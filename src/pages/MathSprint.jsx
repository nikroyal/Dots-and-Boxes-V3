import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

const generateEquation = () => {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a, b, answer;

  if (operation === '+') {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else if (operation === '-') {
    a = Math.floor(Math.random() * 50) + 20;
    b = Math.floor(Math.random() * a); // ensure no negative answers for simplicity
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * 12) + 2;
    answer = a * b;
  }

  return { text: `${a} ${operation} ${b}`, answer: answer.toString() };
};

export default function MathSprint() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [equation, setEquation] = useState({ text: '', answer: '' });
  const [userInput, setUserInput] = useState('');
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-mathsprint-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const scoreRef = useRef(score);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const loadNewEquation = useCallback(() => {
    setEquation(generateEquation());
    setUserInput('');
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;
    loadNewEquation();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-mathsprint-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Math Sprint', score: finalScore });
      updateArcadeBest(profile, 'math-sprint', 'Math Sprint', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const getRatingMessage = (s) => {
    if (s >= 50) return "🧮 Calculator";
    if (s >= 30) return "🧮 Math Whiz";
    if (s >= 15) return "🧮 Good";
    return "🧮 Beginner";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(score);
    const text = `I scored ${score} in Axiom Math Sprint! ${rating}`;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;

    if (userInput.trim() === equation.answer) {
      sfx.piece();
      setScore((s) => s + 1);
      loadNewEquation();
    } else {
      sfx.click();
      setUserInput(''); // clear on wrong answer
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Math Sprint</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Time: {timeLeft}s</span>
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md">
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
            <p className="font-mono text-lg mb-1">Final Score: {score}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(score)}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-5xl sm:text-6xl font-mono tracking-[0.1em] uppercase font-bold text-[var(--ink)] text-center">
            {equation.text || '?'}
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Type answer"
              value={userInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.trim() === equation.answer) {
                  sfx.piece();
                  setScore((s) => s + 1);
                  loadNewEquation();
                } else {
                  setUserInput(val);
                }
              }}
              className="w-full text-center text-3xl font-display uppercase tracking-widest p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
              placeholder="Answer..."
              disabled={gameState !== 'playing'}
              autoFocus
              autoComplete="off"
            />
            <button type="submit" className="hidden">Submit</button>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => {
                sfx.click();
                loadNewEquation();
              }}
              disabled={gameState !== 'playing'}
              className="btn-ghost text-xs"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Solve as many math equations as you can in 60 seconds!
      </p>
    </div>
  );
}
