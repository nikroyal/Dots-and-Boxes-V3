import { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import {
  watchMatch, makeMove, requestPause, respondToPause, resumeMatch, resignMatch,
  proposeTimer, acceptTimer, rejectTimer,
  sendChatAs, joinAsSpectator, leaveSpectator, finalizeStats, requestRematch, sendFriendRequest,
  forfeitOnTimeout,
} from '../lib/actions';
import { PLAYER_COLORS, hKey, vKey, bKey } from '../lib/gameLogic';
import { sfx } from '../lib/sound';
import { toast } from '../components/Notifications';
import { ACHIEVEMENTS, getAchievementById, getRankInfo } from '../lib/achievements';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';
import { usePrompt } from '../components/PromptDialog';
import { isDisconnected } from '../lib/presence';
import { Pause, Play, Flag, Send, Eye, Trophy, RotateCcw, Home, Repeat, Clock, WifiOff, Handshake, UserPlus } from 'lucide-react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { applyMove } from '../lib/chessLogic.js';

export default function MatchChess() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [achievementToasts, setAchievementToasts] = useState([]);
  const [now, setNow] = useState(Date.now()); // drives ticker
  const [opponentDoc, setOpponentDoc] = useState(null); // for disconnect detection
  // Track which action button is currently in-flight so we can disable it
  // (prevents spam-clicking Resign / Claim Victory / Pause etc. firing
  // multiple round-trips while the first is still pending).
  // MUST be declared before any conditional early-return below — React's
  // rules-of-hooks require a stable hook order across renders.
  const [busy, setBusy] = useState(null); // null | 'move' | 'pause' | 'resign' | 'claim' | 'resume'
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [pendingGame, setPendingGame] = useState(null);
  const pendingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);
  const prevMoveCount = useRef(-1); // -1 sentinel: no snapshot yet
  const prevStatus = useRef(null);
  const hasSubscribed = useRef(false);
  const timeoutAttempted = useRef(null); // tracks last turnStartedAt we tried to forfeit on (debounces)
  const chatEndRef = useRef(null);
  // Themed confirm dialog (replaces browser confirm). See ConfirmDialog.jsx.
  // Also a hook — must run unconditionally before any early return.
  const { confirm, dialog: confirmDialogEl } = useConfirm();
  const { prompt, dialog: promptDialogEl } = usePrompt();

  const [timerMins, setTimerMins] = useState(5);
  const [useTimer, setUseTimer] = useState(false);
  const [proposingTimer, setProposingTimer] = useState(false);

  // Keep a live ref to the current profile so the match-subscribe callback
  // (which we deliberately don't re-create on every profile snapshot — see
  // dep array below) can read the latest profile.id when computing
  // win/loss sounds.
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Subscribe to match. Deps key on `id` and `profile?.id` (not the full
  // `profile` object), because the auth-profile object gets a new reference
  // on every Firestore snapshot of the user doc — including every 20s
  // heartbeat. Using `profile` as a dep tore down and rebuilt the match
  // listener on every heartbeat, which (a) wasted Firestore reads and
  // (b) reset `hasSubscribed.current` mid-game, suppressing the move sound
  // for one snapshot afterward.
  useEffect(() => {
    if (!id) return;
    const unsub = watchMatch(id, (m) => {
      setMatch(m);
      if (!m) return;

      // Sound on new moves. We can't just gate on `prevMoveCount.current > 0`
      // because that misses the very first move ever (where prev=0, new=1).
      // Instead, gate on "have we seen at least one prior snapshot for this
      // match?" — set after the first callback fires.
      const newMoveCount = m.game?.moveCount || 0;
      if (hasSubscribed.current && newMoveCount > prevMoveCount.current) {
        const lastMove = Array.isArray(m.game.moves) ? m.game.moves[m.game.moves.length - 1] : undefined;
        if (lastMove?.claimed > 0) sfx.claim();
        else sfx.line();
      }
      prevMoveCount.current = newMoveCount;

      // Sound on status change. Read profile via ref so we don't have to
      // re-subscribe on every profile snapshot (see dep-array comment above).
      if (hasSubscribed.current && prevStatus.current !== m.status) {
        if (m.status === 'finished') {
          const p = profileRef.current;
          const isPlayer = p && m.players.includes(p.id);
          if (isPlayer) {
            const won = m.winner === p.id;
            won ? sfx.win() : (m.winner === 'draw' ? sfx.notify() : sfx.loss());
          } else {
            sfx.notify();
          }
        }
      }
      prevStatus.current = m.status;
      hasSubscribed.current = true;
    });
    return () => { hasSubscribed.current = false; unsub(); };
  }, [id, profile?.id]);

  // Tick every 250ms while the match is in countdown or active. Drives both
  // the pre-game countdown and the per-turn timer UI. Stops when the match
  // is paused or finished.
  useEffect(() => {
    if (!match) return;
    if (match.status !== 'active') return;
    // 1 Hz is enough — the displayed seconds and progress bar are smooth
    // because the bar has a CSS transition that interpolates between ticks.
    // The previous 250ms rate just burned CPU on slow phones.
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [match?.status]);

  // Subscribe to opponent's user doc for disconnect detection.
  // We only care when we're a player and the match is in play.
  useEffect(() => {
    if (!match || !profile) return;
    if (match.status !== 'active') return;
    if (!match.players.includes(profile.id)) return;
    const oppId = match.players.find(id => id !== profile.id);
    if (!oppId) return;
    const unsub = onSnapshot(doc(db, 'users', oppId), (snap) => {
      if (snap.exists()) setOpponentDoc(snap.data());
    });
    return () => unsub();
  }, [match?.status, match?.players, profile?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [Array.isArray(match?.chat) ? match.chat.length : 0]);

  // Join as spectator if not a player
  useEffect(() => {
    if (!match || !profile) return;
    if (match.players.includes(profile.id)) return;
    if ((match.spectators || []).some(s => s.id === profile.id)) return;
    joinAsSpectator(id, profile).catch(() => {});
    return () => { leaveSpectator(id, profile).catch(() => {}); };
    // eslint-disable-next-line
  }, [match?.id, profile?.id]);

  // Finalize stats when match ends
  useEffect(() => {
    if (!match || !profile || finalized) return;
    if (match.status !== 'finished') return;
    if (!match.players.includes(profile.id)) return;
    setFinalized(true);
    finalizeStats(id, profile).then((res) => {
      if (Array.isArray(res?.newlyUnlocked) ? res.newlyUnlocked.length : 0) {
        sfx.achievement();
        setAchievementToasts(res.newlyUnlocked);
      }
    }).catch(err => console.warn('Stats finalize failed:', err));
    // Dep on profile?.id, not the full `profile` object. The finalize logic
    // reads other profile fields (passed straight through to `finalizeStats`
    // for activity recording), but those are read inside the call — we just
    // need the effect to re-run when the user changes or the match status
    // flips to 'finished'. Using the whole `profile` re-ran on every
    // heartbeat-driven profile snapshot, which only wasted renders thanks
    // to the `finalized` guard but is now correctly gated.
  }, [match?.status, profile?.id, finalized, id]);

  // Auto-forfeit when MY turn timer expires. Honest path: the player whose
  // clock ran out concedes via their own client. The opponent's "Claim
  // Victory" button is the safety net for crashed/cheating clients.
  // We debounce on `turnStartedAt` so we don't spam the transaction.
  useEffect(() => {
    if (!match || !profile) return;
    if (match.status !== 'active') return;
    if (!match.players.includes(profile.id)) return;
    const isMine = match.players[match.game.currentPlayerIdx] === profile.id;
    if (!isMine) return;
    // Derive countdown end from createdAt (server-stamped) when available,
    // falling back to client-stamped startsAtMs. Mirrors the render logic
    // below; see the bigger comment there about clock-skew.
    const createdAtMs = match.createdAt?.toMillis ? match.createdAt.toMillis() : null;
    const serverDerivedStart = createdAtMs ? createdAtMs + 3500 : null;
    let effectiveStartsAtMs = serverDerivedStart ?? match.startsAtMs ?? null;
    if (effectiveStartsAtMs && match.startsAtMs && serverDerivedStart) {
      effectiveStartsAtMs = Math.min(match.startsAtMs, serverDerivedStart);
    }
    if (effectiveStartsAtMs && Date.now() < effectiveStartsAtMs) return; // pre-game
    const rawStartedAtMs = match.turnStartedAt?.toMillis ? match.turnStartedAt.toMillis() : null;
    if (!rawStartedAtMs) return;
    // Same first-turn clamp as actions.js forfeitOnTimeout — see comment there.
    const startedAtMs = effectiveStartsAtMs
      ? Math.max(rawStartedAtMs, effectiveStartsAtMs)
      : rawStartedAtMs;
    if (match.turnTimeoutMs === -1) return;
    const timeoutMs = match.turnTimeoutMs || 60000;
    const expired = Date.now() > startedAtMs + timeoutMs;
    if (!expired) return;
    if (timeoutAttempted.current === startedAtMs) return; // already tried
    timeoutAttempted.current = startedAtMs;
    forfeitOnTimeout(id, profile).catch(err => {
      console.warn('auto-forfeit failed:', err);
    });
  }, [match?.turnStartedAt, match?.game?.currentPlayerIdx, match?.status, profile?.id, now, id]);

  if (!match) {
    return <div className="fade-in font-mono text-xs tracking-widest opacity-50 text-center py-20">LOADING…</div>;
  }
  if (!profile) return null;

  const isPlayer = match.players.includes(profile.id);
  const isSpectator = !isPlayer;
  const myIdx = match.players.indexOf(profile.id);

  // Countdown end: prefer the server timestamp `createdAt + 3500ms` over the
  // client-stamped `startsAtMs`, which can be wildly off if the inviter's
  // local clock is wrong. We cap the visible countdown to the design
  // PREGAME_COUNTDOWN_MS so a skewed clock can't strand both players on
  // "Starting…" for an hour.
  const PREGAME_COUNTDOWN_MS = 3500;
  const createdAtMs = match.createdAt?.toMillis ? match.createdAt.toMillis() : null;
  const serverDerivedStart = createdAtMs ? createdAtMs + PREGAME_COUNTDOWN_MS : null;
  // Pick whichever signals "ready sooner" so clock skew never strands users.
  // If both are present and the client value is more than ~30s into the
  // future of the server value, that's a sign the writer's clock is wrong —
  // fall back to the server value.
  let effectiveStartsAtMs = serverDerivedStart ?? match.startsAtMs ?? null;
  if (effectiveStartsAtMs && match.startsAtMs && serverDerivedStart) {
    effectiveStartsAtMs = Math.min(match.startsAtMs, serverDerivedStart);
  }

  const inCountdown = !!effectiveStartsAtMs && now < effectiveStartsAtMs && match.status === 'active';
  const isMyTurn = isPlayer
                   && match.game.currentPlayerIdx === myIdx
                   && match.status === 'active'
                   && !inCountdown;
  const opponentId = match.players.find(id => id !== profile.id);

  // Turn timer state. turnStartedAt is a Firestore Timestamp; .toMillis()
  // can briefly be null after a write before the listener gets the resolved
  // value. In that window we suppress the timer UI rather than show garbage.
  // The first turn's `turnStartedAt` is stamped at match creation — i.e.
  // before the 3.5s pre-game countdown — so we clamp to effectiveStartsAtMs
  // so the first player doesn't lose ~3.5s.
  const rawTurnStartedAtMs = match.turnStartedAt?.toMillis ? match.turnStartedAt.toMillis() : null;
  const turnStartedAtMs = rawTurnStartedAtMs && effectiveStartsAtMs
    ? Math.max(rawTurnStartedAtMs, effectiveStartsAtMs)
    : rawTurnStartedAtMs;
  const turnTimeoutMs = match.turnTimeoutMs !== undefined ? match.turnTimeoutMs : 60000;
  const isTimerNegotiation = match.status === 'timer_negotiation';
  const hasTimerConfig = !!match.timerConfig;
  const amIProposer = match.timerProposer === profile.id;
  const opponentNameObj = match.players.find(id => id !== profile.id);
  const oppNameTimer = match.playerInfo?.[opponentNameObj]?.username || 'Opponent';
  const turnRemainingMs = (turnStartedAtMs && match.status === 'active' && !inCountdown && match.turnTimeoutMs !== -1)
    ? Math.max(0, turnStartedAtMs + turnTimeoutMs - now)
    : null;
  const turnExpiredWithGrace = (turnStartedAtMs && match.turnTimeoutMs !== -1)
    ? now > turnStartedAtMs + turnTimeoutMs + 5000
    : false;

  // Disconnect detection: opponent's lastSeen too old
  const opponentDisconnected = !!opponentDoc && isDisconnected(opponentDoc);
  const canClaimVictory = isPlayer
                          && !isMyTurn
                          && match.status === 'active'
                          && !inCountdown
                          && (turnExpiredWithGrace || opponentDisconnected);

  // Track which action button is currently in-flight so we can disable it
  // (prevents spam-clicking Resign / Claim Victory / Pause etc. firing
  // multiple round-trips while the first is still pending).
  // `busy` is declared at the top of the component to satisfy rules-of-hooks.
  const wrap = (key, fn) => async (...args) => {
    if (busy) return;
    setBusy(key);
    try { await fn(...args); }
    finally { setBusy(null); }
  };

  const onDrop = useCallback(async (sourceSquare, targetSquare, piece) => {
    if (!isMyTurn) return false;
    if (busy === 'move') return false;
    if (pendingGame) return false;
    // Don't set busy immediately, we will wait 3 seconds first.

    const moveObj = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece ? (piece[1].toLowerCase() === 'p' ? 'q' : piece[1].toLowerCase()) : 'q',
    };

    // Calculate pending state
    const { newGame, error } = applyMove(match.game, moveObj, profile.id, match.players);
    if (error) return false;

    setPendingGame(newGame);
    setSelectedSquare(null);
    setOptionSquares({});

    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(async () => {
      setBusy('move');
      try {
        await makeMove(id, 'chess', null, moveObj, null, profile);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setBusy(null);
        setPendingGame(null);
        pendingTimeoutRef.current = null;
      }
    }, 3000);

    return true;
  }, [isMyTurn, busy, pendingGame, match?.game, match?.players, id, profile]);

  const undoMove = () => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    setPendingGame(null);
  };

  const onSquareClick = useCallback((square, piece) => {
    if (!isMyTurn || match.status !== 'active') return;

    if (optionSquares[square]) {
      onDrop(selectedSquare, square, undefined);
      return;
    }

    const chess = new Chess(match.game.fen);
    const moves = chess.moves({ square, verbose: true });

    if (moves.length === 0) {
      setSelectedSquare(null);
      setOptionSquares({});
      return;
    }

    setSelectedSquare(square);
    const newOptions = {};
    moves.forEach(move => {
      newOptions[move.to] = {
        background: 'radial-gradient(circle, rgba(0,255,0,.2) 25%, transparent 30%)',
        borderRadius: '50%'
      };
    });
    setOptionSquares(newOptions);
  }, [isMyTurn, match?.status, optionSquares, selectedSquare, onDrop, match?.game?.fen]);

  const handleSendChat = async (e, textOverride) => {
    e?.preventDefault();
    const text = textOverride ?? chatInput;
    if (!text.trim()) return;
    try {
      await sendChatAs(id, profile, text, isSpectator);
      if (!textOverride) setChatInput('');
    } catch (err) { toast(err.message, 'error'); }
  };

  const EMOTES = ['👍', '🎯', '🔥', '😂', 'Oops!', 'GG!'];

  const handleRequestPause = wrap('pause', async () => {
    try { await requestPause(id, profile); toast('Pause requested', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  });

  const handleRespondPause = wrap('pause', async (accept) => {
    try { await respondToPause(id, profile, accept); }
    catch (err) { toast(err.message, 'error'); }
  });

  const handleResume = wrap('resume', async () => {
    try { await resumeMatch(id, profile); }
    catch (err) { toast(err.message, 'error'); }
  });

  // (useConfirm is hoisted to the top of the component to satisfy rules-of-hooks.)

  const handleResign = async () => {
    const ok = await confirm({
      title: 'Resign this match?',
      body: 'Your opponent will win.',
      confirmLabel: 'Resign',
      danger: true,
    });
    if (!ok) return;
    if (busy) return;
    setBusy('resign');
    try { await resignMatch(id, profile); }
    catch (err) { toast(err.message, 'error'); }
    finally { setBusy(null); }
  };

  const handleClaimVictory = wrap('claim', async () => {
    try { await forfeitOnTimeout(id, profile); }
    catch (err) { toast(err.message, 'error'); }
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  if (isTimerNegotiation) {
    return (
      <div className="fade-in max-w-xl mx-auto py-10 px-4">
        <div className="card text-center">
          <h2 className="font-display text-2xl mb-4">Timer Settings</h2>
          {!hasTimerConfig ? (
            <div className="space-y-4 text-left">
              <p className="font-mono text-[0.7rem] uppercase tracking-widest opacity-60 mb-4">Propose Timer Settings</p>

              {match.timerRejectReason && (
                 <div className="bg-red-500/10 border border-red-500/20 p-3 mb-4 text-sm">
                   <strong className="text-red-400">Rejected:</strong> {match.timerRejectReason}
                 </div>
              )}

              <label htmlFor="use-timer" className="flex items-center gap-2 cursor-pointer mb-2">
                <input id="use-timer" type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} />
                <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-80">Use Timer (per turn)</span>
              </label>
              {useTimer && (
                <div className="mb-4">
                  <label htmlFor="timer-mins" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Minutes per turn</label>
                  <input id="timer-mins" type="number" value={timerMins} onChange={e => setTimerMins(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" min={1} required />
                </div>
              )}
              <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-4">Note: Both players should agree on the timer settings.</div>
              <button
                className="btn-primary w-full justify-center"
                onClick={async () => {
                  setProposingTimer(true);
                  try {
                    await proposeTimer(id, profile, useTimer, useTimer ? timerMins : null);
                  } catch (e) {
                    toast(e.message, 'error');
                  }
                  setProposingTimer(false);
                }}
                disabled={proposingTimer}
              >
                Propose Timer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
               {amIProposer ? (
                 <div>
                   <p className="mb-4">Waiting for {oppNameTimer} to accept timer settings...</p>
                   <div className="font-mono text-xs opacity-70">
                     {match.timerConfig.useTimer ? `${match.timerConfig.timerMins} minutes per turn` : 'No timer'}
                   </div>
                 </div>
               ) : (
                 <div>
                   <p className="mb-4">{oppNameTimer} proposed the following timer settings:</p>
                   <div className="font-mono text-sm font-bold mb-6">
                     {match.timerConfig.useTimer ? `${match.timerConfig.timerMins} minutes per turn` : 'No timer'}
                   </div>
                   <div className="flex gap-3 justify-center">
                     <button className="btn-primary" onClick={async () => {
                       try {
                         await acceptTimer(id, profile, match.timerConfig.useTimer, match.timerConfig.timerMins);
                       } catch (e) { toast(e.message, 'error'); }
                     }}>Accept</button>

                     <button className="btn-ghost" onClick={async () => {
                       const reason = await prompt({
                         title: 'Reject Timer',
                         body: 'Why are you rejecting these settings?',
                         confirmLabel: 'Reject',
                         cancelLabel: 'Cancel',
                         danger: true
                       });
                       if (reason !== null) {
                         try {
                           await rejectTimer(id, profile, reason);
                         } catch (e) { toast(e.message, 'error'); }
                       }
                     }}>Reject</button>
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
        {confirmDialogEl}
        {promptDialogEl}
      </div>
    );
  }

  if (match.status === 'finished') {
    return <WinScreen match={match} profile={profile} achievementToasts={achievementToasts}
                      onHome={() => navigate('/')}
                      onReplay={() => navigate(`/replay/${id}`)} />;
  }

  const displayGame = pendingGame || match.game;

  // Pause concealment - hide board if paused
  const concealBoard = match.status === 'paused' && match.pauseConcealed;
  const lastMove = (Array.isArray(displayGame.moves) ? displayGame.moves : []).slice(-1)[0];

  const customSquareStyles = {
    ...(lastMove ? {
      [lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    } : {}),
    ...optionSquares,
    ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' } } : {})
  };

  return (
    <>
    {confirmDialogEl}
    <div className="fade-in grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Game area */}
      <div className="space-y-6">
        {/* Pre-game countdown banner */}
        {inCountdown && (
          <div className="card flex items-center justify-between"
               style={{ background: 'var(--bg-soft)', borderColor: 'var(--hairline-strong)' }}>
            <div className="flex items-center gap-3">
              <div>
                <div className="font-display text-base">Starting…</div>
                <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Get ready</div>
              </div>
            </div>
            <div className="font-display text-5xl font-medium tabular-nums">
              {(() => {
                const remaining = (effectiveStartsAtMs - now) / 1000;
                if (remaining <= 1) return 'GO';
                return Math.ceil(remaining);
              })()}
            </div>
          </div>
        )}

        {/* Status banner */}
        {match.status === 'paused' && (
          <div className="card flex items-center justify-between" style={{ background: 'rgba(183,121,31,0.05)', borderColor: 'rgba(183,121,31,0.3)' }}>
            <div className="flex items-center gap-3">
              <Pause size={16} style={{ color: 'var(--ochre)' }} />
              <div>
                <div className="font-display text-base">Match Paused</div>
                <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Board hidden to prevent strategizing</div>
              </div>
            </div>
            {isPlayer && (
              <button onClick={handleResume} className="btn-primary">
                <Play size={14} /> Resume
              </button>
            )}
          </div>
        )}

        {match.pauseRequest && match.status === 'active' && (
          <PauseRequestCard
            request={match.pauseRequest}
            currentUserId={profile.id}
            playerInfo={match.playerInfo}
            isPlayer={isPlayer}
            onRespond={handleRespondPause}
          />
        )}

        {/* Turn timer + disconnect / claim victory */}
        {turnRemainingMs !== null && (
          <TurnTimerBanner
            remainingMs={turnRemainingMs}
            timeoutMs={turnTimeoutMs}
            isMyTurn={isMyTurn}
            isPlayer={isPlayer}
            opponentDisconnected={opponentDisconnected}
            opponentName={match.playerInfo?.[opponentId]?.username}
            canClaimVictory={canClaimVictory}
            onClaimVictory={handleClaimVictory}
          />
        )}

        {/* Scoreboard */}
        <div className="grid grid-cols-2 gap-3">
          {match.players.map((pid, i) => {
            const info = match.playerInfo?.[pid] || { username: '?', avatar: '?' };
            const isCurrent = displayGame.currentPlayerIdx === i && match.status === 'active' && !inCountdown;
            return (
              <div key={pid}
                className="border p-4 transition-all"
                style={{
                  borderColor: isCurrent ? PLAYER_COLORS[i].hex : 'var(--hairline)',
                  background: isCurrent ? PLAYER_COLORS[i].soft : 'transparent',
                }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display text-xl shrink-0">{info.avatar}</span>
                    <span className="font-display text-base truncate">
                      {info.username}{pid === profile.id ? ' (you)' : ''}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="font-mono text-[0.55rem] tracking-widest opacity-60 shrink-0">● TURN</span>
                  )}
                </div>
                <div className="font-display text-3xl font-medium tabular-nums" style={{ color: PLAYER_COLORS[i].hex }}>
                  {displayGame.scores[pid] || 0}
                </div>
              </div>
            );
          })}
        </div>

        {/* Board */}
        <div className="flex justify-center">
          {concealBoard ? (
            <div className="text-center italic opacity-50 py-10">Board hidden while paused</div>
          ) : (
            <div className="w-full max-w-[500px]">
              <Chessboard
                position={displayGame.fen}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation={match.players.indexOf(profile?.id) === 1 ? 'black' : 'white'}
                customDarkSquareStyle={{ backgroundColor: 'var(--ochre)' }}
                customLightSquareStyle={{ backgroundColor: 'var(--paper-tint)' }}
                customSquareStyles={customSquareStyles}
              />
            </div>
          )}
        </div>

        {pendingGame && (
          <div className="flex justify-center fade-in">
            <button onClick={undoMove} className="btn-ghost text-sm py-1 px-3 border border-current rounded">
              Undo Move (3s)
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-xs tracking-wide opacity-60">
            {isSpectator ? (
              <><Eye size={12} className="inline mr-1" /> Spectating · {(Array.isArray(match.spectators) ? match.spectators.length : 0)} watching</>
            ) : inCountdown ? (
              'Starting…'
            ) : isMyTurn ? (
              '◆ Your move'
            ) : match.status === 'paused' ? (
              'Paused'
            ) : (
              `Waiting for ${match.playerInfo?.[match.players[match.game.currentPlayerIdx]]?.username}…`
            )}
          </div>
          <div className="flex gap-2">
            {isPlayer && match.status === 'active' && !match.pauseRequest && !inCountdown && (
              <button onClick={handleRequestPause} className="btn-ghost"
                      disabled={busy === 'pause'}
                      aria-label="Request pause">
                <Pause size={12} aria-hidden="true" /> Pause
              </button>
            )}
            {isPlayer && match.status !== 'finished' && (
              <button onClick={handleResign} className="btn-danger"
                      disabled={busy === 'resign'}
                      aria-label="Resign match">
                <Flag size={12} aria-hidden="true" /> Resign
              </button>
            )}
            <button onClick={async () => {
              // Confirm before leaving a live match — easy to misclick the
              // Lobby button mid-game otherwise. Spectators don't get the
              // prompt; they're not invested.
              if (isPlayer && match.status !== 'finished') {
                const ok = await confirm({
                  title: 'Leave this match?',
                  body: 'The match continues without you. Your turn timer keeps running — if it expires you forfeit. You can rejoin from the Lobby or Home page.',
                  confirmLabel: 'Leave',
                });
                if (!ok) return;
              }
              navigate('/lobby');
            }} className="btn-ghost" aria-label="Back to lobby">
              <Home size={12} aria-hidden="true" /> Lobby
            </button>
          </div>
        </div>
      </div>

      {/* Chat sidebar */}
      <div className="border hairline flex flex-col" style={{ minHeight: 400, maxHeight: 600 }}>
        <div className="px-4 py-3 border-b hairline flex items-center justify-between">
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Chat</div>
          <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">
            <Eye size={10} className="inline mr-1" /> {(Array.isArray(match.spectators) ? match.spectators.length : 0)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {(Array.isArray(match.chat) ? match.chat.length : 0) === 0 && (
            <div className="font-mono text-[0.65rem] opacity-40 text-center py-8 italic">
              No messages yet
            </div>
          )}
          {(match.chat || []).map(msg => {
            const isPlayerMsg = match.players.includes(msg.userId);
            const playerIdx = match.players.indexOf(msg.userId);
            const color = isPlayerMsg ? PLAYER_COLORS[playerIdx].hex : '#888';
            return (
              <div key={msg.id} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-base shrink-0">{msg.avatar}</span>
                  <span className="font-mono text-[0.65rem] tracking-wide font-medium" style={{ color }}>
                    {msg.username}
                  </span>
                  {msg.isSpectator && (
                    <span className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50">spec</span>
                  )}
                </div>
                <div className="font-display text-base ml-7 leading-snug break-words">{msg.text}</div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t hairline px-2 py-1.5 flex gap-1 overflow-x-auto scrollbar-none" aria-label="Quick reactions">
          {EMOTES.map(emote => (
            <button
              key={emote}
              onClick={() => handleSendChat(null, emote)}
              className="px-2 py-1 text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors whitespace-nowrap focus-ring"
              title={`Send ${emote}`}
            >
              {emote}
            </button>
          ))}
        </div>
        <form onSubmit={handleSendChat} className="border-t hairline p-2 flex gap-2 items-center">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value.slice(0, 200))}
            placeholder="Say something…"
            aria-label="Chat message"
            maxLength={200}
            className="flex-1 bg-transparent font-display text-base outline-none px-2"
          />
          {chatInput.length > 150 && (
            <span className="font-mono text-[0.55rem] opacity-50 tabular-nums">{chatInput.length}/200</span>
          )}
          <button type="submit" disabled={!chatInput.trim()} className="opacity-60 hover:opacity-100 disabled:opacity-20 px-2" aria-label="Send chat message">
            <Send size={14} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
    </>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────
function TurnTimerBanner({ remainingMs, timeoutMs, isMyTurn, isPlayer, opponentDisconnected, opponentName, canClaimVictory, onClaimVictory }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.max(0, Math.min(1, remainingMs / timeoutMs));
  // Color the timer by urgency
  const color = remainingMs < 10000 ? 'var(--crimson)'
              : remainingMs < 20000 ? 'var(--ochre)'
              : 'var(--ink)';

  // Show "Claim Victory" UI when opponent has timed out or appears to have
  // disconnected. Otherwise just show the standard countdown.
  if (canClaimVictory) {
    return (
      <div className="card flex items-center justify-between gap-3 flex-wrap"
           style={{ background: 'rgba(185,28,60,0.06)', borderColor: 'rgba(185,28,60,0.3)' }}>
        <div className="flex items-center gap-3">
          {opponentDisconnected
            ? <WifiOff size={16} style={{ color: 'var(--crimson)' }} />
            : <Clock size={16} style={{ color: 'var(--crimson)' }} />}
          <div>
            <div className="font-display text-base">
              {opponentDisconnected ? 'Opponent disconnected' : "Opponent's time is up"}
            </div>
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">
              {opponentName ? `${opponentName} ` : 'They '}haven't moved
            </div>
          </div>
        </div>
        <button onClick={onClaimVictory} className="btn-primary">
          <Trophy size={12} /> Claim Victory
        </button>
      </div>
    );
  }

  return (
    <div className="border hairline px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Clock size={14} style={{ color, opacity: 0.8 }} />
        <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-70">
          {!isPlayer ? 'Spectating'
            : isMyTurn ? 'Your turn'
            : opponentDisconnected ? `${opponentName || 'Opponent'} idle`
            : `${opponentName || 'Opponent'}'s turn`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block" style={{ width: 80, height: 4, background: 'var(--hairline)' }}>
          <div role="progressbar" aria-valuenow={Math.min(timeoutMs / 1000, seconds)} aria-valuemin={0} aria-valuemax={timeoutMs / 1000} style={{ width: (fraction * 100) + '%', height: '100%', background: color, transition: 'width 1000ms linear' }} />
        </div>
        <span className="font-mono text-sm tabular-nums" style={{ color }}>
          {seconds}s
        </span>
      </div>
    </div>
  );
}

// Per-player line stroke style. Combined with color, this gives a
// non-color signal (dasharray pattern) so a color-blind player can still
// tell players apart. The patterns are subtle enough that everyone else
// barely notices, but they're meaningfully different up close.
// Index matches PLAYER_COLORS order.
const PLAYER_STROKE_PATTERNS = [
  undefined,           // P1: solid
  '6 3',               // P2: short dash
  '2 3',               // P3: dotted
  '8 3 2 3',           // P4: dash-dot
];

// Optimization (Bolt): React.memo prevents the concealed board from re-rendering every second.
const ConcealedBoard = memo(function ConcealedBoard({ rows, cols }) {
  const cell = Math.min(70, Math.max(28, 520 / Math.max(rows, cols)));
  const padding = 30;
  const w = cols * cell + padding * 2;
  const h = rows * cell + padding * 2;
  return (
    <div className="relative" style={{ width: w, maxWidth: '100%', height: h }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ filter: 'blur(12px)', opacity: 0.4 }}>
        {Array.from({ length: rows + 1 }).map((_, r) =>
          Array.from({ length: cols + 1 }).map((_, c) => (
            <circle key={`d-${r}-${c}`} cx={padding + c * cell} cy={padding + r * cell} r={3} fill="currentColor" />
          ))
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Pause size={36} style={{ opacity: 0.4 }} />
        <div className="font-mono text-[0.7rem] tracking-widest uppercase opacity-50 mt-3">Board hidden</div>
      </div>
    </div>
  );
});

function PauseRequestCard({ request, currentUserId, playerInfo, isPlayer, onRespond }) {
  const requester = playerInfo?.[request.byId];
  const isMyRequest = request.byId === currentUserId;
  const acceptBtnRef = useRef(null);
  // Focus the Accept button when the card appears for the opponent (the
  // one who has to respond). Without this the user has to mouse-grab the
  // button or tab through the whole page to reach it.
  useEffect(() => {
    if (!isMyRequest && isPlayer) {
      acceptBtnRef.current?.focus();
    }
  }, [isMyRequest, isPlayer]);
  return (
    <div className="card" role="alert" style={{ background: 'rgba(183,121,31,0.05)', borderColor: 'rgba(183,121,31,0.3)' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Pause size={16} style={{ color: 'var(--ochre)' }} aria-hidden="true" />
          <div>
            <div className="font-display text-base">
              {isMyRequest ? 'Pause request sent' : `${requester?.username || 'Player'} wants to pause`}
            </div>
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">
              {isMyRequest ? 'Waiting for opponent…' : 'Both players must agree'}
            </div>
          </div>
        </div>
        {isPlayer && !isMyRequest && (
          <div className="flex gap-2">
            <button ref={acceptBtnRef} onClick={() => onRespond(true)} className="btn-primary">Accept</button>
            <button onClick={() => onRespond(false)} className="btn-ghost">Decline</button>
          </div>
        )}
      </div>
    </div>
  );
}

function WinScreen({ match, profile, achievementToasts, onHome, onReplay }) {
  const players = match.players.map(id => match.playerInfo?.[id] || { username: '?', avatar: '?' });
  const scores = match.players.map(id => match.game.scores[id] || 0);
  const sorted = match.players.map((id, i) => ({ id, ...players[i], score: scores[i], idx: i }))
                              .sort((a, b) => b.score - a.score);
  const isPlayer = match.players.includes(profile.id);
  const isDraw = match.winner === 'draw';
  const youWon = match.winner === profile.id;
  const wasResigned = !!match.resignedBy;

  const historyEntry = (profile?.matchHistory || []).find(h => h.matchId === match.id);
  const eloDelta = historyEntry?.eloDelta;
  const newElo = historyEntry?.eloAfter ?? profile?.elo ?? 1000;
  const rankInfo = getRankInfo(newElo);
  const rank = rankInfo.rank;
  const nextRank = rankInfo.nextRank;
  const rankProgress = rankInfo.progress;


  const [rematchState, setRematchState] = useState('idle'); // idle | sending | sent | error
  const [friendRequestState, setFriendRequestState] = useState('idle');

  const opponentId = match.players.find(id => id !== profile.id);
  const opponentInfo = match.playerInfo?.[opponentId];
  const isFriend = (Array.isArray(profile.friends) ? profile.friends : []).includes(opponentId);
  const hasPendingRequest = (Array.isArray(profile.outgoingFriendRequests) ? profile.outgoingFriendRequests : []).includes(opponentId);
  const hasIncomingRequest = (Array.isArray(profile.friendRequests) ? profile.friendRequests : []).some(r => r.fromId === opponentId);

  const handleAddFriend = async () => {
    if (friendRequestState === 'sending' || friendRequestState === 'sent') return;
    if (!opponentInfo?.username) return;
    setFriendRequestState('sending');
    try {
      await sendFriendRequest(profile, opponentInfo.username);
      setFriendRequestState('sent');
      toast('Friend request sent', 'success');
      sfx.click();
    } catch (e) {
      setFriendRequestState('idle');
      toast(e.message, 'error');
    }
  };
  const handleRematch = async () => {
    if (rematchState === 'sending' || rematchState === 'sent') return;
    setRematchState('sending');
    try {
      await requestRematch(match, profile);
      setRematchState('sent');
      toast('Rematch invite sent', 'success');
      sfx.click();
    } catch (e) {
      setRematchState('idle');
      toast(e.message, 'error');
    }
  };

  let title;
  if (isDraw) title = 'A draw';
  else if (isPlayer && youWon) title = 'Victory';
  else if (isPlayer && !youWon) title = 'Defeat';
  else {
    const winner = match.players.find(id => id === match.winner);
    const winnerInfo = match.playerInfo?.[winner];
    title = `${winnerInfo?.username || '?'} wins`;
  }

  return (
    <div className="fade-in max-w-xl mx-auto text-center py-10">
      {/* Confetti only on personal victory */}
      {isPlayer && youWon && <Confetti />}

      {isDraw ? (
        <Handshake size={36} style={{ margin: '0 auto', opacity: 0.6 }} aria-hidden="true" />
      ) : (
        <Trophy size={36} style={{ margin: '0 auto', opacity: 0.6, color: youWon ? 'var(--ochre)' : 'var(--ink)' }} aria-hidden="true" />
      )}
      <h2 className="font-display mt-6 mb-2 leading-tight" style={{ fontSize: 'clamp(2.5rem, 7vw, 4rem)', fontWeight: 500 }}>
        {title}
      </h2>
      {wasResigned && (
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-4">
          By resignation
        </div>
      )}
      <div className="font-mono text-xs tracking-widest uppercase opacity-55 mb-12">Final score</div>

      <div className="space-y-2 max-w-sm mx-auto mb-8">
        {sorted.map(p => (
          <div key={p.id} className="flex items-center justify-between border hairline px-4 py-3"
               style={{ background: PLAYER_COLORS[p.idx].soft }}>
            <div className="flex items-center gap-3">
              <span className="font-display text-xl">{p.avatar}</span>
              <span className="font-display text-lg">{p.username}{p.id === profile.id ? ' (you)' : ''}</span>
            </div>
            <span className="font-display text-2xl font-medium tabular-nums" style={{ color: PLAYER_COLORS[p.idx].hex }}>
              {p.score}
            </span>
          </div>
        ))}
      </div>


      {/* Post-Match Progression (ELO & Streak) */}
      {isPlayer && historyEntry && (
        <div className="mb-8 text-left border hairline p-4 bg-black/5" style={{ borderColor: 'var(--hairline)' }}>
          <div className="flex justify-between items-end mb-2">
            <div className="font-mono text-xs tracking-widest uppercase" style={{ color: rank.color }}>
              {rank.name} · {newElo} ELO
              <span className="ml-2" style={{ color: eloDelta >= 0 ? 'var(--forest)' : 'var(--crimson)' }}>
                {eloDelta > 0 ? '+' : ''}{eloDelta}
              </span>
            </div>
            {nextRank && (
              <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">
                Next: {nextRank.name} ({nextRank.min})
              </div>
            )}
          </div>
          {nextRank && (
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{ width: `${rankProgress}%`, background: rank.color }}
              />
            </div>
          )}
          {youWon && (profile.winStreak || 0) > 1 && (
            <div className="mt-3 font-mono text-[0.7rem] tracking-widest uppercase" style={{ color: 'var(--ochre)' }}>
              🔥 {profile.winStreak} Win Streak
            </div>
          )}
        </div>
      )}

      {/* Achievement unlocks */}
      {achievementToasts.length > 0 && (
        <div className="mb-8">
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-3">
            ◆ Achievement{achievementToasts.length > 1 ? 's' : ''} Unlocked
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            {achievementToasts.map(id => {
              const a = getAchievementById(id);
              if (!a) return null;
              return (
                <div key={id} className="card fade-in text-left" style={{ background: 'rgba(183,121,31,0.05)', borderColor: 'rgba(183,121,31,0.3)' }}>
                  <div className="font-display text-lg">{a.name}</div>
                  <div className="font-mono text-[0.65rem] tracking-wide opacity-70 mt-1 leading-relaxed">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        {isPlayer && (
          <>
            <button onClick={handleRematch} disabled={rematchState === 'sending' || rematchState === 'sent'}
                    className="btn-ghost">
              <Repeat size={14} />{' '}
              {rematchState === 'sent' ? 'Rematch sent'
                : rematchState === 'sending' ? 'Sending…'
                : 'Rematch'}
            </button>
            {opponentInfo && !isFriend && !hasPendingRequest && !hasIncomingRequest && (
              <button onClick={handleAddFriend} disabled={friendRequestState === 'sending' || friendRequestState === 'sent'}
                      className={friendRequestState === 'sent' ? 'btn-ghost opacity-50' : 'btn-ghost'}>
                <UserPlus size={14} />{' '}
                {friendRequestState === 'sent' ? 'Request sent'
                  : friendRequestState === 'sending' ? 'Sending…'
                  : 'Add Friend'}
              </button>
            )}
          </>
        )}
        <button onClick={onReplay} className="btn-ghost"><RotateCcw size={14} /> Watch Replay</button>
        <button onClick={onHome} className="btn-primary"><Home size={14} /> Home</button>
      </div>
    </div>
  );
}
