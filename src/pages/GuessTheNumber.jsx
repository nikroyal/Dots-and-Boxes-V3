import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function GuessTheNumber() {
  const { profile } = useAuth();

  const [targetNumber, setTargetNumber] = useState(0);
  const [currentGuess, setCurrentGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'won'
  const [message, setMessage] = useState('Guess a number between 1 and 100!');
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [bestAttempts, setBestAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-guess-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const inputRef = useRef(null);

  const initGame = () => {
    setTargetNumber(Math.floor(Math.random() * 100) + 1);
    setCurrentGuess('');
    setAttempts(0);
    setGameState('playing');
    setMessage('Guess a number between 1 and 100!');
    setHistory([]);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleGuess = (e) => {
    e.preventDefault();

    if (gameState !== 'playing') return;

    const guess = parseInt(currentGuess, 10);

    if (isNaN(guess) || guess < 1 || guess > 100) {
      setMessage('Please enter a valid number between 1 and 100.');
      sfx.click();
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let resultMessage = '';

    if (guess === targetNumber) {
      sfx.win();
      resultMessage = `Correct! You guessed it in ${newAttempts} attempts.`;
      setGameState('won');

      if (bestAttempts === null || newAttempts < bestAttempts) {
        setBestAttempts(newAttempts);
        try {
          localStorage.setItem('axiom-guess-best', newAttempts.toString());
        } catch {}

        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Guess The Number', score: newAttempts + ' attempts' });
        updateArcadeBest(profile, 'guess-the-number', 'Guess The Number', newAttempts, newAttempts + ' attempts');
      }
    } else if (guess < targetNumber) {
      sfx.click();
      resultMessage = 'Too low!';
    } else {
      sfx.click();
      resultMessage = 'Too high!';
    }

    setMessage(resultMessage);
    setHistory(prev => [{ guess, result: resultMessage }, ...prev].slice(0, 5));
    setCurrentGuess('');

    if (guess !== targetNumber) {
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const getRatingMessage = (att) => {
    if (att <= 3) return "🔮 Mind Reader!";
    if (att <= 5) return "🎯 Sharpshooter!";
    if (att <= 7) return "🧠 Smart Cookie!";
    if (att <= 10) return "👍 Good Job!";
    return "🐢 Made it eventually!";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(attempts);
    const text = `I guessed the number in ${attempts} attempts on Axiom Guess The Number! 🎯 ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
      }).catch(err => {
        console.warn("Clipboard copy failed", err);
      });
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Guess The Number</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Attempts: {attempts}
        </p>
        {bestAttempts !== null && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: {bestAttempts} attempts
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        <div className="font-display text-2xl text-center mb-6 min-h-[3rem] flex items-center justify-center">
          {message}
        </div>

        {gameState === 'won' && (
          <div className="font-display text-xl text-[var(--forest)] mb-4 pulse-soft text-center w-full">
            {getRatingMessage(attempts)}
          </div>
        )}

        {gameState === 'playing' ? (
          <form onSubmit={handleGuess} className="w-full flex flex-col items-center gap-4">
            <input
              ref={inputRef}
              type="number"
              min="1"
              max="100"
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value)}
              className="w-full text-center text-4xl font-mono p-4 border hairline bg-[var(--bg-soft)] rounded focus-ring"
              placeholder="?"
              autoFocus
              aria-label="Enter your guess"
            />
            <button type="submit" className="btn-primary w-full">
              Guess
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 w-full fade-in">
            <button onClick={() => { sfx.click(); initGame(); }} className="btn-primary w-full">
              Play Again
            </button>
            <button onClick={handleShare} className="btn-secondary w-full">
              {copied ? 'Copied!' : 'Share Result'}
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-8 w-full">
            <h3 className="font-mono text-xs tracking-widest uppercase opacity-50 mb-3 text-center">Recent Guesses</h3>
            <div className="flex flex-col gap-2">
              {history.map((h, i) => (
                <div key={i} className="flex justify-between items-center text-sm font-mono border hairline bg-[var(--bg-soft)] px-4 py-2 rounded opacity-80">
                  <span>{h.guess}</span>
                  <span className={h.result === 'Too high!' ? 'text-[var(--crimson)]' : 'text-[var(--forest)]'}>
                    {h.result}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
