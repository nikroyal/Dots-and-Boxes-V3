import { describe, it, expect } from 'vitest';
import { checkUnlocks } from './achievements';

describe('checkUnlocks', () => {
  it('returns empty array if no achievements are met', () => {
    const stats = { gamesPlayed: 0, wins: 0, winStreak: 0, totalBoxes: 0 };
    const unlocked = checkUnlocks(stats);
    expect(unlocked).toEqual([]);
  });

  it('returns unlocked achievement IDs', () => {
    const stats = { gamesPlayed: 1 };
    const unlocked = checkUnlocks(stats);
    expect(unlocked).toEqual(['first_steps']);
  });

  it('does not return already unlocked achievements', () => {
    const stats = { gamesPlayed: 1 };
    const unlocked = checkUnlocks(stats, ['first_steps']);
    expect(unlocked).toEqual([]);
  });

  it('correctly evaluates multiple achievements simultaneously', () => {
    const stats = { gamesPlayed: 10, wins: 1 };
    const unlocked = checkUnlocks(stats);
    expect(unlocked).toEqual(['first_steps', 'first_blood', 'veteran_10']);
  });

  it('handles edge cases for achievements', () => {
    const stats = { biggestChain: 15, perfectWins: 1 };
    const unlocked = checkUnlocks(stats);
    expect(unlocked).toContain('chain_legend');
    expect(unlocked).toContain('chain_master');
    expect(unlocked).toContain('perfectionist');
  });
});
