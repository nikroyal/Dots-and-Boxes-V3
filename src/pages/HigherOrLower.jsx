import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();
  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [nextNumber, setNextNumber] = useState(null);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higherlower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef(null);

  const startGameRef = useRef(null);
  const handleGuessRef = useRef(null);

  const generateNumber = useCallback(() => Math.floor(Math.random() * 100) + 1, []);

  const startGame = useCallback(() => {
    sfx.click();
    setScore(0);
    const startNum = generateNumber();
    setCurrentNumber(startNum);
    // ensure next is different
    let n = generateNumber();
    while (n === startNum) n = generateNumber();
    setNextNumber(n);
    setGameState('playing');
  }, [generateNumber]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const endGame = useCallback(() => {
    sfx.loss();
    setGameState('gameover');

    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem('axiom-higherlower-best', score.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: score });
      updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', score, score.toString());
    }
  }, [score, bestScore, profile]);

  const handleGuess = useCallback((guessHigher) => {
    if (gameState !== 'playing') return;

    const isHigher = nextNumber > currentNumber;

    if ((guessHigher && isHigher) || (!guessHigher && !isHigher)) {
      // Correct guess
      sfx.win();
      setScore(s => s + 1);
      setCurrentNumber(nextNumber);
      let n = generateNumber();
      while (n === nextNumber) n = generateNumber();
      setNextNumber(n);
    } else {
      // Wrong guess
      endGame();
    }
  }, [gameState, currentNumber, nextNumber, generateNumber, endGame]);

  useEffect(() => {
    handleGuessRef.current = handleGuess;
  }, [handleGuess]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

      if (gameState === 'playing') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleGuessRef.current?.(true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleGuessRef.current?.(false);
        }
      } else if (gameState === 'waiting' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGameRef.current?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  const getRating = (s) => {
    if (s >= 50) return "🔮 Oracle";
    if (s >= 30) return "🧠 Mind Reader";
    if (s >= 15) return "🎲 Lucky";
    return "🐢 Keep practicing";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(score);
    const text = `I scored ${score} in Axiom Higher or Lower! ${rating}`;
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

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Will the next number be higher or lower?
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative min-h-[350px] justify-center">
        {gameState === 'playing' && (
          <div className="absolute top-4 left-6 font-mono text-xl tracking-widest">
            Score: {score}
          </div>
        )}

        {gameState === 'waiting' && (
          <div className="text-center fade-in">
            <p className="mb-6 opacity-80">
              Numbers range from 1 to 100. Guess if the next one is higher or lower. One mistake ends the run!
            </p>
            <button onClick={startGame} className="btn-primary w-full text-lg py-3">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center w-full fade-in">
            <div className="font-mono text-sm uppercase tracking-widest opacity-60 mb-4">Current Number</div>
            <div className="font-display text-8xl tracking-tight mb-12">
              {currentNumber}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={() => handleGuess(true)}
                className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1 hover:bg-[var(--forest)] hover:text-white transition-colors border-[var(--forest)]"
              >
                <span className="font-bold text-2xl">Higher</span>
                <span className="text-[0.6rem] uppercase tracking-widest opacity-60">↑ Up Arrow</span>
              </button>
              <button
                onClick={() => handleGuess(false)}
                className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1 hover:bg-[var(--crimson)] hover:text-white transition-colors border-[var(--crimson)]"
              >
                <span className="font-bold text-2xl">Lower</span>
                <span className="text-[0.6rem] uppercase tracking-widest opacity-60">↓ Down Arrow</span>
              </button>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="text-center fade-in w-full flex flex-col items-center">
            <div className="font-mono text-sm uppercase tracking-widest opacity-60 mb-2">The number was</div>
            <div className="font-display text-7xl text-[var(--crimson)] mb-6 pulse-soft">
              {nextNumber}
            </div>
            <div className="font-display text-3xl mb-1">Game Over!</div>
            <div className="font-display text-xl mb-1 opacity-90">Score: {score}</div>
            <div className="font-display text-lg mb-8 opacity-70 text-[var(--forest)]">{getRating(score)}</div>

            <div className="flex gap-4 w-full">
              <button onClick={startGame} className="btn-primary flex-1 text-lg py-3">
                Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-secondary flex-1 text-lg py-3">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
