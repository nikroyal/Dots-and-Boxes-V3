import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function NumberMemory() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // waiting, memorizing, typing, result
  const [level, setLevel] = useState(1);
  const [numberToRemember, setNumberToRemember] = useState('');
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [bestLevel, setBestLevel] = useState(() => {
    try {
      return parseInt(localStorage.getItem('axiom-number-memory-best') || '0', 10);
    } catch { return 0; }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const generateNumber = (lvl) => {
    let numStr = '';
    for (let i = 0; i < lvl; i++) {
      numStr += Math.floor(Math.random() * 10).toString();
    }
    return numStr;
  };

  const startGame = () => {
    sfx.click();
    setLevel(1);
    startLevel(1);
  };

  const startLevel = (lvl) => {
    const newNum = generateNumber(lvl);
    setNumberToRemember(newNum);
    setUserInput('');
    setGameState('memorizing');

    // Time to memorize increases slightly with length
    const timeMs = 1500 + (lvl * 500);
    setTimeLeft(timeMs);

    const startTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const remaining = timeMs - elapsed;

      if (remaining <= 0) {
        setGameState('typing');
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setTimeLeft(remaining);
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'typing') return;

    if (userInput === numberToRemember) {
      sfx.click();
      setGameState('success');
      const nextLevel = level + 1;
      setLevel(nextLevel);

      if (nextLevel > bestLevel) {
        setBestLevel(nextLevel);
        try { localStorage.setItem('axiom-number-memory-best', nextLevel.toString()); } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Number Memory', score: 'Level ' + nextLevel });
        updateArcadeBest(profile, 'number-memory', 'Number Memory', nextLevel, 'Level ' + nextLevel);
      }

      setTimeout(() => startLevel(nextLevel), 1000); // Short pause before next level
    } else {
      sfx.notify();
      setGameState('result');
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-4xl font-medium tracking-tight mb-2">Number Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60">Remember the longest number</p>
        <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-4 text-[var(--ochre)]">
          Best Level: {bestLevel}
        </p>
      </section>

      <div className="w-full max-w-md border hairline p-8 text-center" style={{ background: 'var(--paper-tint)' }}>
        {gameState === 'waiting' && (
          <div className="space-y-6">
            <p className="font-display text-lg">Memorize the number. It gets longer each round.</p>
            <button onClick={startGame} className="btn-primary w-full">Start Game</button>
          </div>
        )}

        {gameState === 'memorizing' && (
          <div className="space-y-6">
            <div className="font-mono text-sm opacity-60 uppercase tracking-widest">Level {level}</div>
            <div className="font-display text-5xl tracking-[0.2em]">{numberToRemember}</div>
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden mt-4">
              <div
                className="h-full bg-[var(--ochre)] transition-all duration-[50ms] ease-linear"
                style={{ width: `${(timeLeft / (1500 + level * 500)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {gameState === 'typing' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="font-mono text-sm opacity-60 uppercase tracking-widest">Level {level}</div>
            <p className="font-display text-xl mb-4">What was the number?</p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userInput}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*$/.test(val)) setUserInput(val);
              }}
              className="w-full text-center font-display text-4xl tracking-[0.2em] bg-transparent border-b-2 border-black/20 focus:border-[var(--ochre)] outline-none py-2"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary w-full">Submit</button>
          </form>
        )}

        {gameState === 'success' && (
          <div className="space-y-6 flex flex-col items-center justify-center py-8">
            <div className="font-display text-4xl text-[var(--forest)] pulse-soft">Correct!</div>
            <div className="font-mono text-sm uppercase tracking-widest opacity-60 mt-4">Get ready for next level...</div>
          </div>
        )}

        {gameState === 'result' && (
          <div className="space-y-6">
            <div className="font-display text-2xl mb-4 text-[var(--crimson)]">Incorrect!</div>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest opacity-60">Number was</p>
              <p className="font-display text-2xl tracking-[0.2em]">{numberToRemember}</p>
              <p className="font-mono text-xs uppercase tracking-widest opacity-60 mt-4">You typed</p>
              <p className="font-display text-xl tracking-[0.2em] text-[var(--crimson)] line-through">{userInput || '(blank)'}</p>
            </div>
            <div className="mt-6">
              <p className="font-display text-lg mb-4">You reached Level {level}</p>
              <button onClick={startGame} className="btn-primary w-full">Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
