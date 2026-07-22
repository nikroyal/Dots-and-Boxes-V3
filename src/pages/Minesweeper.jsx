import { useState, useEffect, useRef } from 'react';
import { Shield, Flag, RefreshCw, Trophy } from 'lucide-react';
import Confetti from '../components/Confetti';

const ROWS = 8;
const COLS = 8;
const MINES = 10;

function createBoard() {
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    b.push(new Array(COLS).fill(null).map(() => ({
      hasMine: false,
      revealed: false,
      flagged: false,
      neighborMines: 0
    })));
  }
  return b;
}

export default function Minesweeper() {
  const [board, setBoard] = useState(createBoard);
  const [status, setStatus] = useState('idle'); // idle, playing, won, lost
  const [flags, setFlags] = useState(0);
  const [time, setTime] = useState(0);
  const [bestTime, setBestTime] = useState(() => {
    const saved = localStorage.getItem('minesweeper-best');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isFlagMode, setIsFlagMode] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const placeMines = (firstR, firstC) => {
    const b = createBoard();
    let m = 0;
    while (m < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!b[r][c].hasMine && !(r === firstR && c === firstC)) {
        b[r][c].hasMine = true;
        m++;
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!b[r][c].hasMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && b[nr][nc].hasMine) {
                count++;
              }
            }
          }
          b[r][c].neighborMines = count;
        }
      }
    }
    return b;
  };

  const revealCell = (r, c, currentBoard) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || currentBoard[r][c].revealed || currentBoard[r][c].flagged) {
      return;
    }
    currentBoard[r][c].revealed = true;
    if (currentBoard[r][c].neighborMines === 0 && !currentBoard[r][c].hasMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealCell(r + dr, c + dc, currentBoard);
        }
      }
    }
  };

  const handleCellClick = (r, c, e) => {
    if (e) e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    if (board[r][c].revealed) return;

    if (isFlagMode) {
      handleCellRightClick(r, c, e);
      return;
    }

    if (board[r][c].flagged) return;

    let newBoard = board.map(row => row.map(cell => ({ ...cell })));

    if (status === 'idle') {
      newBoard = placeMines(r, c);
      setStatus('playing');
    }

    if (newBoard[r][c].hasMine) {
      newBoard[r][c].revealed = true;
      setStatus('lost');
      setBoard(newBoard);
      return;
    }

    revealCell(r, c, newBoard);

    let unrevealedSafe = 0;
    newBoard.forEach(row => {
      row.forEach(cell => {
        if (!cell.hasMine && !cell.revealed) unrevealedSafe++;
      });
    });

    if (unrevealedSafe === 0) {
      setStatus('won');
      if (bestTime === null || time < bestTime) {
        setBestTime(time);
        localStorage.setItem('minesweeper-best', time.toString());
      }
    }

    setBoard(newBoard);
  };

  const handleCellRightClick = (r, c, e) => {
    if (e) e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    if (board[r][c].revealed) return;

    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);

    const newFlags = newBoard.reduce((acc, row) => acc + row.filter(cell => cell.flagged).length, 0);
    setFlags(newFlags);
  };

  const resetGame = () => {
    setBoard(createBoard());
    setStatus('idle');
    setFlags(0);
    setTime(0);
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center">
      {status === 'won' && <Confetti />}

      <div className="w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl mb-2">Minesweeper</h1>
          <p className="font-display opacity-70">Clear the board without detonating any mines.</p>
        </div>
        <div className="border hairline p-3 flex gap-4" style={{ background: 'var(--paper-tint)' }}>
          <div className="text-center">
            <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-1">Time</div>
            <div className="font-display text-xl tabular-nums">{time}s</div>
          </div>
          {bestTime !== null && (
            <div className="text-center border-l hairline pl-4 border-black/10 dark:border-white/10">
              <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-1 flex items-center justify-center gap-1">
                <Trophy size={10} /> Best
              </div>
              <div className="font-display text-xl tabular-nums" style={{ color: 'var(--ochre)' }}>{bestTime}s</div>
            </div>
          )}
        </div>
      </div>

      <div className="border hairline p-6 w-full flex flex-col items-center" style={{ background: 'var(--paper-tint)' }}>
        <div className="flex items-center justify-between w-full max-w-[400px] mb-6">
          <div className="flex items-center gap-2 font-display text-xl bg-black/5 px-3 py-1.5 rounded">
            <Flag size={20} style={{ color: 'var(--crimson)' }} /> {MINES - flags}
          </div>

          <button
            onClick={() => setIsFlagMode(!isFlagMode)}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-widest border hairline flex items-center gap-2 transition-colors ${isFlagMode ? 'bg-black/10' : 'bg-transparent hover:bg-black/5'}`}
          >
            {isFlagMode ? <Flag size={14} style={{ color: 'var(--crimson)' }} /> : <Shield size={14} />}
            Mode: {isFlagMode ? 'Flag' : 'Dig'}
          </button>

          <button onClick={resetGame} className="btn-primary flex items-center gap-2">
            <RefreshCw size={16} /> Reset
          </button>
        </div>

        <div className="grid gap-1 mb-6" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {board.map((row, r) => (
            row.map((cell, c) => {
              let cellContent = '';
              let cellClass = 'w-10 h-10 sm:w-12 sm:h-12 border hairline flex items-center justify-center font-display text-xl cursor-pointer select-none transition-colors ';

              if (cell.revealed) {
                cellClass += 'bg-black/5 cursor-default ';
                if (cell.hasMine) {
                  cellContent = '💣';
                  cellClass += 'bg-red-500/20 ';
                } else if (cell.neighborMines > 0) {
                  cellContent = cell.neighborMines;
                  const colors = ['text-transparent', 'text-sky-500', 'text-green-500', 'text-red-500', 'text-purple-500', 'text-yellow-600', 'text-cyan-500', 'text-neutral-500', 'text-gray-400'];
                  cellClass += colors[cell.neighborMines] || '';
                }
              } else {
                cellClass += 'bg-white hover:bg-black/5 ';
                if (cell.flagged) {
                  cellContent = <Flag size={18} style={{ color: 'var(--crimson)' }} />;
                }
              }

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={(e) => handleCellClick(r, c, e)}
                  onContextMenu={(e) => handleCellRightClick(r, c, e)}
                  className={cellClass}
                >
                  {cellContent}
                </div>
              );
            })
          ))}
        </div>

        {status === 'won' && (
          <div className="text-center font-display text-2xl flex items-center gap-2" style={{ color: 'var(--forest)' }}>
            <Trophy size={24} /> You Win!
          </div>
        )}
        {status === 'lost' && (
          <div className="text-center font-display text-2xl" style={{ color: 'var(--crimson)' }}>
            Game Over
          </div>
        )}
      </div>
    </div>
  );
}
