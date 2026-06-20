import { BOARD_SIZE } from './engine.js';

function getValidAdjacentCells(row, col, shotGrid) {
  const adjacent = [];
  if (row > 0 && shotGrid[row - 1][col] === null) adjacent.push({ r: row - 1, c: col });
  if (row < BOARD_SIZE - 1 && shotGrid[row + 1][col] === null) adjacent.push({ r: row + 1, c: col });
  if (col > 0 && shotGrid[row][col - 1] === null) adjacent.push({ r: row, c: col - 1 });
  if (col < BOARD_SIZE - 1 && shotGrid[row][col + 1] === null) adjacent.push({ r: row, c: col + 1 });
  return adjacent;
}

export function getBotMove(shotGrid, difficulty = 3, targetGrid, targetShips) {
  const candidates = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (shotGrid[r][c] === null) {
        candidates.push({ r, c });
      }
    }
  }

  if (candidates.length === 0) return null;

  if (difficulty === 1) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Find all live hits grouped by ship ID
  const liveHitsByShip = {};
  if (targetGrid && targetShips) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shotGrid[r][c] === 'hit') {
          const shipId = targetGrid[r][c];
          if (shipId && targetShips[shipId] && !targetShips[shipId].sunk) {
            if (!liveHitsByShip[shipId]) {
              liveHitsByShip[shipId] = [];
            }
            liveHitsByShip[shipId].push({ r, c });
          }
        }
      }
    }
  } else {
    const fallbackHits = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shotGrid[r][c] === 'hit') {
          const adj = getValidAdjacentCells(r, c, shotGrid);
          if (adj.length > 0) {
            fallbackHits.push({ r, c });
          }
        }
      }
    }
    if (fallbackHits.length > 0) {
      liveHitsByShip['unknown'] = fallbackHits;
    }
  }

  const shipIds = Object.keys(liveHitsByShip);

  if (shipIds.length > 0) {
    // Focus on the first ship we found that is unsunk
    const shipId = shipIds[0];
    const hits = liveHitsByShip[shipId];

    if (difficulty >= 4 && hits.length > 1 && shipId !== 'unknown') {
      // Axis detection
      const isHorizontal = hits[0].r === hits[1].r;
      const validTargets = [];

      if (isHorizontal) {
        // Sort by column
        hits.sort((a, b) => a.c - b.c);
        const minC = hits[0].c;
        const maxC = hits[hits.length - 1].c;
        const r = hits[0].r;

        if (minC > 0 && shotGrid[r][minC - 1] === null) validTargets.push({ r, c: minC - 1 });
        if (maxC < BOARD_SIZE - 1 && shotGrid[r][maxC + 1] === null) validTargets.push({ r, c: maxC + 1 });
      } else {
        // Sort by row
        hits.sort((a, b) => a.r - b.r);
        const minR = hits[0].r;
        const maxR = hits[hits.length - 1].r;
        const c = hits[0].c;

        if (minR > 0 && shotGrid[minR - 1][c] === null) validTargets.push({ r: minR - 1, c });
        if (maxR < BOARD_SIZE - 1 && shotGrid[maxR + 1][c] === null) validTargets.push({ r: maxR + 1, c });
      }

      if (validTargets.length > 0) {
        return validTargets[Math.floor(Math.random() * validTargets.length)];
      }
    }

    // If no valid axis targets or difficulty < 4 or only 1 hit, pick random adjacent
    const allValidAdj = [];
    for (const hit of hits) {
      allValidAdj.push(...getValidAdjacentCells(hit.r, hit.c, shotGrid));
    }

    if (allValidAdj.length > 0) {
      return allValidAdj[Math.floor(Math.random() * allValidAdj.length)];
    }
  }

  // Hunt mode
  if (difficulty === 2) {
    // Pure random hunt
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Difficulty 3, 4, 5 uses parity hunting
  let parity = 2; // Default for diff 3 & 4 (checkerboard)
  if (difficulty === 5 && targetShips) {
    // Find smallest unsunk ship length
    let minLength = 5;
    for (const shipId in targetShips) {
      const ship = targetShips[shipId];
      if (ship && !ship.sunk && typeof ship.length === 'number') {
        minLength = Math.min(minLength, ship.length);
      }
    }
    parity = minLength;
  }

  const parityCandidates = candidates.filter(c => (c.r + c.c) % parity === 0);
  if (parityCandidates.length > 0) {
    return parityCandidates[Math.floor(Math.random() * parityCandidates.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
