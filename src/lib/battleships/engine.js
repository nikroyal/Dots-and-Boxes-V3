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
    const validPlacements = [];
    let maxScore = -Infinity;

    for (let isVertical of [true, false]) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (canPlaceShip(grid, ship.length, row, col, isVertical)) {
            let score = 0;
            const cells = [];
            if (isVertical) {
              for (let i = 0; i < ship.length; i++) cells.push({ r: row + i, c: col });
            } else {
              for (let i = 0; i < ship.length; i++) cells.push({ r: row, c: col + i });
            }

            for (const { r, c } of cells) {
              // Edge penalty
              if (r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1) {
                score -= 1;
              }

              // Adjacency penalty (clumping)
              const adjacents = [
                { r: r - 1, c }, { r: r + 1, c },
                { r, c: c - 1 }, { r, c: c + 1 }
              ];
              for (const adj of adjacents) {
                if (adj.r >= 0 && adj.r < BOARD_SIZE && adj.c >= 0 && adj.c < BOARD_SIZE) {
                  if (grid[adj.r][adj.c] !== null) {
                    score -= 1;
                  }
                }
              }
            }

            if (score > maxScore) {
              maxScore = score;
            }

            validPlacements.push({ row, col, isVertical, score });
          }
        }
      }
    }

    const bestPlacements = validPlacements.filter(p => p.score === maxScore);
    const chosen = bestPlacements[Math.floor(Math.random() * bestPlacements.length)];
    grid = placeShip(grid, ship.length, chosen.row, chosen.col, chosen.isVertical, ship.id);
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
