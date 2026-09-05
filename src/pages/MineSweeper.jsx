import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const ROWS = 10;
const COLS = 10;
const MINES = 15;

const generateGrid = () => {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        r,
        c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      });
    }
    grid.push(row);
  }
  return grid;
};

const placeMines = (grid, firstClickR, firstClickC) => {
  let minesPlaced = 0;
  while (minesPlaced < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);

    // Prevent mine on first click or already placed
    if (!grid[r][c].isMine && (r !== firstClickR || c !== firstClickC)) {
      grid[r][c].isMine = true;
      minesPlaced++;
    }
  }
  return grid;
};

const calculateNeighbors = (grid) => {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].isMine) {
            count++;
          }
        }
      }
      grid[r][c].neighborMines = count;
    }
  }
  return grid;
};

const floodFillLogic = (currentGrid, r, c) => {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (currentGrid[r][c].isRevealed || currentGrid[r][c].isFlagged || currentGrid[r][c].isMine) return;

  currentGrid[r][c].isRevealed = true;

  if (currentGrid[r][c].neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        floodFillLogic(currentGrid, r + dr, c + dc);
      }
    }
  }
};

export default function MineSweeper() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'playing', 'won', 'lost'
  const [grid, setGrid] = useState(generateGrid());
  const [flagsCount, setFlagsCount] = useState(MINES);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [bestTime, setBestTime] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-minesweeper-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);
  const timeElapsedRef = useRef(0);
  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = resetGame;
  });

  useEffect(() => {
    timeElapsedRef.current = timeElapsed;
  }, [timeElapsed]);

  const checkWinCondition = useCallback((currentGrid) => {
    let unrevealedSafeCells = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!currentGrid[r][c].isMine && !currentGrid[r][c].isRevealed) {
          unrevealedSafeCells++;
        }
      }
    }

    if (unrevealedSafeCells === 0) {
      sfx.win();
      setGameState('won');
      if (timerRef.current) clearInterval(timerRef.current);

      const currentTime = timeElapsedRef.current;
      setBestTime(prevBest => {
        const isNewBest = prevBest === null || currentTime < prevBest;
        if (isNewBest) {
           try {
             localStorage.setItem('axiom-minesweeper-best', currentTime.toString());
           } catch {}
           recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Minesweeper', score: `${currentTime}s` });
           updateArcadeBest(profile, 'minesweeper', 'Minesweeper', currentTime, `${currentTime}s`);
           return currentTime;
        }
        return prevBest;
      });
    } else {
      setGrid(currentGrid);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const resetGame = () => {
    sfx.click();
    setGrid(generateGrid());
    setGameState('waiting');
    setTimeElapsed(0);
    setFlagsCount(MINES);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const revealCell = (r, c) => {
    if (gameState === 'won' || gameState === 'lost' || grid[r][c].isRevealed || grid[r][c].isFlagged) {
      return;
    }

    if (gameState === 'waiting') {
      sfx.click();

      const newGrid = generateGrid();
      // Copy over flags from previous state
      for (let ir = 0; ir < ROWS; ir++) {
        for (let ic = 0; ic < COLS; ic++) {
          newGrid[ir][ic].isFlagged = grid[ir][ic].isFlagged;
        }
      }

      placeMines(newGrid, r, c);
      calculateNeighbors(newGrid);
      floodFillLogic(newGrid, r, c);

      setGrid(newGrid);
      setGameState('playing');
      setTimeElapsed(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

      checkWinCondition(newGrid);
      return;
    }

    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));

    if (newGrid[r][c].isMine) {
      // Game over
      sfx.loss();
      setGameState('lost');
      if (timerRef.current) clearInterval(timerRef.current);

      // Reveal all mines
      for (let ir = 0; ir < ROWS; ir++) {
        for (let ic = 0; ic < COLS; ic++) {
          if (newGrid[ir][ic].isMine) {
            newGrid[ir][ic].isRevealed = true;
          }
        }
      }
      setGrid(newGrid);
      return;
    }

    sfx.piece();
    floodFillLogic(newGrid, r, c);
    checkWinCondition(newGrid);
  };

  const toggleFlag = (e, r, c) => {
    e.preventDefault();
    if (gameState === 'won' || gameState === 'lost' || grid[r][c].isRevealed) {
      return;
    }

    sfx.click();
    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
    const cell = newGrid[r][c];

    if (cell.isFlagged) {
      cell.isFlagged = false;
      setFlagsCount(prev => prev + 1);
    } else if (flagsCount > 0) {
      cell.isFlagged = true;
      setFlagsCount(prev => prev - 1);
    }

    setGrid(newGrid);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'won' || gameState === 'lost') && e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const [copied, setCopied] = useState(false);

  const getRatingMessage = (time) => {
    if (time <= 30) return "🚀 Mine Master";
    if (time <= 60) return "⚡ Speedy Sweeper";
    if (time <= 120) return "🧠 Careful Clearer";
    return "🐢 Slow & Steady";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(timeElapsed);
    const text = `I cleared Axiom Minesweeper in ${timeElapsed}s! ${rating}`;
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

  const getNumberColor = (num) => {
    switch (num) {
      case 1: return 'text-blue-500';
      case 2: return 'text-green-500';
      case 3: return 'text-red-500';
      case 4: return 'text-purple-500';
      case 5: return 'text-amber-700';
      case 6: return 'text-cyan-500';
      case 7: return 'text-black dark:text-white';
      case 8: return 'text-gray-500';
      default: return '';
    }
  };

  return (
    <div className="fade-in max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Minesweeper</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: <span className="text-[var(--ink)] font-bold">{timeElapsed}s</span> | Flags: <span className="text-[var(--crimson)] font-bold">{flagsCount}</span>
        </p>
        {gameState === 'waiting' && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-60 mt-1">
            Target: ≤ 60s for ⚡
          </p>
        )}
        {bestTime !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Time: {bestTime}s
          </p>
        )}
      </section>

      <div className="w-full max-w-lg border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10">

        {gameState === 'won' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--forest)]">You Won!</div>
             <div className="font-display text-3xl mb-1 opacity-90">{timeElapsed} Seconds</div>
             <div className="font-display text-xl mb-6 opacity-90 text-[var(--ink)]">{getRatingMessage(timeElapsed)}</div>
             <div className="flex gap-4 mt-6">
               <button onClick={resetGame} className="btn-primary">
                 Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-secondary">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        {gameState === 'lost' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Game Over</div>
             <button onClick={resetGame} className="btn-primary mt-6">
                Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
             </button>
          </div>
        )}

        <div className="flex flex-col gap-1 select-none touch-none">
          {grid.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1">
              {row.map((cell, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  onClick={() => revealCell(rIdx, cIdx)}
                  onContextMenu={(e) => toggleFlag(e, rIdx, cIdx)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl font-bold rounded cursor-pointer transition-colors ${
                    cell.isRevealed
                      ? cell.isMine
                        ? 'bg-[var(--crimson)] text-white'
                        : 'bg-black/5 dark:bg-white/10'
                      : 'bg-[var(--bg-soft)] hover:bg-[var(--ink)]/10'
                  }`}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      '💣'
                    ) : cell.neighborMines > 0 ? (
                      <span className={getNumberColor(cell.neighborMines)}>{cell.neighborMines}</span>
                    ) : (
                      ''
                    )
                  ) : cell.isFlagged ? (
                    '🚩'
                  ) : (
                    ''
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm font-mono opacity-60">
           <p>Left Click: Reveal | Right Click: Flag</p>
        </div>
      </div>
    </div>
  );
}
