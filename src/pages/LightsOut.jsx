import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GRID_SIZE = 5;

// Generate a random solvable board by starting with all lights off and simulating random clicks
function createRandomBoard() {
  let board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
  const numClicks = Math.floor(Math.random() * 10) + 5; // 5 to 14 random clicks

  for (let i = 0; i < numClicks; i++) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    board = toggleLights(board, r, c);
  }

  // Ensure it's not already solved
  if (board.every(row => row.every(cell => !cell))) {
    board[0][0] = true;
    board[0][1] = true;
    board[1][0] = true;
  }
  return board;
}

function toggleLights(board, row, col) {
  const newBoard = board.map(r => [...r]);
  const toggle = (r, c) => {
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      newBoard[r][c] = !newBoard[r][c];
    }
  };

  toggle(row, col);
  toggle(row - 1, col);
  toggle(row + 1, col);
  toggle(row, col - 1);
  toggle(row, col + 1);

  return newBoard;
}

export default function LightsOut() {
  const { profile } = useAuth();

  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameState, setGameState] = useState('start'); // 'start' | 'playing' | 'won'
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
  useEffect(() => {
    startGameRef.current = startGame;
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    setBoard(createRandomBoard());
    setMoves(0);
    setGameState('playing');
  }, []);

  const handleCellClick = (r, c) => {
    if (gameState !== 'playing') return;

    sfx.piece();
    const newBoard = toggleLights(board, r, c);
    setBoard(newBoard);
    const newMoves = moves + 1;
    setMoves(newMoves);

    const isWon = newBoard.every(row => row.every(cell => !cell));
    if (isWon) {
      sfx.win();
      setGameState('won');

      if (bestMoves === null || newMoves < bestMoves) {
        setBestMoves(newMoves);
        try {
          localStorage.setItem('axiom-lightsout-best', newMoves.toString());
        } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Lights Out', score: newMoves + ' moves' });
        updateArcadeBest(profile, 'lights-out', 'Lights Out', newMoves, newMoves + ' moves');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'start' || gameState === 'won') && e.key === 'Enter') {
        const tagName = e.target?.tagName;
        if (tagName === 'BUTTON' || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'A') {
          return;
        }
        e.preventDefault();
        if (startGameRef.current) startGameRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const getRatingMessage = (m) => {
    if (m <= 10) return "🧠 Mastermind!";
    if (m <= 15) return "💡 Brilliant!";
    if (m <= 25) return "👍 Great job!";
    return "🐢 Good effort!";
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
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Lights Out</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Turn off all the lights
        </p>
        <p className="font-mono text-sm tracking-widest uppercase opacity-80 mt-2 text-[var(--ink)]">
          Moves: {moves}
        </p>
        {bestMoves !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: {bestMoves} moves
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        {gameState === 'start' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8 text-center">
             <p className="mb-6 opacity-80 max-w-[250px]">
                Clicking a light toggles it and the four adjacent lights. Your goal is to turn them all off!
              </p>
             <button onClick={startGame} className="btn-primary w-full text-lg py-3 max-w-[200px]">
               Start Game (Enter)
             </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="grid grid-cols-5 gap-2 w-full max-w-[320px]">
            {board.map((row, r) =>
              row.map((isOn, c) => (
                <button
                  key={`${r}-${c}`}
                  onPointerDown={(e) => { e.preventDefault(); handleCellClick(r, c); }}
                  onClick={() => handleCellClick(r, c)}
                  className={`aspect-square rounded-md transition-colors duration-300 border hairline ${
                    isOn
                      ? 'bg-[var(--ochre)] shadow-[0_0_15px_var(--ochre)]'
                      : 'bg-[var(--bg-soft)] opacity-50'
                  }`}
                  aria-label={`Light ${r}-${c} ${isOn ? 'On' : 'Off'}`}
                />
              ))
            )}
          </div>
        )}

        {gameState === 'won' && (
           <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8 text-center fade-in">
             <div className="font-display text-3xl mb-2">You Win!</div>
             <div className="font-display text-5xl text-[var(--forest)] mb-4 pulse-soft">
               {moves} moves
             </div>
             <div className="font-display text-xl mb-8 opacity-90">{getRatingMessage(moves)}</div>
             <div className="flex gap-4 w-full justify-center">
               <button onClick={startGame} className="btn-primary flex-1 max-w-[150px]">
                 Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-secondary flex-1 max-w-[150px]">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
