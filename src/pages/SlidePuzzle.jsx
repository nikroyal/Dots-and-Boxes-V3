import { useState, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GRID_SIZE = 4;
const NUM_TILES = GRID_SIZE * GRID_SIZE;

export default function SlidePuzzle() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'gameover'
  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-slidepuzzle-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });
  const [copied, setCopied] = useState(false);

  const getSolvedBoard = () => {
    const newBoard = Array.from({ length: NUM_TILES - 1 }, (_, i) => i + 1);
    newBoard.push(0); // 0 represents the empty space
    return newBoard;
  };

  const isSolved = (currentBoard) => {
    for (let i = 0; i < NUM_TILES - 1; i++) {
      if (currentBoard[i] !== i + 1) return false;
    }
    return currentBoard[NUM_TILES - 1] === 0;
  };

  const getValidMoves = (emptyIndex) => {
    const validMoves = [];
    const row = Math.floor(emptyIndex / GRID_SIZE);
    const col = emptyIndex % GRID_SIZE;

    if (row > 0) validMoves.push(emptyIndex - GRID_SIZE); // Up
    if (row < GRID_SIZE - 1) validMoves.push(emptyIndex + GRID_SIZE); // Down
    if (col > 0) validMoves.push(emptyIndex - 1); // Left
    if (col < GRID_SIZE - 1) validMoves.push(emptyIndex + 1); // Right

    return validMoves;
  };

  const shuffleBoard = () => {
    let currentBoard = getSolvedBoard();
    let emptyIndex = NUM_TILES - 1;
    let previousIndex = -1;

    for (let i = 0; i < 200; i++) {
      const validMoves = getValidMoves(emptyIndex);
      let possibleMoves = validMoves.filter(move => move !== previousIndex);
      if (possibleMoves.length === 0) possibleMoves = validMoves;

      const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

      currentBoard[emptyIndex] = currentBoard[randomMove];
      currentBoard[randomMove] = 0;

      previousIndex = emptyIndex;
      emptyIndex = randomMove;
    }
    return currentBoard;
  };

  const startGame = useCallback(() => {
    sfx.click();
    setBoard(shuffleBoard());
    setMoves(0);
    setGameState('playing');
  }, []); // dependencies left empty as shuffleBoard and other helpers don't depend on state

  const handleTileClick = (index) => {
    if (gameState !== 'playing') return;

    const emptyIndex = board.indexOf(0);
    const validMoves = getValidMoves(emptyIndex);

    if (validMoves.includes(index)) {
      sfx.piece();
      const newBoard = [...board];
      newBoard[emptyIndex] = newBoard[index];
      newBoard[index] = 0;
      setBoard(newBoard);
      setMoves(m => m + 1);

      if (isSolved(newBoard)) {
        endGame(moves + 1);
      }
    }
  };

  const endGame = (finalMoves) => {
    sfx.win();
    setGameState('gameover');

    if (bestScore === null || finalMoves < bestScore) {
      setBestScore(finalMoves);
      try {
        localStorage.setItem('axiom-slidepuzzle-best', finalMoves.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Slide Puzzle', score: finalMoves });
      updateArcadeBest(profile, 'slide-puzzle', 'Slide Puzzle', finalMoves, `${finalMoves} moves`);
    }
  };

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
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Slide Puzzle</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Moves: {moves}
        </p>
        {bestScore !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best: {bestScore} moves
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-4 sm:p-8 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary mb-2">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--forest)]">Solved!</p>
            <p className="font-mono text-lg mb-6">Total Moves: {moves}</p>

            <div className="flex gap-4 mb-2">
              <button onClick={startGame} className="btn-primary">
                Play Again
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div
          className="grid gap-2 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        >
          {board.length > 0 ? board.map((tile, index) => (
            <button
              key={index}
              onClick={() => handleTileClick(index)}
              disabled={gameState !== 'playing' || tile === 0}
              className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl font-display font-medium rounded-sm transition-all duration-200 ${
                tile === 0
                  ? 'bg-transparent opacity-0 cursor-default'
                  : 'bg-[var(--surface)] border hairline hover:bg-[var(--bg-soft)] shadow-sm text-[var(--ink)]'
              }`}
            >
              {tile !== 0 ? tile : ''}
            </button>
          )) : (
            Array.from({ length: NUM_TILES }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl font-display font-medium rounded-sm bg-[var(--surface)] border hairline text-[var(--ink)] ${i === NUM_TILES - 1 ? 'opacity-0' : 'opacity-50'}`}
              >
                {i !== NUM_TILES - 1 ? i + 1 : ''}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 text-center max-w-xs">
        Arrange the numbers in order from 1 to 15.
      </p>
    </div>
  );
}
