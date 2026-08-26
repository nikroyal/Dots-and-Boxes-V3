import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 10000; // 10 seconds

export default function CPSTest() {
  const { profile } = useAuth();
  // states: 'start' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [copied, setCopied] = useState(false);
  const [bestCPS, setBestCPS] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-cps-best');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const shareTimeoutRef = useRef(null);

  const startGame = useCallback(() => {
    sfx.click();
    if (timerRef.current) clearInterval(timerRef.current);
    setClicks(0);
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    startTimeRef.current = performance.now();

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
      }
    }, 50); // Updates for smooth timer display
  }, []);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.win();
    setGameState('gameover');

    const currentCPS = clicks / (GAME_DURATION / 1000);

    if (currentCPS > bestCPS) {
      setBestCPS(currentCPS);
      try {
        localStorage.setItem('axiom-cps-best', currentCPS.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'CPS Test', score: currentCPS.toFixed(1) + ' CPS' });
      updateArcadeBest(profile, 'cps-test', 'CPS Test', currentCPS, currentCPS.toFixed(1) + ' CPS');
    }
  }, [clicks, bestCPS, profile]);

  useEffect(() => {
    if (timeLeft <= 0 && gameState === 'playing') {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);


  const getRating = (cps) => {
    if (cps >= 10) return "🚀 Auto-Clicker!";
    if (cps >= 8) return "🐆 Cheetah";
    if (cps >= 6) return "🏃 Athlete";
    return "🐢 Warming up";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const currentCPS = (clicks / (GAME_DURATION / 1000)).toFixed(1);
    const rating = getRating(currentCPS);
    const text = `I scored ${currentCPS} CPS on Axiom CPS Test! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  const handleClickArea = useCallback((e) => {
    if (gameState === 'start' || gameState === 'gameover') {
       // Do nothing here, we have separate buttons for start/restart.
       // However, we could start the game on the first click.
       if (gameState === 'start') {
           startGame();
           setClicks(1);
       }
       return;
    }

    if (gameState === 'playing') {
      // Don't play click sound every time, it gets annoying very fast.
      setClicks(c => c + 1);
    }
  }, [gameState, startGame]);

  const handleKeyDownRef = useRef();

  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };
  }, [gameState, startGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentCPS = (clicks / (GAME_DURATION / 1000)).toFixed(1);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">CPS Test</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Clicks Per Second
        </p>
        {bestCPS > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best CPS: {bestCPS.toFixed(1)}
          </p>
        )}
      </section>

      <div className="w-full max-w-md flex flex-col items-center relative">
        <div
          className="w-full aspect-square md:aspect-video border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center justify-center relative select-none cursor-pointer hover:bg-[var(--paper)] transition-colors active:scale-[0.98]"
          onPointerDown={(e) => {
            e.preventDefault(); // crucial to prevent double firing on mobile
            handleClickArea(e);
          }}
        >
          {gameState === 'playing' && (
            <div className="absolute top-4 right-6 font-mono text-xl tracking-widest text-[var(--crimson)]">
              {(timeLeft / 1000).toFixed(1)}s
            </div>
          )}

          {gameState === 'start' && (
            <div className="text-center pointer-events-none">
              <div className="font-display text-3xl mb-4">Click anywhere here</div>
              <p className="opacity-60 max-w-[250px] mx-auto text-sm">
                You have 10 seconds to click as many times as you can.
              </p>
              <div className="mt-8 font-mono text-xs uppercase tracking-widest opacity-50">
                Tap to Start
              </div>
            </div>
          )}

          {gameState === 'playing' && (
            <div className="text-center pointer-events-none fade-in">
              <div className="font-display text-7xl tracking-tight text-[var(--ochre)]">
                {clicks}
              </div>
              <div className="font-mono text-sm tracking-widest uppercase opacity-60 mt-2">
                Clicks
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="text-center fade-in w-full flex flex-col items-center pointer-events-none">
              <div className="font-display text-2xl mb-2 opacity-80">Time's Up!</div>
              <div className="font-display text-5xl text-[var(--forest)] mb-2 pulse-soft">
                {currentCPS} CPS
              </div>
              <div className="font-display text-lg mb-4 opacity-90">{getRating(currentCPS)}</div>
              <div className="font-mono text-xs opacity-60 tracking-widest uppercase">
                Total clicks: {clicks}
              </div>
            </div>
          )}
        </div>

        {gameState === 'gameover' && (
          <div className="flex gap-4 w-full mt-6 fade-up">
            <button onClick={startGame} className="btn-primary flex-1 text-lg py-3">
              Play Again (Enter)
            </button>
            <button onClick={handleShare} className="btn-secondary flex-1 text-lg py-3">
              {copied ? 'Copied!' : 'Share Result'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
