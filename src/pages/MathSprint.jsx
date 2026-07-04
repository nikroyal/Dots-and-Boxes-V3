import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

export default function MathSprint() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [copied, setCopied] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-mathsprint-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Use refs to avoid stale closures in timer
  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generateProblem = useCallback(() => {
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer, text;

    if (op === '+') {
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      answer = a + b;
      text = `${a} + ${b}`;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a - b;
      text = `${a} - ${b}`;
    } else {
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
      text = `${a} × ${b}`;
    }

    setProblem({ text, answer });
    setUserInput('');
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    generateProblem();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.win();
    setGameState('result');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-mathsprint-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Math Sprint', score: finalScore + ' solved' });
      updateArcadeBest(profile, 'math-sprint', 'Math Sprint', finalScore, finalScore + ' solved');
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
    const text = `I solved ${score} math problems in 60s on Axiom Math Sprint! 🧮`;
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
    setUserInput(value);

    // Auto-submit on correct answer
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue === problem.answer) {
      sfx.piece(); // nice little pop sound
      setScore(prev => prev + 1);
      generateProblem();
    }
  };

  // Allow 'Enter' key to restart when game is over
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'result')) {
        startGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Math Sprint</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative min-h-[250px] justify-center">
        {gameState === 'waiting' && (
          <div className="flex flex-col items-center justify-center w-full z-10 fade-in">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Solve as many math problems as you can in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary w-full max-w-xs">
              Start Sprint
            </button>
            <p className="mt-4 font-mono text-xs opacity-50 uppercase tracking-widest">Press Enter to Start</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="flex flex-col items-center justify-center w-full z-10 fade-in">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-3xl mb-6 opacity-90 text-[var(--forest)]">{score} Solved</div>
             <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
               <button onClick={startGame} className="btn-primary w-full sm:w-auto">
                  Play Again
               </button>
               <button onClick={handleShare} className="btn-secondary w-full sm:w-auto">
                 {copied ? 'Copied!' : 'Share'}
               </button>
             </div>
             <p className="mt-4 font-mono text-xs opacity-50 uppercase tracking-widest">Press Enter to Restart</p>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full fade-in">
            <div className="text-4xl sm:text-5xl font-display font-medium text-center min-h-[60px] flex items-center justify-center">
              {problem.text} = ?
            </div>

            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={userInput}
              onChange={handleChange}
              className="w-full max-w-[200px] text-center text-4xl font-mono p-4 border hairline bg-[var(--bg-soft)] rounded focus-ring"
              placeholder=""
              disabled={gameState !== 'playing'}
              autoFocus
              aria-label="Enter your answer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
