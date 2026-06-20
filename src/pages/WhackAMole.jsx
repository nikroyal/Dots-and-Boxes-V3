import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 30; // 30 seconds
const GRID_SIZE = 9;

export default function WhackAMole() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [activeMole, setActiveMole] = useState(null);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-whackamole-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const moleTimerRef = useRef(null);
  const scoreRef = useRef(score);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    };
  }, []);

  const spawnMole = useCallback(() => {
    setActiveMole((currentMole) => {
      let nextMole;
      do {
        nextMole = Math.floor(Math.random() * GRID_SIZE);
      } while (nextMole === currentMole && GRID_SIZE > 1);
      return nextMole;
    });

    // Random duration for mole to stay
    const minStay = 400;
    const maxStay = 1000;
    const stayDuration = Math.random() * (maxStay - minStay) + minStay;

    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    moleTimerRef.current = setTimeout(() => {
      // Use ref to check game state to avoid stale closure if spawnMole is not rebuilt perfectly
      // Actually spawnMole depends on gameState, but let's be safe.
      spawnMole();
    }, stayDuration);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      spawnMole();
    } else {
      setActiveMole(null);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    }
  }, [gameState, spawnMole]);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);

    sfx.win();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-whackamole-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Whack-A-Mole', score: finalScore });
      updateArcadeBest(profile, 'whack-a-mole', 'Whack-A-Mole', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const handleHoleClick = (index) => {
    if (gameState !== 'playing') return;

    if (index === activeMole) {
      sfx.piece();
      setScore((s) => s + 10);
      setActiveMole(null); // hide immediately
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
      moleTimerRef.current = setTimeout(spawnMole, 200); // small delay before next spawn
    } else {
      // Missed
      sfx.click();
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Whack-A-Mole</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Time: {timeLeft}s</span>
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-4 sm:p-6 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</p>
            <p className="font-mono text-lg mb-6">Final Score: {score}</p>
            <button onClick={startGame} className="btn-primary">
              Play Again
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: GRID_SIZE }).map((_, i) => (
            <button
              key={i}
              onPointerDown={(e) => { e.preventDefault(); handleHoleClick(i); }}
              onClick={() => handleHoleClick(i)}
              className={'aspect-square rounded-full flex items-center justify-center transition-all duration-100 ' + (
                activeMole === i
                  ? 'bg-[var(--forest)] scale-105 shadow-md cursor-crosshair'
                  : 'bg-[var(--bg-soft)] border hairline cursor-default'
              )}
              aria-label={activeMole === i ? 'Whack mole' : 'Empty hole'}
            >
              {activeMole === i && (
                <div className="w-1/2 h-1/2 rounded-full bg-white opacity-80 pointer-events-none" />
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Whack the moles as quickly as you can before time runs out!
      </p>
    </div>
  );
}
