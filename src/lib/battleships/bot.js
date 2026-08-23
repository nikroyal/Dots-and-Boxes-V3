import { BOARD_SIZE, SHIPS } from './engine.js';

function getValidAdjacentCells(row, col, shotGrid) {
  const adjacent = [];
  if (row > 0 && shotGrid[row - 1][col] === null) adjacent.push({ r: row - 1, c: col });
  if (row < BOARD_SIZE - 1 && shotGrid[row + 1][col] === null) adjacent.push({ r: row + 1, c: col });
  if (col > 0 && shotGrid[row][col - 1] === null) adjacent.push({ r: row, c: col - 1 });
  if (col < BOARD_SIZE - 1 && shotGrid[row][col + 1] === null) adjacent.push({ r: row, c: col + 1 });
  return adjacent;
}

function generateHeatmap(shotGrid, targetGrid, targetShips) {
  const heatmap = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));

  let shipsToConsider = SHIPS;
  if (targetShips) {
    shipsToConsider = Object.values(targetShips).filter(s => !s.sunk);
  }

  // Find cells that belong to already sunk ships, because we can't overlap them
  const sunkHitCells = new Set();
  if (targetGrid && targetShips) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shotGrid[r][c] === 'hit') {
          const shipId = targetGrid[r][c];
          if (shipId && targetShips[shipId] && targetShips[shipId].sunk) {
            sunkHitCells.add(`${r},${c}`);
          }
        }
      }
    }
  }

  for (const ship of shipsToConsider) {
    const len = ship.length;

    // Horizontal placements
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c <= BOARD_SIZE - len; c++) {
        let valid = true;
        for (let i = 0; i < len; i++) {
          if (shotGrid[r][c + i] === 'miss' || sunkHitCells.has(`${r},${c + i}`)) {
            valid = false;
            break;
          }
        }
        if (valid) {
          for (let i = 0; i < len; i++) {
            if (shotGrid[r][c + i] === null) {
              heatmap[r][c + i]++;
            }
          }
        }
      }
    }

    // Vertical placements
    for (let r = 0; r <= BOARD_SIZE - len; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        let valid = true;
        for (let i = 0; i < len; i++) {
          if (shotGrid[r + i][c] === 'miss' || sunkHitCells.has(`${r + i},${c}`)) {
            valid = false;
            break;
          }
        }
        if (valid) {
          for (let i = 0; i < len; i++) {
            if (shotGrid[r + i][c] === null) {
              heatmap[r + i][c]++;
            }
          }
        }
      }
    }
  }

  return heatmap;
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

  // Find all live hits. Group them by their physical clustering since we can't reliably
  // trust perfect ship IDs in standard battleships (although here we use them if available,
  // clustering is the right way to think about it for human-like play).
  const unsunkHits = [];
  const sunkHitCells = new Set();

  if (targetGrid && targetShips) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shotGrid[r][c] === 'hit') {
          const shipId = targetGrid[r][c];
          if (shipId && targetShips[shipId] && targetShips[shipId].sunk) {
            sunkHitCells.add(`${r},${c}`);
          } else {
            unsunkHits.push({r, c});
          }
        }
      }
    }
  } else {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (shotGrid[r][c] === 'hit') {
          unsunkHits.push({r, c});
        }
      }
    }
  }

  // Target Mode: we have active hits!
  if (unsunkHits.length > 0) {
    // 1. Group hits into clusters (adjacent hit cells)
    const clusters = [];
    const visitedHits = new Set();

    for (const hit of unsunkHits) {
      const key = `${hit.r},${hit.c}`;
      if (visitedHits.has(key)) continue;

      const cluster = [];
      const queue = [hit];
      visitedHits.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        cluster.push(curr);

        const adjs = [
          { r: curr.r - 1, c: curr.c },
          { r: curr.r + 1, c: curr.c },
          { r: curr.r, c: curr.c - 1 },
          { r: curr.r, c: curr.c + 1 },
        ];

        for (const adj of adjs) {
          const adjKey = `${adj.r},${adj.c}`;
          if (adj.r >= 0 && adj.r < BOARD_SIZE && adj.c >= 0 && adj.c < BOARD_SIZE) {
            if (shotGrid[adj.r][adj.c] === 'hit' && !sunkHitCells.has(adjKey) && !visitedHits.has(adjKey)) {
              visitedHits.add(adjKey);
              queue.push(adj);
            }
          }
        }
      }
      clusters.push(cluster);
    }

    // Pick a cluster to focus on (e.g., the largest one or the first one)
    // Here we'll just sort to pick the largest cluster
    clusters.sort((a, b) => b.length - a.length);
    const targetCluster = clusters[0];

    const validTargets = [];

    // 2. Infer orientation if we have 2+ hits in the cluster
    if (difficulty >= 4 && targetCluster.length > 1) {
      const isHorizontal = targetCluster.every(h => h.r === targetCluster[0].r);
      const isVertical = targetCluster.every(h => h.c === targetCluster[0].c);

      if (isHorizontal) {
        targetCluster.sort((a, b) => a.c - b.c);
        const minC = targetCluster[0].c;
        const maxC = Array.isArray(targetCluster) && targetCluster.length > 0 ? targetCluster[targetCluster.length - 1].c : minC;
        const r = targetCluster[0].r;

        // Any missing pieces in the middle? (rare but possible with weird overlap)
        for (let c = minC + 1; c < maxC; c++) {
          if (shotGrid[r][c] === null) validTargets.push({ r, c });
        }

        // If solid, check endpoints
        if (validTargets.length === 0) {
          if (minC > 0 && shotGrid[r][minC - 1] === null) validTargets.push({ r, c: minC - 1 });
          if (maxC < BOARD_SIZE - 1 && shotGrid[r][maxC + 1] === null) validTargets.push({ r, c: maxC + 1 });
        }
      } else if (isVertical) {
        targetCluster.sort((a, b) => a.r - b.r);
        const minR = targetCluster[0].r;
        const maxR = Array.isArray(targetCluster) && targetCluster.length > 0 ? targetCluster[targetCluster.length - 1].r : minR;
        const c = targetCluster[0].c;

        for (let r = minR + 1; r < maxR; r++) {
          if (shotGrid[r][c] === null) validTargets.push({ r, c });
        }

        if (validTargets.length === 0) {
          if (minR > 0 && shotGrid[minR - 1][c] === null) validTargets.push({ r: minR - 1, c });
          if (maxR < BOARD_SIZE - 1 && shotGrid[maxR + 1][c] === null) validTargets.push({ r: maxR + 1, c });
        }
      }
    }

    // If we only have 1 hit, or if axis checking yielded no targets (e.g. blocked on both sides),
    // grab all valid adjacencies of the cluster.
    if (validTargets.length === 0) {
      for (const hit of targetCluster) {
        validTargets.push(...getValidAdjacentCells(hit.r, hit.c, shotGrid));
      }
    }

    // Deduplicate valid targets
    const uniqueTargetsMap = new Map();
    for (const t of validTargets) {
      uniqueTargetsMap.set(`${t.r},${t.c}`, t);
    }
    const uniqueTargets = Array.from(uniqueTargetsMap.values());

    if (uniqueTargets.length > 0) {
      if (difficulty >= 4) {
        // Score valid targets using heatmap
        const heatmap = generateHeatmap(shotGrid, targetGrid, targetShips);
        let bestScore = -1;
        let bestTargets = [];
        for (const t of uniqueTargets) {
          const score = heatmap[t.r][t.c];
          if (score > bestScore) {
            bestScore = score;
            bestTargets = [t];
          } else if (score === bestScore) {
            bestTargets.push(t);
          }
        }
        return bestTargets[Math.floor(Math.random() * bestTargets.length)];
      }
      return uniqueTargets[Math.floor(Math.random() * uniqueTargets.length)];
    } else {
      return candidates[Math.floor(Math.random() * candidates.length)];
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
    if (difficulty >= 4) {
      const heatmap = generateHeatmap(shotGrid, targetGrid, targetShips);
      let bestScore = -1;
      let bestCandidates = [];
      for (const c of parityCandidates) {
        const score = heatmap[c.r][c.c];
        if (score > bestScore) {
          bestScore = score;
          bestCandidates = [c];
        } else if (score === bestScore) {
          bestCandidates.push(c);
        }
      }
      if (bestCandidates.length > 0) {
        return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
      }
    }
    return parityCandidates[Math.floor(Math.random() * parityCandidates.length)];
  }

  if (difficulty >= 4) {
    const heatmap = generateHeatmap(shotGrid, targetGrid, targetShips);
    let bestScore = -1;
    let bestCandidates = [];
    for (const c of candidates) {
      const score = heatmap[c.r][c.c];
      if (score > bestScore) {
        bestScore = score;
        bestCandidates = [c];
      } else if (score === bestScore) {
        bestCandidates.push(c);
      }
    }
    if (bestCandidates.length > 0) {
      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
