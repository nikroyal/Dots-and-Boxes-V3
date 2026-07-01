import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60;

const generateProblem = () => {
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  if (op === '+') {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 50) + 20;
    b = Math.floor(Math.random() * a);
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * 12) + 2;
    answer = a * b;
  }

  return { text: `${a} ${op} ${b} = ?`, answer: answer.toString() };
};

export default function QuickMath() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [problem, setProblem] = useState({ text: '', answer: '' });
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;
    setProblem(generateProblem());
    setUserInput('');

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

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I scored ${score} in Axiom Quick Math! 🧮`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    if (userInput.trim() === problem.answer) {
      sfx.piece();
      setScore((s) => s + 1);
      setProblem(generateProblem());
      setUserInput('');
    } else {
      sfx.click();
      setUserInput('');
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
              Start Game
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</p>
            <p className="font-mono text-lg mb-6">Final Score: {score}</p>
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
          <div className="text-4xl sm:text-5xl font-mono tracking-[0.2em] font-bold text-[var(--ink)] break-all text-center">
            {problem.text || '...'}
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              aria-label="Type answer"
              value={userInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.trim() === problem.answer) {
                  sfx.piece();
                  setScore((s) => s + 1);
                  setProblem(generateProblem());
                  setUserInput('');
                } else {
                  setUserInput(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !userInput.trim()) {
                  e.preventDefault();
                }
              }}
              className="w-full text-center text-2xl font-display tracking-widest p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
              placeholder="Answer..."
              disabled={gameState !== 'playing'}
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" className="hidden">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
}
