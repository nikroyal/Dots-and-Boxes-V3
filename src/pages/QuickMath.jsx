import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

export default function QuickMath() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [equation, setEquation] = useState({ text: '', answer: 0 });
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-quickmath-best');
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

  const generateEquation = useCallback(() => {
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer;

    if (op === '+') {
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      answer = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
    } else { // '*'
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
    }

    setEquation({ text: `${a} ${op} ${b}`, answer });
    setUserInput('');
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    scoreRef.current = 0;
    generateEquation();

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
        localStorage.setItem('axiom-quickmath-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Quick Math', score: finalScore + ' solved' });
      updateArcadeBest(profile, 'quick-math', 'Quick Math', finalScore, finalScore + ' solved');
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
    const text = `I solved ${score} equations in 60s on Axiom Quick Math! 🧮`;
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

    // Only allow numbers and maybe negative sign, though for these ranges we don't have negative answers, so just digits
    if (value !== '' && !/^-?\d+$/.test(value)) return;

    setUserInput(value);

    if (parseInt(value, 10) === equation.answer) {
        sfx.piece();
        setScore(prev => {
            const next = prev + 1;
            scoreRef.current = next;
            return next;
        });
        generateEquation();
    }
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && gameState !== 'playing') {
          startGame();
      }
  }

  useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      }
  });

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Quick Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | Score: {score}
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
              Solve as many math problems as you can in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game
            </button>
            <p className="mt-4 font-mono text-xs opacity-50 uppercase tracking-widest">Press Enter to Start</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-3xl mb-6 opacity-90 text-[var(--forest)]">{score} Solved</div>
             <div className="flex gap-4">
               <button onClick={startGame} className="btn-primary">
                  Play Again
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
             <p className="mt-6 font-mono text-xs opacity-50 uppercase tracking-widest">Press Enter to Restart</p>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 min-h-[200px]">
          <div className="text-5xl font-display leading-relaxed text-center tracking-widest" style={{ minHeight: '80px' }}>
            {equation.text} = ?
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="w-full flex justify-center">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={userInput}
                onChange={handleChange}
                className="w-full max-w-xs text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
                placeholder="?"
                disabled={gameState !== 'playing'}
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
          </form>
        </div>
      </div>
    </div>
  );
}
