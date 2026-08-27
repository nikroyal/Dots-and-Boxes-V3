import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function NumberMemory() {
  const { profile } = useAuth();
  // states: 'waiting' | 'memorize' | 'input' | 'result'
  const [gameState, setGameState] = useState('waiting');
  const [level, setLevel] = useState(1);
  const [currentNumber, setCurrentNumber] = useState('');
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const [bestLevel, setBestLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-number-memory-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const startGameRef = useRef(null);
  const memorizeTimeMs = useRef(0);
  const startTimeRef = useRef(0);
  const animFrameRef = useRef(null);

  const generateNumber = (length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      if (i === 0) {
        // First digit should not be 0 to avoid leading zero confusion
        result += Math.floor(Math.random() * 9) + 1;
      } else {
        result += Math.floor(Math.random() * 10);
      }
    }
    return result;
  };

  const startLevel = useCallback((newLevel) => {
    const num = generateNumber(newLevel);
    setLevel(newLevel);
    setCurrentNumber(num);
    setUserInput('');
    setGameState('memorize');

    // Calculate time to memorize: 1000ms base + 500ms per digit
    const timeToMemorize = 1000 + (newLevel * 500);
    memorizeTimeMs.current = timeToMemorize;
    setTimeLeft(timeToMemorize);

    startTimeRef.current = performance.now();

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, timeToMemorize - elapsed);
      setTimeLeft(remaining);

      if (remaining > 0) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setGameState('input');
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    startLevel(1);
  }, [startLevel]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const endGame = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    sfx.loss();
    setGameState('result');

    // Score is the number of digits successfully remembered (level - 1)
    const score = level - 1;

    if (score > bestLevel) {
      setBestLevel(score);
      try {
        localStorage.setItem('axiom-number-memory-best', score.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Number Memory', score: score.toString() + ' Digits' });
      updateArcadeBest(profile, 'number-memory', 'Number Memory', score, score.toString() + ' Digits');
    }
  }, [level, bestLevel, profile]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'input' && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [gameState]);

  const handleGlobalKeyDownRef = useRef();

  useEffect(() => {
    handleGlobalKeyDownRef.current = (e) => {
      if (e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          // If we are in input state, and we press Enter on the input field, we submit it
          if (gameState === 'input' && e.target === inputRef.current) {
            e.preventDefault();
            handleSubmit();
          }
          return;
        }

        if (gameState === 'waiting' || gameState === 'result') {
          e.preventDefault();
          startGameRef.current?.();
        }
      }
    };
  }, [gameState, userInput, currentNumber, level]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (handleGlobalKeyDownRef.current) {
        handleGlobalKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleChange = (e) => {
    if (gameState !== 'input') return;
    const value = e.target.value;
    if (/^\d*$/.test(value)) { // Only allow digits
      setUserInput(value);
    }
  };

  const handleSubmit = () => {
    if (gameState !== 'input') return;

    if (userInput === currentNumber) {
      sfx.win();
      startLevel(level + 1);
    } else {
      endGame();
    }
  };

  const getRatingMessage = (lvl) => {
    if (lvl >= 15) return "🧠 Einstein!";
    if (lvl >= 10) return "📚 Genius!";
    if (lvl >= 7) return "🎓 Scholar!";
    if (lvl >= 5) return "🤓 Smart!";
    return "🐢 Keep practicing!";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const score = level - 1;
    const text = `I remembered ${score} digits in Axiom Number Memory! ${getRatingMessage(score)}`;
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

  const progressPercent = memorizeTimeMs.current > 0 ? (timeLeft / memorizeTimeMs.current) * 100 : 0;

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Number Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Level: <span className="text-[var(--ink)] font-bold">{level}</span>
        </p>
        {bestLevel > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Level: {bestLevel}
          </p>
        )}
      </section>

      <div className="w-full max-w-lg border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10 min-h-[300px]">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4 max-w-sm">
              Memorize the number shown on screen. It gets longer each level.
            </p>
            <button onClick={startGame} className="btn-primary mb-2">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
            <p className="font-mono text-xs opacity-60">Press Enter</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/95 z-10 backdrop-blur-sm pt-8 overflow-y-auto">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)] shrink-0">Game Over!</div>

             <div className="mb-4 text-center w-full px-6 flex flex-col gap-2 shrink-0">
               <div>
                 <div className="font-mono text-xs opacity-50 uppercase tracking-widest">Number was</div>
                 <div className="font-display text-2xl tracking-widest break-all opacity-80">{currentNumber}</div>
               </div>
               <div>
                 <div className="font-mono text-xs opacity-50 uppercase tracking-widest">You typed</div>
                 <div className="font-display text-2xl tracking-widest break-all text-[var(--crimson)] line-through decoration-2 opacity-80">
                   {userInput || "(Nothing)"}
                 </div>
               </div>
             </div>

             <div className="font-display text-2xl mb-1 text-[var(--ink)] opacity-90 shrink-0">Level {level - 1}</div>
             <div className="font-display text-lg mb-6 text-[var(--ochre)] opacity-90 shrink-0">{getRatingMessage(level - 1)}</div>

             <div className="flex gap-4 mb-2 shrink-0 pb-4">
               <button onClick={startGame} className="btn-primary">
                  Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 w-full min-h-[200px]">
          {gameState === 'memorize' && (
            <>
              <div className="font-display text-5xl sm:text-7xl tracking-[0.2em] text-center break-all text-[var(--ink)]">
                {currentNumber}
              </div>
              <div className="w-full max-w-sm h-1 bg-[var(--bg-soft)] rounded-full overflow-hidden mt-8">
                <div
                  className="h-full bg-[var(--ochre)] transition-all ease-linear"
                  style={{ width: `${progressPercent}%`, transitionDuration: '16ms' }}
                />
              </div>
            </>
          )}

          {gameState === 'input' && (
            <div className="w-full flex flex-col items-center">
              <label htmlFor="number-input" className="mb-4 font-mono text-sm opacity-60 uppercase tracking-widest">
                What was the number?
              </label>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="w-full flex flex-col items-center">
                <input
                  id="number-input"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={userInput}
                  onChange={handleChange}
                  className="w-full max-w-sm text-center text-3xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:ring-2 focus:ring-[var(--ochre)] focus:outline-none transition-colors"
                  placeholder="?"
                  autoComplete="off"
                  spellCheck="false"
                  autoCorrect="off"
                />
                <button
                  type="submit"
                  className="btn-primary mt-6 min-w-[160px]"
                  disabled={userInput.length === 0}
                >
                  Submit
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
