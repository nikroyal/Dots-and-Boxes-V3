export const BOARD_SIZE = 10;

export const SHIPS = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
];

export function createEmptyGrid() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

export function canPlaceShip(grid, length, row, col, isVertical) {
  if (isVertical) {
    if (row + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (grid[row + i][col] !== null) return false;
    }
  } else {
    if (col + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (grid[row][col + i] !== null) return false;
    }
  }
  return true;
}

export function placeShip(grid, length, row, col, isVertical, shipId) {
  const newGrid = grid.map(r => [...r]);
  if (isVertical) {
    for (let i = 0; i < length; i++) {
      newGrid[row + i][col] = shipId;
    }
  } else {
    for (let i = 0; i < length; i++) {
      newGrid[row][col + i] = shipId;
    }
  }
  return newGrid;
}

export function generateRandomBotGrid() {
  let grid = createEmptyGrid();
  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const isVertical = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);

      if (canPlaceShip(grid, ship.length, row, col, isVertical)) {
        grid = placeShip(grid, ship.length, row, col, isVertical, ship.id);
        placed = true;
      }
    }
  }
  return grid;
}

export function createInitialShipsState() {
  const state = {};
  for (const ship of SHIPS) {
    state[ship.id] = { hits: 0, length: ship.length, sunk: false };
  }
  return state;
}

export function processShot(targetGrid, shotGrid, opponentShips, row, col) {
  // Can't shoot same spot twice
  if (shotGrid[row][col] !== null) {
    return { valid: false };
  }

  const newShotGrid = shotGrid.map(r => [...r]);
  const newOpponentShips = { ...opponentShips };
  let hit = false;
  let sunkShipId = null;

  const shipId = targetGrid[row][col];
  if (shipId !== null) {
    // Hit!
    hit = true;
    newShotGrid[row][col] = 'hit';

    // Update ship state
    newOpponentShips[shipId] = { ...newOpponentShips[shipId], hits: newOpponentShips[shipId].hits + 1 };
    if (newOpponentShips[shipId].hits === newOpponentShips[shipId].length) {
      newOpponentShips[shipId].sunk = true;
      sunkShipId = shipId;
    }
  } else {
    // Miss!
    newShotGrid[row][col] = 'miss';
  }

  const allSunk = Object.values(newOpponentShips).every(s => s.sunk);

  return {
    valid: true,
    hit,
    sunkShipId,
    newShotGrid,
    newOpponentShips,
    gameOver: allSunk
  };
}

export function generateRandomBoardState() {
  return {
    grid: generateRandomBotGrid(),
    ships: createInitialShipsState()
  };
}
