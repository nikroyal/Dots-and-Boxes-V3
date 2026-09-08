import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';
import Confetti from '../components/Confetti';

const GRID_SIZE = 4;
const TILE_COUNT = GRID_SIZE * GRID_SIZE;

const getSolvedState = () => {
  return [...Array(TILE_COUNT - 1).keys()].map(x => x + 1).concat([0]);
};

const getNeighbors = (idx) => {
  const neighbors = [];
  const row = Math.floor(idx / GRID_SIZE);
  const col = idx % GRID_SIZE;
  if (row > 0) neighbors.push(idx - GRID_SIZE); // up
  if (row < GRID_SIZE - 1) neighbors.push(idx + GRID_SIZE); // down
  if (col > 0) neighbors.push(idx - 1); // left
  if (col < GRID_SIZE - 1) neighbors.push(idx + 1); // right
  return neighbors;
};

const shuffleBoard = () => {
  let curr = getSolvedState();
  let emptyIdx = TILE_COUNT - 1;
  let lastEmpty = -1;
  for (let i = 0; i < 200; i++) {
    const neighbors = getNeighbors(emptyIdx).filter(n => n !== lastEmpty);
    const nextIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
    curr[emptyIdx] = curr[nextIdx];
    curr[nextIdx] = 0;
    lastEmpty = emptyIdx;
    emptyIdx = nextIdx;
  }
  return curr;
};

export default function SlidingPuzzle() {
  const { profile } = useAuth();

  const [board, setBoard] = useState(getSolvedState());
  const [gameState, setGameState] = useState('start');
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);

  const [bestMoves, setBestMoves] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-sliding-puzzle-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const startGame = useCallback(() => {
    sfx.click();
    if (timerRef.current) clearInterval(timerRef.current);

    setBoard(shuffleBoard());
    setMoves(0);
    setTime(0);
    setGameState('playing');

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    return stopTimer;
  }, [stopTimer]);

  const handleTileClick = (idx) => {
    if (gameState !== 'playing') return;

    const emptyIdx = board.indexOf(0);
    const neighbors = getNeighbors(emptyIdx);

    if (neighbors.includes(idx)) {
      sfx.click();
      const newBoard = [...board];
      newBoard[emptyIdx] = newBoard[idx];
      newBoard[idx] = 0;
      setBoard(newBoard);

      const newMoves = moves + 1;
      setMoves(newMoves);

      if (newBoard.join(',') === getSolvedState().join(',')) {
        stopTimer();
        setGameState('won');
        sfx.win();

        if (!bestMoves || newMoves < bestMoves) {
          setBestMoves(newMoves);
          try {
            localStorage.setItem('axiom-sliding-puzzle-best', newMoves.toString());
          } catch {}

          if (profile?.id) {
            updateArcadeBest(profile.id, 'sliding-puzzle', newMoves).catch(console.error);
          }
        }

        if (profile?.id) {
          recordActivity(profile.id, ACTIVITY_TYPES.ARCADE_PLAY, {
            gameId: 'sliding-puzzle',
            gameName: 'Sliding Puzzle',
            score: newMoves,
            details: `Solved in ${newMoves} moves (${time}s)`
          }).catch(console.error);
        }
      }
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto">
      {gameState === 'won' && <Confetti />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl mb-2">Sliding Puzzle</h1>
          <p className="text-sm opacity-60">Order tiles 1 to 15.</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl">{moves} moves</div>
          <div className="text-sm opacity-60">Best: {bestMoves ? bestMoves : '-'}</div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="font-mono text-xl opacity-80 flex items-center gap-2">
          {formatTime(time)}
        </div>

        {gameState !== 'playing' ? (
          <button onClick={startGame} className="btn-primary animate-fade-in">
            {gameState === 'start' ? 'Start Game' : 'Play Again'}
          </button>
        ) : (
          <button onClick={startGame} className="btn-ghost text-sm">
            Restart
          </button>
        )}
      </div>

      <div
        className="bg-surface border border-white/10 rounded-xl p-2 grid gap-2 mb-8 relative"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          aspectRatio: '1 / 1'
        }}
      >
        {gameState === 'start' && (
          <div className="absolute inset-0 z-10 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <button onClick={startGame} className="btn-primary">
              Play Now
            </button>
          </div>
        )}

        {board.map((tile, idx) => {
          const isEmpty = tile === 0;
          return (
            <button
              key={idx}
              onClick={() => handleTileClick(idx)}
              disabled={gameState !== 'playing' || isEmpty}
              className={`
                relative flex items-center justify-center rounded-lg font-display text-2xl transition-all duration-200
                ${isEmpty ? 'bg-black/20' : 'bg-white/10 hover:bg-white/20 hover:scale-[1.02] active:scale-95 shadow-sm border border-white/5'}
              `}
            >
              {!isEmpty && tile}
            </button>
          );
        })}
      </div>

      <div className="bg-surface border border-white/10 rounded-xl p-6 text-sm opacity-80">
        <h3 className="font-bold mb-2">How to play</h3>
        <ul className="list-disc pl-4 space-y-1">
          <li>Click a tile next to the empty space to slide it.</li>
          <li>Arrange the numbers in order from 1 to 15.</li>
          <li>The empty space should end up in the bottom right corner.</li>
          <li>Solve the puzzle in the fewest moves possible!</li>
        </ul>
      </div>
    </div>
  );
}
