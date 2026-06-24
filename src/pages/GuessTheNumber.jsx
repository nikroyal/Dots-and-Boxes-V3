import { useState, useEffect, useRef } from 'react';
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
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('Guess a number between 1 and 100');
  const [isNewBest, setIsNewBest] = useState(false);
  const [copied, setCopied] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-guess-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const inputRef = useRef(null);

  // Focus input when playing starts
  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState]);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setTargetNumber(Math.floor(Math.random() * 100) + 1);
    setGuesses([]);
    setCurrentGuess('');
    setMessage('Guess a number between 1 and 100');
    setIsNewBest(false);
  };

  const handleGuess = (e) => {
    e.preventDefault();

    if (gameState !== 'playing') return;

    const guessInt = parseInt(currentGuess, 10);

    if (isNaN(guessInt) || guessInt < 1 || guessInt > 100) {
      setMessage('Please enter a valid number between 1 and 100.');
      sfx.loss(); // Or perhaps just a click/notify, but loss indicates invalid
      return;
    }

    if (guesses.includes(guessInt)) {
      setMessage(`You already guessed ${guessInt}.`);
      sfx.click();
      return;
    }

    const newGuesses = [...guesses, guessInt];
    setGuesses(newGuesses);
    setCurrentGuess('');

    if (guessInt === targetNumber) {
      // Won
      sfx.win();
      setGameState('won');
      setMessage(`Correct! The number was ${targetNumber}.`);

      const score = newGuesses.length;
      if (bestScore === null || score < bestScore) {
        setBestScore(score);
        setIsNewBest(true);
        try {
          localStorage.setItem('axiom-guess-best', score.toString());
        } catch {}
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Guess the Number', score: score + ' guesses' });
        updateArcadeBest(profile, 'guess-the-number', 'Guess the Number', score, score + ' guesses');
      }
    } else if (guessInt < targetNumber) {
      sfx.notify();
      setMessage(`${guessInt} is too low!`);
    } else {
      sfx.notify();
      setMessage(`${guessInt} is too high!`);
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getRating = (score) => {
    if (score <= 5) return "Mind Reader! 🔮";
    if (score <= 7) return "Excellent! 🎯";
    if (score <= 10) return "Good job! 👍";
    return "Keep practicing! 🐢";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(guesses.length);
    const text = `I guessed the number in ${guesses.length} tries on Axiom! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.warn("Clipboard copy failed", err);
      });
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      {gameState === 'won' && <Confetti />}

      <section className="text-center mb-10">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Guess the Number</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Find the hidden number
        </p>
        {bestScore !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-4 text-[var(--ochre)]">
            Best Score: {bestScore} guesses
          </p>
        )}
      </section>

      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="w-full card border hairline p-8 flex flex-col items-center" style={{ background: 'var(--paper-tint)' }}>
          <div className="font-display text-2xl text-center mb-6 h-16 flex items-center justify-center">
            {message}
          </div>

          {gameState === 'waiting' && (
            <button onClick={startGame} className="btn-primary w-full text-lg py-4">
              Start Game
            </button>
          )}

          {gameState === 'playing' && (
            <form onSubmit={handleGuess} className="w-full flex flex-col items-center gap-4">
              <input
                ref={inputRef}
                type="number"
                min="1"
                max="100"
                value={currentGuess}
                onChange={(e) => setCurrentGuess(e.target.value)}
                className="input-field text-center text-2xl py-4"
                placeholder="Enter 1-100"
                autoFocus
              />
              <button type="submit" className="btn-primary w-full text-lg">
                Guess
              </button>

              <div className="mt-4 font-mono text-xs opacity-60 uppercase tracking-widest">
                Guesses: {guesses.length}
              </div>

              {guesses.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {guesses.map((g, i) => (
                    <span key={i} className="px-2 py-1 bg-[var(--bg-soft)] border hairline rounded text-xs">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </form>
          )}

          {gameState === 'won' && (
            <div className="flex flex-col items-center w-full fade-in">
              <div className="font-display text-4xl mb-4 text-[var(--forest)]">
                {targetNumber}
              </div>

              {isNewBest && (
                <div className="font-display text-2xl text-[var(--ochre)] pulse-soft mb-2">
                  🎉 New Best!
                </div>
              )}

              <div className="font-display text-xl opacity-90 mb-6">
                {getRating(guesses.length)}
              </div>

              <div className="flex flex-col w-full gap-3">
                <button onClick={startGame} className="btn-primary w-full">
                  Play Again
                </button>
                <button onClick={handleShare} className="btn-ghost w-full">
                  {copied ? 'Copied!' : 'Share Result'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
