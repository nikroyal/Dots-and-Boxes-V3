import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';
import Confetti from '../components/Confetti';

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 10;
const COLORS = [
  { id: 'red', color: 'var(--crimson)' },
  { id: 'green', color: 'var(--forest)' },
  { id: 'blue', color: 'var(--cerulean, #2980b9)' },
  { id: 'yellow', color: 'var(--ochre)' },
  { id: 'purple', color: 'var(--amethyst, #9b59b6)' },
  { id: 'orange', color: 'var(--tangerine, #f39c12)' }
];

export default function Codebreaker() {
  const { profile } = useAuth();

  const [secretCode, setSecretCode] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [currentGuess, setCurrentGuess] = useState([]);
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, won, lost
  const [copied, setCopied] = useState(false);

  const [bestAttempts, setBestAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-codebreaker-best');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (gameState === 'won' && (bestAttempts === null || attempts.length < bestAttempts)) {
      setBestAttempts(attempts.length);
      try {
        localStorage.setItem('axiom-codebreaker-best', attempts.length.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Codebreaker', score: attempts.length + ' attempts' });
      updateArcadeBest(profile, 'codebreaker', 'Codebreaker', attempts.length, attempts.length + ' attempts');
    }
  }, [gameState, attempts.length, bestAttempts, profile]);

  const generateSecretCode = () => {
    const code = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)].id;
      code.push(randomColor);
    }
    return code;
  };

  const startGame = () => {
    sfx.click();
    setSecretCode(generateSecretCode());
    setAttempts([]);
    setCurrentGuess([]);
    setGameState('playing');
  };

  const handleColorSelect = (colorId) => {
    if (gameState !== 'playing' || currentGuess.length >= CODE_LENGTH) return;
    sfx.piece();
    setCurrentGuess([...currentGuess, colorId]);
  };

  const handleBackspace = () => {
    if (gameState !== 'playing' || currentGuess.length === 0) return;
    sfx.click();
    setCurrentGuess(currentGuess.slice(0, -1));
  };

  const calculateFeedback = (guess, secret) => {
    let exact = 0;
    let partial = 0;
    const guessCopy = [...guess];
    const secretCopy = [...secret];

    // Check for exact matches (correct color and position)
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        exact++;
        guessCopy[i] = null;
        secretCopy[i] = null;
      }
    }

    // Check for partial matches (correct color, wrong position)
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (guessCopy[i] !== null) {
        const matchIndex = secretCopy.indexOf(guessCopy[i]);
        if (matchIndex !== -1) {
          partial++;
          secretCopy[matchIndex] = null;
        }
      }
    }

    return { exact, partial };
  };

  const handleSubmit = () => {
    if (gameState !== 'playing' || currentGuess.length !== CODE_LENGTH) return;

    const feedback = calculateFeedback(currentGuess, secretCode);
    const newAttempts = [...attempts, { guess: currentGuess, feedback }];
    setAttempts(newAttempts);
    setCurrentGuess([]);

    if (feedback.exact === CODE_LENGTH) {
      sfx.win();
      setGameState('won');
    } else if (newAttempts.length >= MAX_ATTEMPTS) {
      sfx.loss();
      setGameState('lost');
    } else {
      sfx.notify();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (gameState === 'waiting' || gameState === 'won' || gameState === 'lost') {
          startGame();
        } else if (gameState === 'playing' && currentGuess.length === CODE_LENGTH) {
          handleSubmit();
        }
      } else if (e.key === 'Backspace') {
        if (gameState === 'playing') {
          handleBackspace();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, currentGuess, secretCode, attempts]);

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const attemptsCount = gameState === 'won' ? attempts.length : 'X';
    let text = `Codebreaker ${attemptsCount}/${MAX_ATTEMPTS}\n\n`;

    attempts.forEach(attempt => {
      for (let i = 0; i < attempt.feedback.exact; i++) text += '🟢';
      for (let i = 0; i < attempt.feedback.partial; i++) text += '🟡';
      for (let i = 0; i < (CODE_LENGTH - attempt.feedback.exact - attempt.feedback.partial); i++) text += '⚪';
      text += '\n';
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    }
  };

  const getColorStyle = (colorId) => {
    const colorObj = COLORS.find(c => c.id === colorId);
    return colorObj ? colorObj.color : 'transparent';
  };

  return (
    <div className="fade-in max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh]">
      {gameState === 'won' && <Confetti />}

      <section className="text-center mb-6">
        <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mb-2">Codebreaker</h1>
        <p className="font-mono text-xs tracking-widest uppercase opacity-60">
          Best: {bestAttempts !== null ? bestAttempts + ' attempts' : '--'}
        </p>
      </section>

      <div className="w-full card border hairline bg-[var(--paper-tint)] p-4 sm:p-6 mb-6">
        {gameState === 'waiting' ? (
          <div className="text-center py-8">
            <p className="mb-6 opacity-80">Crack the secret 4-color code.</p>
            <ul className="text-left max-w-[200px] mx-auto space-y-2 font-mono text-xs opacity-70 mb-8">
              <li>🟢 Exact match</li>
              <li>🟡 Right color, wrong spot</li>
              <li>Colors can repeat!</li>
            </ul>
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-[0.65rem] ml-2">(Enter)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Previous Attempts */}
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
              const attempt = attempts[i];
              const isCurrentRow = i === attempts.length && gameState === 'playing';

              return (
                <div key={i} className={`flex items-center gap-4 ${isCurrentRow ? 'opacity-100' : 'opacity-70'}`}>
                  <div className="font-mono text-xs w-4 text-right opacity-40">{i + 1}</div>

                  {/* Guess pegs */}
                  <div className="flex gap-2 bg-black/5 p-2 rounded-lg">
                    {Array.from({ length: CODE_LENGTH }).map((_, j) => {
                      let colorId = null;
                      if (attempt) colorId = attempt.guess[j];
                      else if (isCurrentRow && currentGuess[j]) colorId = currentGuess[j];

                      return (
                        <div
                          key={j}
                          className="w-8 h-8 rounded-full border hairline shadow-inner transition-colors duration-200"
                          style={{
                            backgroundColor: colorId ? getColorStyle(colorId) : 'var(--bg-soft)',
                            opacity: colorId ? 1 : 0.5
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Feedback pegs */}
                  <div className="flex gap-1 flex-wrap w-8 h-8 content-center justify-center">
                    {attempt ? (
                      <>
                        {Array.from({ length: attempt.feedback.exact }).map((_, j) => (
                          <div key={`exact-${j}`} className="w-3 h-3 rounded-full bg-[var(--forest)] shadow-sm" />
                        ))}
                        {Array.from({ length: attempt.feedback.partial }).map((_, j) => (
                          <div key={`partial-${j}`} className="w-3 h-3 rounded-full bg-[var(--ochre)] shadow-sm" />
                        ))}
                        {Array.from({ length: CODE_LENGTH - attempt.feedback.exact - attempt.feedback.partial }).map((_, j) => (
                          <div key={`empty-${j}`} className="w-3 h-3 rounded-full border hairline bg-black/5" />
                        ))}
                      </>
                    ) : (
                      Array.from({ length: CODE_LENGTH }).map((_, j) => (
                         <div key={`empty-ph-${j}`} className="w-3 h-3 rounded-full border hairline bg-black/5 opacity-30" />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {gameState === 'playing' && (
        <div className="w-full max-w-sm">
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => handleColorSelect(color.id)}
                className="w-12 h-12 rounded-full border-2 border-black/10 shadow-sm hover:scale-110 active:scale-95 transition-transform"
                style={{ backgroundColor: color.color }}
                aria-label={`Select ${color.id}`}
              />
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleBackspace}
              disabled={currentGuess.length === 0}
              className="btn-secondary w-24"
            >
              Undo
            </button>
            <button
              onClick={handleSubmit}
              disabled={currentGuess.length !== CODE_LENGTH}
              className="btn-primary w-32"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {(gameState === 'won' || gameState === 'lost') && (
        <div className="text-center animate-fade-in-up">
          <div className="mb-6">
            <p className="font-display text-2xl mb-2">
              {gameState === 'won' ? 'Code Cracked!' : 'Game Over'}
            </p>
            <p className="opacity-80 mb-4">
              {gameState === 'won'
                ? `You did it in ${attempts.length} attempt${attempts.length === 1 ? '' : 's'}.`
                : 'You ran out of attempts.'}
            </p>

            {gameState === 'lost' && (
              <div className="flex justify-center gap-2 mb-4 bg-black/5 p-4 rounded-xl">
                <span className="font-mono text-xs opacity-60 mr-2 self-center uppercase tracking-widest">Secret:</span>
                {secretCode.map((colorId, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border hairline"
                    style={{ backgroundColor: getColorStyle(colorId) }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button onClick={startGame} className="btn-primary">
              Play Again
            </button>
            <button onClick={handleShare} className="btn-secondary">
              {copied ? 'Copied!' : 'Share Result'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
