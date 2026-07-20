import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function NumberMemory() {
  const { profile } = useAuth();
  // states: 'start' | 'showing' | 'input' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [level, setLevel] = useState(1);
  const [targetNumber, setTargetNumber] = useState('');
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef(null);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-numbermemory-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const startGameRef = useRef(null);

  const generateNumber = useCallback((lvl) => {
    let numStr = '';
    for (let i = 0; i < lvl; i++) {
      numStr += Math.floor(Math.random() * 10).toString();
    }
    return numStr;
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setLevel(1);
    const firstNum = generateNumber(1);
    setTargetNumber(firstNum);
    setGameState('showing');

    // Time depends on level: base 1s + 0.5s per digit
    const duration = 1000 + (1 * 500);
    setTimeLeft(duration);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          clearInterval(timerRef.current);
          setGameState('input');
          setUserInput('');
          return 0;
        }
        return prev - 100;
      });
    }, 100);
  }, [generateNumber]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const handleNextLevel = useCallback(() => {
    sfx.win();
    const nextLevel = level + 1;
    setLevel(nextLevel);
    const newNum = generateNumber(nextLevel);
    setTargetNumber(newNum);
    setGameState('showing');

    const duration = 1000 + (nextLevel * 500);
    setTimeLeft(duration);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          clearInterval(timerRef.current);
          setGameState('input');
          setUserInput('');
          return 0;
        }
        return prev - 100;
      });
    }, 100);
  }, [level, generateNumber]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.loss();
    setGameState('gameover');

    const score = level - 1;
    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem('axiom-numbermemory-best', score.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Number Memory', score: score });
      updateArcadeBest(profile, 'number-memory', 'Number Memory', score, score.toString());
    }
  }, [level, bestScore, profile]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'input') return;

    if (userInput === targetNumber) {
      handleNextLevel();
    } else {
      endGame();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'input' && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
    }
  }, [gameState]);

  const getRating = (lvl) => {
    if (lvl >= 12) return "🧠 Genius";
    if (lvl >= 9) return "🧠 Master";
    if (lvl >= 6) return "🧠 Good";
    return "🧠 Beginner";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const finalScore = level - 1;
    const rating = getRating(finalScore);
    const text = `I remembered ${finalScore} digits in Axiom Number Memory! ${rating}`;
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
    const handleKeyDown = (e) => {
      if ((gameState === 'start' || gameState === 'gameover') && e.key === 'Enter') {
        e.preventDefault();
        if (startGameRef.current) startGameRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Number Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Remember the longest number you can.
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore} Digits
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center justify-center min-h-[250px] relative">
        {(gameState === 'showing' || gameState === 'input') && (
          <div className="absolute top-4 right-6 font-mono text-xl tracking-widest">
            Level {level}
          </div>
        )}

        {gameState === 'start' && (
          <div className="text-center">
            <p className="mb-6 opacity-80 max-w-[250px]">
              Memorize the number on the screen. It gets longer every round.
            </p>
            <button onClick={startGame} className="btn-primary w-full text-lg py-3">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'showing' && (
          <div className="text-center fade-in">
            <div className="font-display text-6xl tracking-tight mb-8">
              {targetNumber}
            </div>
            <div className="w-48 h-2 bg-black/10 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-[var(--ochre)] transition-all ease-linear"
                style={{
                  width: `${(timeLeft / (1000 + (level * 500))) * 100}%`,
                  transitionDuration: '100ms'
                }}
              />
            </div>
          </div>
        )}

        {gameState === 'input' && (
          <form onSubmit={handleSubmit} className="text-center fade-in w-full max-w-xs">
            <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-4">
              What was the number?
            </p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full text-center font-display text-4xl mb-6 p-4 border hairline bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ochre)]"
              placeholder="..."
              autoComplete="off"
            />
            <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={userInput.length === 0}>
              Submit
            </button>
          </form>
        )}

        {gameState === 'gameover' && (
          <div className="text-center fade-in w-full flex flex-col items-center">
            <div className="font-display text-3xl mb-2 text-[var(--crimson)]">Wrong Number</div>
            <p className="mb-4">
              Number was: <strong className="font-display text-xl">{targetNumber}</strong>
            </p>
            <div className="font-display text-4xl mb-2 pulse-soft">
              Score: {level - 1} Digits
            </div>
            <div className="font-display text-xl mb-6 opacity-90">{getRating(level - 1)}</div>
            <div className="flex gap-4 w-full">
              <button onClick={startGame} className="btn-primary flex-1 py-3 text-lg">
                Play Again (Enter)
              </button>
              <button onClick={handleShare} className="btn-secondary flex-1 py-3 text-lg">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
