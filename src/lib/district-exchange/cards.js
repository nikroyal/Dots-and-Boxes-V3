// Card definitions for Opportunity and Fortune decks

export const OPPORTUNITY_CARDS = [
  { id: 'opp_1', text: 'Advance to Start Gate. Collect 200 Credits.', action: 'advance', target: 0 },
  { id: 'opp_2', text: 'Advance to Promendade. If you pass Start Gate, collect 200 Credits.', action: 'advance', target: 24 },
  { id: 'opp_3', text: 'Take a trip to South Transit Hub. If you pass Start Gate, collect 200 Credits.', action: 'advance', target: 25 },
  { id: 'opp_4', text: 'Advance to Apex Tower.', action: 'advance', target: 39 },
  { id: 'opp_5', text: 'Take a ride to the nearest Transit Hub. If unowned, you may buy it. If owned, pay double rent.', action: 'advance_nearest', typeTarget: 'transit', multiplier: 2 },
  { id: 'opp_6', text: 'Advance to nearest Infrastructure. If unowned, you may buy it. If owned, throw dice and pay owner 10 times the amount thrown.', action: 'advance_nearest', typeTarget: 'infrastructure', multiplier: 10 },
  { id: 'opp_7', text: 'Bank pays you dividend of 50 Credits.', action: 'collect', amount: 50 },
  { id: 'opp_8', text: 'Release from Holding Cell. This card may be kept until needed or traded.', action: 'get_out_of_jail' },
  { id: 'opp_9', text: 'Go back 3 spaces.', action: 'move', amount: -3 },
  { id: 'opp_10', text: 'Go directly to Holding Cell. Do not pass Start Gate, do not collect 200 Credits.', action: 'gotojail' },
  { id: 'opp_11', text: 'Make general repairs on all your property: For each Shed pay 25 Credits, for each Tower pay 100 Credits.', action: 'repairs', shedCost: 25, towerCost: 100 },
  { id: 'opp_12', text: 'Speeding fine 15 Credits.', action: 'pay', amount: 15 },
  { id: 'opp_13', text: 'Take a walk on the Silk Road. Advance token to Silk Road.', action: 'advance', target: 13 },
  { id: 'opp_14', text: 'You have been elected Chairman of the Board. Pay each player 50 Credits.', action: 'pay_players', amount: 50 },
  { id: 'opp_15', text: 'Your building loan matures. Collect 150 Credits.', action: 'collect', amount: 150 },
  { id: 'opp_16', text: 'You have won a crossword competition. Collect 100 Credits.', action: 'collect', amount: 100 }
];

export const FORTUNE_CARDS = [
  { id: 'fort_1', text: 'Advance to Start Gate. Collect 200 Credits.', action: 'advance', target: 0 },
  { id: 'fort_2', text: 'Bank error in your favor. Collect 200 Credits.', action: 'collect', amount: 200 },
  { id: 'fort_3', text: 'Doctor\'s fee. Pay 50 Credits.', action: 'pay', amount: 50 },
  { id: 'fort_4', text: 'From sale of stock you get 50 Credits.', action: 'collect', amount: 50 },
  { id: 'fort_5', text: 'Release from Holding Cell. This card may be kept until needed or traded.', action: 'get_out_of_jail' },
  { id: 'fort_6', text: 'Go directly to Holding Cell. Do not pass Start Gate, do not collect 200 Credits.', action: 'gotojail' },
  { id: 'fort_7', text: 'Holiday fund matures. Receive 100 Credits.', action: 'collect', amount: 100 },
  { id: 'fort_8', text: 'Income tax refund. Collect 20 Credits.', action: 'collect', amount: 20 },
  { id: 'fort_9', text: 'It is your birthday. Collect 10 Credits from every player.', action: 'collect_players', amount: 10 },
  { id: 'fort_10', text: 'Life insurance matures. Collect 100 Credits.', action: 'collect', amount: 100 },
  { id: 'fort_11', text: 'Pay hospital fees of 100 Credits.', action: 'pay', amount: 100 },
  { id: 'fort_12', text: 'Pay school fees of 50 Credits.', action: 'pay', amount: 50 },
  { id: 'fort_13', text: 'Receive 25 Credits consultancy fee.', action: 'collect', amount: 25 },
  { id: 'fort_14', text: 'You are assessed for street repairs. 40 Credits per Shed, 115 Credits per Tower.', action: 'repairs', shedCost: 40, towerCost: 115 },
  { id: 'fort_15', text: 'You have won second prize in a beauty contest. Collect 10 Credits.', action: 'collect', amount: 10 },
  { id: 'fort_16', text: 'You inherit 100 Credits.', action: 'collect', amount: 100 }
];

export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}
