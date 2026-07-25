import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting');
  const [currentNumber, setCurrentNumber] = useState(50);
  const [streak, setStreak] = useState(0);
  const [resultMessage, setResultMessage] = useState('');
  const [bestStreak, setBestStreak] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higherlower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [copied, setCopied] = useState(false);

  const generateNumber = (exclude = -1) => {
    let num;
    do {
      num = Math.floor(Math.random() * 100) + 1;
    } while (num === exclude);
    return num;
  };

  const startGameRef = useRef(null);
  const handleGuessRef = useRef(null);

  const startGame = () => {
    sfx.click();
    setCurrentNumber(generateNumber());
    setStreak(0);
    setResultMessage('');
    setGameState('playing');
  };

  const handleGuess = (guess) => {
    if (gameState !== 'playing') return;

    const next = generateNumber(currentNumber);
    const isHigher = next > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (isCorrect) {
      sfx.piece();
      setStreak(s => s + 1);
      setCurrentNumber(next);
    } else {
      sfx.loss(); // sfx.loss() was verified in sound.js line 60
      setResultMessage(`Wrong! The number was ${next}.`);
      setGameState('result');
    }
  };

  useEffect(() => {
    startGameRef.current = startGame;
    handleGuessRef.current = handleGuess;
  });

  useEffect(() => {
    if (gameState === 'result' && streak > bestStreak) {
      setBestStreak(streak);
      try {
        localStorage.setItem('axiom-higherlower-best', streak.toString());
      } catch {}
      if (profile) {
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: streak + ' streak' });
        updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', streak, streak + ' streak');
      }
    }
  }, [gameState, streak, bestStreak, profile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState === 'playing') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (handleGuessRef.current) handleGuessRef.current('higher');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (handleGuessRef.current) handleGuessRef.current('lower');
        }
      } else if (gameState === 'waiting' || gameState === 'result') {
        if (e.key === 'Enter') {
          const tagName = e.target?.tagName;
          if (tagName === 'BUTTON' || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'A') {
            return;
          }
          e.preventDefault();
          if (startGameRef.current) startGameRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const getRatingMessage = (s) => {
    if (s >= 20) return "🔮 Clairvoyant!";
    if (s >= 15) return "🧙‍♂️ Wizard!";
    if (s >= 10) return "🔥 On Fire!";
    if (s >= 5) return "👍 Good Job!";
    return "🐢 Needs Practice";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(streak);
    const text = `I reached a streak of ${streak} in Axiom Higher or Lower! ${rating}`;
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
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Current Streak: {streak}
        </p>
        {bestStreak > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestStreak}
          </p>
        )}
      </section>

      <div className="flex flex-col items-center border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md relative min-h-[300px]">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <p className="mb-4 text-center font-mono text-sm uppercase tracking-widest opacity-80 px-4">
              Will the next number (1-100) be higher or lower?
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over!</p>
            <p className="font-mono text-lg mb-1">{resultMessage}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(streak)}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-secondary">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center w-full fade-in">
            <div className="font-mono text-sm uppercase tracking-widest opacity-60 mb-4">
              Current Number
            </div>
            <div className="font-display text-8xl mb-8 text-[var(--ink)]">
              {currentNumber}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={() => handleGuess('higher')}
                className="btn-primary py-4 text-lg flex flex-col items-center justify-center gap-1"
                disabled={gameState !== 'playing'}
              >
                <span>Higher</span>
                <span className="hidden sm:inline text-[0.6rem] uppercase tracking-widest opacity-50">Up Arrow</span>
              </button>
              <button
                onClick={() => handleGuess('lower')}
                className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1"
                disabled={gameState !== 'playing'}
              >
                <span>Lower</span>
                <span className="hidden sm:inline text-[0.6rem] uppercase tracking-widest opacity-50">Down Arrow</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
