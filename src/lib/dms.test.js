import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({
  db: {},
}));

import { conversationId } from './dms';

describe('dms', () => {
  describe('conversationId', () => {
    it('creates a deterministic conversation ID regardless of argument order', () => {
      const id1 = conversationId('userA', 'userB');
      const id2 = conversationId('userB', 'userA');
      expect(id1).toBe(id2);
      expect(id1).toBe('userA_userB');
    });

    it('correctly joins strings with an underscore', () => {
      const id = conversationId('apple', 'zebra');
      expect(id).toBe('apple_zebra');
    });

    it('handles identical strings', () => {
      const id = conversationId('same', 'same');
      expect(id).toBe('same_same');
    });

    it('handles empty strings', () => {
      const id = conversationId('', 'user');
      expect(id).toBe('_user');
    });
  });
});
