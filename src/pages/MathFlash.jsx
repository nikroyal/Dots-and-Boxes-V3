import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 30; // 30 seconds

const getRating = (s) => {
  if (s >= 50) return "🚀 Human Calculator";
  if (s >= 40) return "⚡ Lightning Fast";
  if (s >= 20) return "🧠 Smart Cookie";
  return "🐢 Keep practicing";
};

export default function MathFlash() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [currentEquation, setCurrentEquation] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState(0);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-mathflash-best');
      if (saved) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const scoreRef = useRef(0);

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
    let a, b, answer;

    if (op === '+') {
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a - b;
    } else {
      a = Math.floor(Math.random() * 10) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      answer = a * b;
    }

    setCurrentEquation(`${a} ${op} ${b}`);
    setCorrectAnswer(answer);
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

    // Focus input after a short delay to ensure React has rendered the enabled state
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('result');

    const finalScore = scoreRef.current;

    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-mathflash-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Math Flash', score: finalScore });
      updateArcadeBest(profile, 'math-flash', 'Math Flash', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const [userInput, setUserInput] = useState('');
  const [copied, setCopied] = useState(false);

  const inputRef = useRef(null);
  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'waiting' || gameState === 'result') && e.key === 'Enter') {
        if (e.target.tagName !== 'BUTTON') {
          e.preventDefault();
          startGameRef.current?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);






  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const rating = getRating(score);
    const text = `I scored ${score} in Axiom Math Flash! ${rating}`;
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
    const value = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(value);

    if (value === '') return;

    const parsedValue = parseInt(value, 10);
    const correctAnswerStr = correctAnswer.toString();

    if (parsedValue === correctAnswer) {
      sfx.piece();
      setScore(prev => prev + 1);
      setUserInput('');
      generateEquation();
    } else if (value.length >= correctAnswerStr.length && value !== correctAnswerStr) {
      // Clear input for fast feedback if wrong
      setUserInput('');
    }
  };

  return (
    <div className="fade-in max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Math Flash</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-lg">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10 rounded-xl">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Solve as many math equations as you can in 30 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Test <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
            <p className="font-mono text-xs opacity-60 mt-2">Press Enter</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm rounded-xl">
            <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
            <div className="font-display text-3xl mb-2 opacity-90 text-[var(--forest)]">Score: {score}</div>
            <div className="font-display text-xl mb-6 opacity-90 text-[var(--ink)]">
            {getRating(score)}
            </div>
            <div className="flex gap-4 mb-2">
              <button onClick={startGame} className="btn-primary">
                Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
            <p className="font-mono text-xs opacity-60 mt-2">Press Enter to restart</p>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 min-h-[200px]">
          <div className="text-4xl sm:text-5xl font-display leading-relaxed text-center" style={{ minHeight: '80px' }}>
            {currentEquation} = ?
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={userInput}
            onChange={handleChange}
            className="w-full max-w-[200px] text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)] rounded-lg"
            placeholder="0"
            disabled={gameState !== 'playing'}
            autoFocus
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}