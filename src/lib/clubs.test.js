import { describe, it, expect, vi, beforeEach } from 'vitest';
import { joinClub, ROLES } from './clubs';
import { doc, runTransaction, serverTimestamp, arrayUnion } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'MOCKED_TIMESTAMP'),
  arrayUnion: vi.fn((val) => `ARRAY_UNION_${val}`),
  collection: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('./firebase', () => ({
  db: {}
}));

describe('clubs.js', () => {
  describe('joinClub', () => {
    let tx;
    let currentUser;

    beforeEach(() => {
      vi.clearAllMocks();

      tx = {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };

      runTransaction.mockImplementation(async (dbParam, callback) => {
        return await callback(tx);
      });

      doc.mockImplementation((dbParam, ...args) => args.join('/'));

      currentUser = {
        id: 'user1',
        username: 'testuser',
        avatar: 'user_avatar.png'
      };
    });

    it('throws error if user is impersonated', async () => {
      const impersonatedUser = { ...currentUser, _isImpersonated: true };
      await expect(joinClub('club1', impersonatedUser)).rejects.toThrow('Action blocked: you are in read-only impersonation mode.');
    });

    it('throws error if club does not exist', async () => {
      tx.get.mockResolvedValueOnce({
        exists: () => false
      });

      await expect(joinClub('club1', currentUser)).rejects.toThrow('Club not found');
      expect(runTransaction).toHaveBeenCalled();
      expect(tx.get).toHaveBeenCalledWith('clubs/club1');
    });

    it('returns "joined" early if user is already a member', async () => {
      tx.get
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ joinMode: 'open' }) // club data
        })
        .mockResolvedValueOnce({
          exists: () => true, // member data exists
          data: () => ({})
        });

      const result = await joinClub('club1', currentUser);
      expect(result).toBe('joined');
      expect(tx.get).toHaveBeenCalledWith('clubs/club1/members/user1');
      expect(tx.set).not.toHaveBeenCalled();
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('creates a join request if club joinMode is "approval"', async () => {
      tx.get
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ joinMode: 'approval' }) // club data
        })
        .mockResolvedValueOnce({
          exists: () => false // member data does not exist
        });

      const result = await joinClub('club1', currentUser);
      expect(result).toBe('requested');

      expect(tx.set).toHaveBeenCalledTimes(1);
      expect(tx.set).toHaveBeenCalledWith('clubs/club1/joinRequests/user1', {
        userId: 'user1',
        username: 'testuser',
        avatar: 'user_avatar.png',
        ts: 'MOCKED_TIMESTAMP',
      });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('adds member and updates club if joinMode is "open"', async () => {
      tx.get
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ joinMode: 'open', memberCount: 5 }) // club data
        })
        .mockResolvedValueOnce({
          exists: () => false // member data does not exist
        });

      const result = await joinClub('club1', currentUser);
      expect(result).toBe('joined');

      expect(tx.set).toHaveBeenCalledTimes(1);
      expect(tx.set).toHaveBeenCalledWith('clubs/club1/members/user1', {
        userId: 'user1',
        username: 'testuser',
        avatar: 'user_avatar.png',
        role: ROLES.MEMBER,
        joinedAt: 'MOCKED_TIMESTAMP',
      });

      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(tx.update).toHaveBeenCalledWith('clubs/club1', {
        memberCount: 6,
        memberIds: 'ARRAY_UNION_user1'
      });
    });

    it('uses fallback avatar if user avatar is missing', async () => {
      const userWithoutAvatar = { id: 'user2', username: 'noavatar' };

      tx.get
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ joinMode: 'open', memberCount: 1 })
        })
        .mockResolvedValueOnce({
          exists: () => false
        });

      const result = await joinClub('club1', userWithoutAvatar);
      expect(result).toBe('joined');
      expect(tx.set).toHaveBeenCalledWith('clubs/club1/members/user2', expect.objectContaining({
        avatar: '◆'
      }));
    });
  });
});
