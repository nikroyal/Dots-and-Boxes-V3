import { useAuth } from '../lib/AuthContext';
import { ACHIEVEMENTS } from '../lib/achievements';

export default function Achievements() {
  const { profile } = useAuth();
  if (!profile) return null;
  const unlocked = Array.isArray(profile.unlockedAchievements) ? profile.unlockedAchievements : [];
  const progress = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  return (
    <div className="fade-in space-y-8">
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">
          {unlocked.length} of {ACHIEVEMENTS.length} unlocked
        </div>
        <h1 className="font-display text-4xl font-medium tracking-tight">Achievements</h1>
        <div className="mt-4 h-1 w-full max-w-md" style={{ background: 'var(--hairline)' }} role="progressbar" aria-valuenow={unlocked.length} aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--ink)' }} />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACHIEVEMENTS.map(a => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id} className="border hairline p-4 transition-all" style={{ opacity: got ? 1 : 0.6 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-display text-lg font-medium">{a.name}</div>
                  <div className="font-mono text-[0.7rem] tracking-wide opacity-70 mt-1 leading-relaxed">{a.desc}</div>
                  {!got && a.progress && (() => {
                    const [curr, max, min = 0] = a.progress(profile);
                    const pct = max === min ? 0 : Math.min(100, Math.max(0, ((curr - min) / (max - min)) * 100));
                    if (pct === 0 && max === 1) return null; // Hide 0/1 binary progress
                    return (
                      <div className="mt-3 max-w-xs">
                        <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                          <span>Progress</span>
                          <span>{Math.floor(curr)} / {max}</span>
                        </div>
                        <div className="h-1 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.floor(curr)} aria-valuemin={0} aria-valuemax={max}>
                          <div className="h-full bg-current opacity-40 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {got && (
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase shrink-0" style={{ color: 'var(--forest)' }}>
                    ✓ DONE
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
