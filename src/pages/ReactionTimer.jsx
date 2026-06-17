import { useState, useEffect, useRef } from 'react';
import { sfx } from '../lib/sound';

export default function ReactionTimer() {
  // states: 'waiting' | 'ready' | 'finished'
  const [gameState, setGameState] = useState('waiting');
  const [reactionTime, setReactionTime] = useState(null);
  const [message, setMessage] = useState('Click to start');
  const [bestTime, setBestTime] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-reaction-best');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const gameStateRef = useRef('waiting');

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('ready');
    gameStateRef.current = 'ready';
    setMessage('Wait for green...');
    setReactionTime(null);

    // Random delay between 1.5 and 5 seconds
    const delay = Math.random() * 3500 + 1500;

    timerRef.current = setTimeout(() => {
      setGameState('now');
      gameStateRef.current = 'now';
      setMessage('CLICK NOW!');
      startTimeRef.current = performance.now();
      sfx.notify();
    }, delay);
  };

  const handleEarlyClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sfx.loss();
    setGameState('finished');
    gameStateRef.current = 'finished';
    setMessage('Too early! Click to try again.');
  };

  const handleValidClick = () => {
    const endTime = performance.now();
    const time = endTime - startTimeRef.current;

    sfx.win();
    setReactionTime(time);
    setGameState('finished');
    gameStateRef.current = 'finished';
    setMessage(`Your time: ${time.toFixed(0)} ms`);

    if (!bestTime || time < bestTime) {
      setBestTime(time);
      try {
        localStorage.setItem('axiom-reaction-best', time.toString());
      } catch {}
    }
  };

  const handleClick = () => {
    if (gameStateRef.current === 'waiting' || gameStateRef.current === 'finished') {
      startGame();
    } else if (gameStateRef.current === 'ready') {
      handleEarlyClick();
    } else if (gameStateRef.current === 'now') {
      handleValidClick();
    }
  };

  // Determine background color based on state
  let bgColor = 'var(--paper-tint)';
  let textColor = 'var(--ink)';

  if (gameState === 'ready') {
    bgColor = 'var(--crimson)';
    textColor = 'var(--paper)';
  } else if (gameState === 'now') {
    bgColor = 'var(--forest)';
    textColor = 'var(--paper)';
  }

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-10">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Reaction Timer</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Test your reflexes
        </p>
        {bestTime && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-4 text-[var(--ochre)]">
            Best Time: {bestTime.toFixed(0)} ms
          </p>
        )}
      </section>

      <button
        onClick={handleClick}
        className="w-full max-w-md aspect-video border hairline card transition-colors duration-150 flex flex-col items-center justify-center focus-ring select-none"
        style={{ background: bgColor, color: textColor }}
        aria-label="Reaction timer area"
      >
        <div className="font-display text-3xl md:text-4xl pointer-events-none">
          {message}
        </div>
        {gameState === 'finished' && reactionTime && (
          <div className="font-mono text-sm mt-4 opacity-80 pointer-events-none tracking-widest uppercase">
            Click to try again
          </div>
        )}
      </button>
    </div>
  );
}
