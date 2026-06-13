import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendFriendRequest, removeFriend, unblockUser, acceptFriendRequest, declineFriendRequest } from '../lib/actions';
import { toast } from '../components/Notifications';
import { useConfirm } from '../components/ConfirmDialog';
import { sfx } from '../lib/sound';
import { UserMinus, Send } from 'lucide-react';

// Subscribe to a set of user docs and return them as a map keyed by id.
// We do this rather than getDoc-on-every-mount because the parent's
// `profile` object changes on every Firestore snapshot — making the
// previous version re-fetch every friend doc every ~20 seconds. The key
// is the stable joined-id string so we only resubscribe when membership
// actually changes.
function useUserDocs(ids) {
  const [docs, setDocs] = useState({});
  const stableKey = useMemo(() => [...ids].sort().join(','), [ids]);
  useEffect(() => {
    if (!stableKey) { setDocs({}); return; }
    const idsArr = stableKey.split(',').filter(Boolean);
    // Drop any cached entries that aren't in the current id set, so the
    // returned list doesn't include stale users after the membership
    // shrinks (removed friend, unblocked user).
    setDocs(prev => {
      const next = {};
      for (const id of idsArr) if (prev[id]) next[id] = prev[id];
      return next;
    });
    const unsubs = idsArr.map(id =>
      onSnapshot(doc(db, 'users', id), (snap) => {
        if (!snap.exists()) return;
        setDocs(prev => ({ ...prev, [id]: { id, ...snap.data() } }));
      })
    );
    return () => { unsubs.forEach(u => u()); };
  }, [stableKey]);
  return Object.values(docs);
}

export default function Friends() {
  const { profile } = useAuth();
  const friendIds = profile?.friends || [];
  const blockedIds = profile?.blocked || [];
  const friendsData = useUserDocs(friendIds);
  const blockedData = useUserDocs(blockedIds);
  const [addInput, setAddInput] = useState('');
  const [tab, setTab] = useState('friends');

  const { confirm, dialog: confirmEl } = useConfirm();

  if (!profile) return null;
  const requests = profile.friendRequests || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    try {
      await sendFriendRequest(profile, addInput.trim());
      toast('Friend request sent', 'success');
      setAddInput('');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
    {confirmEl}
    <div className="fade-in space-y-8">
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Social</div>
        <h1 className="font-display text-4xl font-medium tracking-tight">Friends</h1>
      </section>

      <form onSubmit={handleAdd} className="card flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="friends-add" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Add Friend</label>
          <input id="friends-add" value={addInput} onChange={e => setAddInput(e.target.value)} placeholder="username" autoComplete="off"
                 className="input-field" />
        </div>
        <button type="submit" className="btn-primary"><Send size={12} aria-hidden="true" /> Send Request</button>
      </form>

      <div className="flex gap-1 border-b hairline">
        {[
          ['friends', `Friends (${friendsData.length})`],
          ['requests', `Requests (${requests.length})`],
          ['blocked', `Blocked (${blockedData.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); sfx.click(); }}
                  className="px-4 py-2 font-mono text-[0.7rem] tracking-widest uppercase transition-all"
                  style={{
                    borderBottom: `2px solid ${tab === id ? 'var(--ink)' : 'transparent'}`,
                    opacity: tab === id ? 1 : 0.5,
                    background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid', cursor: 'pointer',
                  }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="space-y-2">
          {friendsData.length === 0 && (
            <div className="font-display italic opacity-50 text-center py-12">No friends yet</div>
          )}
          {friendsData.map(f => (
            <div key={f.id} className="flex items-center justify-between border hairline px-4 py-3">
              <Link to={`/profile/${f.username}`} onClick={sfx.click} className="flex items-center gap-3 hover:opacity-70 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <span className="font-display text-2xl">{f.avatar || '◆'}</span>
                  {f.online && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--forest)' }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base truncate">{f.displayName || f.username}</div>
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60">
                    {f.online ? 'Online' : 'Offline'} · {f.elo || 1000} ELO
                  </div>
                </div>
              </Link>
              <button onClick={async () => {
                const ok = await confirm({
                  title: `Remove ${f.displayName || f.username}?`,
                  body: 'They will no longer appear in your friends list. You can re-add them later.',
                  confirmLabel: 'Remove',
                });
                if (!ok) return;
                try { await removeFriend(profile, f.id); toast('Removed'); }
                catch (e) { toast(e.message || 'Failed to remove', 'error'); }
              }}
                      className="opacity-50 hover:opacity-100 focus-ring"
                      aria-label={`Remove ${f.username} from friends`}>
                <UserMinus size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 && (
            <div className="font-display italic opacity-50 text-center py-12">No pending requests</div>
          )}
          {requests.map(r => (
            <div key={r.fromId} className="flex items-center justify-between border hairline px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl">{r.fromAvatar}</span>
                <span className="font-display text-base">{r.fromUsername}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => acceptFriendRequest(profile, r.fromId).then(() => toast('Accepted', 'success'))}
                        className="btn-primary">Accept</button>
                <button onClick={() => declineFriendRequest(profile, r.fromId)} className="btn-ghost">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-2">
          {blockedData.length === 0 && (
            <div className="font-display italic opacity-50 text-center py-12">No blocked users</div>
          )}
          {blockedData.map(b => (
            <div key={b.id} className="flex items-center justify-between border hairline px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl opacity-50">{b.avatar || '◆'}</span>
                <span className="font-display text-base">{b.username}</span>
              </div>
              <button onClick={() => unblockUser(profile, b.id).then(() => toast('Unblocked'))} className="btn-ghost">
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
