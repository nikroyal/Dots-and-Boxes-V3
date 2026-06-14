import { Chess } from 'chess.js';

export function createEmptyGame(playerIds = ['p1', 'p2']) {
  const chess = new Chess();
  return {
    fen: chess.fen(),
    currentPlayerIdx: 0,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    moveCount: 0,
    moves: [], // { from, to, promotion, by, ts }
    finished: false,
    winnerIdx: null,
  };
}

export function applyMove(game, moveObj, playerId, playerIds) {
  const newGame = {
    ...game,
    scores: { ...game.scores },
    moves: [...game.moves]
  };

  const chess = new Chess(newGame.fen);

  try {
    const move = chess.move(moveObj);
    if (!move) {
      return { error: 'invalid-move' };
    }
  } catch(e) {
    return { error: 'invalid-move' };
  }

  newGame.fen = chess.fen();
  newGame.moveCount++;
  newGame.moves.push({ ...moveObj, by: playerId, ts: Date.now() });

  let won = false;
  if (chess.isCheckmate()) {
    won = true;
    newGame.finished = true;
    newGame.winnerIdx = newGame.currentPlayerIdx;
    newGame.scores[playerId]++;
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    newGame.finished = true;
    newGame.winnerIdx = -1;
  } else {
    newGame.currentPlayerIdx = (newGame.currentPlayerIdx + 1) % playerIds.length;
  }

  return { newGame, claimed: won ? 1 : 0, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
