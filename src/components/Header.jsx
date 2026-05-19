import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Volume2, VolumeX, LogOut, Settings, Sun, Moon, BookOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isSoundEnabled, setSoundEnabled, sfx } from '../lib/sound';
import { getRankFromElo } from '../lib/achievements';
import {
  getTheme, setTheme, getReducedMotion, setReducedMotion, THEMES,
} from '../lib/theme';
import { watchTotalUnread } from '../lib/dms';
import { startHeartbeat, stopHeartbeat } from '../lib/presence';

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

  const navItem = (to, label, badge = 0) => {
    const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        onClick={sfx.click}
        className="font-mono px-3 py-1 text-[0.7rem] tracking-widest uppercase transition-opacity inline-flex items-center gap-1.5"
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

  const rank = profile ? getRankFromElo(profile.elo || 1000) : null;

  return (
    <header className="border-b hairline sticky top-0 z-30" style={{ background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="font-display text-lg font-medium tracking-tight" onClick={sfx.click}>
          Dots <em className="font-normal">&amp;</em> Boxes
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItem('/', 'Home')}
          {navItem('/lobby', 'Lobby')}
          {navItem('/leaderboard', 'Ranks')}
          {navItem('/friends', 'Friends')}
          {navItem('/messages', 'Msgs', unreadCount)}
          {navItem('/clubs', 'Clubs')}
          {navItem('/history', 'History')}
          {isAdmin && navItem('/admin', 'Admin')}
        </nav>

        <div className="flex items-center gap-3">
          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setSettingsOpen(s => !s)}
                    className="opacity-50 hover:opacity-100 transition-opacity focus-ring"
                    title="Settings"
                    aria-label="Settings"
                    aria-expanded={settingsOpen}
                    aria-haspopup="true">
              <Settings size={16} aria-hidden="true" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-56 border hairline z-40"
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
                <div className="font-display text-sm leading-tight">{profile.username}</div>
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
      <nav className="md:hidden flex items-center justify-center gap-1 px-4 py-2 border-t hairline overflow-x-auto">
        {navItem('/', 'Home')}
        {navItem('/lobby', 'Lobby')}
        {navItem('/leaderboard', 'Ranks')}
        {navItem('/friends', 'Friends')}
        {navItem('/messages', 'Msgs', unreadCount)}
        {navItem('/clubs', 'Clubs')}
        {navItem('/history', 'History')}
        {isAdmin && navItem('/admin', 'Admin')}
      </nav>
    </header>
  );
}
