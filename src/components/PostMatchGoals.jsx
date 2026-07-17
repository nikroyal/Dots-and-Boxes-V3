import { getDailyGoal, getLocalYYYYMMDD } from '../lib/daily';
import { ACHIEVEMENTS, getRankInfo } from '../lib/achievements';
import { Check } from 'lucide-react';

export default function PostMatchGoals({ profile }) {
  if (!profile) return null;

  const today = getLocalYYYYMMDD();
  const dailyGoal = getDailyGoal(today);
  const dailyStats = profile.dailyStats?.date === today ? profile.dailyStats : { wins: 0, gamesPlayed: 0, totalBoxes: 0, biggestChain: 0 };
  const dailyGoalCompleted = profile.dailyGoalDate === today || dailyGoal.check(dailyStats);

  const rankInfo = getRankInfo(profile.elo ?? 1000);
  const rank = rankInfo.rank;
  const nextRank = rankInfo.nextRank;
  const rankProgress = rankInfo.progress;

  const upNextAchievement = (() => {
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
  })();

  // Removed early return to ensure goals are always shown

  return (
    <div className={`grid gap-3 mb-8 text-left max-w-sm mx-auto ${upNextAchievement ? 'grid-cols-1 sm:grid-cols-3 sm:max-w-none' : 'grid-cols-1 sm:grid-cols-2 sm:max-w-none'}`}>
      {/* Daily Goal */}
      <div className="border hairline p-3 bg-black/5" style={{ borderColor: dailyGoalCompleted ? 'var(--forest)' : 'var(--hairline)' }}>
        <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1 opacity-60">Daily Goal</div>
        <div className="font-display text-base mb-2">{dailyGoal.text}</div>
        {dailyGoalCompleted ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-mono text-[0.7rem] tracking-widest uppercase px-2 py-1 rounded-sm w-fit" style={{ background: 'var(--forest)', color: 'var(--paper)' }}>
              <Check size={12} /> Completed
            </div>
            <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-60">
              Come back tomorrow to keep your streak going
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
              <span>Progress</span>
              <span>{dailyGoal.getProgress(dailyStats)} / {dailyGoal.max}</span>
            </div>
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Daily goal progress" aria-valuenow={dailyGoal.getProgress(dailyStats)} aria-valuemin={0} aria-valuemax={dailyGoal.max}>
              <div className="h-full transition-all duration-500 bg-current opacity-60" style={{ width: `${(dailyGoal.getProgress(dailyStats) / dailyGoal.max) * 100}%` }} />
            </div>
          </div>
        )}
      </div>


      {/* Rank Progress */}
      <div className="border hairline p-3 bg-black/5" style={{ borderColor: 'var(--hairline)' }}>
        <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1 opacity-60">Rank Progress</div>
        <div className="font-display text-base mb-2">{rank.name}</div>
        <div>
          <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
            <span>Progress</span>
            <span>{nextRank ? `${rankProgress}%` : 'MAX'}</span>
          </div>
          <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Rank progress" aria-valuenow={rankProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full transition-all duration-1000 ease-out opacity-80" style={{ width: `${rankProgress}%`, background: rank.color }} />
          </div>
        </div>
      </div>

      {/* Up Next Achievement */}
      {upNextAchievement && (
        <div className="border hairline p-3 bg-black/5" style={{ borderColor: 'var(--ochre)' }}>
          <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1" style={{ color: 'var(--ochre)' }}>Up Next</div>
          <div className="font-display text-base">{upNextAchievement.a.name}</div>
          <div className="font-mono text-[0.65rem] tracking-wide opacity-60 mt-1 mb-2 leading-relaxed">{upNextAchievement.a.desc}</div>
          <div>
            <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
              <span>Progress</span>
              <span>{Math.floor(upNextAchievement.curr)} / {upNextAchievement.max}</span>
            </div>
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Achievement progress" aria-valuenow={Math.floor(upNextAchievement.curr)} aria-valuemin={0} aria-valuemax={upNextAchievement.max}>
              <div className="h-full transition-all duration-500" style={{ width: `${upNextAchievement.pct}%`, background: 'var(--ochre)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}