import { describe, it, expect } from 'vitest';
import { getRankFromElo, checkUnlocks, ACHIEVEMENTS } from './achievements';

describe('achievements', () => {
  describe('social_butterfly', () => {
    const ach = ACHIEVEMENTS.find((a) => a.id === 'social_butterfly');

    it('handles numeric values', () => {
      expect(ach.check({ friends: 5 })).toBe(true);
      expect(ach.check({ friends: 4 })).toBe(false);
      expect(ach.progress({ friends: 5 })).toEqual([5, 5]);
      expect(ach.progress({ friends: 4 })).toEqual([4, 5]);
    });

    it('handles arrays', () => {
      expect(ach.check({ friends: ['a', 'b', 'c', 'd', 'e'] })).toBe(true);
      expect(ach.check({ friends: ['a', 'b'] })).toBe(false);
      expect(ach.progress({ friends: ['a', 'b', 'c', 'd', 'e'] })).toEqual([5, 5]);
      expect(ach.progress({ friends: ['a', 'b'] })).toEqual([2, 5]);
    });

    it('handles undefined/null/empty', () => {
      expect(ach.check({})).toBe(false);
      expect(ach.check({ friends: null })).toBe(false);
      expect(ach.progress({})).toEqual([0, 5]);
      expect(ach.progress({ friends: null })).toEqual([0, 5]);
      expect(ach.progress({ friends: [] })).toEqual([0, 5]);
    });
  });

  describe('getRankFromElo', () => {
    it('returns Master for elo >= 2000', () => {
      expect(getRankFromElo(2000)).toEqual({ name: 'Master', color: '#B91C3C', min: 2000 });
      expect(getRankFromElo(2500)).toEqual({ name: 'Master', color: '#B91C3C', min: 2000 });
      expect(getRankFromElo(Infinity)).toEqual({ name: 'Master', color: '#B91C3C', min: 2000 });
    });

    it('returns Expert for 1800 <= elo < 2000', () => {
      expect(getRankFromElo(1800)).toEqual({ name: 'Expert', color: '#B7791F', min: 1800 });
      expect(getRankFromElo(1999)).toEqual({ name: 'Expert', color: '#B7791F', min: 1800 });
    });

    it('returns Skilled for 1500 <= elo < 1800', () => {
      expect(getRankFromElo(1500)).toEqual({ name: 'Skilled', color: '#2F6B3F', min: 1500 });
      expect(getRankFromElo(1799)).toEqual({ name: 'Skilled', color: '#2F6B3F', min: 1500 });
    });

    it('returns Rated for 1200 <= elo < 1500', () => {
      expect(getRankFromElo(1200)).toEqual({ name: 'Rated', color: '#1A1A1A', min: 1200 });
      expect(getRankFromElo(1499)).toEqual({ name: 'Rated', color: '#1A1A1A', min: 1200 });
    });

    it('returns Player for 1000 <= elo < 1200', () => {
      expect(getRankFromElo(1000)).toEqual({ name: 'Player', color: '#666', min: 1000 });
      expect(getRankFromElo(1199)).toEqual({ name: 'Player', color: '#666', min: 1000 });
    });

    it('returns Novice for elo < 1000', () => {
      expect(getRankFromElo(999)).toEqual({ name: 'Novice', color: '#999', min: 0 });
      expect(getRankFromElo(0)).toEqual({ name: 'Novice', color: '#999', min: 0 });
      expect(getRankFromElo(-500)).toEqual({ name: 'Novice', color: '#999', min: 0 });
      expect(getRankFromElo(-Infinity)).toEqual({ name: 'Novice', color: '#999', min: 0 });
    });

    it('handles non-numeric inputs gracefully if applicable, or falls back to Novice', () => {
      // In JS, undefined >= 2000 is false, etc, so it falls through to Novice.
      expect(getRankFromElo(undefined)).toEqual({ name: 'Novice', color: '#999', min: 0 });
      expect(getRankFromElo(null)).toEqual({ name: 'Novice', color: '#999', min: 0 });
      expect(getRankFromElo(NaN)).toEqual({ name: 'Novice', color: '#999', min: 0 });
    });
  });
});
