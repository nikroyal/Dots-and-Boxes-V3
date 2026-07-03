import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Volume2, VolumeX, LogOut, Settings, Sun, Moon, BookOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isSoundEnabled, setSoundEnabled, sfx } from '../lib/sound';
import { getRankInfo } from '../lib/achievements';
import {
  getTheme, setTheme, getReducedMotion, setReducedMotion, THEMES,
} from '../lib/theme';
import { watchTotalUnread } from '../lib/dms';
import { startHeartbeat, stopHeartbeat } from '../lib/presence';
import { findExperienceByPath, SHARED_NAV_ITEMS } from '../lib/experiences';

export default function Header() {
  const { profile, isImpersonating, logout } = useAuth();
  const loc = useLocation();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeState, setThemeState] = useState(getTheme());
  const [motionState, setMotionState] = useState(getReducedMotion());
  const [unreadCount, setUnreadCount] = useState(0);
  const settingsRef = useRef(null);
  const isAdmin = profile?.role === 'admin';
  const activeExperience = findExperienceByPath(loc.pathname);
  const sectionNavItems = activeExperience.navItems || [];
  const sharedNavItems = SHARED_NAV_ITEMS.map(item => ({
    ...item,
    badge: item.badge === 'unread' ? unreadCount : item.badge,
  }));

  // Subscribe to total unread DM count
  useEffect(() => {
    if (!profile || isImpersonating) return;
    const unsub = watchTotalUnread(profile.id, setUnreadCount);
    return () => unsub();
  }, [profile?.id, isImpersonating]);

  // Start heartbeat once profile is loaded; stop on unmount/logout.
  // We disable the heartbeat while impersonating so we don't mark the
  // impersonated user as online.
  useEffect(() => {
    if (profile?.id && !isImpersonating) {
      startHeartbeat(profile.id);
    } else {
      stopHeartbeat();
    }
    return () => stopHeartbeat();
  }, [profile?.id, isImpersonating]);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  const toggleSound = () => {
    const v = !soundOn;
    setSoundEnabled(v);
    setSoundOn(v);
    if (v) sfx.click();
  };

  const pickTheme = (t) => { setTheme(t); setThemeState(t); sfx.click(); };
  const toggleMotion = () => {
    const v = !motionState;
    setReducedMotion(v);
    setMotionState(v);
    sfx.click();
  };

  const isNavActive = (to) => {
    const hashIndex = to.indexOf('#');
    const targetPath = hashIndex === -1 ? to : to.slice(0, hashIndex);
    const targetHash = hashIndex === -1 ? '' : to.slice(hashIndex);
    if (targetHash) return loc.pathname === targetPath && loc.hash === targetHash;
    return loc.pathname === targetPath || (targetPath !== '/' && loc.pathname.startsWith(`${targetPath}/`));
  };

  const navItem = ({ to, label, badge = 0 }) => {
    const active = isNavActive(to);
    return (
      <Link
        key={`${to}-${label}`}
        to={to}
        onClick={sfx.click}
        className="font-mono px-3 py-1 text-[0.7rem] tracking-widest uppercase transition-opacity inline-flex items-center gap-1.5 whitespace-nowrap"
        style={{ opacity: active ? 1 : 0.5 }}
      >
        {label}
        {badge > 0 && (
          <span className="font-mono text-[0.55rem] tabular-nums px-1"
                style={{ background: 'var(--crimson)', color: 'var(--paper)', minWidth: 16, textAlign: 'center' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    );
  };

  const rank = profile ? getRankInfo(profile.elo ?? 1000).rank : null;

  return (
    <header className="border-b hairline sticky top-0 z-30" style={{ background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="font-display text-lg font-medium tracking-tight flex items-baseline gap-2 min-w-0" onClick={sfx.click}>
          <span>Axiom</span>
          {activeExperience.id !== 'axiom' && (
            <span className="font-mono text-[0.55rem] tracking-widest uppercase opacity-45 truncate hidden sm:inline">
              / {activeExperience.shortName}
            </span>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-thin">
          {sectionNavItems.map(navItem)}
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-current opacity-10" />
          {sharedNavItems.map(navItem)}
          {isAdmin && navItem({ to: '/admin', label: 'Admin' })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setSettingsOpen(s => !s)}
                    className="opacity-50 hover:opacity-100 transition-opacity focus-ring"
                    title="Settings"
                    aria-label="Settings"
                    aria-expanded={settingsOpen}
                    aria-controls={settingsOpen ? "settings-menu" : undefined}
                    aria-haspopup="true">
              <Settings size={16} aria-hidden="true" />
            </button>
            {settingsOpen && (
              <div id="settings-menu" className="absolute right-0 mt-2 w-56 border hairline z-40"
                   role="menu"
                   style={{ background: 'var(--paper-tint)', boxShadow: 'var(--shadow)' }}>
                <div className="p-3 space-y-3">
                  <div>
                    <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60 mb-2" id="theme-group-label">Theme</div>
                    <div className="flex gap-1" role="radiogroup" aria-labelledby="theme-group-label">
                      {THEMES.map(t => (
                        <button key={t} onClick={() => pickTheme(t)}
                                role="radio"
                                aria-checked={themeState === t}
                                aria-label={`${t} theme`}
                                className="flex-1 py-1.5 px-2 font-mono text-[0.6rem] tracking-widest uppercase transition-all focus-ring"
                                style={{
                                  border: `1px solid ${themeState === t ? 'var(--ink)' : 'var(--hairline)'}`,
                                  background: themeState === t ? 'var(--bg-soft)' : 'transparent',
                                  color: 'var(--ink)',
                                  cursor: 'pointer',
                                }}>
                          {t === 'light' && <Sun size={11} className="inline mr-1" aria-hidden="true" />}
                          {t === 'dark'  && <Moon size={11} className="inline mr-1" aria-hidden="true" />}
                          {t === 'sepia' && <BookOpen size={11} className="inline mr-1" aria-hidden="true" />}
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-1 border-t hairline" />
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-80">Reduced motion</span>
                    <input type="checkbox" checked={motionState} onChange={toggleMotion}
                           aria-label="Reduce animations"
                           style={{ accentColor: 'var(--ink)' }} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleSound} className="opacity-50 hover:opacity-100 transition-opacity focus-ring"
                  title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                  aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}>
            {soundOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
          </button>
          {profile && (
            <Link to="/profile" onClick={sfx.click} className="flex items-center gap-2 hover:opacity-70 transition-opacity focus-ring"
                  aria-label={`Open profile, ${profile.username}, rank ${rank?.name}, ${profile.elo || 1000} ELO`}>
              <span className="font-display text-lg leading-none" aria-hidden="true">{profile.avatar}</span>
              <div className="text-right hidden sm:block">
                <div className="font-display text-sm leading-tight flex items-center justify-end gap-1">
                  {(profile.winStreak || 0) >= 3 && <span title={`${profile.winStreak} Win Streak`}>🔥</span>}
                  {profile.username}
                </div>
                <div className="font-mono text-[0.6rem] tracking-widest opacity-60" style={{ color: rank?.color }}>
                  {isAdmin ? 'Admin' : rank?.name} · {profile.elo || 1000}
                </div>
              </div>
            </Link>
          )}
          <button onClick={logout} className="opacity-50 hover:opacity-100 transition-opacity focus-ring"
                  title="Log out" aria-label="Log out">
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 py-2 border-t hairline overflow-x-auto scrollbar-thin">
        {sectionNavItems.map(navItem)}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-current opacity-10 shrink-0" />
        {sharedNavItems.map(navItem)}
        {isAdmin && navItem({ to: '/admin', label: 'Admin' })}
      </nav>
    </header>
  );
}
