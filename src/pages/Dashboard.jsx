import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import {
  sendInvite, cancelInvite, acceptFriendRequest, declineFriendRequest,
  consumeAcceptedInvite, quickMatch,
} from '../lib/actions';
import { toast } from '../components/Notifications';
import { sfx } from '../lib/sound';
import { getRankInfo, ACHIEVEMENTS, getAchievementById } from '../lib/achievements';
import { getDailyGoal, getLocalYYYYMMDD } from '../lib/daily';
import EloChart from '../components/EloChart';
import ActivityFeed from '../components/ActivityFeed';
import { Send, X, Trophy, Target, TrendingUp, Users, Zap, Check } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [sending, setSending] = useState(false);
  const [outgoingInvites, setOutgoingInvites] = useState([]);
  const [findingMatch, setFindingMatch] = useState(false);

  // Keep a live ref to `profile` so the two onSnapshot listeners below can
  // see the latest user object without tearing themselves down on every
  // Firestore snapshot of the user doc. Without this, the heartbeat (every
  // 20s) re-created both listeners.
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Watch our outgoing pending invites
  // Invites considered "stale" after this window. Stale invites are
  // hidden from the UI and auto-cancelled in the background so the
  // recipient doesn't get a notification for a forgotten challenge.
  const STALE_INVITE_MS = 60 * 60 * 1000; // 1 hour

  useEffect(() => {
    if (!profile?.id) return;
    const myId = profile.id;
    const q = query(
      collection(db, 'invites'),
      where('fromId', '==', myId),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const fresh = [];
      for (const inv of list) {
        const created = inv.createdAt?.toMillis ? inv.createdAt.toMillis() : 0;
        if (created && now - created > STALE_INVITE_MS) {
          // Fire-and-forget cancel for the stale invite. Best effort.
          const me = profileRef.current;
          if (me) cancelInvite(inv.id, me).catch(() => {});
        } else {
          fresh.push(inv);
        }
      }
      setOutgoingInvites(fresh);
    });
    return () => unsub();
  }, [profile?.id]);

  // Watch our outgoing invites that get accepted -> auto-navigate to the match.
  // IMPORTANT: skip the initial snapshot. Firestore reports every existing
  // matching doc as "added" on first subscribe, so without this guard we'd
  // re-navigate to old finished matches every time Dashboard mounts (which
  // is what made the post-match Home button appear broken). We also mark
  // accepted invites as "consumed" once we navigate, so they don't keep
  // pulling us back if the listener ever re-fires for any reason.
  //
  // Additionally we track which invite IDs we've already navigated to in
  // this *session* via sessionStorage. Without that, the user can be
  // ping-pong'd: they hit Home (Dashboard mounts), the listener's initial
  // snapshot is skipped, but the in-flight `consumeAcceptedInvite` from the
  // previous mount hasn't committed yet, so the next snapshot fires a
  // "modified" event for an accepted-but-not-consumed invite and ricochets
  // them back into the match.
  //
  // Dep is `profile?.id` (NOT the full profile object) so the heartbeat
  // doesn't reset the listener every 20s.
  useEffect(() => {
    if (!profile?.id) return;
    const myId = profile.id;
    const q = query(
      collection(db, 'invites'),
      where('fromId', '==', myId),
      where('status', '==', 'accepted')
    );
    let isInitialSnapshot = true;
    const seenKey = 'db-navigated-invites';
    const seen = (() => {
      try { return new Set(JSON.parse(sessionStorage.getItem(seenKey) || '[]')); }
      catch { return new Set(); }
    })();
    const markSeen = (id) => {
      seen.add(id);
      try { sessionStorage.setItem(seenKey, JSON.stringify([...seen])); } catch {}
    };
    const unsub = onSnapshot(q, (snap) => {
      if (isInitialSnapshot) {
        // Pre-mark every initial doc as already-handled so the listener
        // can't ricochet us back to an invite from a previous Dashboard
        // mount in this same tab.
        snap.docs.forEach(d => markSeen(d.id));
        isInitialSnapshot = false;
        return;
      }
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          if (seen.has(change.doc.id)) return; // already navigated this session
          const inv = change.doc.data();
          if (inv.matchId) {
            markSeen(change.doc.id);
            sfx.notify();
            const me = profileRef.current;
            if (me) consumeAcceptedInvite(change.doc.id, me).catch(() => {});
            navigate(`/match/${inv.matchId}`);
          }
        }
      });
    });
    return () => unsub();
  }, [profile?.id, navigate]);

  if (!profile) return null;
  const rankInfo = getRankInfo(profile.elo ?? 1000);
  const rank = rankInfo.rank;
  const nextRank = rankInfo.nextRank;
  const rankProgress = rankInfo.progress;
  const winRate = profile.gamesPlayed > 0
    ? Math.round(((profile.wins || 0) / profile.gamesPlayed) * 100)
    : 0;
  const recentAchievements = (profile.unlockedAchievements || []).slice(-3).reverse();
  const friendRequests = profile.friendRequests || [];

  const today = getLocalYYYYMMDD();
  const dailyGoal = getDailyGoal(today);
  const dailyStats = profile.dailyStats?.date === today ? profile.dailyStats : { wins: 0, gamesPlayed: 0, totalBoxes: 0, biggestChain: 0 };
  const dailyGoalCompleted = profile.dailyGoalDate === today || dailyGoal.check(dailyStats);

  // Find the locked achievement with the highest progress percentage
  const upNextAchievement = (() => {
    let best = null;
    let highestPct = -1;
    const unlocked = profile.unlockedAchievements || [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.includes(a.id) && a.progress) {
        const [curr, max, min = 0] = a.progress(profile);
        const pct = max === min ? 0 : Math.min(100, Math.max(0, ((curr - min) / (max - min)) * 100));
        // Only show if it has some progress (not 0/1 binary)
        if (pct > 0 && max > 1 && pct > highestPct) {
          highestPct = pct;
          best = { a, curr, max, pct };
        }
      }
    }
    return best;
  })();

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!target.trim()) return;
    setSending(true);
    try {
      await sendInvite(profile, target.trim(), rows, cols);
      toast(`Invite sent to ${target}`, 'success');
      setTarget('');
      sfx.click();
    } catch (err) {
      toast(err.message, 'error');
    }
    setSending(false);
  };

  const handleQuickMatch = async () => {
    if (findingMatch) return;
    setFindingMatch(true);
    try {
      const res = await quickMatch(profile, rows, cols);
      toast(`Challenge sent to ${res.opponent.username} (${res.opponent.elo} ELO)`, 'success');
      sfx.click();
    } catch (err) {
      toast(err.message, 'error');
    }
    setFindingMatch(false);
  };

  return (
    <div className="fade-in space-y-10">
      {/* Hero stats */}
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Welcome back</div>
        <h1 className="font-display text-5xl font-medium tracking-tight leading-none">
          {profile.displayName || profile.username}
        </h1>
        <div className="mt-4 max-w-sm">
          <div className="flex justify-between items-end mb-2">
            <div className="font-mono text-xs tracking-widest uppercase" style={{ color: rank.color }}>
              {rank.name} · {profile.elo ?? 1000} ELO
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
        {(profile.winStreak || 0) >= 3 && (
          <div className="mt-4 font-mono text-[0.7rem] tracking-widest uppercase" style={{ color: 'var(--ochre)' }}>
            🔥 {profile.winStreak} Win Streak
          </div>
        )}
      </section>

      {/* Daily Goal */}
      <section className="card" style={{ borderColor: dailyGoalCompleted ? 'var(--forest)' : 'var(--hairline)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[0.65rem] tracking-widest uppercase mb-1 flex items-center gap-2">
              <span className="opacity-50 flex items-center gap-1.5"><Target size={12} /> Daily Goal</span>
              {(profile.dailyGoalStreak || 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-sm flex items-center gap-1" style={{ background: 'var(--bg-soft)', color: 'var(--ochre)' }}>
                  🔥 {profile.dailyGoalStreak} Day Streak
                </span>
              )}
            </div>
            <div className="font-display text-xl">{dailyGoal.text}</div>
          </div>
          {dailyGoalCompleted ? (
            <div className="flex flex-col items-end gap-1.5 mt-1 sm:mt-0">
              <div className="flex items-center gap-2 font-mono text-[0.7rem] tracking-widest uppercase px-3 py-1.5 rounded-full" style={{ background: 'var(--forest)', color: 'var(--paper)' }}>
                <Check size={14} /> Completed
              </div>
              <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-60">
                Come back tomorrow to keep your streak going
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs opacity-60">
              {dailyGoal.getProgress(dailyStats)} / {dailyGoal.max}
            </div>
          )}
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Trophy size={14} />} label="Wins" value={profile.wins || 0} />
        <StatCard icon={<Target size={14} />} label="Games" value={profile.gamesPlayed || 0} />
        <StatCard icon={<TrendingUp size={14} />} label="Win Rate" value={`${winRate}%`} />
        <StatCard icon={<Users size={14} />} label="Friends" value={Array.isArray(profile.friends) ? profile.friends.length : 0} />
      </section>

      {/* ELO trend */}
      {(Array.isArray(profile.matchHistory) ? profile.matchHistory.length : 0) > 0 && (
        <section className="card">
          <EloChart matchHistory={profile.matchHistory || []} currentElo={profile.elo || 1000} />
        </section>
      )}

      {/* Quick play */}
      <section className="card">
        <h2 className="font-display text-2xl mb-1">New Match</h2>
        <p className="font-mono text-[0.7rem] tracking-widest uppercase opacity-50 mb-6">Challenge a player by username, or find one</p>
        <form onSubmit={handleInvite} className="space-y-6">
          <div>
            <label htmlFor="dashboard-opponent" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Opponent</label>
            <input
              id="dashboard-opponent"
              className="input-field"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="username"
              autoComplete="off"
            />
          </div>
          <div>
            <div className="font-mono block mb-3 text-[0.65rem] tracking-widest uppercase opacity-55">Board size</div>
            <div className="flex items-baseline gap-4">
              <SizeSelector value={rows} onChange={setRows} label="Rows" />
              <span className="font-display text-2xl opacity-30">×</span>
              <SizeSelector value={cols} onChange={setCols} label="Cols" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={sending} aria-busy={sending} aria-label={sending ? "Sending challenge" : "Send Challenge"} className="btn-primary">
              <Send size={14} aria-hidden="true" /> Send Challenge
            </button>
            <button type="button" onClick={handleQuickMatch} disabled={findingMatch} aria-busy={findingMatch} aria-label={findingMatch ? "Finding quick match" : "Quick Match"} className="btn-ghost">
              <Zap size={14} aria-hidden="true" /> {findingMatch ? 'Finding…' : 'Quick Match'}
            </button>
          </div>
        </form>
      </section>

      {/* Outgoing invites */}
      {outgoingInvites.length > 0 && (
        <section>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Pending Challenges</div>
          <div className="space-y-2">
            {outgoingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between border hairline px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="pulse-soft" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', display: 'inline-block' }} />
                  <span className="font-display text-base">Waiting for {inv.toUsername}…</span>
                  <span className="font-mono text-[0.65rem] tracking-widest opacity-50">{inv.rows}×{inv.cols}</span>
                </div>
                <button onClick={() => cancelInvite(inv.id, profile)} className="opacity-50 hover:opacity-100 focus-ring"
                        aria-label={`Cancel invite to ${inv.toUsername}`}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friend requests */}
      {friendRequests.length > 0 && (
        <section>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Friend Requests</div>
          <div className="space-y-2">
            {friendRequests.map(req => (
              <div key={req.fromId} className="flex items-center justify-between border hairline px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl">{req.fromAvatar}</span>
                  <span className="font-display text-base">{req.fromUsername}</span>
                </div>
                <div className="flex gap-1">
                  <button aria-label={`Accept friend request from ${req.fromUsername}`} onClick={() => acceptFriendRequest(profile, req.fromId).then(() => toast('Friend added', 'success'))}
                          className="px-3 py-1 font-mono text-[0.65rem] tracking-widest uppercase hover:bg-black/5">Accept</button>
                  <button aria-label={`Decline friend request from ${req.fromUsername}`} onClick={() => declineFriendRequest(profile, req.fromId)}
                          className="px-3 py-1 font-mono text-[0.65rem] tracking-widest uppercase opacity-50 hover:opacity-100">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Arcade Records */}
      {profile.arcadeBests && Object.keys(profile.arcadeBests).length > 0 && (
        <section>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Arcade Records</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(profile.arcadeBests).map(([gameId, record]) => (
              <StatCard key={gameId} icon={<Zap size={14} />} label={record.gameName || gameId} value={record.scoreDisplay} />
            ))}
          </div>
        </section>
      )}

      {/* Achievements overview */}
      {(recentAchievements.length > 0 || upNextAchievement) && (
        <section>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Achievements</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {upNextAchievement && (
              <div className="border hairline p-3" style={{ background: 'var(--bg-soft)', borderColor: 'var(--ochre)' }}>
                <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1" style={{ color: 'var(--ochre)' }}>Up Next</div>
                <div className="font-display text-base">{upNextAchievement.a.name}</div>
                <div className="font-mono text-[0.65rem] tracking-wide opacity-60 mt-1 leading-relaxed">{upNextAchievement.a.desc}</div>
                <div className="mt-3">
                  <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                    <span>Progress</span>
                    <span>{Math.floor(upNextAchievement.curr)} / {upNextAchievement.max}</span>
                  </div>
                  <div className="h-1 w-full bg-black/10 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-500" style={{ width: `${upNextAchievement.pct}%`, background: 'var(--ochre)' }} />
                  </div>
                </div>
              </div>
            )}
            {recentAchievements.map(id => {
              const a = getAchievementById(id);
              if (!a) return null;
              return (
                <div key={id} className="border hairline p-3 opacity-80">
                  <div className="font-display text-base">{a.name}</div>
                  <div className="font-mono text-[0.65rem] tracking-wide opacity-60 mt-1 leading-relaxed">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity feed (you + friends) */}
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3">Activity</div>
        <ActivityFeed profile={profile} />
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="border hairline p-4">
      <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-2">
        {icon} {label}
      </div>
      <div className="font-display text-3xl font-medium tabular-nums">{value}</div>
    </div>
  );
}

function SizeSelector({ value, onChange, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(2, value - 1))}
                className="font-display text-2xl opacity-40 hover:opacity-100 transition-opacity w-6">−</button>
        <span className="font-display text-3xl tabular-nums" style={{ minWidth: 50, textAlign: 'center' }}>{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(15, value + 1))}
                className="font-display text-2xl opacity-40 hover:opacity-100 transition-opacity w-6">+</button>
      </div>
      <div className="font-mono mt-1 text-[0.6rem] tracking-widest uppercase opacity-50">{label}</div>
    </div>
  );
}
