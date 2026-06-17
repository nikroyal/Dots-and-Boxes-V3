import { doc, getDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { computeElo } from './gameLogic';
import { checkUnlocks } from './achievements';
import { recordActivity, ACTIVITY_TYPES } from './activity';
import { guard } from './actions';

export function computeMatchDerivedStats(m, currentUser) {
  const playerIds = m.players;
  const myIdx = playerIds.indexOf(currentUser.id);
  const oppId = playerIds[1 - myIdx];
  const myScore = m.game.scores[currentUser.id] || 0;
  const oppScore = m.game.scores[oppId] || 0;

  let result;
  if (m.winner === 'draw') result = 'draw';
  else if (m.winner === currentUser.id) result = 'win';
  else result = 'loss';

  let myBiggestChain = 0;
  for (const mv of m.game.moves || []) {
    if (mv.by === currentUser.id && mv.claimed > myBiggestChain) myBiggestChain = mv.claimed;
  }

  const perfectWin = result === 'win' && oppScore === 0;
  const bigBoardWin = result === 'win' && (m.rows >= 10 || m.cols >= 10);
  let comebackWin = false;
  if (result === 'win' && m.game.moves) {
    let myRunning = 0, oppRunning = 0, wasBehind5 = false;
    for (const mv of m.game.moves) {
      if (mv.by === currentUser.id) myRunning += mv.claimed;
      else oppRunning += mv.claimed;
      if (oppRunning - myRunning >= 5) wasBehind5 = true;
    }
    comebackWin = wasBehind5;
  }

  const duration = m.finishedAt && m.createdAt
    ? (m.finishedAt.toMillis?.() || Date.now()) - (m.createdAt.toMillis?.() || Date.now())
    : null;

  const oppElo = m.playerInfo?.[oppId]?.elo || 1000;
  const scoreA = result === 'win' ? 1 : (result === 'draw' ? 0.5 : 0);
  const nowHour = new Date().getHours();
  const isNightOwl = nowHour >= 0 && nowHour < 4;

  return {
    oppId, myScore, oppScore, result, myBiggestChain, perfectWin, bigBoardWin,
    comebackWin, duration, oppElo, scoreA, isNightOwl
  };
}

export function computeUpdatedUserStats(u, m, matchId, derivedStats) {
  const finalized = u.finalizedMatches || [];
  if (finalized.includes(matchId)) return null;

  const {
    oppId, myScore, oppScore, result, myBiggestChain, perfectWin, bigBoardWin,
    comebackWin, duration, oppElo, scoreA, isNightOwl
  } = derivedStats;

  const myElo = u.elo || 1000;
  const { newA } = computeElo(myElo, oppElo, scoreA);
  const clampedElo = newA;
  const effectiveDelta = clampedElo - myElo;

  const fastestWin = result === 'win' && duration
    ? Math.min(u.fastestWin || Infinity, duration)
    : (u.fastestWin || null);

  const newWinStreak = result === 'win' ? (u.winStreak || 0) + 1 : 0;
  const bestWinStreak = Math.max(u.bestWinStreak || 0, newWinStreak);
  const playedAtMidnight = !!u.playedAtMidnight || isNightOwl;

  const newStats = {
    elo: clampedElo,
    gamesPlayed: (u.gamesPlayed || 0) + 1,
    wins: (u.wins || 0) + (result === 'win' ? 1 : 0),
    losses: (u.losses || 0) + (result === 'loss' ? 1 : 0),
    draws: (u.draws || 0) + (result === 'draw' ? 1 : 0),
    totalBoxes: (u.totalBoxes || 0) + myScore,
    biggestChain: Math.max(u.biggestChain || 0, myBiggestChain),
    perfectWins: (u.perfectWins || 0) + (perfectWin ? 1 : 0),
    bigBoardWins: (u.bigBoardWins || 0) + (bigBoardWin ? 1 : 0),
    comebackWins: (u.comebackWins || 0) + (comebackWin ? 1 : 0),
    winStreak: newWinStreak,
    bestWinStreak,
    fastestWin: fastestWin === Infinity ? null : fastestWin,
    playedAtMidnight,
  };

  const MATCH_HISTORY_CAP = 500;
  const FINALIZED_MATCHES_CAP = 500;

  const newHistoryEntry = {
    matchId,
    opponent: m.playerInfo?.[oppId]?.username || 'unknown',
    opponentAvatar: m.playerInfo?.[oppId]?.avatar || '◆',
    myScore, oppScore,
    result,
    eloDelta: effectiveDelta,
    eloAfter: clampedElo,
    rows: m.rows, cols: m.cols,
    finishedAt: Date.now(),
  };
  const existingHistory = u.matchHistory || [];
  const trimmedHistory = existingHistory.length >= MATCH_HISTORY_CAP
    ? [...existingHistory.slice(existingHistory.length - MATCH_HISTORY_CAP + 1), newHistoryEntry]
    : [...existingHistory, newHistoryEntry];
  newStats.matchHistory = trimmedHistory;

  const existingFinalized = u.finalizedMatches || [];
  const trimmedFinalized = existingFinalized.length >= FINALIZED_MATCHES_CAP
    ? [...existingFinalized.slice(existingFinalized.length - FINALIZED_MATCHES_CAP + 1), matchId]
    : [...existingFinalized, matchId];
  newStats.finalizedMatches = trimmedFinalized;

  const projectedStats = { ...u, ...newStats, friends: (u.friends || []).length };
  const newlyUnlocked = checkUnlocks(projectedStats, u.unlockedAchievements || []);
  if (newlyUnlocked.length > 0) {
    newStats.unlockedAchievements = arrayUnion(...newlyUnlocked);
  }

  return { newStats, txResult: { newlyUnlocked, deltaA: effectiveDelta, result } };
}

export function recordPostMatchActivities(currentUser, m, matchId, derivedStats, txResult) {
  const { oppId, myScore, oppScore, result } = derivedStats;
  const oppUsername = m.playerInfo?.[oppId]?.username || 'unknown';
  const activityType = result === 'win' ? ACTIVITY_TYPES.WIN
                     : result === 'loss' ? ACTIVITY_TYPES.LOSS
                     : ACTIVITY_TYPES.DRAW;
  recordActivity(currentUser, activityType, {
    matchId, opponent: oppUsername, myScore, oppScore, eloDelta: txResult.deltaA,
  });
  for (const ach of txResult.newlyUnlocked) {
    recordActivity(currentUser, ACTIVITY_TYPES.ACHIEVEMENT, { achievementId: ach });
  }
}

// Wrapped in a transaction so concurrent callers (two tabs, a refresh in the
// middle of the win screen, Match.jsx and Replay.jsx both firing it) can't
// double-credit stats. The pre-tx getDoc on the match is a cheap fast-path
// to avoid opening a transaction at all when there's nothing to do — the
// authoritative idempotency check lives inside the transaction below.
export async function finalizeStats(matchId, currentUser) {
  guard(currentUser);
  const matchRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  const m = matchSnap.data();
  if (m.status !== 'finished') return;
  if (m.adminClosed) return;
  if (!m.players.includes(currentUser.id)) return;

  const userRef = doc(db, 'users', currentUser.id);

  const derivedStats = computeMatchDerivedStats(m, currentUser);

  let txResult = null;
  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) return;
    const u = userSnap.data();

    const updateRes = computeUpdatedUserStats(u, m, matchId, derivedStats);
    if (!updateRes) return;

    tx.update(userRef, updateRes.newStats);
    txResult = updateRes.txResult;
  });

  if (!txResult) return;

  recordPostMatchActivities(currentUser, m, matchId, derivedStats, txResult);

  return txResult;
}
