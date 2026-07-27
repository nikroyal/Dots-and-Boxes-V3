import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function ReactionTimer() {
  const { profile } = useAuth();
  // states: 'waiting' | 'ready' | 'finished'
  const [gameState, setGameState] = useState('waiting');
  const [reactionTime, setReactionTime] = useState(null);
  const [message, setMessage] = useState('Click to start');
  const [isNewBest, setIsNewBest] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prevBestTime, setPrevBestTime] = useState(null);
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
    setIsNewBest(false);

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
      setPrevBestTime(bestTime);
      if (profile) {
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Reaction Timer', score: time.toFixed(0) + ' ms' });
      updateArcadeBest(profile, 'reaction-timer', 'Reaction Timer', time, time.toFixed(0) + ' ms');
      }
      setIsNewBest(true);
      setBestTime(time);
      try {
        localStorage.setItem('axiom-reaction-best', time.toString());
      } catch {}
    } else {
      setIsNewBest(false);
    }
  };

  const handleTrigger = () => {
    if (gameStateRef.current === 'waiting' || gameStateRef.current === 'finished') {
      startGame();
    } else if (gameStateRef.current === 'ready') {
      handleEarlyClick();
    } else if (gameStateRef.current === 'now') {
      handleValidClick();
    }
  };


  const getRating = (time) => {
    if (time < 200) return "⚡ Superhuman!";
    if (time < 250) return "🐆 Excellent!";
    if (time < 300) return "🏃 Good!";
    if (time < 400) return "🚶 Average!";
    return "🐢 Keep practicing!";
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.repeat) return;
      e.preventDefault();
      handleTrigger();
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    handleTrigger();
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(reactionTime);
    const text = `I scored ${reactionTime.toFixed(0)}ms on Axiom Reaction Timer! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
      }).catch(err => {
        console.warn("Clipboard copy failed", err);
      });
    } else {
      console.warn("Clipboard API not supported");
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

      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <button
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          className="w-full aspect-video border hairline card transition-colors duration-150 flex flex-col items-center justify-center focus-ring select-none"
          style={{ background: bgColor, color: textColor }}
          aria-label="Reaction timer area"
        >
          <div className="font-display text-3xl md:text-4xl pointer-events-none">
            {message}
          </div>
          {gameState === 'finished' && reactionTime && (
            <div className="flex flex-col items-center pointer-events-none mt-4">
              {isNewBest && (
                <div className="font-display text-2xl text-[var(--ochre)] pulse-soft mb-2">
                  🎉 New Best!
                </div>
              )}
              <div className="font-display text-xl text-[var(--ink)] mb-1 opacity-90">
                {getRating(reactionTime)}
              </div>
              {!isNewBest && bestTime && (
                <div className="font-mono text-xs opacity-60 tracking-widest uppercase mb-2">
                  +{ (reactionTime - bestTime).toFixed(0) } ms slower than best
                </div>
              )}
              {isNewBest && prevBestTime && (
                <div className="font-mono text-xs text-[var(--forest)] tracking-widest uppercase mb-2">
                  -{ (prevBestTime - reactionTime).toFixed(0) } ms faster!
                </div>
              )}
              <div className="font-mono text-sm opacity-80 tracking-widest uppercase mt-2">
                Click to try again
              </div>
            </div>
          )}
        </button>

        {gameState === 'finished' && reactionTime && (
          <button
            onClick={handleShare}
            onPointerDown={(e) => e.stopPropagation()}
            className="btn-secondary fade-up"
          >
            {copied ? 'Copied!' : 'Share Result'}
          </button>
        )}
      </div>
    </div>
  );
}
