import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

export default function SpeedMath() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'result'
  const [gameState, setGameState] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [copied, setCopied] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-speedmath-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generateProblem = useCallback(() => {
    // Generate a simple math problem (+, -, *)
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, text, answer;

    if (op === '+') {
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      text = `${a} + ${b}`;
      answer = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * 20) + 1;
      text = `${a} - ${b}`;
      answer = a - b;
    } else {
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      text = `${a} × ${b}`;
      answer = a * b;
    }

    setProblem({ text, answer });
    setUserInput('');
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    scoreRef.current = 0;
    generateProblem();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    // focus input after react paints the state change
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 0);
  }, [generateProblem]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.win();
    setGameState('result');

    const finalScore = scoreRef.current;

    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-speedmath-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Math', score: finalScore + ' solved' });
      updateArcadeBest(profile, 'speed-math', 'Speed Math', finalScore, finalScore + ' solved');
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
    const text = `I solved ${score} math problems in 60s on Axiom Speed Math! 🧮`;
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
    const value = e.target.value;
    // Allow numbers and an optional negative sign
    if (value === '' || value === '-' || /^-?\d+$/.test(value)) {
      setUserInput(value);

      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue === problem.answer) {
        sfx.piece();
        const newScore = score + 1;
        setScore(newScore);
        scoreRef.current = newScore;
        generateProblem();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (gameState === 'waiting' || gameState === 'result') {
        startGame();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Speed Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md flex flex-col items-center">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10 p-6 text-center">
            <p className="mb-6 font-display text-xl opacity-80">
              Solve as many math problems as you can in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary w-full">
              Start Test (Press Enter)
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/95 z-10 backdrop-blur-sm p-6 text-center">
             <div className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-2xl mb-6 opacity-90 text-[var(--forest)]">{score} Solved</div>
             <div className="flex flex-col gap-4 w-full">
               <button onClick={startGame} className="btn-primary w-full">
                  Try Again (Press Enter)
               </button>
               <button onClick={handleShare} className="btn-secondary w-full">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center w-full">
          <div className="font-display text-5xl sm:text-6xl mb-8 min-h-[4rem] flex items-center justify-center text-[var(--ink)]">
            {gameState === 'playing' ? problem.text : '?'}
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={userInput}
            onChange={handleChange}
            className="w-full text-center text-4xl font-mono p-4 border hairline bg-[var(--bg-soft)] rounded focus-ring"
            placeholder="="
            disabled={gameState !== 'playing'}
            autoComplete="off"
            spellCheck="false"
            aria-label="Enter answer"
          />
        </div>
      </div>
    </div>
  );
}
