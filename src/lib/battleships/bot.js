import { BOARD_SIZE } from './engine.js';

function getValidAdjacentCells(row, col, shotGrid) {
  const adjacent = [];
  if (row > 0 && shotGrid[row - 1][col] === null) adjacent.push({ r: row - 1, c: col });
  if (row < BOARD_SIZE - 1 && shotGrid[row + 1][col] === null) adjacent.push({ r: row + 1, c: col });
  if (col > 0 && shotGrid[row][col - 1] === null) adjacent.push({ r: row, c: col - 1 });
  if (col < BOARD_SIZE - 1 && shotGrid[row][col + 1] === null) adjacent.push({ r: row, c: col + 1 });
  return adjacent;
}

export function getBotMove(shotGrid) {
  // 1. Look for known hits that aren't sunk yet
  // We identify "live hits" as cells marked 'hit' that have adjacent 'null' cells
  const liveHits = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (shotGrid[r][c] === 'hit') {
        const adj = getValidAdjacentCells(r, c, shotGrid);
        if (adj.length > 0) {
          liveHits.push({ r, c, adj });
        }
      }
    }
  }

  if (liveHits.length > 0) {
    // If we have a live hit, pick one and shoot at a random adjacent cell.
    // (A more advanced bot might try to figure out the axis of the ship, but this is good enough)
    // To make it slightly smarter, if we have multiple hits in a line, we could prioritize the ends of the line.

    // Pick the first live hit we find
    const target = liveHits[0];
    const targetAdj = target.adj;
    const move = targetAdj[Math.floor(Math.random() * targetAdj.length)];
    return move;
  }

  // 2. Hunt mode (checkerboard pattern / parity to hunt ships efficiently)
  // Parity logic: to find a size-2 ship, we need to check 1/2 of the board (checkerboard)
  const candidates = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (shotGrid[r][c] === null) {
        // Simple parity: (r + c) % 2 === 0
        // We'll primarily hunt on even parity, but if we exhaust those, we fall back to any null cell
        candidates.push({ r, c, parityMatch: (r + c) % 2 === 0 });
      }
    }
  }

  if (candidates.length === 0) {
     return null; // Should never happen unless game is over
  }

  const parityCandidates = candidates.filter(c => c.parityMatch);
  if (parityCandidates.length > 0) {
    return parityCandidates[Math.floor(Math.random() * parityCandidates.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
