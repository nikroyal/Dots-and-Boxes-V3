export function createEmptyGame(rows = 6, cols = 7, playerIds = ['p1', 'p2']) {
  return {
    rows,
    cols,
    board: Array(rows).fill(null).map(() => Array(cols).fill(null)), // board[r][c] is playerId or null
    currentPlayerIdx: 0,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    moveCount: 0,
    moves: [], // { c, r, by, ts }
    finished: false,
    winnerIdx: null,
  };
}

function checkWin(board, r, c, playerId, rows, cols) {
  const dirs = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal right
    [1, -1] // diagonal left
  ];

  for (let [dr, dc] of dirs) {
    let count = 1;
    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== playerId) break;
      count++;
    }
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== playerId) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

export function applyMove(game, c, playerId, playerIds) {
  const newGame = {
    ...game,
    board: game.board.map(row => [...row]),
    scores: { ...game.scores },
    moves: [...game.moves]
  };

  if (c < 0 || c >= newGame.cols) return { error: 'invalid-coords' };

  // Find the lowest empty row in column c
  let r = -1;
  for (let i = newGame.rows - 1; i >= 0; i--) {
    if (newGame.board[i][c] === null) {
      r = i;
      break;
    }
  }

  if (r === -1) return { error: 'column-full' };

  newGame.board[r][c] = playerId;
  newGame.moveCount++;
  newGame.moves.push({ c, r, by: playerId, ts: Date.now() });

  const won = checkWin(newGame.board, r, c, playerId, newGame.rows, newGame.cols);

  if (won) {
    newGame.finished = true;
    newGame.winnerIdx = newGame.currentPlayerIdx;
    newGame.scores[playerId]++;
  } else if (newGame.moveCount === newGame.rows * newGame.cols) {
    newGame.finished = true;
    newGame.winnerIdx = -1; // draw
  } else {
    newGame.currentPlayerIdx = (newGame.currentPlayerIdx + 1) % playerIds.length;
  }

  return { newGame, claimed: won ? 1 : 0, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
