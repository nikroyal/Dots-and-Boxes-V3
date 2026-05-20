import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Header from './components/Header';
import Notifications from './components/Notifications';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Lobby from './pages/Lobby';
import Match from './pages/Match';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Friends from './pages/Friends';
import Achievements from './pages/Achievements';
import History from './pages/History';
import Replay from './pages/Replay';
import Messages from './pages/Messages';
import Clubs from './pages/Clubs';
import ClubDetail from './pages/ClubDetail';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-xs tracking-widest opacity-50">LOADING…</div>
    </div>
  );
}

function Shell() {
  const { user, profile, realProfile, isImpersonating, stopImpersonation, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  if (!profile) return <LoadingScreen />;

  // Admin Shell: Only if NOT impersonating and the real profile is admin.
  if (profile.role === 'admin' && !isImpersonating) {
    return (
      <div className="min-h-screen flex flex-col">
        <Notifications />
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </div>
    );
  }

  // Player Shell (or Impersonation Shell)
  return (
    <div className="min-h-screen flex flex-col">
      {isImpersonating && (
        <div className="bg-amber-600 text-white px-4 py-2 text-center text-sm font-mono flex items-center justify-center gap-4 sticky top-0 z-[60]">
          <span>You are impersonating <strong>{profile.username}</strong></span>
          <button 
            onClick={stopImpersonation}
            className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[0.7rem] uppercase tracking-wider transition-colors"
          >
            Exit Impersonation
          </button>
        </div>
      )}
      <Header />
      <Notifications />
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/lobby"          element={<Lobby />} />
          <Route path="/match/:id"      element={<Match />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile"        element={<Profile />} />
          <Route path="/leaderboard"    element={<Leaderboard />} />
          <Route path="/friends"        element={<Friends />} />
          <Route path="/achievements"   element={<Achievements />} />
          <Route path="/history"        element={<History />} />
          <Route path="/replay/:id"     element={<Replay />} />
          <Route path="/messages"       element={<Messages />} />
          <Route path="/messages/:convId" element={<Messages />} />
          <Route path="/clubs"          element={<Clubs />} />
          <Route path="/clubs/:id"      element={<ClubDetail />} />
          <Route path="/clubs/:id/:channelId" element={<ClubDetail />} />
          <Route path="*"               element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
