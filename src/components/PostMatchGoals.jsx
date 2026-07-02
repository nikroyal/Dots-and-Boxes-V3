import { getDailyGoal, getLocalYYYYMMDD } from '../lib/daily';
import { ACHIEVEMENTS } from '../lib/achievements';
import { Check } from 'lucide-react';

export default function PostMatchGoals({ profile }) {
  if (!profile) return null;

  const today = getLocalYYYYMMDD();
  const dailyGoal = getDailyGoal(today);
  const dailyStats = profile.dailyStats?.date === today ? profile.dailyStats : { wins: 0, gamesPlayed: 0, totalBoxes: 0, biggestChain: 0 };
  const dailyGoalCompleted = profile.dailyGoalDate === today || dailyGoal.check(dailyStats);

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

  if (!upNextAchievement && dailyGoalCompleted) return null;

  return (
    <div className={`grid gap-3 mb-8 text-left max-w-sm mx-auto ${upNextAchievement ? 'grid-cols-1 sm:grid-cols-2 sm:max-w-none' : 'grid-cols-1'}`}>
      {/* Daily Goal */}
      <div className="border hairline p-3 bg-black/5" style={{ borderColor: dailyGoalCompleted ? 'var(--forest)' : 'var(--hairline)' }}>
        <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1 opacity-60">Daily Goal</div>
        <div className="font-display text-base mb-2">{dailyGoal.text}</div>
        {dailyGoalCompleted ? (
          <div className="flex items-center gap-2 font-mono text-[0.7rem] tracking-widest uppercase px-2 py-1 rounded-sm w-fit" style={{ background: 'var(--forest)', color: 'var(--paper)' }}>
            <Check size={12} /> Completed
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