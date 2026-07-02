import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { updateProfile, sendFriendRequest, removeFriend, blockUser } from '../lib/actions';
import { ACHIEVEMENTS, AVATAR_OPTIONS, TITLE_OPTIONS, UNLOCKABLE_AVATARS, UNLOCKABLE_TITLES, getRankInfo } from '../lib/achievements';
import { toast } from '../components/Notifications';
import { useConfirm } from '../components/ConfirmDialog';
import { Edit2, UserPlus, Ban, Check } from 'lucide-react';
import EloChart from '../components/EloChart';
import ActivityFeed from '../components/ActivityFeed';
import { calculateXP, getLevelInfo } from '../lib/xp';

export default function Profile() {
  const { username } = useParams();
  const { profile: me } = useAuth();
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLineStyle, setEditLineStyle] = useState('solid');

  const isMe = !username || (me && username === me.username);

  // Resolve username -> uid once, then live-subscribe so the page reflects
  // achievement unlocks, ELO changes, online status etc. without a reload.
  useEffect(() => {
    if (!me) return;
    setLoading(true);
    if (isMe) {
      setTarget(me);
      setEditAvatar(me.avatar || AVATAR_OPTIONS[0]);
      setEditTitle(me.title || '');
      setEditBio(me.bio || '');
      setEditLineStyle(me.lineStyle || 'solid');
      setLoading(false);
      return;
    }
    // Look up uid from username, then subscribe to the user doc.
    let unsub = null;
    let cancelled = false;
    getDoc(doc(db, 'usernames', username.toLowerCase().trim())).then(snap => {
      if (cancelled) return;
      if (!snap.exists()) { setTarget(null); setLoading(false); return; }
      const { uid } = snap.data();
      unsub = onSnapshot(doc(db, 'users', uid), (us) => {
        if (cancelled) return;
        if (us.exists()) setTarget({ id: us.id, ...us.data() });
        else setTarget(null);
        setLoading(false);
      });
    }).catch(() => { if (!cancelled) { setTarget(null); setLoading(false); } });
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [me, username, isMe]);

  // Hooks must run unconditionally before any early returns.
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  if (!me) return null;
  if (loading) return <div className="font-mono text-xs opacity-50 text-center py-20">LOADING…</div>;
  if (!target) return <div className="font-mono text-sm opacity-60 text-center py-20">User not found</div>;

  const rankInfo = getRankInfo(target.elo ?? 1000);
  const rank = rankInfo.rank;
  const nextRank = rankInfo.nextRank;
  const rankProgress = rankInfo.progress;
  const winRate = target.gamesPlayed > 0 ? Math.round((target.wins / target.gamesPlayed) * 100) : 0;
  const isFriend = (Array.isArray(me.friends) ? me.friends : []).includes(target.id);
  const isBlocked = (me.blocked || []).includes(target.id);

  const saveProfile = async () => {
    try {
      await updateProfile(me, { avatar: editAvatar, title: editTitle, bio: editBio, lineStyle: editLineStyle });
      toast('Profile updated', 'success');
      setEditing(false);
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleAddFriend = async () => {
    try { await sendFriendRequest(me, target.username); toast('Friend request sent', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const handleRemoveFriend = async () => {
    const ok = await confirm({
      title: `Remove ${target.username} as a friend?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try { await removeFriend(me, target.id); toast('Friend removed'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const handleBlock = async () => {
    const ok = await confirm({
      title: `Block ${target.username}?`,
      body: "They can't invite or friend you. Any active match between you will end in their favor.",
      confirmLabel: 'Block',
      danger: true,
    });
    if (!ok) return;
    try { await blockUser(me, target.username); toast('User blocked'); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
    {confirmDialogEl}
    <div className="fade-in space-y-10">
      {/* Hero */}
      <section className="flex items-start gap-6 flex-wrap">
        <div className="relative">
          <div className="font-display text-7xl">{target.avatar || '◆'}</div>
          {target.online && (
            <span className="absolute bottom-1 right-0 w-3 h-3 rounded-full" style={{ background: 'var(--forest)', border: '2px solid var(--paper)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-4xl font-medium tracking-tight">{target.displayName || target.username}</h1>
          <div className="font-mono text-xs tracking-widest uppercase mt-1 opacity-60">@{target.username}</div>
          {target.title && (
            <div className="font-display italic mt-2 opacity-80">{target.title}</div>
          )}
          <div className="mt-4 max-w-sm">
            <div className="flex justify-between items-end mb-2">
              <div className="font-mono text-xs tracking-widest uppercase" style={{ color: rank.color }}>
                {rank.name} · {target.elo ?? 1000} ELO
              </div>
              {nextRank && (
                <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">
                  Next: {nextRank.name} ({nextRank.min})
                </div>
              )}
            </div>
            {nextRank && (
              <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 ease-out"
                  style={{ width: `${rankProgress}%`, background: rank.color }}
                />
              </div>
            )}
          </div>
          {(target.winStreak || 0) >= 3 && (
            <div className="mt-4 font-mono text-[0.7rem] tracking-widest uppercase" style={{ color: 'var(--ochre)' }}>
              🔥 {target.winStreak} Win Streak
            </div>
          )}
          {target.bio && (
            <div className="font-display mt-4 max-w-md leading-relaxed opacity-80" style={{ whiteSpace: 'pre-wrap' }}>{target.bio}</div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {isMe ? (
            <button onClick={() => setEditing(!editing)} className="btn-ghost">
              <Edit2 size={12} /> {editing ? 'Cancel' : 'Edit'}
            </button>
          ) : (
            <>
              {isFriend ? (
                <button onClick={handleRemoveFriend} className="btn-ghost">
                  <Check size={12} /> Friends
                </button>
              ) : (
                <button onClick={handleAddFriend} className="btn-primary">
                  <UserPlus size={12} /> Add Friend
                </button>
              )}
              {!isBlocked && (
                <button onClick={handleBlock} className="btn-danger">
                  <Ban size={12} /> Block
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Edit form */}
      {isMe && editing && (
        <section className="card space-y-6">
          <div>
            <div className="font-mono block mb-3 text-[0.65rem] tracking-widest uppercase opacity-55">Avatar</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pick avatar">
              {UNLOCKABLE_AVATARS.map(av => {
                const isUnlocked = av.free || av.check(target);
                return (
                <button key={av.val} onClick={() => isUnlocked && setEditAvatar(av.val)}
                        type="button"
                        role="radio"
                        aria-checked={editAvatar === av.val}
                        aria-label={`Avatar ${av.val}${!isUnlocked ? ` (Locked: ${av.req})` : ''}`}
                        title={!isUnlocked ? `Locked: ${av.req}` : ''}
                        disabled={!isUnlocked}
                        className="w-12 h-12 border hairline font-display text-2xl transition-all focus-ring flex items-center justify-center relative"
                        style={{
                          background: editAvatar === av.val ? 'var(--bg-soft)' : 'transparent',
                          borderColor: editAvatar === av.val ? 'var(--ink)' : 'var(--hairline)',
                          opacity: isUnlocked ? 1 : 0.3,
                          cursor: isUnlocked ? 'pointer' : 'not-allowed'
                        }}>
                  {av.val}
                  {!isUnlocked && <span className="absolute top-0 right-0 text-[0.4rem] opacity-70">🔒</span>}
                </button>
              )})}
            </div>
          </div>
          <div>
            <label htmlFor="profile-title" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Title</label>
            <select id="profile-title" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="input-field" style={{ background: 'transparent' }}>
              <option value="">— None —</option>
              {UNLOCKABLE_TITLES.map(t => {
                const isUnlocked = t.free || t.check(target);
                return <option key={t.val} value={t.val} disabled={!isUnlocked}>{t.val} {!isUnlocked ? `(🔒 ${t.req})` : ''}</option>;
              })}
            </select>
          </div>
          <div>
            <label htmlFor="profile-bio" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Bio</label>
            <textarea id="profile-bio" value={editBio} onChange={e => setEditBio(e.target.value.slice(0, 200))}
                      className="input-field font-display text-base"
                      style={{ minHeight: 80, borderBottom: '1px solid var(--hairline-strong)', resize: 'vertical' }}
                      placeholder="A few words…" />
            <div className="font-mono text-[0.6rem] opacity-50 mt-1">{editBio.length}/200</div>
          </div>
          <div className="pt-2">
            <label htmlFor="profile-line-style" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Dots & Boxes Line Style</label>
            <select id="profile-line-style" value={editLineStyle} onChange={e => setEditLineStyle(e.target.value)}
                    className="input-field font-display text-base"
                    style={{ borderBottom: '1px solid var(--hairline-strong)', background: 'transparent' }}>
              <option value="solid">Solid</option>
              <option value="neon">Neon</option>
              <option value="sketch">Sketch</option>
            </select>
          </div>
          <button onClick={saveProfile} className="btn-primary">Save Changes</button>

          {/* Danger zone: delete account permanently */}
          <div className="pt-6 border-t hairline">
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-3" style={{ color: 'var(--crimson)' }}>
              Danger Zone
            </div>
            <p className="font-display text-sm opacity-75 leading-relaxed mb-4">
              Deleting your account removes your profile, username, and login.
              Match records you appear in are preserved (so your opponents'
              histories stay intact).
            </p>
            <DeleteAccountForm />
          </div>
        </section>
      )}

      {/* Progression */}
      <section className="mb-8">
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Progression</div>
        {(() => {
          const xp = calculateXP(target);
          const levelInfo = getLevelInfo(xp);
          return (
            <div className="border hairline p-5 sm:p-6" style={{ background: 'var(--paper-tint)' }}>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1">Axiom Level</div>
                  <div className="font-display text-5xl leading-none">{levelInfo.level}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1">Total XP</div>
                  <div className="font-display text-2xl leading-none">{xp}</div>
                </div>
              </div>

              <div className="relative pt-2">
                <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-2">
                  <span>Current Tier</span>
                  <span>{levelInfo.currentXP} / {levelInfo.xpRequired} to Next</span>
                </div>
                <div className="h-2 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={levelInfo.currentXP} aria-valuemin={0} aria-valuemax={levelInfo.xpRequired}>
                  <div className="h-full bg-current opacity-60 transition-all duration-1000 ease-out" style={{ width: `${levelInfo.progressPercent}%` }} />
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Stats grid */}
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Statistics</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Wins" value={target.wins || 0} />
          <Stat label="Losses" value={target.losses || 0} />
          <Stat label="Draws" value={target.draws || 0} />
          <Stat label="Win Rate" value={`${winRate}%`} />
          <Stat label="Total Boxes" value={target.totalBoxes || 0} />
          <Stat label="Best Streak" value={target.bestWinStreak || 0} />
          <Stat label="Biggest Chain" value={target.biggestChain || 0} />
          <Stat label="Perfect Wins" value={target.perfectWins || 0} />
          <Stat label="Goal Streak" value={target.dailyGoalStreak || 0} />
          <Stat label="Daily Goals" value={target.dailyGoalsCompleted || 0} />
        </div>
      </section>

      {/* ELO trend */}
      {(Array.isArray(target.matchHistory) ? target.matchHistory.length : 0) > 0 && (
        <section className="card">
          <EloChart matchHistory={target.matchHistory || []} currentElo={target.elo ?? 1000} />
        </section>
      )}

      {/* Activity feed */}
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Recent Activity</div>
        <ActivityFeed profile={target} singleUser={true} viewerId={me.id} />
      </section>

      {/* Arcade Records */}
      {target.arcadeBests && Object.keys(target.arcadeBests).length > 0 && (
        <section>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Arcade Records</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(target.arcadeBests).map(([gameId, record]) => (
              <Stat key={gameId} label={record.gameName || gameId} value={record.scoreDisplay} />
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">
          Achievements ({(Array.isArray(target.unlockedAchievements) ? target.unlockedAchievements.length : 0)}/{ACHIEVEMENTS.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = (target.unlockedAchievements || []).includes(a.id);
            return (
              <div key={a.id} className="border hairline p-3" style={{ opacity: unlocked ? 1 : 0.5 }}>
                <div className="font-display text-base">{a.name}</div>
                <div className="font-mono text-[0.65rem] tracking-wide opacity-70 mt-1 leading-relaxed">{a.desc}</div>
                {!unlocked && a.progress && (() => {
                  const [curr, max, min = 0] = a.progress(target);
                  const pct = max === min ? 0 : Math.min(100, Math.max(0, ((curr - min) / (max - min)) * 100));
                  if (pct === 0 && max === 1) return null; // Hide 0/1 binary progress
                  return (
                    <div className="mt-2 h-1 w-full bg-black/10 rounded-full overflow-hidden">
                      <div className="h-full bg-current opacity-40 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </section>
    </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border hairline p-4">
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60 mb-2">{label}</div>
      <div className="font-display text-2xl font-medium tabular-nums">{value}</div>
    </div>
  );
}

// Account deletion is a serious action — we ask for the password as
// re-authentication (Firebase requires it for delete) AND a typed
// confirmation of the username. Belt and suspenders.
function DeleteAccountForm() {
  const { profile, deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typedUsername, setTypedUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = typedUsername === profile?.username && password.length >= 6;

  const submit = async (e) => {
    e?.preventDefault();
    if (!canConfirm) return;
    setBusy(true);
    try {
      await deleteAccount(password);
      // The auth listener will navigate us back to /login automatically.
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-danger">
        Delete Account
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="delete-typed-username" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">
          Type your username to confirm
        </label>
        <input id="delete-typed-username" className="input-field"
               value={typedUsername} onChange={e => setTypedUsername(e.target.value)}
               placeholder={profile?.username} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="delete-password" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">
          Password
        </label>
        <input id="delete-password" className="input-field" type="password"
               value={password} onChange={e => setPassword(e.target.value)}
               autoComplete="current-password" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setPassword(''); setTypedUsername(''); }}
                className="btn-ghost">Cancel</button>
        <button type="submit" disabled={!canConfirm || busy} className="btn-danger">
          {busy ? 'Deleting…' : 'Permanently delete account'}
        </button>
      </div>
    </form>
  );
}
