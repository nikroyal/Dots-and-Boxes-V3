import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GRID_SIZE = 4;
const WIN_TARGET = 2048;

const INITIAL_BOARD = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

// Colors inspired by standard 2048 tiles, using theme variables where appropriate
const TILE_COLORS = {
  0: 'var(--bg-soft)',
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
};

// Text color: dark for small numbers, white for large numbers
const getTextColor = (val) => val <= 4 ? '#776e65' : '#ffffff';

export default function Game2048() {
  const { profile } = useAuth();

  const [board, setBoard] = useState(INITIAL_BOARD);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('playing'); // 'playing', 'won', 'gameover'
  const [hasWon, setHasWon] = useState(false); // To allow continuing after 2048
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-2048-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // --- Game Logic ---

  const addRandomTile = (currentBoard) => {
    const emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length === 0) return currentBoard;

    const newBoard = currentBoard.map(row => [...row]);
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  };

  const initGame = useCallback(() => {
    let newBoard = INITIAL_BOARD.map(row => [...row]);
    newBoard = addRandomTile(newBoard);
    newBoard = addRandomTile(newBoard);
    setBoard(newBoard);
    setScore(0);
    setGameState('playing');
    setHasWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkGameOver = (currentBoard) => {
    // Check for empty cells
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === 0) return false;
      }
    }

    // Check for possible merges
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = currentBoard[r][c];
        // Right
        if (c < GRID_SIZE - 1 && currentBoard[r][c + 1] === val) return false;
        // Down
        if (r < GRID_SIZE - 1 && currentBoard[r + 1][c] === val) return false;
      }
    }

    return true; // No empty cells and no merges possible
  };

  const processMove = useCallback((direction) => {
    if (gameStateRef.current !== 'playing') return;

    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      let moved = false;
      let scoreIncrease = 0;
      let reached2048 = false;

      // Helper to process a single line (row or column)
      const processLine = (line) => {
        // 1. Remove zeros
        let filtered = line.filter(val => val !== 0);
        // 2. Merge adjacent equal elements
        for (let i = 0; i < filtered.length - 1; i++) {
          if (filtered[i] !== 0 && filtered[i] === filtered[i + 1]) {
            filtered[i] *= 2;
            scoreIncrease += filtered[i];
            if (filtered[i] === WIN_TARGET) reached2048 = true;
            filtered.splice(i + 1, 1);
          }
        }
        // 3. Pad with zeros
        while (filtered.length < GRID_SIZE) {
          filtered.push(0);
        }
        return filtered;
      };

      if (direction === 'LEFT' || direction === 'RIGHT') {
        for (let r = 0; r < GRID_SIZE; r++) {
          let row = newBoard[r];
          if (direction === 'RIGHT') row = [...row].reverse();

          const newRow = processLine(row);
          if (direction === 'RIGHT') newRow.reverse();

          for (let c = 0; c < GRID_SIZE; c++) {
            if (newBoard[r][c] !== newRow[c]) moved = true;
            newBoard[r][c] = newRow[c];
          }
        }
      } else if (direction === 'UP' || direction === 'DOWN') {
        for (let c = 0; c < GRID_SIZE; c++) {
          let col = [];
          for (let r = 0; r < GRID_SIZE; r++) {
            col.push(newBoard[r][c]);
          }
          if (direction === 'DOWN') col = col.reverse();

          const newCol = processLine(col);
          if (direction === 'DOWN') newCol.reverse();

          for (let r = 0; r < GRID_SIZE; r++) {
            if (newBoard[r][c] !== newCol[r]) moved = true;
            newBoard[r][c] = newCol[r];
          }
        }
      }

      if (moved) {
        sfx.click();
        const finalBoard = addRandomTile(newBoard);

        setScore(prevScore => {
          const newScore = prevScore + scoreIncrease;

          // Update best score
          setBestScore(prevBest => {
            if (newScore > prevBest) {
              try {
                localStorage.setItem('axiom-2048-best', newScore.toString());
              } catch {}

              if (profile) {
                 recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: '2048', score: newScore.toString() });
                 updateArcadeBest(profile, '2048', '2048', newScore, newScore.toString());
              }
              return newScore;
            }
            return prevBest;
          });

          return newScore;
        });

        if (reached2048 && !hasWon) {
          sfx.win();
          setGameState('won');
          setHasWon(true); // Flag to allow continue playing
        } else if (checkGameOver(finalBoard)) {
          sfx.loss();
          setGameState('gameover');
        }

        return finalBoard;
      }

      return prevBoard; // No move happened
    });
  }, [hasWon, profile]);


  // --- Input Handling ---

  const handleKeyDownRef = useRef();
  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      // Prevent scrolling with arrows
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') processMove('UP');
      else if (e.key === 'ArrowDown') processMove('DOWN');
      else if (e.key === 'ArrowLeft') processMove('LEFT');
      else if (e.key === 'ArrowRight') processMove('RIGHT');
    };
  }, [processMove]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) handleKeyDownRef.current(e);
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Touch Gestures ---
  const touchStartRef = useRef({ x: 0, y: 0 });
  const onTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const onTouchEnd = (e) => {
    if (!touchStartRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartRef.current.x;
    const dy = touchEndY - touchStartRef.current.y;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) { // minimum swipe distance
      if (absDx > absDy) {
        if (dx > 0) processMove('RIGHT');
        else processMove('LEFT');
      } else {
        if (dy > 0) processMove('DOWN');
        else processMove('UP');
      }
    }
  };


  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] px-4 py-8">
      <header className="w-full max-w-[400px] flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-5xl font-medium tracking-tight">2048</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-1">Join the numbers</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-[var(--paper-tint)] border hairline rounded p-2 text-center min-w-[70px]">
            <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">Score</div>
            <div className="font-mono font-bold">{score}</div>
          </div>
          <div className="bg-[var(--paper-tint)] border hairline rounded p-2 text-center min-w-[70px]">
             <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-60">Best</div>
             <div className="font-mono font-bold">{bestScore}</div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[400px] flex justify-between items-center mb-4">
        <p className="font-mono text-sm opacity-80">
          Use <strong className="opacity-100">arrow keys</strong> or <strong className="opacity-100">swipe</strong> to move tiles.
        </p>
        <button onClick={() => { sfx.click(); initGame(); }} className="btn-secondary py-1 px-3 text-sm">
          New Game
        </button>
      </div>

      <div
        className="p-3 rounded-lg relative touch-none shadow-xl border border-black/10"
        style={{ width: '100%', maxWidth: '400px', aspectRatio: '1/1', backgroundColor: '#bbada0' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Game Over / Win Overlay */}
        {(gameState === 'gameover' || (gameState === 'won' && !hasWon)) && (
          <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center text-white fade-in">
            <h2 className="font-display text-4xl mb-4 text-center">
              {gameState === 'won' ? 'You Win!' : 'Game Over!'}
            </h2>
            <div className="flex gap-4">
               {gameState === 'won' && (
                  <button
                    onClick={() => { sfx.click(); setGameState('playing'); }}
                    className="btn-primary border-white"
                  >
                    Keep Playing
                  </button>
               )}
               <button onClick={() => { sfx.click(); initGame(); }} className="btn-secondary bg-white text-black hover:bg-white/90">
                 Try Again
               </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full">
          {board.map((row, r) => (
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className="rounded flex items-center justify-center font-display font-bold transition-all duration-100 ease-in-out"
                style={{
                  backgroundColor: TILE_COLORS[val > 2048 ? 2048 : val] || '#3c3a32',
                  color: getTextColor(val),
                  fontSize: val >= 1024 ? '1.5rem' : val >= 100 ? '2rem' : '2.5rem',
                  // Slightly elevate active tiles
                  boxShadow: val > 0 ? 'inset 0 -3px 0 rgba(0,0,0,0.1)' : 'none',
                  // Empty tiles get a slight background
                  ...(val === 0 ? { backgroundColor: 'rgba(238, 228, 218, 0.35)' } : {})
                }}
              >
                {val !== 0 ? val : ''}
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}
