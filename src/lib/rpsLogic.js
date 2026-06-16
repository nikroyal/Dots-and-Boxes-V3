export function createEmptyGame(targetWins = 3, _unused = null, playerIds = ['p1', 'p2']) {
  return {
    targetWins: typeof targetWins === 'number' ? targetWins : 3,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    currentPlayerIdx: 0, // In RPS both play, but we need this for consistency with other games if needed. Usually we wait for both.
    currentRound: 0,
    p1Choice: null,
    p2Choice: null,
    roundHistory: [], // { p1Choice, p2Choice, winnerIdx }
    moveCount: 0,
    finished: false,
    winnerIdx: null,
  };
}

const WINS = {
    'R': 'S',
    'P': 'R',
    'S': 'P'
};

export function applyMove(game, choice, playerId, playerIds) {
    const newGame = {
        ...game,
        scores: { ...game.scores },
        roundHistory: [...game.roundHistory]
    };

    if (newGame.finished) return { error: 'game-finished' };
    if (!['R', 'P', 'S'].includes(choice)) return { error: 'invalid-choice' };

    const isP1 = playerId === playerIds[0];

    if (isP1) {
        if (newGame.p1Choice) return { error: 'already-played' };
        newGame.p1Choice = choice;
    } else {
        if (newGame.p2Choice) return { error: 'already-played' };
        newGame.p2Choice = choice;
    }

    // Resolve round if both played
    if (newGame.p1Choice && newGame.p2Choice) {
        let roundWinnerIdx = -1;

        if (newGame.p1Choice !== newGame.p2Choice) {
            if (WINS[newGame.p1Choice] === newGame.p2Choice) {
                roundWinnerIdx = 0;
                newGame.scores[playerIds[0]]++;
            } else {
                roundWinnerIdx = 1;
                newGame.scores[playerIds[1]]++;
            }
        }

        newGame.roundHistory.push({
            p1Choice: newGame.p1Choice,
            p2Choice: newGame.p2Choice,
            winnerIdx: roundWinnerIdx
        });

        // Check overall game win
        if (newGame.scores[playerIds[0]] >= newGame.targetWins) {
            newGame.finished = true;
            newGame.winnerIdx = 0;
        } else if (newGame.scores[playerIds[1]] >= newGame.targetWins) {
            newGame.finished = true;
            newGame.winnerIdx = 1;
        }

        // Reset for next round if not finished
        if (!newGame.finished) {
            newGame.p1Choice = null;
            newGame.p2Choice = null;
            newGame.currentRound++;
        }
    }

    newGame.moveCount++;
    return { newGame, claimed: 0, finished: newGame.finished, winnerIdx: newGame.winnerIdx };
}
