// Achievement catalog. Each achievement has:
//   id, name, description, check(stats) -> boolean
// stats shape: { wins, losses, draws, gamesPlayed, totalBoxes, biggestChain,
//                fastestWin, longestGame, perfectWins, friends, elo,
//                playedAtMidnight }

export const ACHIEVEMENTS = [
  { id: 'first_steps',    name: 'First Steps',    desc: 'Play your first game',
    check: s => s.gamesPlayed >= 1, progress: s => [s.gamesPlayed || 0, 1] },
  { id: 'first_blood',    name: 'First Blood',    desc: 'Win your first game',
    check: s => s.wins >= 1, progress: s => [s.wins || 0, 1] },
  { id: 'veteran_10',     name: 'Veteran',        desc: 'Play 10 games',
    check: s => s.gamesPlayed >= 10, progress: s => [s.gamesPlayed || 0, 10] },
  { id: 'veteran_50',     name: 'Seasoned',       desc: 'Play 50 games',
    check: s => s.gamesPlayed >= 50, progress: s => [s.gamesPlayed || 0, 50] },
  { id: 'veteran_100',    name: 'Centurion',      desc: 'Play 100 games',
    check: s => s.gamesPlayed >= 100, progress: s => [s.gamesPlayed || 0, 100] },
  { id: 'streak_5',       name: 'On Fire',        desc: 'Win 5 in a row',
    check: s => (s.winStreak || 0) >= 5, progress: s => [s.winStreak || 0, 5] },
  { id: 'streak_10',      name: 'Unstoppable',    desc: 'Win 10 in a row',
    check: s => (s.winStreak || 0) >= 10, progress: s => [s.winStreak || 0, 10] },
  { id: 'collector_100',  name: 'Collector',      desc: 'Claim 100 boxes total',
    check: s => (s.totalBoxes || 0) >= 100, progress: s => [s.totalBoxes || 0, 100] },
  { id: 'collector_1000', name: 'Hoarder',        desc: 'Claim 1000 boxes total',
    check: s => (s.totalBoxes || 0) >= 1000, progress: s => [s.totalBoxes || 0, 1000] },
  { id: 'chain_master',   name: 'Chain Master',   desc: 'Claim 5+ boxes on a single move',
    check: s => (s.biggestChain || 0) >= 5, progress: s => [s.biggestChain || 0, 5] },
  { id: 'chain_legend',   name: 'Chain Legend',   desc: 'Claim 10+ boxes on a single move',
    check: s => (s.biggestChain || 0) >= 10, progress: s => [s.biggestChain || 0, 10] },
  { id: 'perfectionist',  name: 'Perfectionist',  desc: 'Win without giving up a single box',
    check: s => (s.perfectWins || 0) >= 1, progress: s => [s.perfectWins || 0, 1] },
  { id: 'social_butterfly', name: 'Social Butterfly', desc: 'Add 5 friends',
    check: s => (s.friends?.length ?? s.friends ?? 0) >= 5, progress: s => [s.friends?.length ?? s.friends ?? 0, 5] },
  { id: 'rated_1200',     name: 'Rated',          desc: 'Reach 1200 ELO',
    check: s => (s.elo || 1000) >= 1200, progress: s => [Math.max(1000, s.elo || 1000), 1200, 1000] },
  { id: 'rated_1500',     name: 'Skilled',        desc: 'Reach 1500 ELO',
    check: s => (s.elo || 1000) >= 1500, progress: s => [Math.max(1000, s.elo || 1000), 1500, 1000] },
  { id: 'rated_1800',     name: 'Expert',         desc: 'Reach 1800 ELO',
    check: s => (s.elo || 1000) >= 1800, progress: s => [Math.max(1000, s.elo || 1000), 1800, 1000] },
  { id: 'rated_2000',     name: 'Master',         desc: 'Reach 2000 ELO',
    check: s => (s.elo || 1000) >= 2000, progress: s => [Math.max(1000, s.elo || 1000), 2000, 1000] },
  { id: 'big_board',      name: 'Big Thinker',    desc: 'Win a 10x10 or larger game',
    check: s => (s.bigBoardWins || 0) >= 1, progress: s => [s.bigBoardWins || 0, 1] },
  { id: 'comeback',       name: 'Comeback Kid',   desc: 'Win after being down by 5+ boxes',
    check: s => (s.comebackWins || 0) >= 1, progress: s => [s.comebackWins || 0, 1] },
  { id: 'speed_demon',    name: 'Speed Demon',    desc: 'Win a game in under 2 minutes',
    check: s => (s.fastestWin || Infinity) < 120000, progress: s => [(s.fastestWin && s.fastestWin < 120000) ? 1 : 0, 1] },
  // ── Easter eggs ───────────────────────────────────────────────────────────
  { id: 'persistence',    name: 'Persistence',    desc: 'Lose 25 games (we all have to start somewhere)',
    check: s => (s.losses || 0) >= 25, progress: s => [s.losses || 0, 25] },
  { id: 'tied_one_on',    name: 'Tied One On',    desc: 'Finish a game in a draw',
    check: s => (s.draws || 0) >= 1, progress: s => [s.draws || 0, 1] },
  { id: 'night_owl',      name: 'Night Owl',      desc: 'Finish a game between midnight and 4 AM',
    check: s => !!s.playedAtMidnight, progress: s => [s.playedAtMidnight ? 1 : 0, 1] },
];

// Pre-compute Map for O(1) lookups
const achievementMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export function getAchievementById(id) {
  return achievementMap.get(id);
}

// Returns a list of newly-unlocked achievement IDs
export function checkUnlocks(stats, alreadyUnlocked = []) {
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!alreadyUnlocked.includes(a.id) && a.check(stats)) {
      newlyUnlocked.push(a.id);
    }
  }
  return newlyUnlocked;
}

// Avatar options — emoji-based for simplicity, no image storage needed
export const UNLOCKABLE_AVATARS = [
  { val: '◆', free: true }, { val: '◇', free: true }, { val: '●', free: true }, { val: '○', free: true },
  { val: '■', free: true }, { val: '□', free: true }, { val: '▲', free: true }, { val: '△', free: true },
  { val: '▼', free: true }, { val: '▽', free: true },
  { val: '★', req: 'Reach 1200 ELO', check: s => (s.elo || 1000) >= 1200, progress: s => [Math.max(1000, s.elo || 1000), 1200, 1000] },
  { val: '☆', req: 'Reach 1500 ELO', check: s => (s.elo || 1000) >= 1500, progress: s => [Math.max(1000, s.elo || 1000), 1500, 1000] },
  { val: '♠', req: 'Win 50 games', check: s => (s.wins || 0) >= 50, progress: s => [s.wins || 0, 50] },
  { val: '♣', req: 'Win 100 games', check: s => (s.wins || 0) >= 100, progress: s => [s.wins || 0, 100] },
  { val: '♥', req: 'Have 5+ friends', check: s => (Array.isArray(s.friends) ? s.friends.length : 0) >= 5, progress: s => [Array.isArray(s.friends) ? s.friends.length : 0, 5] },
  { val: '♦', req: 'Win 10 in a row', check: s => (s.bestWinStreak || 0) >= 10, progress: s => [s.bestWinStreak || 0, 10] },
  { val: '✦', req: 'Reach 1800 ELO', check: s => (s.elo || 1000) >= 1800, progress: s => [Math.max(1000, s.elo || 1000), 1800, 1000] },
  { val: '✧', req: 'Reach 2000 ELO', check: s => (s.elo || 1000) >= 2000, progress: s => [Math.max(1000, s.elo || 1000), 2000, 1000] },
  { val: '◉', req: 'Claim 1000 boxes', check: s => (s.totalBoxes || 0) >= 1000, progress: s => [s.totalBoxes || 0, 1000] },
  { val: '⬢', req: 'Complete 10 Daily Goals', check: s => (s.dailyGoalsCompleted || 0) >= 10, progress: s => [s.dailyGoalsCompleted || 0, 10] },
];

export const AVATAR_OPTIONS = UNLOCKABLE_AVATARS.map(a => a.val);
AVATAR_OPTIONS.freeCount = UNLOCKABLE_AVATARS.filter(a => a.free).length;

export const UNLOCKABLE_TITLES = [
  { val: 'Novice', free: true },
  { val: 'Apprentice', req: 'Play 10 games', check: s => (s.gamesPlayed || 0) >= 10, progress: s => [s.gamesPlayed || 0, 10] },
  { val: 'Player', req: 'Reach 1200 ELO', check: s => (s.elo || 1000) >= 1200, progress: s => [Math.max(1000, s.elo || 1000), 1200, 1000] },
  { val: 'Strategist', req: 'Win 50 games', check: s => (s.wins || 0) >= 50, progress: s => [s.wins || 0, 50] },
  { val: 'Tactician', req: 'Reach 1500 ELO', check: s => (s.elo || 1000) >= 1500, progress: s => [Math.max(1000, s.elo || 1000), 1500, 1000] },
  { val: 'Master', req: 'Reach 2000 ELO', check: s => (s.elo || 1000) >= 2000, progress: s => [Math.max(1000, s.elo || 1000), 2000, 1000] },
  { val: 'Grandmaster', req: 'Reach 2500 ELO', check: s => (s.elo || 1000) >= 2500, progress: s => [Math.max(1000, s.elo || 1000), 2500, 1000] },
  { val: 'Legend', req: 'Reach 3000 ELO', check: s => (s.elo || 1000) >= 3000, progress: s => [Math.max(1000, s.elo || 1000), 3000, 1000] },
  { val: 'The Patient', req: 'Lose 25 games', check: s => (s.losses || 0) >= 25, progress: s => [s.losses || 0, 25] },
  { val: 'The Bold', req: 'Win in under 2 minutes', check: s => (s.fastestWin ?? Infinity) < 120000, progress: s => [(s.fastestWin && s.fastestWin < 120000) ? 1 : 0, 1] },
];

export const TITLE_OPTIONS = UNLOCKABLE_TITLES.map(t => t.val);

export const RANKS = [
  { name: 'Novice',  min: 0,    color: '#999' },
  { name: 'Player',  min: 1000, color: '#666' },
  { name: 'Rated',   min: 1200, color: '#1A1A1A' },
  { name: 'Skilled', min: 1500, color: '#2F6B3F' },
  { name: 'Expert',  min: 1800, color: '#B7791F' },
  { name: 'Master',  min: 2000, color: '#B91C3C' },
];

export function getRankInfo(elo) {
  let currentRank = RANKS[0];
  let nextRank = null;
  let progress = 100;

  for (let i = 0; i < RANKS.length; i++) {
    if (elo >= RANKS[i].min) {
      currentRank = RANKS[i];
      nextRank = RANKS[i + 1] || null;
    }
  }

  if (nextRank) {
    const range = nextRank.min - currentRank.min;
    const into = elo - currentRank.min;
    progress = Math.max(0, Math.min(100, Math.round((into / range) * 100)));
  }

  return { rank: currentRank, nextRank, progress };
}

export function getRankFromElo(elo) {
  return getRankInfo(elo).rank;
}
