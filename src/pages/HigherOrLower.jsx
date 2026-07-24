import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(50);
  const [previousNumber, setPreviousNumber] = useState(null);
  const [bestScore, setBestScore] = useState(() => {
    try { return parseInt(localStorage.getItem('axiom-higherorlower-best') || '0', 10); } catch { return 0; }
  });

  const startGameRef = useRef(null);
  useEffect(() => { startGameRef.current = startGame; }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'gameover')) {
        e.preventDefault();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const startGame = () => {
    sfx.click();
    setScore(0);
    setCurrentNumber(Math.floor(Math.random() * 100) + 1);
    setPreviousNumber(null);
    setGameState('playing');
  };

  const handleGuess = (guess) => {
    if (gameState !== 'playing') return;
    let nextNum = Math.floor(Math.random() * 100) + 1;
    while (nextNum === currentNumber) {
      nextNum = Math.floor(Math.random() * 100) + 1;
    }

    const isHigher = nextNum > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    setPreviousNumber(currentNumber);
    setCurrentNumber(nextNum);

    if (isCorrect) {
      sfx.piece();
      setScore(s => s + 1);
    } else {
      endGame(score);
    }
  };

  const endGame = (finalScore) => {
    sfx.win();
    setGameState('gameover');
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try { localStorage.setItem('axiom-higherorlower-best', finalScore.toString()); } catch {}
      if (profile) {
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: finalScore });
        updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', finalScore, finalScore.toString());
      }
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary mb-2">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over!</p>
            <p className="font-mono text-lg mb-1">Final Score: {score}</p>
            <button onClick={startGame} className="btn-primary mt-4">
              Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-6xl font-display font-bold text-[var(--ink)]">
            {gameState === 'playing' ? currentNumber : (gameState === 'gameover' ? currentNumber : '?')}
          </div>
          {gameState === 'gameover' && previousNumber && (
            <p className="font-mono text-sm opacity-60">
              Previous was {previousNumber}
            </p>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => handleGuess('higher')}
              disabled={gameState !== 'playing'}
              className="btn-primary text-xl px-6 py-3"
            >
              Higher ↑
            </button>
            <button
              onClick={() => handleGuess('lower')}
              disabled={gameState !== 'playing'}
              className="btn-primary text-xl px-6 py-3 bg-[var(--crimson)] border-[var(--crimson)]"
            >
              Lower ↓
            </button>
          </div>
        </div>
      </div>
      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Will the next number (1-100) be higher or lower? Guess correctly to keep your streak alive!
      </p>
    </div>
  );
}
