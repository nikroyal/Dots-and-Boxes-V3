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
  };
}

function checkWin(board, r, c, playerId, rows, cols) {
  // Check row
  if (board[r].every(cell => cell === playerId)) return true;
  // Check col
  let colWin = true;
  for (let i = 0; i < rows; i++) {
    if (board[i][c] !== playerId) {
      colWin = false; break;
    }
  }
  if (colWin) return true;

  // Check diagonals (assuming square board)
  if (r === c) {
    let diag1Win = true;
    for (let i = 0; i < rows; i++) {
      if (board[i][i] !== playerId) { diag1Win = false; break; }
    }
    if (diag1Win) return true;
  }
  if (r + c === rows - 1) {
    let diag2Win = true;
    for (let i = 0; i < rows; i++) {
      if (board[i][rows - 1 - i] !== playerId) { diag2Win = false; break; }
    }
    if (diag2Win) return true;
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

  if (r < 0 || r >= newGame.rows || c < 0 || c >= newGame.cols) return { error: 'invalid-coords' };
  if (newGame.board[r][c] !== null) return { error: 'already-played' };

  newGame.board[r][c] = playerId;
  newGame.moveCount++;
  newGame.moves.push({ r, c, by: playerId, ts: Date.now() });

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
