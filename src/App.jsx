import React, { Component, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { isImmersivePath } from './lib/experiences';
import Header from './components/Header';
import Notifications, { toast } from './components/Notifications';
import Login from './pages/Login';
import AxiomHub from './pages/AxiomHub';
import DotsHome from './pages/Dashboard';
import PaperIo from './pages/PaperIo';
import CircuitMaker from './pages/CircuitMaker';
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
import LocalMatch from './pages/LocalMatch';
import Connect4Hub from './pages/Connect4Hub';
import LocalConnect4 from './pages/LocalConnect4';
import MatchConnect4 from './pages/MatchConnect4';
import TicTacToeHub from './pages/TicTacToeHub';
import LocalTicTacToe from './pages/LocalTicTacToe';
import MatchTicTacToe from './pages/MatchTicTacToe';
import ChessHub from './pages/ChessHub';
import LocalChess from './pages/LocalChess';
import MatchChess from './pages/MatchChess';
import MemoryMatch from './pages/MemoryMatch';
import ReactionTimer from './pages/ReactionTimer';
import Snake from './pages/Snake';
import Battleships from './pages/battleships/Battleships';
import WhackAMole from './pages/WhackAMole';
import WordScramble from './pages/WordScramble';
import QuickMath from './pages/QuickMath';
import RockPaperScissors from './pages/RockPaperScissors';
import GuessTheNumber from './pages/GuessTheNumber';
import SpeedMath from './pages/SpeedMath';
import ClickTheTarget from './pages/ClickTheTarget';
import SequenceMemory from './pages/SequenceMemory';
import ColorMatch from './pages/ColorMatch';
import SpeedGrid from './pages/SpeedGrid';
import TypingSpeed from './pages/TypingSpeed';
import MathFlash from './pages/MathFlash';
import Minesweeper from './pages/Minesweeper';

import LocalDistrictExchange from './pages/LocalDistrictExchange';
import DistrictExchangeHub from './pages/DistrictExchangeHub';
const Admin = lazy(() => import('./pages/Admin'));

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
      <div className="font-mono text-xs tracking-widest opacity-50">LOADING...</div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Route crashed:', error, info);
    toast('An unexpected error occurred. You can go back home and keep playing.', 'error');
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-center py-20 px-4">
          <div className="font-display text-3xl mb-3">Something went wrong</div>
          <p className="font-display text-sm opacity-60 max-w-md mx-auto mb-6">
            This page hit an unexpected error. You can go back home and keep playing.
          </p>
          <button onClick={() => window.location.assign('/')} className="btn-primary">
            Go Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Shell() {
  const { user, profile, isImpersonating, stopImpersonation, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/local" element={<LocalMatch />} />
        <Route path="/connect4/local" element={<LocalConnect4 />} />
        <Route path="/tictactoe/local" element={<LocalTicTacToe />} />
        <Route path="/chess/local" element={<LocalChess />} />
        <Route path="/memory-match" element={<MemoryMatch />} />
        <Route path="/reaction-timer" element={<ReactionTimer />} />
        <Route path="/word-scramble" element={<WordScramble />} />
        <Route path="/quick-math" element={<QuickMath />} />
        <Route path="/whack-a-mole" element={<WhackAMole />} />
        <Route path="/rock-paper-scissors" element={<RockPaperScissors />} />
        <Route path="/guess-the-number" element={<GuessTheNumber />} />
        <Route path="/click-the-target" element={<ClickTheTarget />} />
        <Route path="/sequence-memory" element={<SequenceMemory />} />
        <Route path="/color-match" element={<ColorMatch />} />
        <Route path="/speed-grid" element={<SpeedGrid />} />
        <Route path="/typing-speed" element={<TypingSpeed />} />
        <Route path="/math-flash" element={<MathFlash />} />
        <Route path="/speed-math" element={<SpeedMath />} />
        <Route path="/district-exchange/local" element={<LocalDistrictExchange />} />
        <Route path="/snake" element={<Snake />} />
        <Route path="/battleships" element={<Battleships />} />
        <Route path="/paper-io" element={<PaperIo />} />
                <Route path="/minesweeper" element={<Minesweeper />} />
<Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  if (!profile) return <LoadingScreen />;

  const isAdmin = profile.role === 'admin' && !isImpersonating;
  const immersive = isImmersivePath(location.pathname);

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
      <main className={immersive
        ? 'flex-1 w-full min-h-0'
        : 'flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full'}>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<AxiomHub />} />
              <Route path="/dots-and-boxes" element={<DotsHome />} />
              <Route path="/connect4" element={<Connect4Hub />} />
              <Route path="/tictactoe" element={<TicTacToeHub />} />
              <Route path="/chess" element={<ChessHub />} />
              <Route path="/district-exchange" element={<DistrictExchangeHub />} />
              <Route path="/paper-io" element={<PaperIo />} />
              <Route path="/circuit-maker" element={<CircuitMaker />} />
              <Route path="/memory-match" element={<MemoryMatch />} />
              <Route path="/reaction-timer" element={<ReactionTimer />} />
              <Route path="/word-scramble" element={<WordScramble />} />
              <Route path="/quick-math" element={<QuickMath />} />
              <Route path="/whack-a-mole" element={<WhackAMole />} />
              <Route path="/rock-paper-scissors" element={<RockPaperScissors />} />
              <Route path="/guess-the-number" element={<GuessTheNumber />} />
              <Route path="/sequence-memory" element={<SequenceMemory />} />
              <Route path="/color-match" element={<ColorMatch />} />
              <Route path="/speed-grid" element={<SpeedGrid />} />
              <Route path="/click-the-target" element={<ClickTheTarget />} />
              <Route path="/typing-speed" element={<TypingSpeed />} />
              <Route path="/math-flash" element={<MathFlash />} />
              <Route path="/speed-math" element={<SpeedMath />} />
              <Route path="/snake" element={<Snake />} />
              <Route path="/battleships" element={<Battleships />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/match/:id" element={<Match />} />
              <Route path="/connect4/match/:id" element={<MatchConnect4 />} />
              <Route path="/tictactoe/match/:id" element={<MatchTicTacToe />} />
              <Route path="/chess/match/:id" element={<MatchChess />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/history" element={<History />} />
              <Route path="/replay/:id" element={<Replay />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:convId" element={<Messages />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/:id" element={<ClubDetail />} />
              <Route path="/clubs/:id/:channelId" element={<ClubDetail />} />
              <Route path="/local" element={<LocalMatch />} />
              <Route path="/connect4/local" element={<LocalConnect4 />} />
              <Route path="/tictactoe/local" element={<LocalTicTacToe />} />
              <Route path="/chess/local" element={<LocalChess />} />
              <Route path="/district-exchange/local" element={<LocalDistrictExchange />} />
              {isAdmin && <Route path="/admin" element={<Admin />} />}
                            <Route path="/minesweeper" element={<Minesweeper />} />
<Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
