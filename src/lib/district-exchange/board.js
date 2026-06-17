export const BOARD_SPACES = [
  // Bottom Row (0-10)
  { id: 0, name: 'Start Gate', type: 'corner', cornerType: 'start' },
  { id: 1, name: 'Tide Pools', type: 'property', setId: 'harbor', price: 60, baseRent: 2, rents: [10, 30, 90, 160, 250], upgradeCost: 50 },
  { id: 2, name: 'Opportunity', type: 'chance' },
  { id: 3, name: 'Marina Docks', type: 'property', setId: 'harbor', price: 60, baseRent: 4, rents: [20, 60, 180, 320, 450], upgradeCost: 50 },
  { id: 4, name: 'Processing Fee', type: 'tax', amount: 200 },
  { id: 5, name: 'North Transit Hub', type: 'transit', price: 200 },
  { id: 6, name: 'Alley Way', type: 'property', setId: 'neon', price: 100, baseRent: 6, rents: [30, 90, 270, 400, 550], upgradeCost: 50 },
  { id: 7, name: 'Fortune', type: 'chest' },
  { id: 8, name: 'Glow Street', type: 'property', setId: 'neon', price: 100, baseRent: 6, rents: [30, 90, 270, 400, 550], upgradeCost: 50 },
  { id: 9, name: 'Cyber Avenue', type: 'property', setId: 'neon', price: 120, baseRent: 8, rents: [40, 100, 300, 450, 600], upgradeCost: 50 },
  { id: 10, name: 'Holding Cell', type: 'corner', cornerType: 'jail' },

  // Left Row (11-19)
  { id: 11, name: 'Spice Lane', type: 'property', setId: 'market', price: 140, baseRent: 10, rents: [50, 150, 450, 625, 750], upgradeCost: 100 },
  { id: 12, name: 'Power Grid', type: 'infrastructure', price: 150 },
  { id: 13, name: 'Silk Road', type: 'property', setId: 'market', price: 140, baseRent: 10, rents: [50, 150, 450, 625, 750], upgradeCost: 100 },
  { id: 14, name: 'Grand Bazaar', type: 'property', setId: 'market', price: 160, baseRent: 12, rents: [60, 180, 500, 700, 900], upgradeCost: 100 },
  { id: 15, name: 'East Transit Hub', type: 'transit', price: 200 },
  { id: 16, name: 'Zen Path', type: 'property', setId: 'gardens', price: 180, baseRent: 14, rents: [70, 200, 550, 750, 950], upgradeCost: 100 },
  { id: 17, name: 'Fortune', type: 'chest' },
  { id: 18, name: 'Lotus Pond', type: 'property', setId: 'gardens', price: 180, baseRent: 14, rents: [70, 200, 550, 750, 950], upgradeCost: 100 },
  { id: 19, name: 'Orchid Conservatory', type: 'property', setId: 'gardens', price: 200, baseRent: 16, rents: [80, 220, 600, 800, 1000], upgradeCost: 100 },

  // Top Row (20-30)
  { id: 20, name: 'Relief Park', type: 'corner', cornerType: 'parking' },
  { id: 21, name: 'Delta Bank', type: 'property', setId: 'riverfront', price: 220, baseRent: 18, rents: [90, 250, 700, 875, 1050], upgradeCost: 150 },
  { id: 22, name: 'Opportunity', type: 'chance' },
  { id: 23, name: 'Canal Street', type: 'property', setId: 'riverfront', price: 220, baseRent: 18, rents: [90, 250, 700, 875, 1050], upgradeCost: 150 },
  { id: 24, name: 'Promenade', type: 'property', setId: 'riverfront', price: 240, baseRent: 20, rents: [100, 300, 750, 925, 1100], upgradeCost: 150 },
  { id: 25, name: 'South Transit Hub', type: 'transit', price: 200 },
  { id: 26, name: 'Scrap Yard', type: 'property', setId: 'foundry', price: 260, baseRent: 22, rents: [110, 330, 800, 975, 1150], upgradeCost: 150 },
  { id: 27, name: 'Steel Works', type: 'property', setId: 'foundry', price: 260, baseRent: 22, rents: [110, 330, 800, 975, 1150], upgradeCost: 150 },
  { id: 28, name: 'Water Works', type: 'infrastructure', price: 150 },
  { id: 29, name: 'Assembly Line', type: 'property', setId: 'foundry', price: 280, baseRent: 24, rents: [120, 360, 850, 1025, 1200], upgradeCost: 150 },
  { id: 30, name: 'Compliance Office', type: 'corner', cornerType: 'gotojail' },

  // Right Row (31-39)
  { id: 31, name: 'Base Camp', type: 'property', setId: 'summit', price: 300, baseRent: 26, rents: [130, 390, 900, 1100, 1275], upgradeCost: 200 },
  { id: 32, name: 'Ridge Peak', type: 'property', setId: 'summit', price: 300, baseRent: 26, rents: [130, 390, 900, 1100, 1275], upgradeCost: 200 },
  { id: 33, name: 'Fortune', type: 'chest' },
  { id: 34, name: 'Glacier Point', type: 'property', setId: 'summit', price: 320, baseRent: 28, rents: [150, 450, 1000, 1200, 1400], upgradeCost: 200 },
  { id: 35, name: 'West Transit Hub', type: 'transit', price: 200 },
  { id: 36, name: 'Opportunity', type: 'chance' },
  { id: 37, name: 'Cloud Deck', type: 'property', setId: 'skyline', price: 350, baseRent: 35, rents: [175, 500, 1100, 1300, 1500], upgradeCost: 200 },
  { id: 38, name: 'Luxury Tax', type: 'tax', amount: 100 },
  { id: 39, name: 'Apex Tower', type: 'property', setId: 'skyline', price: 400, baseRent: 50, rents: [200, 600, 1400, 1700, 2000], upgradeCost: 200 }
];

export const PROPERTY_SETS = {
  harbor: { name: 'Harbor', color: '#8b5a2b' }, // Brown-ish
  neon: { name: 'Neon', color: '#87ceeb' },    // Light Blue
  market: { name: 'Market', color: '#da70d6' },   // Orchid/Pink
  gardens: { name: 'Gardens', color: '#ffa500' }, // Orange
  riverfront: { name: 'Riverfront', color: '#ff0000' }, // Red
  foundry: { name: 'Foundry', color: '#ffff00' }, // Yellow
  summit: { name: 'Summit', color: '#008000' }, // Green
  skyline: { name: 'Skyline', color: '#0000ff' }  // Blue
};

// Returns array of property IDs that belong to the given set
export function getPropertiesInSet(setId) {
  return BOARD_SPACES.filter(s => s.setId === setId).map(s => s.id);
}

export function isPurchasable(space) {
  return space.type === 'property' || space.type === 'transit' || space.type === 'infrastructure';
}
