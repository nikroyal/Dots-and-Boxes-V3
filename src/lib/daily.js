export function getLocalYYYYMMDD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DAILY_GOALS = [
  { id: 'win_1', text: 'Win 1 match', check: (stats) => stats.wins >= 1, max: 1, getProgress: (stats) => Math.min(stats.wins || 0, 1) },
  { id: 'play_3', text: 'Play 3 matches', check: (stats) => stats.gamesPlayed >= 3, max: 3, getProgress: (stats) => Math.min(stats.gamesPlayed || 0, 3) },
  { id: 'claim_15', text: 'Claim 15 boxes', check: (stats) => stats.totalBoxes >= 15, max: 15, getProgress: (stats) => Math.min(stats.totalBoxes || 0, 15) },
  { id: 'win_2', text: 'Win 2 matches', check: (stats) => stats.wins >= 2, max: 2, getProgress: (stats) => Math.min(stats.wins || 0, 2) },
  { id: 'play_5', text: 'Play 5 matches', check: (stats) => stats.gamesPlayed >= 5, max: 5, getProgress: (stats) => Math.min(stats.gamesPlayed || 0, 5) },
  { id: 'chain_3', text: 'Achieve a chain of 3+ boxes', check: (stats) => stats.biggestChain >= 3, max: 3, getProgress: (stats) => Math.min(stats.biggestChain || 0, 3) },
];

export function getDailyGoal(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % DAILY_GOALS.length;
  return DAILY_GOALS[index];
}
