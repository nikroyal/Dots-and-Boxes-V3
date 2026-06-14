export function createEmptyGame(rows = 3, cols = 3, playerIds = ['p1', 'p2']) {
  return {
    rows,
    cols,
    board: Array(rows).fill(null).map(() => Array(cols).fill(null)),
    currentPlayerIdx: 0,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    moveCount: 0,
    moves: [], // { r, c, by, ts }
    finished: false,
    winnerIdx: null,
    winLine: null,
  };
}

function checkWin(board, r, c, playerId, rows, cols) {
  const winLength = Math.min(5, Math.max(3, Math.min(rows, cols)));

  const dirs = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal
    [1, -1]  // anti-diagonal
  ];

  for (const [dr, dc] of dirs) {
    let count = 1;
    let line = [{ r, c }];

    // Check in the positive direction
    for (let i = 1; i < winLength; i++) {
      const nr = r + i * dr;
      const nc = c + i * dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== playerId) break;
      count++;
      line.push({ r: nr, c: nc });
    }

    // Check in the negative direction
    for (let i = 1; i < winLength; i++) {
      const nr = r - i * dr;
      const nc = c - i * dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== playerId) break;
      count++;
      line.push({ r: nr, c: nc });
    }

    if (count >= winLength) {
      line.sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        return a.c - b.c;
      });
      return { won: true, line };
    }
  }

  return { won: false, line: null };
}

export function applyMove(game, r, c, playerId, playerIds) {
  const newGame = {
    ...game,
    board: game.board.map(row => [...row]),
    scores: { ...game.scores },
    moves: [...game.moves]
  };

  if (r < 0 || r >= newGame.rows || c < 0 || c >= newGame.cols) return { error: 'invalid-coords' };
  if (newGame.board[r][c] !== null) return { error: 'already-played' };

  newGame.board[r][c] = playerId;
  newGame.moveCount++;
  newGame.moves.push({ r, c, by: playerId, ts: Date.now() });

  const { won, line } = checkWin(newGame.board, r, c, playerId, newGame.rows, newGame.cols);

  if (won) {
    newGame.finished = true;
    newGame.winnerIdx = newGame.currentPlayerIdx;
    newGame.scores[playerId]++;
    newGame.winLine = line;
  } else if (newGame.moveCount === newGame.rows * newGame.cols) {
    newGame.finished = true;
    newGame.winnerIdx = -1; // draw
  } else {
    newGame.currentPlayerIdx = (newGame.currentPlayerIdx + 1) % playerIds.length;
  }

  return { newGame, claimed: won ? 1 : 0, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
