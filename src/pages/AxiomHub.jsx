import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Star, Target, Trophy, Users, Zap, LayoutGrid, Check } from 'lucide-react';
import { EXPERIENCE_CATALOG } from '../lib/experiences';
import { useAuth } from '../lib/AuthContext';
import { sfx } from '../lib/sound';
import { getRankInfo, ACHIEVEMENTS } from '../lib/achievements';
import { getDailyGoal, getLocalYYYYMMDD } from '../lib/daily';

const FAVORITES_KEY = 'axiom-favorite-experiences';

const iconByExperience = {
  'dots-and-boxes': Trophy,
  'paper-io': Zap,
  'circuit-maker': Target,
  'memory-match': LayoutGrid,
  'reaction-timer': Zap,
};

function readFavorites() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(EXPERIENCE_CATALOG.map(experience => experience.id));
    return parsed.filter(id => allowed.has(id));
  } catch {
    return [];
  }
}

export default function AxiomHub() {
  const { profile } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(readFavorites);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favorites = EXPERIENCE_CATALOG.filter(experience => favoriteSet.has(experience.id));
  const others = EXPERIENCE_CATALOG.filter(experience => !favoriteSet.has(experience.id));

  const today = getLocalYYYYMMDD();
  const dailyGoal = getDailyGoal(today);
  const dailyStats = profile?.dailyStats?.date === today ? profile.dailyStats : { wins: 0, gamesPlayed: 0, totalBoxes: 0, biggestChain: 0 };
  const dailyGoalCompleted = profile?.dailyGoalDate === today || dailyGoal.check(dailyStats);

  const rankInfo = getRankInfo(profile?.elo ?? 1000);
  const rank = rankInfo.rank;
  const rankProgress = rankInfo.progress;

  const upNextAchievement = (() => {
    let best = null;
    let highestPct = -1;
    const unlocked = profile?.unlockedAchievements || [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.includes(a.id) && a.progress) {
        const [curr, max, min = 0] = a.progress(profile || {});
        const pct = max === min ? 0 : Math.min(100, Math.max(0, ((curr - min) / (max - min)) * 100));
        if (pct > 0 && max > 1 && pct > highestPct) {
          highestPct = pct;
          best = { a, curr, max, pct };
        }
      }
    }
    return best;
  })();


  const toggleFavorite = (id) => {
    setFavoriteIds(current => {
      if (current.includes(id)) return current.filter(item => item !== id);
      return [...current, id];
    });
    sfx.click();
  };

  return (
    <div className="fade-in space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.85fr] items-end">
        <div>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Welcome to</div>
          <h1 className="font-display text-6xl sm:text-7xl font-medium tracking-tight leading-none">Axiom</h1>
          <p className="font-display text-xl sm:text-2xl leading-snug opacity-70 mt-5 max-w-2xl">
            Pick a game, build a circuit, or jump back into your Dots & Boxes world.
          </p>
        </div>
        <Link to="/profile" className="border hairline p-5 block hover:bg-black/5 transition-colors" style={{ background: 'var(--paper-tint)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="font-display text-4xl">{profile?.avatar || '◆'}</div>
            <div className="flex-1">
              <div className="font-display text-lg leading-tight">{profile?.displayName || profile?.username}</div>
              <div className="flex justify-between items-end mt-1">
                <div className="font-mono text-[0.65rem] tracking-widest uppercase" style={{ color: rank.color }}>
                  {rank.name} · {profile?.elo ?? 1000} ELO
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${rankProgress}%`, background: rank.color }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Things" value={EXPERIENCE_CATALOG.length} />
            <MiniStat label="Favorites" value={favoriteIds.length} />
            <MiniStat label="Friends" value={Array.isArray(profile?.friends) ? profile.friends.length : 0} />
          </div>
        </Link>
      </section>


      {/* Active Objectives */}
      {(upNextAchievement || !dailyGoalCompleted) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!dailyGoalCompleted && (
            <Link to="/dots-and-boxes" className="block border hairline p-4 bg-black/5 hover:bg-black/10 transition-colors" style={{ borderColor: 'var(--hairline)' }}>
              <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1 flex items-center gap-2 opacity-60">
                <Target size={12} /> Daily Goal
              </div>
              <div className="font-display text-lg mb-3">{dailyGoal.text}</div>
              <div>
                <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                  <span>Progress</span>
                  <span>{dailyGoal.getProgress(dailyStats)} / {dailyGoal.max}</span>
                </div>
                <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Daily goal progress" aria-valuenow={dailyGoal.getProgress(dailyStats)} aria-valuemin={0} aria-valuemax={dailyGoal.max}>
                  <div className="h-full transition-all duration-500 bg-current opacity-60" style={{ width: `${(dailyGoal.getProgress(dailyStats) / dailyGoal.max) * 100}%` }} />
                </div>
              </div>
            </Link>
          )}

          {upNextAchievement && (
            <Link to="/achievements" className="block border hairline p-4 bg-black/5 hover:bg-black/10 transition-colors" style={{ borderColor: 'var(--ochre)' }}>
              <div className="font-mono text-[0.55rem] tracking-widest uppercase mb-1 flex items-center gap-2" style={{ color: 'var(--ochre)' }}>
                <Trophy size={12} /> Up Next
              </div>
              <div className="font-display text-lg truncate">{upNextAchievement.a.name}</div>
              <div className="font-mono text-[0.6rem] tracking-wide opacity-60 mt-1 mb-2 truncate">{upNextAchievement.a.desc}</div>
              <div>
                <div className="flex justify-between font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mb-1">
                  <span>Progress</span>
                  <span>{Math.floor(upNextAchievement.curr)} / {upNextAchievement.max}</span>
                </div>
                <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Achievement progress" aria-valuenow={Math.floor(upNextAchievement.curr)} aria-valuemin={0} aria-valuemax={upNextAchievement.max}>
                  <div className="h-full transition-all duration-500" style={{ width: `${upNextAchievement.pct}%`, background: 'var(--ochre)' }} />
                </div>
              </div>
            </Link>
          )}
        </section>
      )}

      <ExperienceSection
        title="Favorites"
        empty={false}
        experiences={favorites}
        favoriteSet={favoriteSet}
        onToggleFavorite={toggleFavorite}
      />

      <ExperienceSection
        title={favorites.length ? 'All Things' : 'Things'}
        experiences={favorites.length ? others : EXPERIENCE_CATALOG}
        favoriteSet={favoriteSet}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="border hairline px-3 py-3">
      <div className="font-display text-2xl font-medium tabular-nums">{value}</div>
      <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mt-1">{label}</div>
    </div>
  );
}

function ExperienceSection({ title, experiences, favoriteSet, onToggleFavorite }) {
  if (!experiences.length) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-3">
        <h2 className="font-display text-2xl font-medium tracking-tight">{title}</h2>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-45 tabular-nums">
          {experiences.length} {experiences.length === 1 ? 'thing' : 'things'}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {experiences.map(experience => (
          <ExperienceCard
            key={experience.id}
            experience={experience}
            isFavorite={favoriteSet.has(experience.id)}
            onToggleFavorite={() => onToggleFavorite(experience.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ExperienceCard({ experience, isFavorite, onToggleFavorite }) {
  const Icon = iconByExperience[experience.id] || Play;

  return (
    <article className="border hairline p-5 flex flex-col min-h-[260px]" style={{ background: 'var(--paper-tint)' }}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="border hairline flex items-center justify-center shrink-0" style={{ width: 42, height: 42, color: experience.accent }}>
            <Icon size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-2xl leading-tight truncate">{experience.name}</div>
            <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">{experience.kind} / {experience.status}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${experience.name} from favorites` : `Favorite ${experience.name}`}
          title={isFavorite ? 'Remove favorite' : 'Favorite'}
          className="p-2 opacity-60 hover:opacity-100 transition-opacity focus-ring"
          style={{ color: isFavorite ? experience.accent : 'var(--ink)' }}
        >
          <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <p className="font-display text-lg leading-snug opacity-70 flex-1">{experience.description}</p>

      <div className="flex flex-wrap gap-2 mt-5 mb-5">
        {experience.features.map(feature => (
          <span key={feature} className="font-mono text-[0.58rem] tracking-widest uppercase border hairline px-2 py-1 opacity-70">
            {feature}
          </span>
        ))}
      </div>

      <Link to={experience.path} onClick={sfx.click} className="btn-primary w-full">
        <Play size={14} aria-hidden="true" /> Open
      </Link>
    </article>
  );
}
