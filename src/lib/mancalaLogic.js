export function createEmptyGame(rows = 2, cols = 6, playerIds = ['p1', 'p2']) { // Pits per side
  const board = Array(2).fill(null).map(() => Array(cols).fill(4)); // 4 stones per pit initially

  return {
    rows: 2,
    cols,
    board, // index 0 is player 2's pits, index 1 is player 1's pits.
    stores: { 'p1': 0, 'p2': 0 }, // Mancala stores
    currentPlayerIdx: 0,
    scores: { 'p1': 0, 'p2': 0 }, // scores can be synced to stores
    moveCount: 0,
    moves: [], // { pit, by, ts }
    finished: false,
    winnerIdx: null,
  };
}

export function applyMove(game, pitIndex, playerId, playerIds) {
    const newGame = {
        ...game,
        board: game.board.map(row => [...row]),
        stores: { ...game.stores },
        scores: { ...game.scores },
        moves: [...game.moves]
    };

    const isPlayer1 = playerId === playerIds[0];
    const sideIdx = isPlayer1 ? 1 : 0;

    // Validations
    if (game.currentPlayerIdx !== (isPlayer1 ? 0 : 1)) return { error: 'not-your-turn' };
    if (pitIndex < 0 || pitIndex >= newGame.cols) return { error: 'invalid-pit' };
    if (newGame.board[sideIdx][pitIndex] === 0) return { error: 'empty-pit' };

    let stones = newGame.board[sideIdx][pitIndex];
    newGame.board[sideIdx][pitIndex] = 0;

    let currentSide = sideIdx;
    let currentPit = pitIndex;
    let extraTurn = false;

    while (stones > 0) {
        if (currentSide === 1) { // Player 1's side (bottom)
            currentPit++;
            if (currentPit === newGame.cols) {
                // Drop in store if it's P1's turn
                if (isPlayer1) {
                    newGame.stores['p1']++;
                    stones--;
                    if (stones === 0) {
                        extraTurn = true;
                        break;
                    }
                }
                currentSide = 0;
                currentPit = newGame.cols - 1; // Start from rightmost of P2
                if (stones > 0) {
                    newGame.board[currentSide][currentPit]++;
                    stones--;
                }
            } else {
                newGame.board[currentSide][currentPit]++;
                stones--;
            }
        } else { // Player 2's side (top)
            currentPit--;
            if (currentPit < 0) {
                 // Drop in store if it's P2's turn
                 if (!isPlayer1) {
                    newGame.stores['p2']++;
                    stones--;
                    if (stones === 0) {
                        extraTurn = true;
                        break;
                    }
                 }
                 currentSide = 1;
                 currentPit = 0; // Start from leftmost of P1
                 if (stones > 0) {
                     newGame.board[currentSide][currentPit]++;
                     stones--;
                 }
            } else {
                 newGame.board[currentSide][currentPit]++;
                 stones--;
            }
        }
    }

    // Capture logic
    if (!extraTurn && currentSide === sideIdx && newGame.board[currentSide][currentPit] === 1) {
        const oppositeSide = currentSide === 1 ? 0 : 1;
        const oppositePit = currentSide === 1 ? currentPit : currentPit; // indices align nicely here
        const capturedStones = newGame.board[oppositeSide][oppositePit];

        if (capturedStones > 0) {
            newGame.board[oppositeSide][oppositePit] = 0;
            newGame.board[currentSide][currentPit] = 0;
            newGame.stores[playerId] += capturedStones + 1;
        }
    }

    // Check game over
    const p1Empty = newGame.board[1].every(pit => pit === 0);
    const p2Empty = newGame.board[0].every(pit => pit === 0);

    if (p1Empty || p2Empty) {
        newGame.finished = true;
        // Sweep remaining stones
        for (let i=0; i<newGame.cols; i++) {
            newGame.stores['p1'] += newGame.board[1][i];
            newGame.board[1][i] = 0;
            newGame.stores['p2'] += newGame.board[0][i];
            newGame.board[0][i] = 0;
        }

        newGame.scores = { ...newGame.stores };

        if (newGame.scores['p1'] > newGame.scores['p2']) newGame.winnerIdx = 0;
        else if (newGame.scores['p2'] > newGame.scores['p1']) newGame.winnerIdx = 1;
        else newGame.winnerIdx = -1; // Draw
    } else if (!extraTurn) {
        newGame.currentPlayerIdx = (newGame.currentPlayerIdx + 1) % 2;
    }

    newGame.moveCount++;
    newGame.moves.push({ pit: pitIndex, by: playerId, ts: Date.now() });

    // Sync scores
    newGame.scores = { ...newGame.stores };

    return { newGame, claimed: 0, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
