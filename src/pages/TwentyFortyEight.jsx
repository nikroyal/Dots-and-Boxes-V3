import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const BOARD_SIZE = 4;

const emptyBoard = () => Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));

const spawnTile = (board) => {
  let emptyCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) emptyCells.push({ r, c });
    }
  }
  if (emptyCells.length === 0) return { board, spawned: false };
  const idx = Math.floor(Math.random() * emptyCells.length);
  const cell = emptyCells[idx];
  const newBoard = board.map(row => [...row]);
  newBoard[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
  return { board: newBoard, spawned: true };
};

const hasMoves = (board) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c < BOARD_SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < BOARD_SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
};

const rotateRight = (board) => {
  let newBoard = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      newBoard[c][BOARD_SIZE - 1 - r] = board[r][c];
    }
  }
  return newBoard;
};

const rotateLeft = (board) => {
  let newBoard = emptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      newBoard[BOARD_SIZE - 1 - c][r] = board[r][c];
    }
  }
  return newBoard;
};

const moveLeft = (board) => {
  let newBoard = [];
  let scoreDiff = 0;
  let moved = false;

  for (let i = 0; i < BOARD_SIZE; i++) {
    let row = board[i].filter(x => x !== 0);
    for (let j = 0; j < row.length - 1; j++) {
      if (row[j] !== 0 && row[j] === row[j + 1]) {
        row[j] *= 2;
        scoreDiff += row[j];
        row.splice(j + 1, 1);
      }
    }
    while (row.length < BOARD_SIZE) row.push(0);

    // Check if row changed
    if (!moved) {
      for(let j=0; j<BOARD_SIZE; j++) {
        if (row[j] !== board[i][j]) {
          moved = true;
          break;
        }
      }
    }
    newBoard.push(row);
  }
  return { newBoard, scoreDiff, moved };
};

const moveBoard = (board, dir) => {
  // 0: left, 1: up, 2: right, 3: down
  let b = board;
  for (let i = 0; i < dir; i++) b = rotateLeft(b);
  let { newBoard, scoreDiff, moved } = moveLeft(b);
  for (let i = 0; i < dir; i++) newBoard = rotateRight(newBoard);
  return { newBoard, scoreDiff, moved };
};

const getTileColor = (val) => {
  if (val === 0) return 'var(--surface-hover)';
  const colors = {
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
    2048: '#edc22e'
  };
  return colors[val] || '#3c3a32';
};

const getTileTextColor = (val) => {
  if (val <= 4) return '#776e65';
  return '#f9f6f2';
};

export default function TwentyFortyEight() {
  const { profile } = useAuth();
  const [board, setBoard] = useState(emptyBoard);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, gameover
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-2048-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Touch tracking for mobile swipe
  const touchStartRef = useRef({ x: null, y: null });

  const initGame = useCallback(() => {
    let b = emptyBoard();
    b = spawnTile(b).board;
    b = spawnTile(b).board;
    setBoard(b);
    setScore(0);
    setGameState('playing');
  }, []);

  const handleGameEnd = useCallback((finalScore) => {
    setGameState('gameover');
    sfx.loss();
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try { localStorage.setItem('axiom-2048-best', finalScore.toString()); } catch {}
    }
    if (profile) {
      recordActivity(profile.id, ACTIVITY_TYPES.ARCADE_PLAY, {
        gameId: 'twenty-forty-eight',
        gameName: '2048',
        score: finalScore,
      });
      updateArcadeBest(profile, 'twenty-forty-eight', '2048', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  const doMove = useCallback((dir) => {
    if (gameState !== 'playing') return;

    const { newBoard, scoreDiff, moved } = moveBoard(board, dir);
    if (moved) {
      const { board: spawnedBoard, spawned } = spawnTile(newBoard);
      setBoard(spawnedBoard);
      const newScore = score + scoreDiff;
      setScore(newScore);
      if (scoreDiff > 0) {
        if (scoreDiff >= 128) sfx.achievement();
        else sfx.piece();
      } else {
        sfx.line();
      }

      if (!hasMoves(spawnedBoard)) {
        handleGameEnd(newScore);
      }
    }
  }, [board, gameState, score, handleGameEnd]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default scrolling for arrow keys if playing
      if (gameState === 'playing' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowLeft': doMove(0); break;
        case 'ArrowUp': doMove(1); break;
        case 'ArrowRight': doMove(2); break;
        case 'ArrowDown': doMove(3); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doMove, gameState]);

  // Touch handlers
  const handleTouchStart = (e) => {
    if (gameState !== 'playing') return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e) => {
    if (gameState !== 'playing' || !touchStartRef.current.x) return;

    const xEnd = e.changedTouches[0].clientX;
    const yEnd = e.changedTouches[0].clientY;

    const dx = xEnd - touchStartRef.current.x;
    const dy = yEnd - touchStartRef.current.y;

    // Require a minimum swipe distance
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) doMove(2); // right
        else doMove(0); // left
      } else {
        if (dy > 0) doMove(3); // down
        else doMove(1); // up
      }
    }

    touchStartRef.current = { x: null, y: null };
  };

  return (
    <div className="fade-in max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">2048</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: <span className="text-[var(--ink)] font-bold">{score}</span> | Best: <span className="text-[var(--ink)] font-bold">{bestScore}</span>
        </p>
      </section>

      <div
        className="card p-4 sm:p-6 relative rounded-xl"
        style={{
          backgroundColor: '#bbada0',
          width: 'min(90vw, 400px)',
          height: 'min(90vw, 400px)',
          touchAction: 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid gap-2 w-full h-full"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
        >
          {gameState === 'waiting' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl" style={{ backgroundColor: 'rgba(238, 228, 218, 0.73)' }}>
              <button className="btn-primary" onPointerDown={(e) => { e.preventDefault(); initGame(); }}>
                Start Game
              </button>
            </div>
          ) : gameState === 'gameover' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4 rounded-xl" style={{ backgroundColor: 'rgba(238, 228, 218, 0.73)' }}>
              <h2 className="text-4xl font-display" style={{ color: '#776e65' }}>Game Over!</h2>
              <button className="btn-primary" onPointerDown={(e) => { e.preventDefault(); initGame(); }}>
                Try Again
              </button>
            </div>
          ) : null}

          {board.map((row, r) => (
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className="flex items-center justify-center rounded-sm transition-all duration-150"
                style={{
                  backgroundColor: getTileColor(val),
                  color: getTileTextColor(val),
                  fontSize: val > 1000 ? '1.5rem' : val > 100 ? '2rem' : '2.5rem',
                  fontWeight: 'bold'
                }}
              >
                {val !== 0 ? val : ''}
              </div>
            ))
          ))}
        </div>
      </div>

      <div className="max-w-lg mt-8 text-center text-sm opacity-60">
        <p><strong>How to play:</strong> Use your <strong>arrow keys</strong> or <strong>swipe</strong> to move the tiles. Tiles with the same number merge into one when they touch. Add them up to reach <strong>2048!</strong></p>
      </div>
    </div>
  );
}
