const fs = require('fs');

let content = fs.readFileSync('src/pages/AxiomHub.jsx', 'utf8');

// Add imports
if (!content.includes("import { getRankInfo, ACHIEVEMENTS } from '../lib/achievements';")) {
  content = content.replace(
    "import { sfx } from '../lib/sound';",
    "import { sfx } from '../lib/sound';\nimport { getRankInfo, ACHIEVEMENTS } from '../lib/achievements';"
  );
}

// Add state/memo
const stateInsert = `  const rankInfo = profile ? getRankInfo(profile.elo ?? 1000) : null;
  const rank = rankInfo?.rank;
  const nextRank = rankInfo?.nextRank;
  const rankProgress = rankInfo?.progress;

  const upNextAchievement = useMemo(() => {
    if (!profile) return null;
    let best = null;
    let highestPct = -1;
    const unlocked = profile.unlockedAchievements || [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.includes(a.id) && a.progress) {
        const [curr, max, min = 0] = a.progress(profile);
        const pct = max === min ? 0 : Math.min(100, Math.max(0, ((curr - min) / (max - min)) * 100));
        if (pct > 0 && max > 1 && pct > highestPct) {
          highestPct = pct;
          best = { a, curr, max, pct };
        }
      }
    }
    return best;
  }, [profile]);`;

if (!content.includes('const rankInfo = profile')) {
  content = content.replace(
    "const [favoriteIds, setFavoriteIds] = useState(readFavorites);",
    "const [favoriteIds, setFavoriteIds] = useState(readFavorites);\n\n" + stateInsert
  );
}

// Replace UI
const oldUI = `<div className="border hairline p-5" style={{ background: 'var(--paper-tint)' }}>
          <div className="flex items-center gap-3 mb-4">
            <Users size={16} aria-hidden="true" />
            <div>
              <div className="font-display text-lg leading-tight">{profile?.displayName || profile?.username}</div>
              <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50">Axiom profile</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Things" value={EXPERIENCE_CATALOG.length} />
            <MiniStat label="Favorites" value={favoriteIds.length} />
            <MiniStat label="Friends" value={Array.isArray(profile?.friends) ? profile.friends.length : 0} />
          </div>
        </div>`;

const newUI = `<div className="border hairline p-5 flex flex-col gap-4" style={{ background: 'var(--paper-tint)' }}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl">{profile?.avatar || '◆'}</span>
              <div>
                <div className="font-display text-xl leading-tight">{profile?.username}</div>
                {rank && (
                  <div className="font-mono text-[0.65rem] tracking-widest uppercase mt-1" style={{ color: rank.color }}>
                    {rank.name} · {profile.elo || 1000} ELO
                  </div>
                )}
              </div>
            </div>
            <Link to="/profile" onClick={sfx.click} className="btn-ghost" style={{ padding: '4px 8px' }}>
              Profile
            </Link>
          </div>

          {nextRank && (
            <div>
              <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                <span>Next: {nextRank.name}</span>
                <span>{nextRank.min}</span>
              </div>
              <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 ease-out"
                  style={{ width: \`\${rankProgress}%\`, background: rank.color }}
                />
              </div>
            </div>
          )}

          {upNextAchievement && (
            <div className="border hairline p-3 bg-black/5 mt-2" style={{ borderColor: 'var(--ochre)' }}>
              <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1" style={{ color: 'var(--ochre)' }}>Up Next</div>
              <div className="font-display text-base">{upNextAchievement.a.name}</div>
              <div className="mt-2">
                <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                  <span>Progress</span>
                  <span>{Math.floor(upNextAchievement.curr)} / {upNextAchievement.max}</span>
                </div>
                <div className="h-1 w-full bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500" style={{ width: \`\${upNextAchievement.pct}%\`, background: 'var(--ochre)' }} />
                </div>
              </div>
            </div>
          )}
        </div>`;

if (content.includes(oldUI)) {
  content = content.replace(oldUI, newUI);
  fs.writeFileSync('src/pages/AxiomHub.jsx', content, 'utf8');
  console.log("Success");
} else {
  console.log("Could not find old UI");
}
