import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, runTransaction,
  arrayUnion, arrayRemove, increment, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { createEmptyGame, applyMove, computeElo } from './gameLogic';
import { createEmptyGame as createEmptyGameC4, applyMove as applyMoveC4 } from './connect4Logic';
import { createEmptyGame as createEmptyGameTTT, applyMove as applyMoveTTT } from './tictactoeLogic';
import { createEmptyGame as createEmptyGameChess, applyMove as applyMoveChess } from './chessLogic.js';
import { checkUnlocks } from './achievements';
import { recordActivity, ACTIVITY_TYPES } from './activity';

// Pre-game countdown duration (ms). Both clients use the same `startsAtMs`
// stored on the match document to render a synchronized 3..2..1 countdown.
const PREGAME_COUNTDOWN_MS = 3500;

// Per-turn timeout (ms). When a player's turn starts, `turnStartedAt` is
// stamped on the match doc with serverTimestamp(). If a player doesn't move
// within this window, either client can call forfeitOnTimeout to settle the
// match. Note: this is enforceable only against honest clients — a
// determined cheater can disable JS to avoid auto-forfeiting. For a casual
// game this is good enough; the opponent's "Claim Victory" button is the
// safety net for abandoned games.
const TURN_TIMEOUT_MS = 60 * 1000;

// ─── Guard ────────────────────────────────────────────────────────────────
export function guard(user) {
  if (user?._isImpersonated) {
    throw new Error('Action blocked: you are in read-only impersonation mode.');
  }
}

// ─── User lookups ─────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function lookupUserByUsername(username) {
  const clean = (username || '').toLowerCase().trim();
  // Invalid format → don't even hit Firestore. Callers treat null as
  // "user not found", which is the same friendly UX whether the user
  // typo'd a real name or pasted in something with spaces.
  if (!USERNAME_RE.test(clean)) return null;
  const snap = await getDoc(doc(db, 'usernames', clean));
  if (!snap.exists()) return null;
  const { uid } = snap.data();
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  return { id: uid, ...userSnap.data() };
}

// ─── Invites ──────────────────────────────────────────────────────────────
// invites collection: { fromId, fromUsername, toId, toUsername, rows, cols, status, createdAt, matchId? }
export async function sendInvite(fromUser, toUsername, rows, cols, gameType = 'dots') {
  guard(fromUser);
  const target = await lookupUserByUsername(toUsername);
  if (!target) throw new Error('User not found');
  if (target.id === fromUser.id) throw new Error("You can't invite yourself");
  if ((target.blocked || []).includes(fromUser.id)) throw new Error('Cannot invite this user');

  // Prevent duplicate pending invites — if I already have one outstanding
  // to this user, surface a friendlier error rather than piling up cards.
  const existing = await getDocs(query(
    collection(db, 'invites'),
    where('fromId', '==', fromUser.id),
    where('toId', '==', target.id),
    where('status', '==', 'pending'),
    limit(1),
  ));
  if (!existing.empty) {
    throw new Error('You already have a pending invite to this user');
  }

  const inv = await addDoc(collection(db, 'invites'), {
    fromId: fromUser.id,
    fromUsername: fromUser.username,
    fromAvatar: fromUser.avatar || '◆',
    fromElo: fromUser.elo || 1000,
    fromLineStyle: fromUser.lineStyle || 'solid',
    toId: target.id,
    toUsername: target.username,
    rows, cols,
    gameType,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return inv.id;
}

export async function acceptInvite(inviteId, currentUser) {
  guard(currentUser);
  const invRef = doc(db, 'invites', inviteId);
  const matchRef = doc(collection(db, 'matches'));

  return await runTransaction(db, async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) throw new Error('Invite not found');
    const inv = invSnap.data();
    if (inv.toId !== currentUser.id) throw new Error('Not your invite');

    // Idempotency for double-clicks, duplicate notification taps, and two tabs.
    // Once an invite has an accepted matchId, every retry returns that same match
    // instead of creating another game.
    if (inv.status === 'accepted' && inv.matchId) return inv.matchId;
    if (inv.status !== 'pending') throw new Error('Invite already handled');

    // Create the match. `startsAtMs` is a client-side wall-clock time both
    // players use to drive a synchronized pre-game countdown. We accept that
    // network latency may shift each player's perceived countdown by ~100ms
    // — fine for a 3-second UX, and `makeMove` enforces the gate transaction-side.
    const playerIds = [inv.fromId, inv.toId];
    const startsAtMs = Date.now() + PREGAME_COUNTDOWN_MS;

    const gType = inv.gameType || 'dots';
    let newGame;
    if (gType === 'connect4') newGame = createEmptyGameC4(inv.rows, inv.cols, playerIds);
    else if (gType === 'tictactoe') newGame = createEmptyGameTTT(inv.rows, inv.cols, playerIds);
    else if (gType === 'chess') newGame = createEmptyGameChess(playerIds);
    else newGame = createEmptyGame(inv.rows, inv.cols, playerIds);

    const isChess = gType === 'chess';
    tx.set(matchRef, {
      players: playerIds,
      playerInfo: {
        [inv.fromId]: { username: inv.fromUsername, avatar: inv.fromAvatar, elo: inv.fromElo, lineStyle: inv.fromLineStyle },
        [inv.toId]:   { username: currentUser.username, avatar: currentUser.avatar || '◆', elo: currentUser.elo || 1000, lineStyle: currentUser.lineStyle || 'solid' },
      },
      rows: inv.rows,
      cols: inv.cols,
      gameType: gType,
      game: newGame,
      status: isChess ? 'timer_negotiation' : 'active',
      pauseRequest: null,
      pauseConcealed: false,
      spectators: [],
      chat: [],
      winner: null,
      ...(isChess ? {} : { startsAtMs }),
      ...(isChess ? {} : { turnStartedAt: serverTimestamp() }),
      turnTimeoutMs: TURN_TIMEOUT_MS,
      createdAt: serverTimestamp(),
      finishedAt: null,
      timerConfig: null,
      timerProposer: null,
      timerRejectReason: null,
    });

    tx.update(invRef, { status: 'accepted', matchId: matchRef.id });
    return matchRef.id;
  });
}

export async function declineInvite(inviteId, currentUser) {
  guard(currentUser);
  const invRef = doc(db, 'invites', inviteId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return;
  if (invSnap.data().toId !== currentUser.id) throw new Error('Not your invite');
  await updateDoc(invRef, { status: 'declined' });
}

export async function cancelInvite(inviteId, currentUser) {
  guard(currentUser);
  const invRef = doc(db, 'invites', inviteId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return;
  if (invSnap.data().fromId !== currentUser.id) throw new Error('Not your invite');
  await deleteDoc(invRef);
}

// Mark an accepted invite as "consumed" so Dashboard's listener doesn't
// re-fire on it. Called after navigating to a match. Any user can clear
// their own outgoing invite — we use updateDoc against an existing doc so
// the rule allowing sender/recipient to update applies.
export async function consumeAcceptedInvite(inviteId, currentUser) {
  guard(currentUser);
  const invRef = doc(db, 'invites', inviteId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return;
  const inv = invSnap.data();
  if (inv.fromId !== currentUser.id && inv.toId !== currentUser.id) return;
  if (inv.status !== 'accepted') return;
  await updateDoc(invRef, { status: 'consumed' }).catch(() => {});
}

// ─── Quick Match ─────────────────────────────────────────────────────────
// Find an online opponent within ±200 ELO and send them an invite.
// Returns { ok: true, opponent } on success, or throws with a friendly
// "no players found" message.
export async function quickMatch(currentUser, rows = 5, cols = 5, gameType = 'dots') {
  guard(currentUser);
  const myElo = currentUser.elo || 1000;
  const blockedByMe = currentUser.blocked || [];

  // Build the set of users I've challenged in the last 10 minutes so I
  // don't keep pinging the same person who isn't responding. We look at
  // ALL recent invite statuses (pending/declined/cancelled), not just
  // declined — a stale-pending state is just as annoying.
  const RECENT_INVITE_WINDOW_MS = 10 * 60 * 1000;
  const recentlyInvited = new Set();
  try {
    const recent = await getDocs(query(
      collection(db, 'invites'),
      where('fromId', '==', currentUser.id),
      orderBy('createdAt', 'desc'),
      limit(20),
    ));
    const cutoff = Date.now() - RECENT_INVITE_WINDOW_MS;
    for (const d of recent.docs) {
      const inv = d.data();
      const ts = inv.createdAt?.toMillis?.() || 0;
      if (ts >= cutoff) recentlyInvited.add(inv.toId);
    }
  } catch {} // missing composite index? Don't block quick-match on it.

  // Pull a sample of online users. We don't combine where+orderBy because
  // that requires a composite index — instead we sort client-side. We also
  // can't filter on "the target's blocked array doesn't contain me"
  // server-side, so we fetch candidates and filter in JS.
  const q = query(
    collection(db, 'users'),
    where('online', '==', true),
    limit(50)
  );
  const snap = await getDocs(q);
  const candidates = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u =>
      u.id !== currentUser.id
      && !blockedByMe.includes(u.id)
      && !(u.blocked || []).includes(currentUser.id)
      && !recentlyInvited.has(u.id)
      && Math.abs((u.elo || 1000) - myElo) <= 200
    );

  if (candidates.length === 0) {
    throw new Error('No new players online right now — try again in a minute');
  }

  // Pick the closest by ELO; tie-break randomly so two players hitting the
  // button at once don't always pair with the exact same person.
  candidates.sort((a, b) => {
    const da = Math.abs((a.elo || 1000) - myElo);
    const db_ = Math.abs((b.elo || 1000) - myElo);
    if (da !== db_) return da - db_;
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 - 0.5;
  });
  const target = candidates[0];

  // Reuse the regular invite flow.
  await sendInvite(currentUser, target.username, rows, cols, gameType);
  return { ok: true, opponent: { username: target.username, elo: target.elo || 1000 } };
}

// ─── Rematch ─────────────────────────────────────────────────────────────
// After a finished match, send a fresh invite to the same opponent with the
// same board size. Marks the invite with `isRematch: true` so the recipient
// can see at a glance that this comes from a recently-finished game.
export async function requestRematch(match, currentUser) {
  guard(currentUser);
  if (!match || match.status !== 'finished') throw new Error('Match not finished');
  if (!match.players.includes(currentUser.id)) throw new Error('Not a player');
  const opponentId = match.players.find(id => id !== currentUser.id);
  const opponentUsername = match.playerInfo?.[opponentId]?.username;
  if (!opponentUsername) throw new Error('Opponent unknown');
  // Reuse sendInvite then patch the resulting doc to add the rematch flag.
  // (Patching after the create is cheaper than threading a flag through
  // every call site of sendInvite.)
  const inviteId = await sendInvite(currentUser, opponentUsername, match.rows, match.cols, match.gameType || 'dots');
  await updateDoc(doc(db, 'invites', inviteId), { isRematch: true, prevMatchId: match.id }).catch(() => {});
  return inviteId;
}

// ─── Matches ─────────────────────────────────────────────────────────────
export async function hostGame(currentUser, gameType, rows, cols) {
  guard(currentUser);
  let game;
  if (gameType === 'connect4') game = createEmptyGameC4(rows, cols, [currentUser.id]);
  else if (gameType === 'tictactoe') game = createEmptyGameTTT(rows, cols, [currentUser.id]);
  else if (gameType === 'chess') game = createEmptyGameChess([currentUser.id]);

  const docRef = await addDoc(collection(db, 'matches'), {
    gameType,
    players: [currentUser.id],
    playerInfo: {
      [currentUser.id]: { username: currentUser.username, avatar: currentUser.avatar || '◆', elo: currentUser.elo || 1000, lineStyle: currentUser.lineStyle || 'solid' }
    },
    rows,
    cols,
    game,
    status: 'waiting', // waiting | active | paused | finished
    createdAt: serverTimestamp(),
    timerConfig: null,
    timerProposer: null,
    timerRejectReason: null,
  });
  return docRef.id;
}

export async function cancelGame(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) return;
    const m = snap.data();
    if (m.status !== 'waiting') throw new Error('Game already started');
    if (!m.players.includes(currentUser.id)) throw new Error('Not your game');
    tx.delete(matchRef);
  });
}

export async function joinGame(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const m = snap.data();
    if (m.status !== 'waiting') throw new Error('Game already started');
    if (m.players.includes(currentUser.id)) throw new Error('You are already in this game');

    const playerIds = [m.players[0], currentUser.id];
    let game;
    if (m.gameType === 'connect4') game = createEmptyGameC4(m.rows, m.cols, playerIds);
    else if (m.gameType === 'tictactoe') game = createEmptyGameTTT(m.rows, m.cols, playerIds);
    else if (m.gameType === 'chess') game = createEmptyGameChess(playerIds);

    const startsAtMs = Date.now() + PREGAME_COUNTDOWN_MS;

    const isChess = m.gameType === 'chess';
    tx.update(matchRef, {
      players: playerIds,
      [`playerInfo.${currentUser.id}`]: { username: currentUser.username, avatar: currentUser.avatar || '◆', elo: currentUser.elo || 1000, lineStyle: currentUser.lineStyle || 'solid' },
      game,
      status: isChess ? 'timer_negotiation' : 'active',
      pauseRequest: null,
      pauseConcealed: false,
      spectators: [],
      chat: [],
      winner: null,
      ...(isChess ? {} : { startsAtMs }),
      ...(isChess ? {} : { turnStartedAt: serverTimestamp() }),
      turnTimeoutMs: TURN_TIMEOUT_MS,
      timerConfig: null,
      timerProposer: null,
      timerRejectReason: null,
    });
  });
}

export function watchMatch(matchId, callback) {
  return onSnapshot(doc(db, 'matches', matchId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

export async function makeMove(matchId, gameType, orientation, r, c, currentUser) {
  guard(currentUser);
  await runTransaction(db, async (tx) => {
// ... (rest of makeMove)
    const matchRef = doc(db, 'matches', matchId);
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const m = snap.data();
    if (m.status !== 'active') throw new Error('Game not active');

    // Pre-game countdown gate. We use the client's clock here, but since
    // `startsAtMs` was set ~3.5s in the future at match creation, this
    // window closes naturally for both players within a small skew.
    if (m.startsAtMs && Date.now() < m.startsAtMs) {
      throw new Error('Game starting…');
    }

    const playerIdx = m.players.indexOf(currentUser.id);
    if (playerIdx === -1) throw new Error('Not a player');
    if (m.game.currentPlayerIdx !== playerIdx) throw new Error('Not your turn');

    let result;
    if (gameType === 'connect4') {
      result = applyMoveC4(m.game, c, currentUser.id, m.players);
    } else if (gameType === 'tictactoe') {
      result = applyMoveTTT(m.game, r, c, currentUser.id, m.players);
    } else if (gameType === 'chess') {
      result = applyMoveChess(m.game, r, currentUser.id, m.players); // r contains moveObj
    } else {
      result = applyMove(m.game, orientation, r, c, currentUser.id, m.players);
    }

    if (result.error) throw new Error(result.error);

    const update = { game: result.newGame };

    // Reset the turn timer whenever the active player changes OR the mover
    // just claimed a box. The original design only reset on player change
    // to "avoid stalling games", but that quietly penalized long chains:
    // a player who claimed 5 boxes in one continuous chain had to spend the
    // entire chain inside their original 60s window or lose to an opponent
    // hitting Claim Victory. Now each successful move — including the
    // bonus-turn followups after a claim — gets a fresh 60s window.
    const turnAdvanced = result.newGame.currentPlayerIdx !== m.game.currentPlayerIdx;
    if ((turnAdvanced || result.claimed > 0) && !result.finished) {
      update.turnStartedAt = serverTimestamp();
    }

    if (result.finished) {
      update.status = 'finished';
      update.finishedAt = serverTimestamp();
      const winnerId = result.winnerIdx === -1 ? 'draw' : m.players[result.winnerIdx];
      update.winner = winnerId;
    }

    tx.update(matchRef, update);
  });
}

export async function requestPause(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) throw new Error('Match not found');
  const m = snap.data();
  if (!m.players.includes(currentUser.id)) throw new Error('Not a player');
  if (m.status !== 'active') throw new Error('Game not active');
  if (m.pauseRequest) throw new Error('Pause already requested');
  await updateDoc(matchRef, {
    pauseRequest: { byId: currentUser.id, requestedAt: Date.now() },
  });
}

export async function respondToPause(matchId, currentUser, accept) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) throw new Error('Match not found');
  const m = snap.data();
  if (!m.players.includes(currentUser.id)) throw new Error('Not a player');
  if (!m.pauseRequest || m.pauseRequest.byId === currentUser.id)
    throw new Error('Nothing to respond to');

  if (accept) {
    await updateDoc(matchRef, {
      status: 'paused',
      pauseRequest: null,
      pauseConcealed: true, // hide the board to prevent strategizing
    });
  } else {
    await updateDoc(matchRef, { pauseRequest: null });
  }
}

export async function resumeMatch(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) throw new Error('Match not found');
  const m = snap.data();
  if (!m.players.includes(currentUser.id)) throw new Error('Not a player');
  if (m.status !== 'paused') throw new Error('Not paused');
  // Either player can resume
  await updateDoc(matchRef, {
    status: 'active',
    pauseConcealed: false,
  });
}

export async function resignMatch(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) return;
  const m = snap.data();
  if (!m.players.includes(currentUser.id)) return;
  if (m.status === 'finished') return;
  const otherPlayerId = m.players.find(id => id !== currentUser.id);
  await updateDoc(matchRef, {
    status: 'finished',
    winner: otherPlayerId,
    resignedBy: currentUser.id,
    finishedAt: serverTimestamp(),
  });
}

// Settle a match where the active player has run out of time. Either client
// (the timed-out player auto-forfeiting, or their opponent claiming victory)
// can call this. Idempotent — the transaction re-checks the timer and bails
// out if someone else already settled it. This also handles disconnect
// claims: if the opponent's `lastSeen` is stale, the present player can
// claim the win the same way.
export async function forfeitOnTimeout(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const m = snap.data();
    if (m.status !== 'active') return; // already over
    if (!m.players.includes(currentUser.id)) throw new Error('Not a player');

    // The player whose turn it currently is, is the loser on timeout.
    const loserIdx = m.game.currentPlayerIdx;
    const loserId = m.players[loserIdx];
    const winnerId = m.players.find(id => id !== loserId);

    // Verify the timer has actually expired (within a 5s grace window so
    // we don't punish slightly-skewed clocks). turnStartedAt is a
    // serverTimestamp; toMillis() can be null briefly between write and
    // resolution, in which case we conservatively skip.
    const rawStartedAtMs = m.turnStartedAt?.toMillis ? m.turnStartedAt.toMillis() : null;
    if (!rawStartedAtMs) return;
    // The pre-game countdown shouldn't eat the first player's timer. Prefer
    // the server-derived start (createdAt + 3500) over the client-stamped
    // startsAtMs, to defang clock skew between the inviter's machine and
    // the rest of the world. Whichever is smaller wins so a wildly-future
    // startsAtMs can't strand both players.
    const createdAtMs = m.createdAt?.toMillis ? m.createdAt.toMillis() : null;
    const serverDerivedStart = createdAtMs ? createdAtMs + 3500 : null;
    let effectiveStartsAtMs = serverDerivedStart ?? m.startsAtMs ?? null;
    if (effectiveStartsAtMs && m.startsAtMs && serverDerivedStart) {
      effectiveStartsAtMs = Math.min(m.startsAtMs, serverDerivedStart);
    }
    const effectiveStartedAtMs = effectiveStartsAtMs
      ? Math.max(rawStartedAtMs, effectiveStartsAtMs)
      : rawStartedAtMs;
    const timeoutMs = m.turnTimeoutMs !== undefined ? m.turnTimeoutMs : 60000;

    // If timeoutMs is -1, it means no timer was agreed upon. Don't forfeit.
    if (timeoutMs === -1) {
      return;
    }

    const expired = Date.now() - effectiveStartedAtMs > timeoutMs + 5000;
    if (!expired) return;

    tx.update(matchRef, {
      status: 'finished',
      winner: winnerId,
      timedOut: loserId,
      finishedAt: serverTimestamp(),
    });
  });
}

// Maximum chat messages stored on a single match doc. New messages roll
// the oldest off, keeping the doc small. Note we can't use a transaction
// here because spectators are allowed to send chat (the rule permits
// chatAppend non-player writes), and the rule only checks size-grew-by-1
// — so we keep the implementation as a read-then-write arrayUnion, with
// occasional cleanup baked in instead. The cleanup path is gated to
// players only (the rule rejects non-player full-array overwrites).
const MAX_MATCH_CHAT = 100;

export async function sendChat(matchId, currentUser, text) {
  return sendChatAs(matchId, currentUser, text, false);
}

export async function sendChatAs(matchId, currentUser, text, isSpectator) {
  guard(currentUser);
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) return;
  const matchRef = doc(db, 'matches', matchId);
  const msg = {
    id: crypto.randomUUID(),
    userId: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
    text: trimmed,
    ts: Date.now(),
    isSpectator,
  };
  // The simple case — append via arrayUnion. Works for both players and
  // spectators because the security rule's chatAppend branch permits a
  // size-grew-by-1 write with last.userId == auth.uid.
  await updateDoc(matchRef, { chat: arrayUnion(msg) });

  // Best-effort rolling cleanup: if I'm a player, also do an
  // occasional full-array trim. Doing this for every message would be
  // wasteful (and racy with simultaneous appends), so we only do it
  // when the array is way over the cap. Spectators skip this path
  // because the rule forbids them from writing a full-array replacement.
  if (!isSpectator) {
    try {
      const snap = await getDoc(matchRef);
      if (!snap.exists()) return;
      const m = snap.data();
      if (!m.players.includes(currentUser.id)) return;
      if ((m.chat || []).length > MAX_MATCH_CHAT * 1.5) {
        const trimmedChat = m.chat.slice(m.chat.length - MAX_MATCH_CHAT);
        await updateDoc(matchRef, { chat: trimmedChat }).catch(() => {});
      }
    } catch {} // never let cleanup failure surface
  }
}

// ─── Spectating ──────────────────────────────────────────────────────────
export async function joinAsSpectator(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) throw new Error('Match not found');
  const m = snap.data();
  if (m.players.includes(currentUser.id)) return; // already a player
  // Idempotent dedupe by id. arrayUnion can't dedupe here because the
  // object includes mutable fields (avatar, username) — if I visit, change
  // my avatar elsewhere, and come back, arrayUnion would see a different
  // object and append it as a duplicate entry. We resolve at the rule
  // boundary by reading first, then writing the merged value.
  const existing = m.spectators || [];
  const mine = {
    id: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
  };
  const idx = existing.findIndex(s => s.id === currentUser.id);
  if (idx >= 0) {
    // Already there. If our stored avatar/username matches the current
    // user, nothing to do. Otherwise rewrite our entry so the displayed
    // spectator info matches the user's current state. The rules' specJoin
    // / specLeave functions only allow size +/- 1 from a non-player, so a
    // same-size in-place update is only allowed for players — gate the
    // refresh on that. (Spectators viewing themselves stale isn't worth a
    // permission error.)
    const stored = existing[idx];
    if (stored.username === mine.username && stored.avatar === mine.avatar) return;
    return; // not a player; can't rewrite under the rule. Stale is harmless.
  }
  await updateDoc(matchRef, {
    spectators: arrayUnion(mine),
  });
}

export async function leaveSpectator(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) return;
  const m = snap.data();
  const newSpecs = (m.spectators || []).filter(s => s.id !== currentUser.id);
  await updateDoc(matchRef, { spectators: newSpecs });
}

// ─── Friends / social ────────────────────────────────────────────────────
export async function sendFriendRequest(currentUser, targetUsername) {
  guard(currentUser);
  const target = await lookupUserByUsername(targetUsername);
  if (!target) throw new Error('User not found');
  if (target.id === currentUser.id) throw new Error("You can't friend yourself");
  if ((currentUser.friends || []).includes(target.id)) throw new Error('Already friends');
  if ((target.blocked || []).includes(currentUser.id)) throw new Error('Cannot send request');

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', target.id), {
    friendRequests: arrayUnion({
      fromId: currentUser.id,
      fromUsername: currentUser.username,
      fromAvatar: currentUser.avatar || '◆',
      ts: Date.now(),
    }),
  });
  batch.update(doc(db, 'users', currentUser.id), {
    outgoingFriendRequests: arrayUnion(target.id),
  });
  await batch.commit();
}

export async function acceptFriendRequest(currentUser, fromId) {
  guard(currentUser);
  // We need the sender's profile to populate the activity-feed entry, and
  // we need to read+write the current user's doc atomically — if a second
  // friend request arrives between the in-memory `currentUser.friendRequests`
  // snapshot and the write, a naive read-modify-write would silently
  // destroy the second request. A transaction reads the doc fresh inside
  // the critical section so the filter operates on the authoritative
  // current value.
  const fromUserSnap = await getDoc(doc(db, 'users', fromId));
  if (!fromUserSnap.exists()) throw new Error('User not found');
  const fromUser = fromUserSnap.data();

  const myRef = doc(db, 'users', currentUser.id);
  await runTransaction(db, async (tx) => {
    const mySnap = await tx.get(myRef);
    if (!mySnap.exists()) return;
    const me = mySnap.data();
    const currentReqs = me.friendRequests || [];
    // Filter on the *current* value inside the tx, so any request that
    // arrived between this user's last profile snapshot and now survives.
    const newReqs = currentReqs.filter(r => r.fromId !== fromId);
    // arrayUnion would also work, but listing the full array makes the
    // intent explicit and matches the legacy doc shape exactly.
    const myFriends = me.friends || [];
    const newFriends = myFriends.includes(fromId) ? myFriends : [...myFriends, fromId];
    tx.update(myRef, { friends: newFriends, friendRequests: newReqs });
  });

  // The symmetric write to the other user. This stays a separate
  // updateDoc because the Firestore security rule only permits the
  // narrow "append my own uid to your friends" shape — a transaction that
  // reads the other user's doc would require broader rule access. The
  // arrayUnion shape exactly matches the rule's expectation.
  await updateDoc(doc(db, 'users', fromId), {
    friends: arrayUnion(currentUser.id),
    outgoingFriendRequests: arrayRemove(currentUser.id),
  }).catch(() => {});

  recordActivity(currentUser, ACTIVITY_TYPES.FRIEND_ADDED, {
    friendId: fromId,
    friendUsername: fromUser.username,
    friendAvatar: fromUser.avatar || '◆',
  });
}

export async function declineFriendRequest(currentUser, fromId) {
  guard(currentUser);
  // Same race as acceptFriendRequest: do the filter inside a transaction so
  // a request that arrives concurrently isn't clobbered by a stale read.
  const myRef = doc(db, 'users', currentUser.id);
  await runTransaction(db, async (tx) => {
    const mySnap = await tx.get(myRef);
    if (!mySnap.exists()) return;
    const currentReqs = mySnap.data().friendRequests || [];
    const newReqs = currentReqs.filter(r => r.fromId !== fromId);
    tx.update(myRef, { friendRequests: newReqs });
  });

  // Clean up the sender's outgoing requests so they can request again later
  // if they want. Rule permits this symmetric removal.
  await updateDoc(doc(db, 'users', fromId), {
    outgoingFriendRequests: arrayRemove(currentUser.id),
  }).catch(() => {});
}

export async function removeFriend(currentUser, friendId) {
  guard(currentUser);
  // Remove from my doc first — that part always succeeds for self-updates.
  await updateDoc(doc(db, 'users', currentUser.id), {
    friends: arrayRemove(friendId),
  });
  // Then the symmetric write. This can fail if the friendship was
  // already asymmetric (the other user already removed me, or the
  // friend doc state is somehow inconsistent). The block rule allows
  // arrayRemove-self; it rejects if my uid wasn't in their `friends`
  // to begin with. Either way, my view is now correct — don't surface
  // a permission error to the user for what is a no-op outcome.
  await updateDoc(doc(db, 'users', friendId), {
    friends: arrayRemove(currentUser.id),
  }).catch(() => {});
}

export async function blockUser(currentUser, targetUsername) {
  guard(currentUser);
  const target = await lookupUserByUsername(targetUsername);
  if (!target) throw new Error('User not found');
  // Update my doc: add to blocked, remove from friends.
  await updateDoc(doc(db, 'users', currentUser.id), {
    blocked: arrayUnion(target.id),
    friends: arrayRemove(target.id),
  });
  // Symmetric removal from the target's friends list, so the friendship
  // doesn't linger one-sided. Best-effort: if the target's rules reject
  // this (e.g. the target has me hard-blocked), the write fails silently
  // — that's fine, my view is already consistent.
  await updateDoc(doc(db, 'users', target.id), {
    friends: arrayRemove(currentUser.id),
  }).catch(() => {});

  // End any active matches between the two of us. Awkward to keep a match
  // running with someone you just blocked. The blocker forfeits the match
  // (they're the one ending things) — they don't get an ELO windfall for
  // it. We query both as players, using array-contains, then resign
  // any that match both ids.
  try {
    const myActive = await getDocs(query(
      collection(db, 'matches'),
      where('players', 'array-contains', currentUser.id),
      where('status', 'in', ['active', 'paused']),
      limit(20),
    ));
    const batch = writeBatch(db);
    let count = 0;
    for (const d of myActive.docs) {
      const m = d.data();
      if (!m.players.includes(target.id)) continue;
      // Settle the match: blocker concedes, target wins.
      batch.update(doc(db, 'matches', d.id), {
        status: 'finished',
        winner: target.id,
        resignedBy: currentUser.id,
        finishedAt: serverTimestamp(),
      });
      count++;
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (e) {
    // Best-effort; matches list may need a composite index. Don't block
    // the block itself on this cleanup.
  }
}

export async function unblockUser(currentUser, targetId) {
  guard(currentUser);
  await updateDoc(doc(db, 'users', currentUser.id), {
    blocked: arrayRemove(targetId),
  });
}

// ─── Profile updates ─────────────────────────────────────────────────────
export async function updateProfile(currentUser, updates) {
  guard(currentUser);
  const allowed = ['avatar', 'title', 'bio', 'displayName', 'lineStyle'];
  const filtered = {};
  for (const k of allowed) if (k in updates) filtered[k] = updates[k];
  await updateDoc(doc(db, 'users', currentUser.id), filtered);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────
export async function getLeaderboard(limitN = 50) {
  const q = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ─── Timer Negotiation ───────────────────────────────────────────────────

export async function proposeTimer(matchId, currentUser, useTimer, timerMins) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    timerConfig: { useTimer, timerMins },
    timerProposer: currentUser.id,
    timerRejectReason: null,
  });
}

export async function rejectTimer(matchId, currentUser, reason) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    timerConfig: null,
    timerProposer: null,
    timerRejectReason: reason || 'Rejected without reason',
  });
}

export async function acceptTimer(matchId, currentUser, useTimer, timerMins) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    status: 'active',
    startsAtMs: Date.now() + 3500, // PREGAME_COUNTDOWN_MS
    turnStartedAt: serverTimestamp(),
    turnTimeoutMs: useTimer ? timerMins * 60 * 1000 : -1,
  });
}

// Export finalizeStats from stats.js for backward compatibility
export { finalizeStats } from './stats';
