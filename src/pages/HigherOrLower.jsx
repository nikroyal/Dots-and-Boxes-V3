import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();

  // 'start' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(50);
  const [nextNumber, setNextNumber] = useState(50);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higherlower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const generateNumber = (exclude) => {
    let num;
    do {
      num = Math.floor(Math.random() * 100) + 1;
    } while (num === exclude);
    return num;
  };

  const startGame = useCallback(() => {
    sfx.click();
    setScore(0);
    const startNum = generateNumber(0);
    setCurrentNumber(startNum);
    setNextNumber(generateNumber(startNum));
    setGameState('playing');
    setMessage('Higher or Lower?');
  }, []);

  const handleGuess = useCallback((guessHigher) => {
    if (gameState !== 'playing') return;

    const actualHigher = nextNumber > currentNumber;

    if (guessHigher === actualHigher) {
      // Win
      sfx.win();
      setScore(s => s + 1);
      setCurrentNumber(nextNumber);
      setNextNumber(generateNumber(nextNumber));
    } else {
      // Lose
      sfx.loss();
      setGameState('gameover');
      setMessage(`It was ${nextNumber}!`);

      if (score > bestScore) {
        setBestScore(score);
        try {
          localStorage.setItem('axiom-higherlower-best', score.toString());
        } catch {}
        if (profile) {
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: score.toString() });
          updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', score, score.toString());
        }
      }
    }
  }, [gameState, currentNumber, nextNumber, score, bestScore, profile]);

  const handleKeyDownRef = useRef();
  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      if (gameState === 'playing') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleGuess(true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          handleGuess(false);
        }
      } else if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };
  }, [gameState, handleGuess, startGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getRating = (s) => {
    if (s >= 20) return "🔮 Oracle";
    if (s >= 10) return "🧠 Mind Reader";
    if (s >= 5) return "🎲 Lucky";
    return "🐢 Keep trying";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(score);
    const text = `I got a streak of ${score} in Axiom Higher or Lower! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
          Will the next number (1-100) be higher or lower?
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        {gameState === 'playing' && (
          <div className="absolute top-4 left-6 font-mono text-xl tracking-widest text-[var(--forest)]">
            Streak: {score}
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[160px] w-full mt-8 mb-8">
          {gameState === 'start' && (
            <div className="text-center">
              <p className="mb-6 opacity-80 max-w-[250px] mx-auto">
                Guess if the next random number between 1 and 100 will be higher or lower than the current one.
              </p>
              <button onClick={startGame} className="btn-primary w-full text-lg py-3">
                Start Game (Enter)
              </button>
            </div>
          )}

          {gameState === 'playing' && (
            <div className="flex flex-col items-center">
              <div className="font-display text-8xl tracking-tight text-[var(--ink)] mb-4">
                {currentNumber}
              </div>
              <div className="font-display text-xl opacity-70">
                {message}
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="text-center fade-in w-full flex flex-col items-center">
              <div className="font-display text-3xl mb-2 text-[var(--crimson)]">{message}</div>
              <div className="font-display text-5xl text-[var(--ink)] mb-2 pulse-soft">
                Streak: {score}
              </div>
              <div className="font-display text-xl mb-6 opacity-90">{getRating(score)}</div>
              <div className="flex gap-4 w-full">
                <button onClick={startGame} className="btn-primary flex-1 text-lg py-3">
                  Play Again (Enter)
                </button>
                <button onClick={handleShare} className="btn-secondary flex-1 text-lg py-3">
                  {copied ? 'Copied!' : 'Share Result'}
                </button>
              </div>
            </div>
          )}
        </div>

        {gameState === 'playing' && (
          <div className="grid grid-cols-2 gap-4 w-full">
            <button
              onClick={() => handleGuess(true)}
              className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1 hover:border-[var(--forest)] hover:text-[var(--forest)] transition-colors"
            >
              <span>Higher</span>
              <span className="text-[0.6rem] uppercase tracking-widest opacity-50">Up / Right</span>
            </button>
            <button
              onClick={() => handleGuess(false)}
              className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1 hover:border-[var(--crimson)] hover:text-[var(--crimson)] transition-colors"
            >
              <span>Lower</span>
              <span className="text-[0.6rem] uppercase tracking-widest opacity-50">Down / Left</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
