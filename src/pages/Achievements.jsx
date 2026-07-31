import { useAuth } from '../lib/AuthContext';
import { ACHIEVEMENTS, UNLOCKABLE_AVATARS, UNLOCKABLE_TITLES } from '../lib/achievements';

export default function Achievements() {
  const { profile } = useAuth();
  if (!profile) return null;
  const unlocked = profile.unlockedAchievements || [];

  const unlockedAvatars = UNLOCKABLE_AVATARS.filter(a => a.free || a.check(profile));
  const unlockedTitles = UNLOCKABLE_TITLES.filter(t => t.free || t.check(profile));

  const totalUnlockables = ACHIEVEMENTS.length + UNLOCKABLE_AVATARS.length + UNLOCKABLE_TITLES.length;
  const totalUnlocked = unlocked.length + unlockedAvatars.length + unlockedTitles.length;
  const progress = Math.round((totalUnlocked / totalUnlockables) * 100);

  const renderProgress = (item, isUnlocked) => {
    if (isUnlocked || !item.progress) return null;
    const [curr, max, min = 0] = item.progress(profile);
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
  };

  return (
    <div className="fade-in space-y-12">
      <section>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">
          {totalUnlocked} of {totalUnlockables} unlocked
        </div>
        <h1 className="font-display text-4xl font-medium tracking-tight">Awards & Unlocks</h1>
        <div className="mt-4 h-1 w-full max-w-md" style={{ background: 'var(--hairline)' }} role="progressbar" aria-valuenow={totalUnlocked} aria-valuemin={0} aria-valuemax={totalUnlockables}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--ink)' }} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Avatars</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {UNLOCKABLE_AVATARS.map(a => {
            const got = a.free || a.check(profile);
            return (
              <div key={a.val} className="border hairline p-4 transition-all" style={{ opacity: got ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                       <div className="font-display text-3xl shrink-0 w-10 text-center">{a.val}</div>
                       <div>
                         <div className="font-display text-lg font-medium">{a.free ? 'Starter Avatar' : a.req}</div>
                       </div>
                    </div>
                    {renderProgress(a, got)}
                  </div>
                  {got && (
                    <div className="font-mono text-[0.6rem] tracking-widest uppercase shrink-0" style={{ color: 'var(--forest)' }}>
                      ✓ UNLOCKED
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Titles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {UNLOCKABLE_TITLES.map(t => {
            const got = t.free || t.check(profile);
            return (
              <div key={t.val} className="border hairline p-4 transition-all" style={{ opacity: got ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-display text-lg font-medium">{t.val}</div>
                    {!t.free && <div className="font-mono text-[0.7rem] tracking-wide opacity-70 mt-1 leading-relaxed">{t.req}</div>}
                    {t.free && <div className="font-mono text-[0.7rem] tracking-wide opacity-70 mt-1 leading-relaxed">Starter Title</div>}
                    {renderProgress(t, got)}
                  </div>
                  {got && (
                    <div className="font-mono text-[0.6rem] tracking-widest uppercase shrink-0" style={{ color: 'var(--forest)' }}>
                      ✓ UNLOCKED
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Achievements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACHIEVEMENTS.map(a => {
            const got = unlocked.includes(a.id);
            return (
              <div key={a.id} className="border hairline p-4 transition-all" style={{ opacity: got ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-display text-lg font-medium">{a.name}</div>
                    <div className="font-mono text-[0.7rem] tracking-wide opacity-70 mt-1 leading-relaxed">{a.desc}</div>
                    {renderProgress(a, got)}
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
        </div>
      </section>
    </div>
  );
}
