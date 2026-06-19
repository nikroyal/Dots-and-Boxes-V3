import { BOARD_SPACES, getPropertiesInSet, isPurchasable } from './board';
import { OPPORTUNITY_CARDS, FORTUNE_CARDS, shuffleDeck } from './cards';

// Upgrades: 0=None, 1=Shed, 2=Shop, 3=Block, 4=Tower
// Max level is 4 (Tower). Note: classic uses 5, but requirements say 4-step progression (Shed, Shop, Block, Tower).
// So base rent -> 1 shed -> 2 shop -> 3 block -> 4 tower
export const MAX_UPGRADE = 4;
export const STARTING_CASH = 1500;

export function createInitialState(players) {
  const gameState = {
    players: players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      isAI: p.isAI || false,
      difficulty: p.difficulty || 'balanced',
      color: p.color || '#cccccc',
      position: 0,
      cash: STARTING_CASH,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      properties: [], // Array of space IDs
      upgrades: {}, // spaceId -> level (1-4)
      mortgaged: [] // Array of space IDs
    })),
    currentPlayerIdx: 0,
    boardSpaces: BOARD_SPACES,
    opportunityDeck: shuffleDeck(OPPORTUNITY_CARDS),
    fortuneDeck: shuffleDeck(FORTUNE_CARDS),
    turnPhase: 'roll', // roll, move, action, end
    doublesCount: 0,
    lastDice: [0, 0],
    pendingAction: null, // { type: 'buy', spaceId, amount } or { type: 'card', card }
    auctionState: null,
    tradeState: null,
    log: [],
    winner: null
  };
  return gameState;
}

export function rollDice(state) {
  if (state.turnPhase !== 'roll') return state;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const isDoubles = d1 === d2;

  let newState = structuredClone(state);
  newState.lastDice = [d1, d2];
  const cp = newState.players[newState.currentPlayerIdx];

  if (cp.inJail) {
    if (isDoubles) {
      newState = releaseFromJail(newState, cp.id, true);
      newState = movePlayer(newState, cp.id, d1 + d2);
    } else {
      const pIdx = newState.players.findIndex(p => p.id === cp.id);
      newState.players[pIdx].jailTurns += 1;
      if (newState.players[pIdx].jailTurns >= 3) {
        // Forced to pay
        newState = pay(newState, cp.id, 50, null, 'Jail Release Fee');
        newState = releaseFromJail(newState, cp.id, false);
        newState = movePlayer(newState, cp.id, d1 + d2);
      } else {
        newState.turnPhase = 'end';
      }
    }
  } else {
    if (isDoubles) {
      newState.doublesCount += 1;
      if (newState.doublesCount >= 3) {
        newState = sendToJail(newState, cp.id);
        newState.turnPhase = 'end';
        return newState;
      }
    } else {
      newState.doublesCount = 0;
    }
    newState = movePlayer(newState, cp.id, d1 + d2);
  }

  return newState;
}

export function movePlayer(state, playerId, amount) {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  let cp = newState.players[pIdx];

  let newPos = cp.position + amount;

  if (newPos >= 40) {
    newPos = newPos % 40;
    newState = addCash(newState, playerId, 200, 'Passed Start Gate');
  } else if (newPos < 0) {
    newPos = 40 + newPos; // For moving backward
  }

  newState.players[pIdx].position = newPos;
  newState = resolveSpace(newState, playerId, newPos);

  return newState;
}

export function resolveSpace(state, playerId, spaceId) {
  let newState = structuredClone(state);
  const space = newState.boardSpaces[spaceId];
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  const cp = newState.players[pIdx];

  if (space.type === 'property' || space.type === 'transit' || space.type === 'infrastructure') {
    const ownerId = getOwner(newState, spaceId);
    if (!ownerId) {
      newState.pendingAction = { type: 'buy', spaceId, amount: space.price };
      newState.turnPhase = 'action';
    } else if (ownerId !== playerId) {
      const owner = newState.players.find(p => p.id === ownerId);
      if (!owner.mortgaged.includes(spaceId)) {
         const rent = calculateRent(newState, spaceId, newState.lastDice[0] + newState.lastDice[1]);
         newState = pay(newState, playerId, rent, ownerId, `Rent for ${space.name}`);
         newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
      } else {
         newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
      }
    } else {
      newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
    }
  } else if (space.type === 'tax') {
    newState = pay(newState, playerId, space.amount, null, space.name);
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (space.type === 'chance') {
    newState = drawCard(newState, playerId, 'opportunity');
  } else if (space.type === 'chest') {
    newState = drawCard(newState, playerId, 'fortune');
  } else if (space.type === 'corner') {
    if (space.cornerType === 'gotojail') {
      newState = sendToJail(newState, playerId);
      newState.turnPhase = 'end';
    } else {
      newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
    }
  }

  return newState;
}

export function drawCard(state, playerId, deckType) {
  let newState = structuredClone(state);
  let deck = deckType === 'opportunity' ? newState.opportunityDeck : newState.fortuneDeck;
  if (deck.length === 0) return newState; // Should reshuffle in reality, simplified here

  const card = deck.shift();
  // We'll just put it back at the bottom for simplicity unless it's get out of jail
  if (card.action !== 'get_out_of_jail') {
    deck.push(card);
  } else {
    const pIdx = newState.players.findIndex(p => p.id === playerId);
    newState.players[pIdx].getOutOfJailCards += 1;
  }

  newState.pendingAction = { type: 'card', card, deckType };
  newState.turnPhase = 'action';

  return newState;
}

export function resolveCard(state) {
  let newState = structuredClone(state);
  if (!newState.pendingAction || newState.pendingAction.type !== 'card') return newState;

  const card = newState.pendingAction.card;
  const playerId = newState.players[newState.currentPlayerIdx].id;
  newState.pendingAction = null;

  if (card.action === 'advance') {
    const cp = newState.players[newState.currentPlayerIdx];
    let amount = card.target - cp.position;
    if (amount < 0) amount += 40;
    newState = movePlayer(newState, playerId, amount);
  } else if (card.action === 'advance_nearest') {
    const cp = newState.players[newState.currentPlayerIdx];
    let targetId = -1;
    for (let i=1; i<=40; i++) {
       const sid = (cp.position + i) % 40;
       if (newState.boardSpaces[sid].type === card.typeTarget) {
         targetId = sid;
         break;
       }
    }
    if (targetId !== -1) {
       let amount = targetId - cp.position;
       if (amount < 0) amount += 40;
       // Mark special modifier for rent calculation if needed (omitted for simplicity, but a proper engine would flag this turn for double rent)
       newState = movePlayer(newState, playerId, amount);
    }
  } else if (card.action === 'collect') {
    newState = addCash(newState, playerId, card.amount, `Card: ${card.text}`);
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (card.action === 'pay') {
    newState = pay(newState, playerId, card.amount, null, `Card: ${card.text}`);
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (card.action === 'move') {
    newState = movePlayer(newState, playerId, card.amount);
  } else if (card.action === 'gotojail') {
    newState = sendToJail(newState, playerId);
    newState.turnPhase = 'end';
  } else if (card.action === 'collect_players') {
    newState.players.forEach(p => {
      if (p.id !== playerId && !p.bankrupt) {
         newState = pay(newState, p.id, card.amount, playerId, 'Birthday');
      }
    });
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (card.action === 'pay_players') {
    newState.players.forEach(p => {
      if (p.id !== playerId && !p.bankrupt) {
         newState = pay(newState, playerId, card.amount, p.id, 'Chairman');
      }
    });
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (card.action === 'repairs') {
    const cp = newState.players[newState.currentPlayerIdx];
    let cost = 0;
    cp.properties.forEach(pid => {
      const lvl = cp.upgrades[pid] || 0;
      if (lvl > 0 && lvl < 4) cost += (card.shedCost * lvl);
      if (lvl === 4) cost += card.towerCost;
    });
    if (cost > 0) newState = pay(newState, playerId, cost, null, 'Repairs');
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  } else if (card.action === 'get_out_of_jail') {
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  }

  return newState;
}

export function calculateRent(state, spaceId, diceRoll) {
  const space = state.boardSpaces[spaceId];
  const ownerId = getOwner(state, spaceId);
  if (!ownerId) return 0;

  const owner = state.players.find(p => p.id === ownerId);

  if (owner.mortgaged.includes(spaceId)) return 0;

  if (space.type === 'transit') {
    const ownedTransit = owner.properties.filter(id => state.boardSpaces[id].type === 'transit' && !owner.mortgaged.includes(id)).length;
    if (ownedTransit === 1) return 25;
    if (ownedTransit === 2) return 50;
    if (ownedTransit === 3) return 100;
    if (ownedTransit === 4) return 200;
    return 0;
  }

  if (space.type === 'infrastructure') {
    const ownedInfra = owner.properties.filter(id => state.boardSpaces[id].type === 'infrastructure' && !owner.mortgaged.includes(id)).length;
    if (ownedInfra === 1) return diceRoll * 4;
    if (ownedInfra === 2) return diceRoll * 10;
    return 0;
  }

  if (space.type === 'property') {
    const level = owner.upgrades[spaceId] || 0;
    if (level > 0) {
      return space.rents[level - 1]; // 1=shed(rents[0]), etc. rents[0] is shed rent
    }

    // Check for monopoly
    const setProps = getPropertiesInSet(space.setId);
    const hasMonopoly = setProps.every(id => owner.properties.includes(id));
    if (hasMonopoly) {
      return space.baseRent * 2;
    }
    return space.baseRent;
  }

  return 0;
}

export function getOwner(state, spaceId) {
  for (const p of state.players) {
    if (p.properties.includes(spaceId)) return p.id;
  }
  return null;
}

export function buyProperty(state, playerId, spaceId) {
  let newState = structuredClone(state);
  const space = newState.boardSpaces[spaceId];
  const pIdx = newState.players.findIndex(p => p.id === playerId);

  if (newState.players[pIdx].cash >= space.price) {
    newState.players[pIdx].cash -= space.price;
    newState.players[pIdx].properties.push(spaceId);
    newState.pendingAction = null;
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  }
  return newState;
}

export function declineBuy(state) {
  let newState = structuredClone(state);
  if (newState.pendingAction && newState.pendingAction.type === 'buy') {
    // Start Auction
    newState.auctionState = {
      spaceId: newState.pendingAction.spaceId,
      highestBid: 0,
      highestBidder: null,
      activeBidders: newState.players.filter(p => !p.bankrupt).map(p => p.id)
    };
    newState.pendingAction = null;
  }
  return newState;
}

export function bidAuction(state, playerId, amount) {
  let newState = structuredClone(state);
  if (newState.auctionState) {
    if (amount > newState.auctionState.highestBid) {
      const p = newState.players.find(pl => pl.id === playerId);
      if (p && p.cash >= amount) {
        newState.auctionState.highestBid = amount;
        newState.auctionState.highestBidder = playerId;
      }
    }
  }
  return newState;
}

export function passAuction(state, playerId) {
  let newState = structuredClone(state);
  if (newState.auctionState) {
    newState.auctionState.activeBidders = newState.auctionState.activeBidders.filter(id => id !== playerId);
    const isSoleBidderHighest = newState.auctionState.activeBidders[0] === newState.auctionState.highestBidder;
    if (newState.auctionState.activeBidders.length === 0 || (newState.auctionState.activeBidders.length === 1 && isSoleBidderHighest)) {
       newState = resolveAuction(newState);
    }
  }
  return newState;
}

export function resolveAuction(state) {
  let newState = structuredClone(state);
  if (newState.auctionState) {
    const { spaceId, highestBid, highestBidder } = newState.auctionState;
    if (highestBidder) {
      const pIdx = newState.players.findIndex(p => p.id === highestBidder);
      newState.players[pIdx].cash -= highestBid;
      newState.players[pIdx].properties.push(spaceId);
    }
    newState.auctionState = null;
    newState.turnPhase = newState.doublesCount > 0 ? 'roll' : 'end';
  }
  return newState;
}

export function mortgageProperty(state, playerId, spaceId) {
  const pIdx = state.players.findIndex(p => p.id === playerId);
  const cp = state.players[pIdx];
  const space = state.boardSpaces[spaceId];

  if (!cp.properties.includes(spaceId)) return state;
  if (cp.mortgaged.includes(spaceId)) return state;

  // Cannot mortgage if ANY property in the set has upgrades
  if (space.type === 'property') {
    const setProps = getPropertiesInSet(space.setId);
    const setHasUpgrades = setProps.some(pid => cp.upgrades[pid] > 0);
    if (setHasUpgrades) return state;
  }

  let newState = structuredClone(state);
  newState.players[pIdx].mortgaged.push(spaceId);
  newState.players[pIdx].cash += Math.floor(space.price / 2);

  return newState;
}

export function unmortgageProperty(state, playerId, spaceId) {
  const pIdx = state.players.findIndex(p => p.id === playerId);
  const cp = state.players[pIdx];
  const space = state.boardSpaces[spaceId];

  if (!cp.mortgaged.includes(spaceId)) return state;

  const cost = Math.floor((space.price / 2) * 1.1); // 10% interest
  if (cp.cash < cost) return state;

  let newState = structuredClone(state);
  newState.players[pIdx].cash -= cost;
  newState.players[pIdx].mortgaged = newState.players[pIdx].mortgaged.filter(id => id !== spaceId);

  return newState;
}

export function upgradeProperty(state, playerId, spaceId) {
  const pIdx = state.players.findIndex(p => p.id === playerId);
  const cp = state.players[pIdx];
  const space = state.boardSpaces[spaceId];

  // Validate owner
  if (!cp.properties.includes(spaceId)) return state;

  // Validate monopoly
  const setProps = getPropertiesInSet(space.setId);
  const hasMonopoly = setProps.every(id => cp.properties.includes(id));
  if (!hasMonopoly) return state;

  // Validate cost
  if (cp.cash < space.upgradeCost) return state;

  const currentLevel = cp.upgrades[spaceId] || 0;
  if (currentLevel >= 4) return state;

  // Validate even build (simplified: just ensure we aren't building a level N+1 when another is < N)
  // Standard rule: can't build level 2 if any in set is level 0
  const levels = setProps.map(id => cp.upgrades[id] || 0);
  const minLevel = Math.min(...levels);
  if (currentLevel > minLevel) return state; // Need to build evenly

  let newState = structuredClone(state);
  newState.players[pIdx].cash -= space.upgradeCost;
  newState.players[pIdx].upgrades[spaceId] = currentLevel + 1;

  return newState;
}

export function sellUpgrade(state, playerId, spaceId) {
  const pIdx = state.players.findIndex(p => p.id === playerId);
  const cp = state.players[pIdx];
  const space = state.boardSpaces[spaceId];

  if (!cp.properties.includes(spaceId)) return state;

  const currentLevel = cp.upgrades[spaceId] || 0;
  if (currentLevel <= 0) return state;

  // Validate even sell: can't sell if another property in the set has a higher upgrade level
  const setProps = getPropertiesInSet(space.setId);
  const levels = setProps.map(id => cp.upgrades[id] || 0);
  const maxLevel = Math.max(...levels);

  if (currentLevel < maxLevel) return state; // Must sell evenly

  let newState = structuredClone(state);
  newState.players[pIdx].upgrades[spaceId] = currentLevel - 1;
  newState.players[pIdx].cash += Math.floor(space.upgradeCost / 2);

  return newState;
}

export function pay(state, playerId, amount, toPlayerId = null, reason = '') {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);

  newState.players[pIdx].cash -= amount;

  if (toPlayerId) {
    const toIdx = newState.players.findIndex(p => p.id === toPlayerId);
    newState.players[toIdx].cash += amount;
  }

  if (newState.players[pIdx].cash < 0) {
    // Instead of instant bankruptcy, we place the player in debt.
    newState.debtState = {
      playerId,
      creditorId: toPlayerId,
      amountOwed: Math.abs(newState.players[pIdx].cash) // To be positive
    };
  }

  return newState;
}

export function declareBankruptcy(state, playerId) {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  const cp = newState.players[pIdx];

  cp.bankrupt = true;
  cp.upgrades = {};

  if (newState.debtState && newState.debtState.playerId === playerId) {
    const creditorId = newState.debtState.creditorId;
    if (creditorId) {
       const toIdx = newState.players.findIndex(p => p.id === creditorId);
       newState.players[toIdx].properties.push(...cp.properties);
    }
    newState.debtState = null;
  }

  cp.properties = [];
  cp.cash = 0;

  // Check win condition
  const activePlayers = newState.players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    newState.winner = activePlayers[0].id;
  } else {
    // If it's this player's turn, force end turn
    if (newState.currentPlayerIdx === pIdx) {
      newState.turnPhase = 'end';
      newState = endTurn(newState);
    }
  }

  return newState;
}

export function resolveDebt(state, playerId) {
  let newState = structuredClone(state);
  if (newState.debtState && newState.debtState.playerId === playerId) {
    const cp = newState.players.find(p => p.id === playerId);
    if (cp.cash >= 0) {
      newState.debtState = null;
    }
  }
  return newState;
}

export function addCash(state, playerId, amount, reason = '') {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  newState.players[pIdx].cash += amount;
  return newState;
}

export function sendToJail(state, playerId) {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  newState.players[pIdx].inJail = true;
  newState.players[pIdx].jailTurns = 0;
  newState.players[pIdx].position = 10; // Holding Cell
  return newState;
}

export function releaseFromJail(state, playerId, free = true) {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  newState.players[pIdx].inJail = false;
  newState.players[pIdx].jailTurns = 0;
  return newState;
}

export function useGetOutOfJailCard(state, playerId) {
  let newState = structuredClone(state);
  const pIdx = newState.players.findIndex(p => p.id === playerId);
  if (newState.players[pIdx].getOutOfJailCards > 0 && newState.players[pIdx].inJail) {
    newState.players[pIdx].getOutOfJailCards -= 1;
    newState = releaseFromJail(newState, playerId, true);
  }
  return newState;
}

export function proposeTrade(state, proposerId, targetId, offer, request) {
  // offer/request structure: { cash: 0, properties: [pid1, pid2], getOutOfJailCards: 0 }
  let newState = structuredClone(state);
  newState.tradeState = {
    proposerId,
    targetId,
    offer,
    request
  };
  return newState;
}

export function cancelTrade(state) {
  let newState = structuredClone(state);
  newState.tradeState = null;
  return newState;
}

export function rejectTrade(state) {
  let newState = structuredClone(state);
  newState.tradeState = null;
  return newState;
}

export function acceptTrade(state, playerId) {
  let newState = structuredClone(state);
  if (!newState.tradeState || newState.tradeState.targetId !== playerId) return newState;

  const { proposerId, targetId, offer, request } = newState.tradeState;
  const p1 = newState.players.findIndex(p => p.id === proposerId);
  const p2 = newState.players.findIndex(p => p.id === targetId);
  if (p1 === -1 || p2 === -1) return newState;

  // Validate one last time
  if (newState.players[p1].cash < offer.cash || newState.players[p2].cash < request.cash) return newState;

  // Execute Offer transfer (Proposer -> Target)
  newState.players[p1].cash -= offer.cash;
  newState.players[p2].cash += offer.cash;

  newState.players[p1].getOutOfJailCards -= offer.getOutOfJailCards;
  newState.players[p2].getOutOfJailCards += offer.getOutOfJailCards;

  offer.properties.forEach(pid => {
    newState.players[p1].properties = newState.players[p1].properties.filter(id => id !== pid);
    newState.players[p2].properties.push(pid);
  });

  // Execute Request transfer (Target -> Proposer)
  newState.players[p2].cash -= request.cash;
  newState.players[p1].cash += request.cash;

  newState.players[p2].getOutOfJailCards -= request.getOutOfJailCards;
  newState.players[p1].getOutOfJailCards += request.getOutOfJailCards;

  request.properties.forEach(pid => {
    newState.players[p2].properties = newState.players[p2].properties.filter(id => id !== pid);
    newState.players[p1].properties.push(pid);
  });

  newState.tradeState = null;
  return newState;
}

export function endTurn(state) {
  let newState = structuredClone(state);
  if (newState.turnPhase !== 'end') return newState;

  if (newState.doublesCount > 0 && !newState.players[newState.currentPlayerIdx].inJail) {
    newState.turnPhase = 'roll';
  } else {
    newState.doublesCount = 0;
    do {
      newState.currentPlayerIdx = (newState.currentPlayerIdx + 1) % newState.players.length;
    } while (newState.players[newState.currentPlayerIdx].bankrupt);
    newState.turnPhase = 'roll';
  }
  return newState;
}
