import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 30; // 30 seconds
const GRID_SIZE = 9;

export default function WhackAMole() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [activeMole, setActiveMole] = useState(null);
  const [hits, setHits] = useState([]);
  const [misses, setMisses] = useState([]);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-whackamole-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const moleTimerRef = useRef(null);
  const hitTimeoutsRef = useRef([]);
  const scoreRef = useRef(score);
  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      hitTimeoutsRef.current.forEach(clearTimeout);
      hitTimeoutsRef.current = [];
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    };
  }, []);

  const spawnMole = useCallback(() => {
    setActiveMole((currentMole) => {
      let nextMole;
      do {
        nextMole = Math.floor(Math.random() * GRID_SIZE);
      } while (nextMole === currentMole && GRID_SIZE > 1);
      return nextMole;
    });

    // Random duration for mole to stay
    const minStay = 400;
    const maxStay = 1000;
    const stayDuration = Math.random() * (maxStay - minStay) + minStay;

    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    moleTimerRef.current = setTimeout(() => {
      // Use ref to check game state to avoid stale closure if spawnMole is not rebuilt perfectly
      // Actually spawnMole depends on gameState, but let's be safe.
      spawnMole();
    }, stayDuration);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      spawnMole();
    } else {
      setActiveMole(null);
      setHits([]);
      setMisses([]);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    }
  }, [gameState, spawnMole]);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setHits([]);
    setMisses([]);
    scoreRef.current = 0;

    hitTimeoutsRef.current.forEach(clearTimeout);
    hitTimeoutsRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);

    sfx.win();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-whackamole-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Whack-A-Mole', score: finalScore });
      updateArcadeBest(profile, 'whack-a-mole', 'Whack-A-Mole', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const getRatingMessage = (s) => {
    if (s >= 300) return "🔨 Master";
    if (s >= 200) return "🔨 Pro";
    if (s >= 100) return "🔨 Good";
    return "🔨 Novice";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(score);
    const text = `I scored ${score} in Axiom Whack-A-Mole! ${rating}`;
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

  const handleHoleClick = (index) => {
    if (gameState !== 'playing') return;

    if (index === activeMole) {
      sfx.piece();
      setScore((s) => s + 10);
      setActiveMole(null); // hide immediately

      const hitId = Date.now();
      setHits(currentHits => [...currentHits, { id: hitId, index }]);
      const timeoutId = setTimeout(() => {
        setHits(currentHits => currentHits.filter(h => h.id !== hitId));
        hitTimeoutsRef.current = hitTimeoutsRef.current.filter(id => id !== timeoutId);
      }, 500);
      hitTimeoutsRef.current.push(timeoutId);

      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
      moleTimerRef.current = setTimeout(spawnMole, 200); // small delay before next spawn
    } else {
      // Missed
      sfx.click();
      setScore((s) => Math.max(0, s - 5));

      const missId = Date.now();
      setMisses(currentMisses => [...currentMisses, { id: missId, index }]);
      setTimeout(() => {
        setMisses(currentMisses => currentMisses.filter(m => m.id !== missId));
      }, 500);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'waiting' || gameState === 'gameover') && e.key === 'Enter') {
        e.preventDefault();
        if (startGameRef.current) startGameRef.current();
        return;
      }
      if (gameState !== 'playing') return;
      const keyMap = {
        '1': 0, '2': 1, '3': 2,
        '4': 3, '5': 4, '6': 5,
        '7': 6, '8': 7, '9': 8,
      };
      if (keyMap[e.key] !== undefined) {
        e.preventDefault();
        handleHoleClick(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, activeMole]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Whack-A-Mole</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Time: {timeLeft}s</span>
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-4 sm:p-6 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <p className="mb-4 text-center font-mono text-sm uppercase tracking-widest opacity-80">
              Target: ≥ 300 for 🔨 Master
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</p>
            <p className="font-mono text-lg mb-1">Final Score: {score}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(score)}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-secondary">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isHit = hits.some(h => h.index === i);
            const isMiss = misses.some(m => m.index === i);
            return (
              <div key={i} className="relative aspect-square">
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleHoleClick(i); }}
                  onClick={() => handleHoleClick(i)}
                  className={'w-full h-full rounded-full flex items-center justify-center transition-all duration-100 ' + (
                    activeMole === i
                      ? 'bg-[var(--forest)] scale-105 shadow-md cursor-crosshair'
                      : 'bg-[var(--bg-soft)] border hairline cursor-default'
                  )}
                  aria-label={activeMole === i ? 'Whack mole' : 'Empty hole'}
                >
                  {activeMole === i && (
                    <div className="text-4xl sm:text-5xl pointer-events-none select-none drop-shadow-sm">🐹</div>
                  )}
                  <div className="hidden sm:block absolute top-1 left-2 font-mono text-xs opacity-30 pointer-events-none">
                    {i + 1}
                  </div>
                </button>
                {isHit && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none fade-up text-[var(--forest)] font-display text-2xl" style={{ animationDuration: '0.3s' }}>
                    +10
                  </div>
                )}
                {isMiss && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none fade-up text-[var(--crimson)] font-display text-2xl" style={{ animationDuration: '0.3s' }}>
                    -5
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Whack the moles as quickly as you can before time runs out!
      </p>
    </div>
  );
}
