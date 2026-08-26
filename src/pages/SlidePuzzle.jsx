import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function SlidePuzzle() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [tiles, setTiles] = useState([]); // 0 is empty
  const [moves, setMoves] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-slide-puzzle-best');
      return saved ? parseInt(saved, 10) : Infinity;
    } catch {
      return Infinity;
    }
  });

  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = startGame;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'waiting' || gameState === 'result') && e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const generateSolvableBoard = () => {
    // A standard 4x4 goal state
    let board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    let emptyIdx = 15;

    // Simulate reverse moves to ensure it's always solvable.
    // 100 random moves is enough to shuffle well.
    const getValidNeighbors = (idx) => {
      const n = [];
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      if (row > 0) n.push(idx - 4); // up
      if (row < 3) n.push(idx + 4); // down
      if (col > 0) n.push(idx - 1); // left
      if (col < 3) n.push(idx + 1); // right
      return n;
    };

    let prevIdx = -1;
    for (let i = 0; i < 150; i++) {
      const neighbors = getValidNeighbors(emptyIdx).filter(n => n !== prevIdx);
      const nextEmptyIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      board[emptyIdx] = board[nextEmptyIdx];
      board[nextEmptyIdx] = 0;
      prevIdx = emptyIdx;
      emptyIdx = nextEmptyIdx;
    }

    return board;
  };

  const startGame = () => {
    sfx.click();
    setTiles(generateSolvableBoard());
    setMoves(0);
    setGameState('playing');
  };

  const isSolved = (currentTiles) => {
    for (let i = 0; i < 15; i++) {
      if (currentTiles[i] !== i + 1) return false;
    }
    return currentTiles[15] === 0;
  };

  const handleTileClick = (index) => {
    if (gameState !== 'playing') return;
    const emptyIndex = tiles.indexOf(0);

    // Check if adjacent
    const row = Math.floor(index / 4);
    const col = index % 4;
    const emptyRow = Math.floor(emptyIndex / 4);
    const emptyCol = emptyIndex % 4;

    const isAdjacent = Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;

    if (isAdjacent) {
      sfx.piece();
      const newTiles = [...tiles];
      newTiles[emptyIndex] = newTiles[index];
      newTiles[index] = 0;
      setTiles(newTiles);
      setMoves(m => m + 1);

      if (isSolved(newTiles)) {
        setGameState('result');
      }
    }
  };

  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (gameState === 'playing') {
      hasRecordedRef.current = false;
    } else if (gameState === 'result' && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      let isNewBest = false;
      if (moves < bestScore) {
        setBestScore(moves);
        isNewBest = true;
        try {
          localStorage.setItem('axiom-slide-puzzle-best', moves.toString());
        } catch {}
      }

      if (isNewBest) {
        sfx.achievement();
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Slide Puzzle', score: moves + ' moves' });
        updateArcadeBest(profile, 'slide-puzzle', 'Slide Puzzle', moves, moves + ' moves');
      } else {
        sfx.notify();
      }
    }
  }, [gameState, moves, bestScore, profile]);

  const [copied, setCopied] = useState(false);
  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I solved the Axiom Slide Puzzle in ${moves} moves!`;
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
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Slide Puzzle</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Moves: {moves}
        </p>
        {bestScore !== Infinity && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore} moves
          </p>
        )}
      </section>

      <div
        className="w-full max-w-md border hairline card bg-[var(--paper-tint)] relative flex flex-col items-center justify-center min-h-[400px] overflow-hidden p-4"
      >
        {gameState === 'playing' && (
          <div className="grid grid-cols-4 gap-2 w-full max-w-[350px] aspect-square">
            {tiles.map((num, i) => (
              <button
                key={i}
                onPointerDown={(e) => { e.preventDefault(); handleTileClick(i); }}
                className={`relative flex items-center justify-center text-3xl font-display transition-all duration-200 select-none ${
                  num === 0
                    ? 'bg-transparent'
                    : 'bg-white shadow-sm border hairline hover:bg-gray-50 active:scale-95'
                }`}
                style={{
                  color: 'var(--ink)'
                }}
                disabled={num === 0}
                aria-label={num === 0 ? "Empty tile" : `Tile ${num}`}
              >
                {num !== 0 && num}
              </button>
            ))}
          </div>
        )}

        {gameState === 'waiting' && (
          <div className="flex flex-col items-center justify-center text-center px-4 w-full h-full">
            <p className="mb-6 font-display text-xl opacity-80">
              Slide the tiles to put them in order from 1 to 15!<br/>
              <span className="text-sm opacity-60 mt-2 block font-mono tracking-widest uppercase">Fewest moves wins</span>
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="flex flex-col items-center justify-center text-center px-4 w-full h-full fade-in absolute inset-0 bg-[var(--paper-tint)] z-10">
             <div className="font-display text-4xl mb-2">Solved!</div>
             <div className="font-display text-2xl mb-6 opacity-80 text-[var(--forest)]">Took {moves} moves</div>
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
