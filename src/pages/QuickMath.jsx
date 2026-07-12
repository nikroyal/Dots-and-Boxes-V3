import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

export default function QuickMath() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [equation, setEquation] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-quickmath-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const scoreRef = useRef(score);
  const inputRef = useRef(null);
  const startGameRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const generateEquation = useCallback(() => {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let num1, num2, answer;

    if (op === '+') {
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      answer = num1 + num2;
    } else if (op === '-') {
      num1 = Math.floor(Math.random() * 50) + 20;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 - num2;
    } else if (op === '*') {
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
      answer = num1 * num2;
    }

    setEquation({ text: `${num1} ${op} ${num2}`, answer });
    setUserInput('');
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;
    generateEquation();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  }, [generateEquation]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-quickmath-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Quick Math', score: finalScore });
      updateArcadeBest(profile, 'quick-math', 'Quick Math', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const getRatingMessage = (s) => {
    if (s >= 50) return "🧮 Math Genius";
    if (s >= 30) return "🧮 Math Whiz";
    if (s >= 15) return "🧮 Good";
    return "🧮 Beginner";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(score);
    const text = `I scored ${score} in Axiom Quick Math! ${rating}`;
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

  const handleChange = (e) => {
    if (gameState !== 'playing') return;
    // Strip non-numeric characters for simple bounds checking and validation
    const rawValue = e.target.value.replace(/[^0-9-]/g, '');
    setUserInput(rawValue);

    if (rawValue && parseInt(rawValue, 10) === equation.answer) {
      sfx.piece();
      setScore((s) => s + 1);
      generateEquation();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'gameover')) {
        e.preventDefault();
        if (startGameRef.current) startGameRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Quick Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Time: {timeLeft}s</span>
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</p>
            <p className="font-mono text-lg mb-1">Final Score: {score}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(score)}</p>
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

        <div className="flex flex-col items-center justify-center space-y-6 min-h-[150px]">
          <div className="text-5xl sm:text-6xl font-mono uppercase font-bold text-[var(--ink)] text-center">
            {equation.text || '...'}
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            aria-label="Type answer"
            value={userInput}
            onChange={handleChange}
            className="w-full max-w-[200px] text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ochre)]"
            placeholder="?"
            disabled={gameState !== 'playing'}
            autoFocus
            autoComplete="off"
          />
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Solve as many equations as you can in 60 seconds!
      </p>
    </div>
  );
}
