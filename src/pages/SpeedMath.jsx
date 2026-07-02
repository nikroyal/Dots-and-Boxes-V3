import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function SpeedMath() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [question, setQuestion] = useState({ text: '', answer: 0 });
  const [inputValue, setInputValue] = useState('');
  const [isNewBest, setIsNewBest] = useState(false);
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

  const generateQuestion = () => {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, ans;
    if (op === '+') {
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      ans = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * a);
      ans = a - b;
    } else {
      a = Math.floor(Math.random() * 10) + 2;
      b = Math.floor(Math.random() * 10) + 2;
      ans = a * b;
    }
    setQuestion({ text: `${a} ${op} ${b}`, answer: ans });
    setInputValue('');
  };

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(60);
    setIsNewBest(false);
    setCopied(false);
    generateQuestion();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    setTimeout(() => {
      if(inputRef.current) inputRef.current.focus();
    }, 0);
  };

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('finished');
      sfx.loss();
    }
  }, [gameState, timeLeft]);

  useEffect(() => {
    if (gameState === 'finished') {
       if (score > bestScore) {
          setBestScore(score);
          setIsNewBest(true);
          try {
             localStorage.setItem('axiom-speedmath-best', score.toString());
          } catch {}
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Speed Math', score: score.toString() });
          updateArcadeBest(profile, 'speed-math', 'Speed Math', score, score.toString());
          sfx.win();
       }
    }
  }, [gameState, score, bestScore, profile]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (parseInt(val, 10) === question.answer) {
      sfx.notify();
      setScore(s => s + 1);
      generateQuestion();
    }
  };

  const handleKeyDown = (e) => {
    if (gameState !== 'playing' && (e.key === 'Enter' || e.key === ' ')) {
       startGame();
    }
  };

  const callbackRef = useRef(handleKeyDown);
  useEffect(() => {
      callbackRef.current = handleKeyDown;
  });

  useEffect(() => {
      const handler = (e) => callbackRef.current(e);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
  }, []);

  const getTier = (s) => {
    if (s >= 40) return "🧮 Human Calculator";
    if (s >= 30) return "⚡ Math Whiz";
    if (s >= 20) return "🤓 Scholar";
    if (s >= 10) return "🤔 Student";
    return "🐢 Beginner";
  };

  const handleShare = () => {
    const text = `I scored ${score} in Axiom Speed Math! Tier: ${getTier(score)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
      }).catch(() => {});
    }
  };


  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-10">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Speed Math</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Solve as many as you can in 60s
        </p>
        <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-4 text-[var(--crimson)]">
            Best Score: {bestScore}
        </p>
      </section>

      <div className="w-full max-w-md flex flex-col items-center gap-4">
          <div className="w-full border hairline card flex flex-col items-center justify-center p-8 bg-[var(--paper-tint)]">
             {gameState === 'waiting' && (
                 <button className="btn-primary px-6 py-2" onClick={startGame}>Start Game</button>
             )}
             {gameState === 'playing' && (
                 <div className="flex flex-col items-center w-full">
                     <div className="flex justify-between w-full mb-6 font-mono text-xl">
                        <span>Score: {score}</span>
                        <span>{timeLeft}s</span>
                     </div>
                     <div className="font-display text-5xl mb-8">{question.text} = ?</div>
                     <input
                         ref={inputRef}
                         type="text"
                         inputMode="numeric"
                         value={inputValue}
                         onChange={handleChange}
                         className="input-field text-center text-2xl w-full max-w-[200px]"
                         autoFocus
                         aria-label="Answer input"
                     />
                 </div>
             )}
             {gameState === 'finished' && (
                 <div className="flex flex-col items-center">
                    <div className="font-display text-4xl mb-2">Time's Up!</div>
                    <div className="font-mono opacity-80 mb-4">{question.text} = {question.answer}</div>
                    <div className="font-mono text-2xl mb-1">Final Score: {score}</div>
                    <div className="font-display text-xl mb-4 text-[var(--ink)] opacity-90">{getTier(score)}</div>
                    {isNewBest && <div className="text-[var(--crimson)] pulse-soft mb-4">New Best Score!</div>}
                    <div className="flex gap-4 mt-4">
                        <button className="btn-primary px-6 py-2" onClick={startGame}>Play Again</button>
                        <button className="btn-ghost px-6 py-2" onClick={handleShare}>
                            {copied ? 'Copied!' : 'Share'}
                        </button>
                    </div>
                 </div>
             )}
          </div>
      </div>
    </div>
  );
}
