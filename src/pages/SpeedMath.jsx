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

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const generateProblem = useCallback(() => {
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let a, b, text, answer;

    if (operator === '+') {
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      text = `${a} + ${b}`;
      answer = a + b;
    } else if (operator === '-') {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * 20) + 1;
      text = `${a} - ${b}`;
      answer = a - b;
    } else if (operator === '*') {
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

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 10);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
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
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Math', score: finalScore + ' pts' });
      updateArcadeBest(profile, 'speed-math', 'Speed Math', finalScore, finalScore + ' pts');
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

  const handleChange = (e) => {
    if (gameState !== 'playing') return;
    const value = e.target.value;

    // Only allow numbers and minus sign
    if (!/^-?\d*$/.test(value)) return;

    setUserInput(value);

    // Auto-submit if the typed answer is fully correct
    if (value !== '' && value !== '-' && parseInt(value, 10) === problem.answer) {
      sfx.piece();
      setScore(prev => prev + 1);
      generateProblem();
    } else if (value.length >= problem.answer.toString().length + 1) {
       // if we exceeded max characters and it's wrong, we could just clear it, but let's just let it be.
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (gameState === 'waiting' || gameState === 'result') {
        if (e.key === 'Enter') {
            e.preventDefault();
            startGame();
        }
    }
  }, [gameState, startGame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Speed Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md">
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
             <div className="font-display text-3xl mb-6 opacity-90 text-[var(--ochre)]">{score} Points</div>
             <div className="flex gap-4">
               <button onClick={startGame} className="btn-primary">
                  Try Again (Enter)
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 min-h-[200px]">
          <div className="text-5xl font-display leading-relaxed text-center tracking-widest pointer-events-none">
            {problem.text}
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={userInput}
            onChange={handleChange}
            className="w-full text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ochre)]"
            placeholder="?"
            disabled={gameState !== 'playing'}
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
}
