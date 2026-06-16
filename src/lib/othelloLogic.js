export function createEmptyGame(rows = 8, cols = 8, playerIds = ['p1', 'p2']) {
  const board = Array(rows).fill(null).map(() => Array(cols).fill(null));

  // Othello initial setup
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);

  if (rows >= 2 && cols >= 2) {
    board[midR - 1][midC - 1] = playerIds[1];
    board[midR][midC] = playerIds[1];
    board[midR - 1][midC] = playerIds[0];
    board[midR][midC - 1] = playerIds[0];
  }

  const scores = Object.fromEntries(playerIds.map(id => [id, 0]));
  scores[playerIds[0]] = 2;
  scores[playerIds[1]] = 2;

  return {
    rows,
    cols,
    board,
    currentPlayerIdx: 0,
    scores,
    moveCount: 0,
    moves: [], // { r, c, by, ts }
    finished: false,
    winnerIdx: null,
  };
}

function getFlips(board, r, c, playerId, opponentId, rows, cols) {
  const flips = [];
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (const [dr, dc] of dirs) {
    let nr = r + dr;
    let nc = c + dc;
    let dirFlips = [];

    while (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === opponentId) {
      dirFlips.push({ r: nr, c: nc });
      nr += dr;
      nc += dc;
    }

    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === playerId) {
      flips.push(...dirFlips);
    }
  }

  return flips;
}

export function hasValidMove(board, playerId, opponentId, rows, cols) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === null && getFlips(board, r, c, playerId, opponentId, rows, cols).length > 0) {
                return true;
            }
        }
    }
    return false;
}

export function applyMove(game, r, c, playerId, playerIds) {
  const newGame = {
    ...game,
    board: game.board.map(row => [...row]),
    scores: { ...game.scores },
    moves: [...game.moves]
  };

  const opponentIdx = (game.currentPlayerIdx + 1) % playerIds.length;
  const opponentId = playerIds[opponentIdx];

  if (r < 0 || r >= newGame.rows || c < 0 || c >= newGame.cols) return { error: 'invalid-coords' };
  if (newGame.board[r][c] !== null) return { error: 'already-played' };

  const flips = getFlips(newGame.board, r, c, playerId, opponentId, newGame.rows, newGame.cols);
  if (flips.length === 0) return { error: 'invalid-move' }; // Must flip at least one piece in Othello

  newGame.board[r][c] = playerId;
  for (const flip of flips) {
      newGame.board[flip.r][flip.c] = playerId;
  }

  newGame.scores[playerId] += flips.length + 1;
  newGame.scores[opponentId] -= flips.length;

  newGame.moveCount++;
  newGame.moves.push({ r, c, by: playerId, ts: Date.now() });

  // Check if opponent has a valid move
  let nextPlayerIdx = opponentIdx;
  let nextPlayerId = opponentId;

  if (!hasValidMove(newGame.board, nextPlayerId, playerId, newGame.rows, newGame.cols)) {
      // Opponent has no valid moves, check if current player has another move
      nextPlayerIdx = newGame.currentPlayerIdx;
      nextPlayerId = playerId;

      if (!hasValidMove(newGame.board, nextPlayerId, opponentId, newGame.rows, newGame.cols)) {
          // Neither player has a valid move, game is over
          newGame.finished = true;
      }
  }

  newGame.currentPlayerIdx = nextPlayerIdx;

  if (newGame.finished || newGame.moveCount === (newGame.rows * newGame.cols) - 4) { // -4 for initial pieces
      newGame.finished = true;
      if (newGame.scores[playerIds[0]] > newGame.scores[playerIds[1]]) {
          newGame.winnerIdx = 0;
      } else if (newGame.scores[playerIds[1]] > newGame.scores[playerIds[0]]) {
          newGame.winnerIdx = 1;
      } else {
          newGame.winnerIdx = -1; // Draw
      }
  }

  return { newGame, claimed: flips.length, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
