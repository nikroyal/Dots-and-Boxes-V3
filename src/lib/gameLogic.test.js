import { describe, it, expect } from 'vitest';
import { createEmptyGame, applyMove, computeElo } from './gameLogic';

describe('gameLogic', () => {
  describe('createEmptyGame', () => {
    it('creates a game with the correct rows and cols', () => {
      const game = createEmptyGame(3, 3, ['p1', 'p2']);
      expect(game.rows).toBe(3);
      expect(game.cols).toBe(3);
      expect(game.currentPlayerIdx).toBe(0);
      expect(game.scores).toEqual({ p1: 0, p2: 0 });
      expect(game.moveCount).toBe(0);
    });
  });

  describe('applyMove', () => {
    it('applies a valid horizontal move', () => {
      const game = createEmptyGame(2, 2, ['p1', 'p2']);
      const { newGame, claimed, finished } = applyMove(game, 'h', 0, 0, 'p1', ['p1', 'p2']);
      expect(newGame.error).toBeUndefined();
      expect(newGame.hLines['0,0']).toBe('p1');
      expect(claimed).toBe(0);
      expect(finished).toBe(false);
      expect(newGame.currentPlayerIdx).toBe(1); // turn advanced
    });

    it('rejects an invalid orientation', () => {
      const game = createEmptyGame(2, 2, ['p1', 'p2']);
      const res = applyMove(game, 'z', 0, 0, 'p1', ['p1', 'p2']);
      expect(res.error).toBe('invalid-orientation');
    });

    it('rejects an already-played line', () => {
      let game = createEmptyGame(2, 2, ['p1', 'p2']);
      const { newGame } = applyMove(game, 'v', 0, 0, 'p1', ['p1', 'p2']);
      const res = applyMove(newGame, 'v', 0, 0, 'p2', ['p1', 'p2']);
      expect(res.error).toBe('already-played');
    });

    it('claims a box when 4 lines are drawn and grants an extra turn', () => {
      let game = createEmptyGame(1, 1, ['p1', 'p2']);
      game = applyMove(game, 'h', 0, 0, 'p1', ['p1', 'p2']).newGame; // Top
      game = applyMove(game, 'h', 1, 0, 'p2', ['p1', 'p2']).newGame; // Bottom
      game = applyMove(game, 'v', 0, 0, 'p1', ['p1', 'p2']).newGame; // Left

      // p2's turn to draw the final right line
      const res = applyMove(game, 'v', 0, 1, 'p2', ['p1', 'p2']);
      expect(res.newGame.error).toBeUndefined();
      expect(res.claimed).toBe(1);
      expect(res.finished).toBe(true);
      expect(res.winnerIdx).toBe(1);
      expect(res.newGame.scores['p2']).toBe(1);
      expect(res.newGame.currentPlayerIdx).toBe(1); // Didn't advance due to claim
    });
  });

  describe('computeElo', () => {
    it('updates elo correctly when A wins', () => {
      // If A and B have 1000, expected win rate is 0.5.
      // K=32. If A wins (s=1), A gets 32 * (1 - 0.5) = +16. B gets -16.
      const res = computeElo(1000, 1000, 1);
      expect(res.newA).toBe(1016);
      expect(res.newB).toBe(984);
      expect(res.deltaA).toBe(16);
      expect(res.deltaB).toBe(-16);
    });

    it('handles non-finite input by defaulting to 1000', () => {
      const res = computeElo(NaN, null, 1);
      expect(res.newA).toBe(1016);
      expect(res.newB).toBe(984);
    });

    it('clamps elo to the [100, 3500] range', () => {
      // B has 3490, A wins (scoreA=0), so B should gain rating but it's clamped to 3500
      const res = computeElo(100, 3490, 0);
      expect(res.newA >= 100).toBe(true);
      expect(res.newB <= 3500).toBe(true);
    });
  });
});
