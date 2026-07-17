import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function ClickTheTarget() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targetPos, setTargetPos] = useState({ top: '50%', left: '50%' });
  const [missFeedback, setMissFeedback] = useState(null);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-click-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = startGame;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'waiting' || gameState === 'result') && e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);


  const getRating = (s) => {
    if (s >= 40) return "🎯 Aimbot";
    if (s >= 30) return "🦅 Sharpshooter";
    if (s >= 20) return "🏃 Good";
    return "🐢 Keep practicing";
  };

  const startGame = () => {
    sfx.click();
    setScore(0);
    setTimeLeft(30);
    setGameState('playing');
    moveTarget();
  };

  const moveTarget = () => {
    // Keep it somewhat within bounds (padding 10% on edges to avoid clipping)
    const top = Math.floor(Math.random() * 80 + 10);
    const left = Math.floor(Math.random() * 80 + 10);
    setTargetPos({ top: `${top}%`, left: `${left}%` });
  };

  const handleTargetClick = (e) => {
    e.stopPropagation();
    if (gameState !== 'playing') return;
    sfx.piece();
    setScore((s) => s + 1);
    moveTarget();
  };

  const handleMiss = (e) => {
    if (gameState !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    sfx.click();
    setScore((s) => Math.max(0, s - 1));

    const id = Date.now();
    setMissFeedback({ id, x, y });
    setTimeout(() => {
      setMissFeedback((prev) => (prev?.id === id ? null : prev));
    }, 300);
  };

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    if (timeLeft <= 0 && gameState === 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('result');
      if (score > bestScore) {
        sfx.achievement();
        setBestScore(score);
        try {
          localStorage.setItem('axiom-click-best', score.toString());
        } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Click The Target', score: score + ' targets' });
        updateArcadeBest(profile, 'click-the-target', 'Click The Target', score, score + ' targets');
      } else {
        sfx.notify();
      }
    }
  }, [timeLeft, gameState, score, bestScore, profile]);

  const [copied, setCopied] = useState(false);
  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(score);
    const text = `I scored ${score} in Axiom Click The Target! ${rating}`;
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
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Click The Target</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {Math.max(0, timeLeft)}s | Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div
        className="w-full max-w-lg border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden"
        style={{ minHeight: '400px' }}
        ref={containerRef}
        onPointerDown={handleMiss}
      >
        {missFeedback && (
          <div
            key={missFeedback.id}
            className="absolute text-[var(--crimson)] font-display text-2xl fade-up pointer-events-none select-none"
            style={{
              left: missFeedback.x,
              top: missFeedback.y,
              transform: 'translate(-50%, -50%)',
              animationDuration: '0.3s'
            }}
          >
            -1
          </div>
        )}

        {gameState === 'playing' && (
          <button
            onPointerDown={handleTargetClick}
            className="absolute rounded-full bg-[var(--crimson)] w-12 h-12 flex items-center justify-center text-white focus:outline-none hover:bg-red-600 transition-colors shadow-lg active:scale-90"
            style={{
              top: targetPos.top,
              left: targetPos.left,
              transform: `translate(-50%, -50%) scale(${Math.max(0.4, 1 - score * 0.015)})`,
              transition: 'top 0.1s ease-out, left 0.1s ease-out, transform 0.1s ease-out'
            }}
            aria-label="Target"
          >
            <div className="w-8 h-8 rounded-full border-2 border-white/50 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/80"></div>
            </div>
          </button>
        )}

        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Click the target as many times as you can in 30 seconds!<br/>
              <span className="text-sm opacity-60 mt-2 block font-mono tracking-widest uppercase">Target: ≥ 40 for 🎯 Aimbot</span>
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] fade-in">
             <div className="font-display text-4xl mb-2">Time's Up!</div>
             <div className="font-display text-2xl mb-2 opacity-80 text-[var(--forest)]">Score: {score}</div>
             <div className="font-display text-xl mb-6 opacity-90">{getRating(score)}</div>
             <div className="flex gap-4">
               <button onClick={startGame} className="btn-primary">
                  Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
