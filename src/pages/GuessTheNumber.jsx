import { useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';
import Confetti from '../components/Confetti';

export default function GuessTheNumber() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'won'
  const [gameState, setGameState] = useState('waiting');
  const [targetNumber, setTargetNumber] = useState(null);
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState('Guess a number between 1 and 100');
  const [bestAttempts, setBestAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-guess-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const inputRef = useRef(null);

  const startGame = () => {
    sfx.click();
    setTargetNumber(Math.floor(Math.random() * 100) + 1);
    setGameState('playing');
    setAttempts(0);
    setGuess('');
    setMessage('Guess a number between 1 and 100');
    // Focus input after state update
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 10);
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;

    const numGuess = parseInt(guess, 10);

    if (isNaN(numGuess)) {
      sfx.click();
      setMessage('Please enter a valid number');
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setGuess(''); // clear input

    if (numGuess === targetNumber) {
      sfx.win();
      setGameState('won');
      setMessage(`Correct! You got it in ${newAttempts} attempts.`);

      if (bestAttempts === null || newAttempts < bestAttempts) {
        setBestAttempts(newAttempts);
        try {
          localStorage.setItem('axiom-guess-best', newAttempts.toString());
        } catch {}
        if (profile) {
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Guess the Number', score: newAttempts.toString() + ' attempts' });
          updateArcadeBest(profile, 'guess-the-number', 'Guess the Number', newAttempts, newAttempts.toString() + ' attempts');
        }
      }
    } else if (numGuess < targetNumber) {
      sfx.piece();
      setMessage(`Too low! Try again.`);
    } else {
      sfx.piece();
      setMessage(`Too high! Try again.`);
    }

    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      {gameState === 'won' && <Confetti />}

      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Guess the Number</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Attempts: {attempts}
        </p>
        {bestAttempts !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: {bestAttempts} attempts
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md flex flex-col items-center">

        <div className="font-display text-2xl mb-8 text-center min-h-[4rem] flex items-center justify-center">
           {message}
        </div>

        {gameState === 'waiting' && (
          <button onClick={startGame} className="btn-primary">
            Start Game
          </button>
        )}

        {gameState === 'playing' && (
          <form onSubmit={handleGuess} className="w-full flex flex-col items-center gap-4">
            <input
              ref={inputRef}
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              className="input-field text-center text-4xl w-32"
              placeholder="0"
              autoFocus
              min="1"
              max="100"
            />
            <button type="submit" className="btn-primary mt-4">
              Guess
            </button>
          </form>
        )}

        {gameState === 'won' && (
          <div className="flex flex-col items-center fade-in">
             <div className="text-6xl mb-6 text-[var(--forest)] font-display">
                {targetNumber}
             </div>
             <button onClick={startGame} className="btn-primary mt-2">
                Play Again
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
