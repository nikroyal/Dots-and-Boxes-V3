import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const ROWS = 8;
const COLS = 8;
const MINES = 10;

export default function MineSweeper() {
  const { profile } = useAuth();

  // 'waiting' | 'playing' | 'gameover' | 'won'
  const [gameState, setGameState] = useState('waiting');
  const [grid, setGrid] = useState([]);
  const [flagsCount, setFlagsCount] = useState(0);
  const [time, setTime] = useState(0);
  const [bestTime, setBestTime] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-minesweeper-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);

  const generateGrid = useCallback((firstClickRow = -1, firstClickCol = -1) => {
    const newGrid = Array(ROWS).fill(null).map(() =>
      Array(COLS).fill(null).map(() => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0
      }))
    );

    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);

      // Avoid placing mine on first click or its neighbors (to ensure safe start)
      const isFirstClickArea = Math.abs(r - firstClickRow) <= 1 && Math.abs(c - firstClickCol) <= 1;

      if (!newGrid[r][c].isMine && !isFirstClickArea) {
        newGrid[r][c].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbors
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (r + dr >= 0 && r + dr < ROWS && c + dc >= 0 && c + dc < COLS) {
                if (newGrid[r + dr][c + dc].isMine) count++;
              }
            }
          }
          newGrid[r][c].neighborMines = count;
        }
      }
    }

    return newGrid;
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setGrid(generateGrid(-1, -1)); // Temporary grid until first click
    setFlagsCount(0);
    setTime(0);
    setGameState('waiting');

    if (timerRef.current) clearInterval(timerRef.current);
  }, [generateGrid]);

  // Helper for cascade reveal
  const revealEmpty = (r, c, currentGrid) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || currentGrid[r][c].isRevealed || currentGrid[r][c].isFlagged) {
      return;
    }

    currentGrid[r][c].isRevealed = true;

    if (currentGrid[r][c].neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealEmpty(r + dr, c + dc, currentGrid);
        }
      }
    }
  };

  const handleCellClick = (r, c) => {
    if (gameState !== 'playing' && gameState !== 'waiting') return;

    let currentGrid = grid;

    if (gameState === 'waiting') {
      sfx.click();
      currentGrid = generateGrid(r, c);
      setGrid(currentGrid);
      setFlagsCount(0);
      setTime(0);
      setGameState('playing');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    }

    if (currentGrid[r][c].isRevealed || currentGrid[r][c].isFlagged) return;

    if (currentGrid[r][c].isMine) {
      // Game Over
      sfx.loss();
      if (timerRef.current) clearInterval(timerRef.current);

      const newGrid = [...currentGrid];
      // Reveal all mines
      for(let i=0; i<ROWS; i++){
        for(let j=0; j<COLS; j++){
          if(newGrid[i][j].isMine) newGrid[i][j].isRevealed = true;
        }
      }
      setGrid(newGrid);
      setGameState('gameover');
      return;
    }

    sfx.piece();
    const newGrid = currentGrid.map(row => row.map(cell => ({...cell})));
    revealEmpty(r, c, newGrid);
    setGrid(newGrid);

    // Check Win
    let revealedCount = 0;
    for(let i=0; i<ROWS; i++) {
      for(let j=0; j<COLS; j++) {
        if(newGrid[i][j].isRevealed) revealedCount++;
      }
    }

    if (revealedCount === (ROWS * COLS) - MINES) {
      if (timerRef.current) clearInterval(timerRef.current);
      sfx.win();
      setGameState('won');

      // Auto flag remaining mines
      for(let i=0; i<ROWS; i++){
        for(let j=0; j<COLS; j++){
          if(newGrid[i][j].isMine) newGrid[i][j].isFlagged = true;
        }
      }
      setFlagsCount(MINES);
      setGrid(newGrid);

      if (bestTime === null || time < bestTime) {
        setBestTime(time);
        try {
          localStorage.setItem('axiom-minesweeper-best', time.toString());
        } catch {}
        if (profile) {
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Mine Sweeper', score: time + 's' });
          updateArcadeBest(profile, 'mine-sweeper', 'Mine Sweeper', time, time + 's');
        }
      }
    }
  };

  const handleCellRightClick = (e, r, c) => {
    e.preventDefault();
    if (gameState !== 'playing') return;

    if (grid[r][c].isRevealed) return;

    sfx.click();
    const newGrid = grid.map(row => row.map(cell => ({...cell})));
    const cell = newGrid[r][c];

    if (cell.isFlagged) {
      cell.isFlagged = false;
      setFlagsCount(f => f - 1);
    } else if (flagsCount < MINES) {
      cell.isFlagged = true;
      setFlagsCount(f => f + 1);
    }

    setGrid(newGrid);
  };

  // Setup initial blank grid
  useEffect(() => {
    setGrid(Array(ROWS).fill(null).map(() => Array(COLS).fill(null).map(() => ({isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0}))));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const [copied, setCopied] = useState(false);
  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I cleared Axiom Mine Sweeper in ${time}s! 💣`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    }
  };

  const getNumberColor = (num) => {
    const colors = [
      '', // 0
      'text-[var(--forest)]', // 1
      'text-[var(--ochre)]', // 2
      'text-[var(--crimson)]', // 3
      'text-blue-600 dark:text-blue-400', // 4
      'text-purple-600 dark:text-purple-400', // 5
      'text-teal-600 dark:text-teal-400', // 6
      'text-black dark:text-white', // 7
      'text-gray-500' // 8
    ];
    return colors[num] || '';
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Mine Sweeper</h1>
        <div className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2 flex justify-center gap-6">
          <span>💣 {MINES - flagsCount}</span>
          <span>⏱️ {time}s</span>
        </div>
        {bestTime !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Time: {bestTime}s
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-4 sm:p-6 flex flex-col items-center relative">
        <div
          className="grid gap-[2px] bg-[var(--ink)]/10 p-[2px] rounded"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => handleCellRightClick(e, r, c)}
                className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-display text-xl sm:text-2xl transition-colors ${
                  cell.isRevealed
                    ? cell.isMine
                      ? 'bg-red-500/20'
                      : 'bg-[var(--paper-tint)]'
                    : 'bg-[var(--bg-soft)] hover:bg-[var(--bg-hover)] active:bg-[var(--ink)]/5'
                }`}
                disabled={gameState === 'won' || gameState === 'gameover'}
              >
                {cell.isRevealed ? (
                  cell.isMine ? '💣' : (cell.neighborMines > 0 ? (
                    <span className={getNumberColor(cell.neighborMines)}>
                      {cell.neighborMines}
                    </span>
                  ) : '')
                ) : (
                  cell.isFlagged ? '🚩' : ''
                )}
              </button>
            ))
          )}
        </div>

        {(gameState === 'won' || gameState === 'gameover') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 backdrop-blur-[2px] z-10 fade-in">
             <div className={`font-display text-4xl mb-2 ${gameState === 'won' ? 'text-[var(--forest)]' : 'text-[var(--crimson)]'}`}>
               {gameState === 'won' ? 'You Won!' : 'Game Over'}
             </div>
             {gameState === 'won' && (
               <div className="font-display text-2xl mb-6">Time: {time}s</div>
             )}
             <div className="flex gap-4 mt-4">
               <button onClick={startGame} className="btn-primary">
                  Play Again
               </button>
               {gameState === 'won' && (
                 <button onClick={handleShare} className="btn-secondary">
                   {copied ? 'Copied!' : 'Share'}
                 </button>
               )}
             </div>
          </div>
        )}
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 text-center max-w-xs">
        Click to reveal, Right-Click to flag mines.
      </p>
    </div>
  );
}
