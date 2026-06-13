import { describe, it, expect } from 'vitest';
import { getRankFromElo } from './achievements';

describe('achievements', () => {
  describe('getRankFromElo', () => {
    it('returns Master for elo >= 2000', () => {
      expect(getRankFromElo(2000)).toEqual({ name: 'Master', color: '#B91C3C' });
      expect(getRankFromElo(2500)).toEqual({ name: 'Master', color: '#B91C3C' });
      expect(getRankFromElo(Infinity)).toEqual({ name: 'Master', color: '#B91C3C' });
    });

    it('returns Expert for 1800 <= elo < 2000', () => {
      expect(getRankFromElo(1800)).toEqual({ name: 'Expert', color: '#B7791F' });
      expect(getRankFromElo(1999)).toEqual({ name: 'Expert', color: '#B7791F' });
    });

    it('returns Skilled for 1500 <= elo < 1800', () => {
      expect(getRankFromElo(1500)).toEqual({ name: 'Skilled', color: '#2F6B3F' });
      expect(getRankFromElo(1799)).toEqual({ name: 'Skilled', color: '#2F6B3F' });
    });

    it('returns Rated for 1200 <= elo < 1500', () => {
      expect(getRankFromElo(1200)).toEqual({ name: 'Rated', color: '#1A1A1A' });
      expect(getRankFromElo(1499)).toEqual({ name: 'Rated', color: '#1A1A1A' });
    });

    it('returns Player for 1000 <= elo < 1200', () => {
      expect(getRankFromElo(1000)).toEqual({ name: 'Player', color: '#666' });
      expect(getRankFromElo(1199)).toEqual({ name: 'Player', color: '#666' });
    });

    it('returns Novice for elo < 1000', () => {
      expect(getRankFromElo(999)).toEqual({ name: 'Novice', color: '#999' });
      expect(getRankFromElo(0)).toEqual({ name: 'Novice', color: '#999' });
      expect(getRankFromElo(-500)).toEqual({ name: 'Novice', color: '#999' });
      expect(getRankFromElo(-Infinity)).toEqual({ name: 'Novice', color: '#999' });
    });

    it('handles non-numeric inputs gracefully if applicable, or falls back to Novice', () => {
      // In JS, undefined >= 2000 is false, etc, so it falls through to Novice.
      expect(getRankFromElo(undefined)).toEqual({ name: 'Novice', color: '#999' });
      expect(getRankFromElo(null)).toEqual({ name: 'Novice', color: '#999' });
      expect(getRankFromElo(NaN)).toEqual({ name: 'Novice', color: '#999' });
    });
  });
});
