import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

export default function SpeedMath() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [copied, setCopied] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const inputRef = useRef(null);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-speedmath-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const profileBest = profile?.arcadeBests?.['speed-math']?.scoreValue;
    if (profileBest !== undefined && profileBest > bestScore) {
      setBestScore(profileBest);
    }
  }, [profile, bestScore]);

  const generateProblem = useCallback((currentScore = score) => {
    const ops = ['+', '-', '*'];
    // Weight towards + and - for speed, but include some *
    const op = ops[Math.floor(Math.random() * (currentScore > 10 ? 3 : 2))];

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
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    generateProblem(0);

    startTimeRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      setTimeLeft(Math.ceil(remaining));

      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    timerRef.current = requestAnimationFrame(tick);
  }, [generateProblem]);

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState]);

  const endGame = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);

    sfx.win();
    setGameState('result');

    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem('axiom-speedmath-best', score.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Math', score: score });
      updateArcadeBest(profile, 'speed-math', 'Speed Math', score, score.toString());
    }
  }, [bestScore, profile, score]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'result' || gameState === 'gameover')) {
      e.preventDefault();
      startGame();
    }
  }, [gameState, startGame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (gameState !== 'playing' || !userInput.trim()) return;

    if (parseInt(userInput, 10) === problem.answer) {
      sfx.piece();
      const nextScore = score + 1;
      setScore(nextScore);
      generateProblem(nextScore);
    } else {
      sfx.click();
      setUserInput('');
    }
  };

  const handleChange = (e) => {
    if (gameState !== 'playing') return;
    const val = e.target.value.replace(/[^0-9-]/g, '');

    // Allow only numbers and minus sign
    if (!/^-?\d*$/.test(val)) return;

    setUserInput(val);

    if (val !== '' && val !== '-') {
      const parsedVal = parseInt(val, 10);
      if (parsedVal === problem.answer) {
        sfx.piece();
        const nextScore = score + 1;
        setScore(nextScore);
        generateProblem(nextScore);
      }
    }
  };

  const getRatingMessage = (s) => {
    if (s >= 50) return "⚡ Superhuman!";
    if (s >= 35) return "🐆 Excellent!";
    if (s >= 20) return "🏃 Good!";
    if (s >= 10) return "🚶 Average!";
    return "🐢 Keep practicing!";
  };

  const getNextTierMessage = (s) => {
    if (s >= 50) return "You're at the top tier!";
    if (s >= 35) return `${50 - s} more to Superhuman tier`;
    if (s >= 20) return `${35 - s} more to Excellent tier`;
    if (s >= 10) return `${20 - s} more to Good tier`;
    return `${10 - s} more to Average tier`;
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I solved ${score} math problems in 60s in Axiom Speed Math! 🧮`;
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
          Score: <span className="score-display">{score}</span> <span className="ml-4">Time: {timeLeft}s</span>
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Solve as many basic math problems as you can in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-3xl mb-1 opacity-90 text-[var(--forest)]">{score} Solved</div>
             <div className="font-display text-xl mb-1 text-[var(--ink)] opacity-90">{getRatingMessage(score)}</div>
             <div className="font-mono text-xs opacity-60 tracking-widest uppercase mb-4">{getNextTierMessage(score)}</div>
             {problem && problem.text && (
               <div className="font-mono text-sm opacity-80 mb-6 text-[var(--crimson)]">
                 Missed: {problem.text} = {problem.answer}
               </div>
             )}
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

        <div className="flex flex-col items-center justify-center space-y-8 min-h-[150px]">
          <div className="text-4xl sm:text-5xl font-mono tracking-widest font-bold text-[var(--ink)] text-center problem-text">
            {problem.text || '?'}
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              aria-label="Answer input"
              value={userInput}
              onChange={handleChange}
              className="w-full text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
              placeholder="Answer..."
              disabled={gameState !== 'playing'}
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
