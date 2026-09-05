import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'playing', 'gameover'
  const [currentNumber, setCurrentNumber] = useState(0);
  const [nextNumber, setNextNumber] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higherorlower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const dbBest = profile?.arcadeBests?.['higher-or-lower']?.scoreValue;
    if (dbBest !== undefined && dbBest > bestStreak) {
      setBestStreak(dbBest);
    }
  }, [profile, bestStreak]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const generateNumber = (exclude) => {
    let num;
    do {
      num = Math.floor(Math.random() * 100) + 1; // 1 to 100
    } while (num === exclude);
    return num;
  };

  const startGame = useCallback(() => {
    sfx.click();
    const firstNum = generateNumber(-1);
    setCurrentNumber(firstNum);
    setNextNumber(generateNumber(firstNum));
    setStreak(0);
    setGameState('playing');
  }, []);

  const handleGuess = useCallback((guess) => {
    if (gameState !== 'playing') return;

    const isHigher = nextNumber > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (isCorrect) {
      sfx.piece();
      const newStreak = streak + 1;
      setStreak(newStreak);
      setCurrentNumber(nextNumber);
      setNextNumber(generateNumber(nextNumber));
    } else {
      sfx.error && sfx.error(); // if available, or fallback

      const finalStreak = streak;
      setGameState('gameover');

      if (finalStreak > bestStreak) {
        setBestStreak(finalStreak);
        try {
          localStorage.setItem('axiom-higherorlower-best', finalStreak.toString());
        } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: finalStreak });
        updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', finalStreak, finalStreak.toString());
      }
    }
  }, [currentNumber, nextNumber, streak, gameState, bestStreak, profile]);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'gameover')) {
      e.preventDefault();
      startGame();
    } else if (gameState === 'playing') {
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleGuess('higher');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleGuess('lower');
      }
    }
  }, [gameState, startGame, handleGuess]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getRatingMessage = (s) => {
    if (s >= 30) return "🚀 Mind Reader";
    if (s >= 15) return "⚡ Lucky Streak";
    if (s >= 5) return "🧠 Getting Warm";
    return "🐢 Keep Trying";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(streak);
    const text = `I got a streak of ${streak} in Axiom Higher or Lower! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Streak: {streak}
        </p>
        {bestStreak > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestStreak}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md min-h-[300px] flex flex-col justify-center">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over!</p>
            <p className="font-mono text-sm opacity-80 mb-1">The number was {nextNumber}</p>
            <p className="font-mono text-lg mb-1">Final Streak: {streak}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(streak)}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again (Enter)
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8">
          {gameState === 'playing' ? (
            <>
              <div className="text-sm font-mono opacity-60 uppercase tracking-widest">
                Will the next number be...
              </div>
              <div className="text-7xl font-display text-[var(--ink)] tracking-tighter">
                {currentNumber}
              </div>

              <div className="flex gap-6 mt-4 w-full justify-center">
                <button
                  onClick={() => handleGuess('higher')}
                  className="flex-1 max-w-[120px] btn-primary bg-[var(--ochre)] hover:bg-[var(--ochre)] opacity-90 hover:opacity-100 flex items-center justify-center gap-2 py-4"
                  aria-label="Higher"
                >
                  <span className="text-xl">▲</span> Higher
                </button>
                <button
                  onClick={() => handleGuess('lower')}
                  className="flex-1 max-w-[120px] btn-primary bg-[var(--crimson)] hover:bg-[var(--crimson)] opacity-90 hover:opacity-100 flex items-center justify-center gap-2 py-4"
                  aria-label="Lower"
                >
                  <span className="text-xl">▼</span> Lower
                </button>
              </div>

              <div className="text-xs font-mono opacity-40 mt-4">
                Keyboard: Up/Down arrows or H/L
              </div>
            </>
          ) : (
             <div className="text-5xl font-display tracking-widest text-[var(--ink)] break-all text-center">
                ?
             </div>
          )}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Numbers range from 1 to 100. Guess if the next one is higher or lower!
      </p>
    </div>
  );
}
