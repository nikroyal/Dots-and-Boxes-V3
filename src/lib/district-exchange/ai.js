import {
  rollDice,
  buyProperty,
  declineBuy,
  upgradeProperty,
  endTurn,
  resolveCard,
  useGetOutOfJailCard,
  pay,
  releaseFromJail,
  acceptTrade,
  rejectTrade,
  resolveAuction,
  sellUpgrade,
  mortgageProperty,
  resolveDebt,
  declareBankruptcy
} from './engine';

import { getPropertiesInSet } from './board';

// A simple AI that plays the game automatically
export function playAITurn(state) {
  let newState = { ...state };
  const cp = newState.players[newState.currentPlayerIdx];

  if (!cp.isAI) return newState;
  if (cp.bankrupt) return newState;

  const difficulty = cp.difficulty || 'balanced';

  // Handle Debt / Bankruptcy
  if (newState.debtState && newState.debtState.playerId === cp.id) {
    // 1. Try selling upgrades
    const propsWithUpgrades = cp.properties.filter(pid => (cp.upgrades[pid] || 0) > 0);
    for (const pid of propsWithUpgrades) {
      if (cp.cash >= 0) break;
      newState = sellUpgrade(newState, cp.id, pid);
    }

    // 2. Try mortgaging
    if (cp.cash < 0) {
      const mortgageable = cp.properties.filter(pid => !cp.mortgaged.includes(pid) && (cp.upgrades[pid] || 0) === 0);
      for (const pid of mortgageable) {
        if (cp.cash >= 0) break;
        newState = mortgageProperty(newState, cp.id, pid);
      }
    }

    // 3. Resolve or Bankrupt
    if (cp.cash >= 0) {
      newState = resolveDebt(newState, cp.id);
    } else {
      newState = declareBankruptcy(newState, cp.id);
    }
    return newState;
  }

  // Handle Action Phase
  if (newState.turnPhase === 'action') {
    if (newState.pendingAction) {
      if (newState.pendingAction.type === 'buy') {
        const space = newState.boardSpaces[newState.pendingAction.spaceId];

        let shouldBuy = false;

        if (difficulty === 'aggressive') {
           // Aggressive: Buy everything they can afford
           shouldBuy = cp.cash > space.price;
        } else if (difficulty === 'cautious') {
           // Cautious: Buy only if it leaves a large safety net (e.g. 2x price)
           shouldBuy = cp.cash >= space.price * 2;
        } else {
           // Balanced: Buy if it leaves some safety net, or if it's cheap
           shouldBuy = cp.cash >= space.price * 1.5 || cp.cash > 800;
        }

        if (shouldBuy) {
          newState = buyProperty(newState, cp.id, space.id);
        } else {
          newState = declineBuy(newState);
        }
      } else if (newState.pendingAction.type === 'card') {
        newState = resolveCard(newState);
      }
    }
    return newState;
  }


  // Handle Upgrades before rolling or ending
  // Strategy: If we have a monopoly and decent cash, upgrade evenly
  let madeUpgrade = false;
  const sets = ['harbor', 'neon', 'market', 'gardens', 'riverfront', 'foundry', 'summit', 'skyline'];

  for (const setId of sets) {
    const setProps = getPropertiesInSet(setId);
    const hasMonopoly = setProps.length > 0 && setProps.every(id => cp.properties.includes(id));

    if (hasMonopoly) {
      for (const pid of setProps) {
        const space = newState.boardSpaces[pid];

        let shouldUpgrade = false;
        if (difficulty === 'aggressive') {
           shouldUpgrade = cp.cash > space.upgradeCost; // Builds as much as possible
        } else if (difficulty === 'cautious') {
           shouldUpgrade = cp.cash >= space.upgradeCost * 3; // Keeps huge cash reserves
        } else {
           shouldUpgrade = cp.cash >= space.upgradeCost * 2; // Balanced
        }

        if (shouldUpgrade) {
           const preState = newState;
           newState = upgradeProperty(newState, cp.id, pid);
           if (newState !== preState) {
             madeUpgrade = true;
             break;
           }
        }
      }
    }
    if (madeUpgrade) break;
  }

  // Handle Jail
  if (cp.inJail && newState.turnPhase === 'roll') {
    if (cp.getOutOfJailCards > 0) {
      newState = useGetOutOfJailCard(newState, cp.id);
    } else if (cp.cash >= 500) {
      // Just pay to get out if rich
      newState = pay(newState, cp.id, 50, null, 'Jail Release Fee');
      newState = releaseFromJail(newState, cp.id, false);
    }
  }

  // Handle Roll
  if (newState.turnPhase === 'roll' && !madeUpgrade) { // Roll if we didn't upgrade
     newState = rollDice(newState);
     return newState;
  }

  // Handle End
  if (newState.turnPhase === 'end' && !madeUpgrade) {
     newState = endTurn(newState);
     return newState;
  }

  return newState;
}

export function evaluateIncomingAITrades(state) {
  let newState = { ...state };
  if (!newState.tradeState) return newState;

  const targetPlayer = newState.players.find(p => p.id === newState.tradeState.targetId);
  if (!targetPlayer || !targetPlayer.isAI) return newState;

  const difficulty = targetPlayer.difficulty || 'balanced';
  const { offer, request } = newState.tradeState;

  let offerValue = offer.cash + (offer.getOutOfJailCards * 50);
  offer.properties.forEach(pid => offerValue += newState.boardSpaces[pid].price);

  let requestValue = request.cash + (request.getOutOfJailCards * 50);
  request.properties.forEach(pid => requestValue += newState.boardSpaces[pid].price);

  let accept = false;

  if (difficulty === 'cautious') {
     accept = offerValue >= requestValue * 1.5;
  } else if (difficulty === 'aggressive') {
     accept = offerValue > requestValue;
     if (request.properties.length > 0) accept = offerValue >= requestValue * 1.2;
  } else {
     accept = offerValue >= requestValue * 1.1;
  }

  if (accept) {
    newState = acceptTrade(newState, targetPlayer.id);
  } else {
    newState = rejectTrade(newState);
  }
  return newState;
}

export function playAIAuction(state) {
  let newState = { ...state };
  if (!newState.auctionState) return newState;

  const { spaceId, highestBid, activeBidders } = newState.auctionState;
  const space = newState.boardSpaces[spaceId];

  let bidsMade = false;

  for (const pid of activeBidders) {
    const p = newState.players.find(x => x.id === pid);
    if (!p.isAI) continue;

    const difficulty = p.difficulty || 'balanced';

    let maxBidRatio = 1.0;
    if (difficulty === 'aggressive') maxBidRatio = 1.5;
    else if (difficulty === 'cautious') maxBidRatio = 0.8;
    else maxBidRatio = 1.2;

    const maxBid = Math.min(p.cash - 50, Math.floor(space.price * maxBidRatio));

    if (highestBid < maxBid && newState.auctionState.highestBidder !== p.id) {
       const bidAmount = highestBid + 10;
       if (bidAmount <= maxBid) {
         newState.auctionState.highestBid = bidAmount;
         newState.auctionState.highestBidder = p.id;
         bidsMade = true;
       }
    }
  }

  if (!bidsMade) {
    // AIs pass if they don't want to bid
    for (const pid of activeBidders) {
      const p = newState.players.find(x => x.id === pid);
      if (p.isAI && newState.auctionState.highestBidder !== p.id) {
         newState.auctionState.activeBidders = newState.auctionState.activeBidders.filter(id => id !== p.id);
      }
    }

    // Crucial fix: resolve auction if only 1 (or 0) bidders remain after AIs pass
    const hasBids = newState.auctionState.highestBidder !== null;
    if (newState.auctionState.activeBidders.length === 0 || (newState.auctionState.activeBidders.length === 1 && hasBids)) {
      newState = resolveAuction(newState);
    }
  }

  return newState;
}
