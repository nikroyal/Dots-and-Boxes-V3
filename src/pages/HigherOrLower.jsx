import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting');
  const [currentNumber, setCurrentNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Will the next number be higher or lower?');
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higher-lower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const initGame = useCallback(() => {
    setCurrentNumber(Math.floor(Math.random() * 100) + 1);
    setScore(0);
    setGameState('playing');
    setMessage('Will the next number be higher or lower?');
  }, []);

  const handleGuess = (guess) => {
    if (gameState !== 'playing') return;

    let nextNumber = Math.floor(Math.random() * 100) + 1;
    while (nextNumber === currentNumber) {
      nextNumber = Math.floor(Math.random() * 100) + 1;
    }

    const isHigher = nextNumber > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (isCorrect) {
      sfx.piece();
      setScore(s => s + 1);
      setCurrentNumber(nextNumber);
    } else {
      sfx.loss();
      setGameState('result');
      setMessage(`Game Over! The number was ${nextNumber}.`);
      if (score > bestScore) {
        setBestScore(score);
        try {
          localStorage.setItem('axiom-higher-lower-best', score.toString());
        } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: score.toString() });
        updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', score, score.toString());
      }
    }
  };

  const handleGuessRef = useRef(handleGuess);
  const initGameRef = useRef(initGame);
  useEffect(() => {
    handleGuessRef.current = handleGuess;
    initGameRef.current = initGame;
  }, [handleGuess, initGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState === 'playing') {
        if (e.key === 'ArrowUp') handleGuessRef.current('higher');
        if (e.key === 'ArrowDown') handleGuessRef.current('lower');
      } else if (e.key === 'Enter') {
        initGameRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher Or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">Score: {score}</p>
        {bestScore > 0 && <p className="font-mono text-xs text-[var(--ochre)]">Best: {bestScore}</p>}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center">
        <div className="text-6xl font-mono mb-8">{gameState === 'playing' ? currentNumber : '?'}</div>
        <div className="mb-6 h-8 text-center">{message}</div>

        {gameState === 'playing' ? (
          <div className="flex gap-4">
            <button onClick={() => handleGuess('higher')} className="btn-primary">Higher (↑)</button>
            <button onClick={() => handleGuess('lower')} className="btn-secondary">Lower (↓)</button>
          </div>
        ) : (
          <button onClick={initGame} className="btn-primary">Play Again (Enter)</button>
        )}
      </div>
    </div>
  );
}
