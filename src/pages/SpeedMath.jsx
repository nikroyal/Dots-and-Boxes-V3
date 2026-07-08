import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60;

export default function SpeedMath() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [copied, setCopied] = useState(false);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const startGameRef = useRef(null);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-speedmath-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const generateProblem = useCallback(() => {
    const ops = ['+', '-', '*'];
    // Weight towards + and - for speed, but include some *
    const op = ops[Math.floor(Math.random() * (score > 10 ? 3 : 2))];

    let a, b, answer;
    if (op === '+') {
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 20) + 5;
      b = Math.floor(Math.random() * a) + 1; // Ensure a > b
      answer = a - b;
    } else {
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a * b;
    }

    setProblem({ text: `${a} ${op} ${b}`, answer });
    setUserInput('');
  }, [score]);

  const startGame = useCallback(() => {
    sfx.click();
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setGameState('playing');
    generateProblem();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  }, [generateProblem]);

  startGameRef.current = startGame;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'result')) {
        startGameRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.win();
    setGameState('result');

    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem('axiom-speedmath-best', score.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Math', score: score + ' points' });
      updateArcadeBest(profile, 'speed-math', 'Speed Math', score, score + ' points');
    }
  }, [bestScore, score, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    if (gameState !== 'playing') return;

    // Explicitly strip non-numeric characters (allow minus for future-proofing, though problems are positive now)
    const value = e.target.value.replace(/[^0-9-]/g, '');

    // Enforce reasonable max length
    if (value.length > 5) return;

    setUserInput(value);

    // Auto-submit on exact match
    if (parseInt(value, 10) === problem.answer) {
      sfx.piece();
      setScore((s) => s + 1);
      generateProblem();
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I scored ${score} in Axiom Speed Math! 🧮`;
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
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Speed Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {Math.max(0, timeLeft)}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-lg border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10 min-h-[300px]">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Solve as many math problems as you can in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-3xl mb-6 opacity-90 text-[var(--forest)]">Score: {score}</div>
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

        <div className="flex flex-col items-center justify-center space-y-8 w-full flex-1">
          <div className="text-5xl font-display tracking-widest h-16 flex items-center justify-center">
            {gameState === 'playing' ? `${problem.text} = ?` : ''}
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={userInput}
            onChange={handleChange}
            className="w-full max-w-[200px] text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
            placeholder=""
            disabled={gameState !== 'playing'}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
