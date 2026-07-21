import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

function createShuffledGrid() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

export default function SpeedGrid() {
  const { profile } = useAuth();

  // states: 'start' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [grid, setGrid] = useState([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [time, setTime] = useState(0);
  const [bestTime, setBestTime] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-speedgrid-best');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });

  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef(null);

  const getRating = (t) => {
    if (t < 5000) return "⚡ Speed Demon";
    if (t < 10000) return "🐆 Fast";
    if (t < 15000) return "🏃 Good";
    return "🐢 Keep practicing";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(time);
    const text = `I cleared Axiom Speed Grid in ${(time / 1000).toFixed(3)}s! ${rating}`;
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

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const startGame = useCallback(() => {
    sfx.click();
    if (timerRef.current) cancelAnimationFrame(timerRef.current);

    setGrid(createShuffledGrid());
    setNextNumber(1);
    setTime(0);
    setGameState('playing');

    startTimeRef.current = performance.now();
    const animate = () => {
      setTime(performance.now() - startTimeRef.current);
      timerRef.current = requestAnimationFrame(animate);
    };
    timerRef.current = requestAnimationFrame(animate);
  }, []);

  const endGame = useCallback((finalTime) => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    sfx.win();
    setGameState('gameover');
    setTime(finalTime);

    if (bestTime === null || finalTime < bestTime) {
      setBestTime(finalTime);
      try {
        localStorage.setItem('axiom-speedgrid-best', finalTime.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Grid', score: (finalTime / 1000).toFixed(3) + 's' });
      updateArcadeBest(profile, 'speed-grid', 'Speed Grid', finalTime, (finalTime / 1000).toFixed(3) + 's');
    }
  }, [bestTime, profile]);

  const handleCellClick = (num) => {
    if (gameState !== 'playing') return;

    if (num === nextNumber) {
      sfx.click();
      if (nextNumber === 25) {
        const finalTime = performance.now() - startTimeRef.current;
        endGame(finalTime);
      } else {
        setNextNumber(n => n + 1);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Speed Grid</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Click 1 to 25 as fast as you can.
        </p>
        {bestTime !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Time: {(bestTime / 1000).toFixed(3)}s
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        <div className="flex justify-between w-full mb-6 font-mono text-xl tracking-widest px-2">
           <div>Next: {gameState === 'playing' ? nextNumber : '-'}</div>
           <div>{(time / 1000).toFixed(3)}s</div>
        </div>

        {gameState === 'start' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8">
             <button onClick={startGame} className="btn-primary w-full text-lg py-3 max-w-[200px]">
               Start Game (Enter)
             </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-[320px]">
            {grid.map((num) => {
              const isClicked = num < nextNumber;
              return (
                <button
                  key={num}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleCellClick(num); }}
                  onClick={() => handleCellClick(num)}
                  disabled={isClicked}
                  className={`aspect-square flex items-center justify-center font-display text-2xl ${isClicked ? 'opacity-0' : 'bg-[var(--bg-soft)] border hairline hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors'}`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        )}

        {gameState === 'gameover' && (
           <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8 text-center fade-in">
             <div className="font-display text-3xl mb-2">Done!</div>
             <div className="font-display text-5xl text-[var(--forest)] mb-6 pulse-soft">
               {(time / 1000).toFixed(3)}s
             </div>
             <div className="flex gap-4 w-full justify-center">
               <button onClick={startGame} className="btn-primary flex-1 text-lg py-3 max-w-[200px]">
                 Play Again (Enter)
               </button>
               <button onClick={handleShare} className="btn-secondary flex-1 text-lg py-3 max-w-[200px]">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}