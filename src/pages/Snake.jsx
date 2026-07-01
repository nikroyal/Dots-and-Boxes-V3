import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 2;
const MIN_SPEED = 50;

const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION = { x: 0, y: -1 }; // UP

export default function Snake() {
  const { profile } = useAuth();
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-snake-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const directionRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(score);
  const bestScoreRef = useRef(bestScore);
  const lastMoveDirectionRef = useRef(direction);
  const speedRef = useRef(INITIAL_SPEED);
  const frameRef = useRef(null);

  // Sync refs
  useEffect(() => {
    directionRef.current = direction;
    snakeRef.current = snake;
    foodRef.current = food;
    gameStateRef.current = gameState;
    scoreRef.current = score;
    bestScoreRef.current = bestScore;
  }, [direction, snake, food, gameState, score, bestScore]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, []);

  const generateFood = (currentSnake) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) break;
    }
    return newFood;
  };

  const startGame = useCallback(() => {
    sfx.click();
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    directionRef.current = INITIAL_DIRECTION;
    lastMoveDirectionRef.current = INITIAL_DIRECTION;
    setScore(0);
    speedRef.current = INITIAL_SPEED;
    setFood(generateFood(INITIAL_SNAKE));
    setGameState('playing');
  }, []);

  const startGameRef = useRef(startGame);
  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const gameOver = () => {
    sfx.loss();
    setGameState('gameover');
    if (scoreRef.current > bestScoreRef.current) {
      setBestScore(scoreRef.current);
      try {
        localStorage.setItem('axiom-snake-best', scoreRef.current.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Snake', score: scoreRef.current.toString() });
      updateArcadeBest(profile, 'snake', 'Snake', scoreRef.current, scoreRef.current.toString());
    }
  };

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const currentSnake = snakeRef.current;
    const currentDirection = directionRef.current;

    // Update last move direction so we don't reverse into ourselves
    lastMoveDirectionRef.current = currentDirection;

    const head = currentSnake[0];
    const newHead = {
      x: head.x + currentDirection.x,
      y: head.y + currentDirection.y,
    };

    // Check wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      gameOver();
      return;
    }

    // Check self collision
    if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      gameOver();
      return;
    }

    const currentFood = foodRef.current;
    let didEat = false;

    if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
      didEat = true;
      sfx.notify();
      setScore(s => s + 10);
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_INCREMENT);
    }

    const newSnake = [newHead, ...currentSnake];

    if (didEat) {
      setFood(generateFood(newSnake));
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);

    frameRef.current = setTimeout(gameLoop, speedRef.current);
  }, []); // no dependencies needed as we use refs!

  useEffect(() => {
    if (gameState === 'playing') {
      if (frameRef.current) clearTimeout(frameRef.current);
      frameRef.current = setTimeout(gameLoop, speedRef.current);
    }
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStateRef.current !== 'playing') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGameRef.current();
        }
        return;
      }

      const { x, y } = lastMoveDirectionRef.current;

      let handled = true;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (y !== 1) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (y !== -1) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (x !== 1) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (x !== -1) setDirection({ x: 1, y: 0 });
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const getGameOverMessage = (finalScore) => {
    if (finalScore === 0) return "Ouch. Fast game!";
    if (finalScore < 50) return "Good start!";
    if (finalScore < 100) return "Getting the hang of it!";
    return "Snake charmer!";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const msg = getGameOverMessage(score);
    const text = `I scored ${score} in Axiom Snake! 🐍 ${msg}`;
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

  const handleMobileControl = (dirX, dirY) => {
    if (gameState !== 'playing') return;
    const { x, y } = lastMoveDirectionRef.current;
    if (dirX !== 0 && x !== -dirX) setDirection({ x: dirX, y: 0 });
    if (dirY !== 0 && y !== -dirY) setDirection({ x: 0, y: dirY });
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-6">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Snake</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Best: {bestScore}</span>
        </p>
      </section>

      <div
        className="relative border hairline card bg-[var(--paper-tint)] overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '400px',
          aspectRatio: '1/1',
        }}
      >
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10">
            <button onClick={startGame} className="btn-primary mb-4">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over</p>
            <p className="font-mono text-sm opacity-80 mb-4">{getGameOverMessage(score)}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-secondary">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none p-2">
          <div
            className="w-full h-full relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
          >
            {/* Food */}
            <div
              className="bg-[var(--crimson)] rounded-full shadow-sm"
              style={{
                gridColumnStart: food.x + 1,
                gridRowStart: food.y + 1,
                transform: 'scale(0.8)',
              }}
            />
            {/* Snake */}
            {snake.map((segment, index) => {
              const isHead = index === 0;
              return (
                <div
                  key={`${segment.x}-${segment.y}-${index}`}
                  className="bg-[var(--forest)]"
                  style={{
                    gridColumnStart: segment.x + 1,
                    gridRowStart: segment.y + 1,
                    borderRadius: isHead ? '4px' : '2px',
                    opacity: isHead ? 1 : 0.85,
                    transform: 'scale(0.95)',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 sm:hidden w-full max-w-[200px]">
        <div />
        <button
          className="btn-secondary h-12 flex items-center justify-center text-xl"
          onPointerDown={(e) => { e.preventDefault(); handleMobileControl(0, -1); }}
          aria-label="Move Up"
        >
          ↑
        </button>
        <div />
        <button
          className="btn-secondary h-12 flex items-center justify-center text-xl"
          onPointerDown={(e) => { e.preventDefault(); handleMobileControl(-1, 0); }}
          aria-label="Move Left"
        >
          ←
        </button>
        <button
          className="btn-secondary h-12 flex items-center justify-center text-xl"
          onPointerDown={(e) => { e.preventDefault(); handleMobileControl(0, 1); }}
          aria-label="Move Down"
        >
          ↓
        </button>
        <button
          className="btn-secondary h-12 flex items-center justify-center text-xl"
          onPointerDown={(e) => { e.preventDefault(); handleMobileControl(1, 0); }}
          aria-label="Move Right"
        >
          →
        </button>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block">
        Use WASD or Arrow Keys to move
      </p>
    </div>
  );
}
