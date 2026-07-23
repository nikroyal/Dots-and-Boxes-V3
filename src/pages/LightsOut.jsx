import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';
import Confetti from '../components/Confetti';

// 5x5 grid
const ROWS = 5;
const COLS = 5;

// Helper to create a solvable board
const createBoard = () => {
  // Start with all lights off (false)
  let board = Array(ROWS).fill().map(() => Array(COLS).fill(false));

  // Randomly simulate clicks to ensure the board is solvable
  // We do enough random clicks to shuffle it well
  for (let i = 0; i < 15; i++) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    toggleLights(board, r, c);
  }

  // If we accidentally solved it during generation, regenerate
  if (board.every(row => row.every(cell => !cell))) {
    return createBoard();
  }

  return board;
};

// Toggle a cell and its adjacent neighbors
const toggleLights = (board, r, c) => {
  const toggle = (row, col) => {
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      board[row][col] = !board[row][col];
    }
  };

  toggle(r, c); // center
  toggle(r - 1, c); // top
  toggle(r + 1, c); // bottom
  toggle(r, c - 1); // left
  toggle(r, c + 1); // right
};

export default function LightsOut() {
  const { profile } = useAuth();

  const [board, setBoard] = useState(() => createBoard());
  const [moves, setMoves] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [copied, setCopied] = useState(false);

  const [bestMoves, setBestMoves] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-lightsout-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const startGameRef = useRef(null);

  const initGame = useCallback(() => {
    setBoard(createBoard());
    setMoves(0);
    setHasWon(false);
  }, []);

  useEffect(() => {
    startGameRef.current = initGame;
  }, [initGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (hasWon && e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        sfx.click();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasWon]);

  const handleCellClick = (r, c) => {
    if (hasWon) return;

    sfx.click();

    const newBoard = board.map(row => [...row]);
    toggleLights(newBoard, r, c);
    setBoard(newBoard);

    const newMoves = moves + 1;
    setMoves(newMoves);

    // Check win condition (all lights are off / false)
    const isWon = newBoard.every(row => row.every(cell => !cell));

    if (isWon) {
      sfx.win();
      setHasWon(true);

      if (bestMoves === null || newMoves < bestMoves) {
        setBestMoves(newMoves);
        try {
          localStorage.setItem('axiom-lightsout-best', newMoves.toString());
        } catch {}

        if (profile) {
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Lights Out', score: newMoves + ' moves' });
          updateArcadeBest(profile, 'lights-out', 'Lights Out', newMoves, newMoves + ' moves');
        }
      }
    }
  };

  const getRatingMessage = (m) => {
    if (m <= 15) return "💡 Genius!";
    if (m <= 25) return "🔦 Expert!";
    if (m <= 40) return "🕯️ Good job!";
    return "🐢 Made it!";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(moves);
    const text = `I solved Axiom Lights Out in ${moves} moves! ${rating}`;
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
      {hasWon && <Confetti />}

      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Lights Out</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Moves: {moves}
        </p>
        {bestMoves !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: {bestMoves} moves
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative min-h-[350px]">
        {hasWon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm fade-in">
             <div className="font-display text-4xl mb-2 text-[var(--forest)]">You Win!</div>
             <div className="font-display text-2xl mb-1 opacity-90">{moves} moves</div>
             <div className="font-display text-xl mb-6 opacity-90">{getRatingMessage(moves)}</div>
             <div className="flex gap-4 mb-2">
               <button onClick={() => { sfx.click(); initGame(); }} className="btn-primary">
                  Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-secondary">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        ) : (
          <div className="text-center mb-6 opacity-80 max-w-[250px] font-mono text-xs">
            Turn off all the lights! Clicking a light toggles it and its neighbors.
          </div>
        )}

        <div className="grid grid-cols-5 gap-2 w-full max-w-[300px]">
          {board.map((row, rIndex) =>
            row.map((isOn, cIndex) => (
              <button
                key={`${rIndex}-${cIndex}`}
                onClick={() => handleCellClick(rIndex, cIndex)}
                disabled={hasWon}
                className={`aspect-square w-full rounded-sm transition-colors duration-300 ${isOn ? 'bg-[var(--ochre)] shadow-[0_0_15px_var(--ochre)]' : 'bg-black/10 dark:bg-white/10'}`}
                aria-label={`Light ${rIndex},${cIndex} ${isOn ? 'on' : 'off'}`}
              />
            ))
          )}
        </div>

        <button onClick={() => { sfx.click(); initGame(); }} className="btn-ghost mt-6 text-xs font-mono uppercase tracking-widest opacity-50">
          Restart
        </button>
      </div>
    </div>
  );
}
