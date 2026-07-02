export function calculateXP(profile) {
  if (!profile) return 0;
  let xp = 0;
  xp += (profile.gamesPlayed || 0) * 10;
  xp += (profile.wins || 0) * 20;
  xp += (profile.totalBoxes || 0) * 2;
  xp += (profile.dailyGoalsCompleted || 0) * 50;
  xp += (Array.isArray(profile.unlockedAchievements) ? profile.unlockedAchievements.length : 0) * 100;
  if (profile.arcadeBests) {
    xp += Object.keys(profile.arcadeBests).length * 25;
  }
  return xp;
}

export function getLevelInfo(xp) {
  const BASE_XP = 100;
  const MULTIPLIER = 1.5;
  let level = 1;
  let xpRequired = BASE_XP;
  let currentTierXP = xp;

  while (currentTierXP >= xpRequired) {
    currentTierXP -= xpRequired;
    level++;
    xpRequired = Math.floor(xpRequired * MULTIPLIER);
  }

  return {
    level,
    currentXP: currentTierXP,
    xpRequired,
    progressPercent: Math.min(100, Math.max(0, Math.floor((currentTierXP / xpRequired) * 100)))
  };
}