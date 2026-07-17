import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function NumberMemory() {
  const { profile } = useAuth();

  // 'start' | 'memorize' | 'recall' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [level, setLevel] = useState(1);
  const [targetNumber, setTargetNumber] = useState('');
  const [userInput, setUserInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [bestLevel, setBestLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-numbermemory-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const generateNumber = useCallback((len) => {
    let numStr = '';
    for (let i = 0; i < len; i++) {
      numStr += Math.floor(Math.random() * 10).toString();
    }
    return numStr;
  }, []);

  const endGame = useCallback(() => {
    sfx.loss();
    setGameState('gameover');
    if (level > bestLevel) {
      setBestLevel(level);
      try {
        localStorage.setItem('axiom-numbermemory-best', level.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Number Memory', score: 'Level ' + level });
      updateArcadeBest(profile, 'number-memory', 'Number Memory', level, 'Level ' + level);
    }
  }, [level, bestLevel, profile]);

  const startLevel = useCallback((lvl) => {
    const num = generateNumber(lvl);
    setTargetNumber(num);
    setUserInput('');
    setGameState('memorize');

    // Give more time for longer numbers (min 2s, +0.5s per digit)
    const ms = 1500 + (lvl * 500);
    setTimeRemaining(ms);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setGameState('recall');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }, ms);
  }, [generateNumber]);

  const startGame = useCallback(() => {
    sfx.click();
    setLevel(1);
    startLevel(1);
  }, [startLevel]);

  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    if (gameState !== 'recall') return;

    if (userInput === targetNumber) {
      sfx.win();
      setLevel(l => l + 1);
      startLevel(level + 1);
    } else {
      endGame();
    }
  }, [gameState, userInput, targetNumber, level, startLevel, endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);


  const handleKeyDownRef = useRef();

  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      if (e.key === 'Enter') {
        if (gameState === 'start' || gameState === 'gameover') {
          e.preventDefault();
          startGame();
        }
      }
    };
  }, [gameState, startGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^[0-9]+$/.test(val)) {
      setUserInput(val);
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Number Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Remember the longest number you can.
        </p>
        {bestLevel > 1 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Level: {bestLevel}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        {(gameState === 'memorize' || gameState === 'recall') && (
          <div className="absolute top-4 right-6 font-mono text-xl tracking-widest">
            Level {level}
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[200px] w-full mt-8 mb-8">
          {gameState === 'start' && (
            <div className="text-center">
              <button onClick={startGame} className="btn-primary w-full text-lg py-3">
                Start Game (Enter)
              </button>
            </div>
          )}

          {gameState === 'memorize' && (
            <div className="text-center fade-in w-full">
              <div className="font-mono text-5xl tracking-widest break-all">
                {targetNumber}
              </div>
              <div className="mt-8 h-1 bg-black/10 rounded-full overflow-hidden w-full max-w-[200px] mx-auto">
                <div
                  className="h-full bg-[var(--ink)]"
                  style={{
                    animation: `shrink ${timeRemaining}ms linear forwards`
                  }}
                />
              </div>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes shrink {
                  from { width: 100%; }
                  to { width: 0%; }
                }
              `}} />
            </div>
          )}

          {gameState === 'recall' && (
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4 fade-in">
              <p className="font-mono text-sm uppercase tracking-widest opacity-60 mb-2">What was the number?</p>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={userInput}
                onChange={handleInputChange}
                className="w-full text-center text-3xl font-mono p-4 border hairline bg-[var(--bg-soft)] rounded focus-ring"
                placeholder="?"
                autoFocus
                autoComplete="off"
              />
              <button type="submit" className="btn-primary w-full text-lg py-3" disabled={userInput.length === 0}>
                Submit
              </button>
            </form>
          )}

          {gameState === 'gameover' && (
            <div className="text-center fade-in w-full flex flex-col items-center">
              <div className="font-display text-3xl mb-4">Game Over</div>
              <div className="font-mono text-sm opacity-60 mb-1 uppercase tracking-widest">Number was</div>
              <div className="font-mono text-2xl mb-4 break-all text-[var(--forest)]">{targetNumber}</div>
              <div className="font-mono text-sm opacity-60 mb-1 uppercase tracking-widest">You entered</div>
              <div className="font-mono text-2xl mb-8 break-all text-[var(--crimson)]">{userInput || '-'}</div>

              <button onClick={startGame} className="btn-primary w-full text-lg py-3">
                Play Again (Enter)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

}
