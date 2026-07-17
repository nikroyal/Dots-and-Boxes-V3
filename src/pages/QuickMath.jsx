import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

const generateQuestion = () => {
  const operations = ['+', '-', '*'];
  const op = operations[Math.floor(Math.random() * operations.length)];
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

  return { text: `${num1} ${op} ${num2}`, answer };
};

export default function QuickMath() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-quickmath-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const dbBest = profile?.arcadeBests?.['quick-math']?.scoreValue;
    if (dbBest !== undefined && dbBest > bestScore) {
      setBestScore(dbBest);
    }
  }, [profile, bestScore]);

  const timerRef = useRef(null);
  const scoreRef = useRef(score);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const loadNewQuestion = useCallback(() => {
    setQuestion(generateQuestion());
    setUserInput('');
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;
    loadNewQuestion();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  }, [loadNewQuestion]);

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

  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus();
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'gameover')) {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  const getRatingMessage = (s) => {
    if (s >= 40) return "🚀 Human Calculator";
    if (s >= 25) return "⚡ Lightning Fast";
    if (s >= 15) return "🧠 Smart Cookie";
    return "🐢 Beginner";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(score);
    const text = `I solved ${score} problems in Axiom Quick Math! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  const handleChange = (e) => {
    if (gameState !== 'playing') return;

    const val = e.target.value;

    // Only allow numbers and max length of 6
    if (val !== '' && !/^[0-9]+$/.test(val)) return;
    if (val.length > 6) return;

    setUserInput(val);

    if (val !== '' && parseInt(val, 10) === question.answer) {
      sfx.piece();
      setScore((s) => s + 1);
      loadNewQuestion();
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Quick Math</h1>
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

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-5xl font-display tracking-widest text-[var(--ink)] break-all text-center">
            {question.text || '?'}
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="w-full flex flex-col items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              aria-label="Type answer"
              value={userInput}
              onChange={handleChange}
              className="w-full text-center text-4xl font-mono p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
              placeholder="?"
              disabled={gameState !== 'playing'}
              autoComplete="off"
              spellCheck="false"
            />
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => {
                sfx.click();
                loadNewQuestion();
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
        Solve as many math problems as you can in 60 seconds!
      </p>
    </div>
  );
}
