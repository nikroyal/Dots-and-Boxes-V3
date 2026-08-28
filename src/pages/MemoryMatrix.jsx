import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function MemoryMatrix() {
  const { profile } = useAuth();

  // Game states: waiting, memorizing, playing, gameover
  const [gameState, setGameState] = useState('waiting');

  // The grid is always 5x5
  const GRID_SIZE = 5;
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

  // Track game progression
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);

  // Board state
  const [pattern, setPattern] = useState([]); // indices of active cells
  const [clicked, setClicked] = useState([]); // indices of correctly clicked cells
  const [misses, setMisses] = useState([]); // indices of incorrectly clicked cells
  const [copied, setCopied] = useState(false);

  // Timers and Refs
  const timeoutsRef = useRef([]);
  const startGameRef = useRef(null);
  const levelStartedRef = useRef(false);

  // Local best score
  const [bestLevel, setBestLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-memorymatrix-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Calculate pattern size based on level
  // Starts with 3, increases by 1 every 2 levels
  const getPatternSizeForLevel = (currentLevel) => {
    return 2 + Math.floor((currentLevel + 1) / 2);
  };

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  const generatePattern = useCallback((currentLevel) => {
    const size = getPatternSizeForLevel(currentLevel);
    // Don't generate more than we have cells
    const actualSize = Math.min(size, TOTAL_CELLS - 1);

    const newPattern = new Set();
    while (newPattern.size < actualSize) {
      newPattern.add(Math.floor(Math.random() * TOTAL_CELLS));
    }
    return Array.from(newPattern);
  }, []);

  const startLevel = useCallback((currentLevel, currentLives) => {
    clearTimeouts();
    setPattern([]);
    setClicked([]);
    setMisses([]);

    // Brief pause before showing pattern
    setGameState('waiting_level');

    const waitTimeout = setTimeout(() => {
      const newPattern = generatePattern(currentLevel);
      setPattern(newPattern);
      setGameState('memorizing');
      levelStartedRef.current = true;
      sfx.notify();

      // Calculate show duration based on level (starts at 1.5s, gets faster, minimum 0.5s)
      const showDuration = Math.max(500, 1500 - (currentLevel * 50));

      const hideTimeout = setTimeout(() => {
        setGameState('playing');
        sfx.click();
      }, showDuration);

      timeoutsRef.current.push(hideTimeout);
    }, 500);

    timeoutsRef.current.push(waitTimeout);
  }, [generatePattern]);

  const startGame = useCallback(() => {
    sfx.click();
    setLevel(1);
    setLives(3);
    startLevel(1, 3);
  }, [startLevel]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const endGame = useCallback(() => {
    clearTimeouts();
    sfx.loss();
    setGameState('gameover');
    levelStartedRef.current = false;

    const finalScore = level - 1; // Highest completed level

    if (finalScore > bestLevel) {
      setBestLevel(finalScore);
      try {
        localStorage.setItem('axiom-memorymatrix-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Memory Matrix', score: finalScore });
      updateArcadeBest(profile, 'memory-matrix', 'Memory Matrix', finalScore, finalScore.toString());
    }
  }, [level, bestLevel, profile]);

  const handleCellClick = (index) => {
    if (gameState !== 'playing') return;

    if (clicked.includes(index) || misses.includes(index)) return;

    if (pattern.includes(index)) {
      // Correct click
      sfx.piece();
      const newClicked = [...clicked, index];
      setClicked(newClicked);

      // Check if level complete
      if (newClicked.length === pattern.length) {
        setGameState('waiting_level'); // lock inputs
        sfx.win(); // minor win for level
        const timeout = setTimeout(() => {
          setLevel(l => l + 1);
          startLevel(level + 1, lives);
        }, 1000);
        timeoutsRef.current.push(timeout);
      }
    } else {
      // Wrong click
      sfx.error(); // or click if we don't have error

      const newMisses = [...misses, index];
      setMisses(newMisses);

      if (lives > 1) {
        setLives(l => l - 1);
        setGameState('waiting_level'); // lock inputs briefly

        // Brief pause to show error, then retry same level
        const timeout = setTimeout(() => {
          startLevel(level, lives - 1);
        }, 1500);
        timeoutsRef.current.push(timeout);
      } else {
        setLives(0);
        endGame();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
        if (gameState === 'waiting' || gameState === 'gameover') {
          e.preventDefault();
          if (startGameRef.current) startGameRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const getRatingMessage = (l) => {
    if (l >= 15) return "🧠 Perfect Recall";
    if (l >= 10) return "🧠 Photographic";
    if (l >= 5) return "🧠 Sharp Mind";
    return "🧠 Getting started";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const completedLevel = Math.max(0, level - 1);
    const rating = getRatingMessage(completedLevel);
    const text = `I reached level ${completedLevel} in Axiom Memory Matrix! ${rating}`;
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

  const patternSet = useMemo(() => new Set(pattern), [pattern]);
  const clickedSet = useMemo(() => new Set(clicked), [clicked]);
  const missesSet = useMemo(() => new Set(misses), [misses]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Memory Matrix</h1>
        <div className="font-mono text-sm tracking-widest uppercase opacity-60 flex gap-6 justify-center">
          <span>Level: {level}</span>
          <span>Lives: {'❤️'.repeat(lives)}{'🤍'.repeat(3 - lives)}</span>
        </div>
        {bestLevel > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Level: {bestLevel}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-4 sm:p-6 w-full max-w-md aspect-square flex items-center justify-center">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <p className="mb-4 text-center font-mono text-sm uppercase tracking-widest opacity-80 max-w-[200px]">
              Memorize the pattern. Reproduce it to advance!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over</p>
            <p className="font-mono text-lg mb-1">Reached Level: {Math.max(0, level - 1)}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(Math.max(0, level - 1))}</p>
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

        {/* Status indicator */}
        {(gameState === 'memorizing' || gameState === 'playing' || gameState === 'waiting_level') && levelStartedRef.current && (
           <div className="absolute top-2 left-0 right-0 text-center z-10 fade-in pointer-events-none">
             <span className={`font-mono text-xs tracking-widest uppercase px-3 py-1 rounded bg-[var(--paper)]/80 backdrop-blur-sm ${gameState === 'memorizing' ? 'text-[var(--ochre)]' : gameState === 'playing' ? 'text-[var(--forest)]' : 'text-[var(--ink)]'}`}>
               {gameState === 'memorizing' ? 'Memorize...' : gameState === 'playing' ? 'Your Turn!' : '...'}
             </span>
           </div>
        )}

        <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full h-full pt-8 pb-2 px-2">
          {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
            const isPattern = patternSet.has(i);
            const isClicked = clickedSet.has(i);
            const isMiss = missesSet.has(i);

            // Determine cell appearance based on game state
            let cellStyle = 'bg-[var(--bg-soft)] border border-black/5 hover:bg-black/5';

            if (gameState === 'memorizing') {
              if (isPattern) {
                cellStyle = 'bg-[var(--forest)] scale-105 shadow-inner';
              }
            } else if (gameState === 'playing' || gameState === 'waiting_level' || gameState === 'gameover') {
              if (isClicked) {
                 cellStyle = 'bg-[var(--forest)]/80 scale-95';
              } else if (isMiss) {
                 cellStyle = 'bg-[var(--crimson)] scale-95';
              } else if (gameState === 'gameover' && isPattern) {
                 // Show missed pattern cells at game over
                 cellStyle = 'bg-[var(--ochre)]/50';
              }
            }

            return (
              <button
                key={i}
                onPointerDown={(e) => { e.preventDefault(); handleCellClick(i); }}
                onClick={() => handleCellClick(i)}
                disabled={gameState !== 'playing' || isClicked || isMiss}
                className={`relative w-full h-full rounded-md transition-all duration-200 ${cellStyle} focus:outline-none focus:ring-2 focus:ring-[var(--forest)]/50`}
                aria-label={`Grid cell ${i}`}
              />
            );
          })}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Watch the pattern closely. Click the highlighted tiles to advance!
      </p>
    </div>
  );
}