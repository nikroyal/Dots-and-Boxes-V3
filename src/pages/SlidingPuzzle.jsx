import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

function isSolved(tiles) {
  return tiles.every((t, i) => t === (i + 1) % 16);
}

function createShuffledTiles() {
  let tiles = Array.from({ length: 16 }, (_, i) => (i + 1) % 16);
  let emptyIdx = 15;

  let moves = 0;
  let lastMove = -1;
  while (moves < 500 || isSolved(tiles)) {
    const validMoves = [];
    const row = Math.floor(emptyIdx / 4);
    const col = emptyIdx % 4;

    if (row > 0 && emptyIdx - 4 !== lastMove) validMoves.push(emptyIdx - 4);
    if (row < 3 && emptyIdx + 4 !== lastMove) validMoves.push(emptyIdx + 4);
    if (col > 0 && emptyIdx - 1 !== lastMove) validMoves.push(emptyIdx - 1);
    if (col < 3 && emptyIdx + 1 !== lastMove) validMoves.push(emptyIdx + 1);

    if (validMoves.length === 0) {
       if (row > 0) validMoves.push(emptyIdx - 4);
       if (row < 3) validMoves.push(emptyIdx + 4);
       if (col > 0) validMoves.push(emptyIdx - 1);
       if (col < 3) validMoves.push(emptyIdx + 1);
    }

    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    tiles[emptyIdx] = tiles[move];
    tiles[move] = 0;
    lastMove = emptyIdx;
    emptyIdx = move;
    moves++;
  }
  return tiles;
}

export default function SlidingPuzzle() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('start');
  const [tiles, setTiles] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-sliding-puzzle-best');
      return saved ? parseInt(saved) : null;
    } catch {
      return null;
    }
  });

  const startGame = useCallback(() => {
    sfx.click();
    setTiles(createShuffledTiles());
    setMoves(0);
    setGameState('playing');
  }, []);

  const handleTileClick = (index) => {
    if (gameState !== 'playing' || tiles[index] === 0) return;

    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const emptyRow = Math.floor(emptyIdx / 4);
    const emptyCol = emptyIdx % 4;

    const isAdjacent = Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;

    if (isAdjacent) {
      sfx.click();
      const newTiles = [...tiles];
      newTiles[emptyIdx] = tiles[index];
      newTiles[index] = 0;
      setTiles(newTiles);
      setMoves(m => m + 1);

      if (isSolved(newTiles)) {
         setGameState('gameover');
         sfx.win();
         const finalMoves = moves + 1;

         if (bestMoves === null || finalMoves < bestMoves) {
           setBestMoves(finalMoves);
           try {
             localStorage.setItem('axiom-sliding-puzzle-best', finalMoves.toString());
           } catch {}
           recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Sliding Puzzle', score: finalMoves + ' moves' });
           updateArcadeBest(profile, 'sliding-puzzle', 'Sliding Puzzle', finalMoves, finalMoves + ' moves', true);
         }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing') {
         const emptyIdx = tiles.indexOf(0);
         const row = Math.floor(emptyIdx / 4);
         const col = emptyIdx % 4;
         let targetIdx = -1;

         if (e.key === 'ArrowUp' && row < 3) targetIdx = emptyIdx + 4;
         else if (e.key === 'ArrowDown' && row > 0) targetIdx = emptyIdx - 4;
         else if (e.key === 'ArrowLeft' && col < 3) targetIdx = emptyIdx + 1;
         else if (e.key === 'ArrowRight' && col > 0) targetIdx = emptyIdx - 1;

         if (targetIdx !== -1) {
             e.preventDefault();
             handleTileClick(targetIdx);
         }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame, tiles, handleTileClick]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Sliding Puzzle</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Rearrange the tiles into numerical order.
        </p>
        {bestMoves !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: {bestMoves} moves
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        <div className="flex justify-between w-full mb-6 font-mono text-xl tracking-widest px-2">
           <div>Moves: {moves}</div>
        </div>

        {gameState === 'start' ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8">
             <button onClick={startGame} className="btn-primary w-full text-lg py-3 max-w-[200px]">
               Start Game (Enter)
             </button>
          </div>
        ) : gameState === 'gameover' ? (
           <div className="flex flex-col items-center justify-center min-h-[300px] w-full mt-8 mb-8 text-center fade-in">
             <div className="font-display text-3xl mb-2">Solved!</div>
             <div className="font-display text-5xl text-[var(--forest)] mb-6 pulse-soft">
               {moves} moves
             </div>
             <button onClick={startGame} className="btn-primary w-full text-lg py-3 max-w-[200px]">
               Play Again (Enter)
             </button>
           </div>
        ) : (
          <div className="w-full max-w-[320px] aspect-square grid grid-cols-4 gap-1 p-1 bg-[var(--ink)]">
            {tiles.map((num, i) => {
              const isEmpty = num === 0;
              return (
                <button
                  key={i}
                  onClick={() => handleTileClick(i)}
                  disabled={isEmpty}
                  className={`relative flex items-center justify-center font-display text-3xl transition-all duration-200 ${isEmpty ? 'bg-[var(--ink)] cursor-default' : 'bg-[var(--paper-tint)] text-[var(--ink)] hover:bg-[var(--paper)] cursor-pointer'}`}
                >
                  {!isEmpty && num}
                </button>
              );
            })}
          </div>
        )}

        {gameState === 'playing' && (
           <p className="font-mono text-[10px] tracking-widest uppercase opacity-40 mt-8">
             Use arrow keys or click to move tiles.
           </p>
        )}
      </div>
    </div>
  );
}
