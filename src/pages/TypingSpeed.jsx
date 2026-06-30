import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

const QUOTES = [
  "The quick brown fox jumps over the lazy dog.",
  "To be or not to be, that is the question.",
  "All that glitters is not gold.",
  "A journey of a thousand miles begins with a single step.",
  "That which does not kill us makes us stronger.",
  "Life is what happens when you're busy making other plans.",
  "When the going gets tough, the tough get going.",
  "You must be the change you wish to see in the world.",
  "You only live once, but if you do it right, once is enough.",
  "The only thing we have to fear is fear itself.",
  "Do or do not. There is no try.",
  "If you tell the truth, you don't have to remember anything.",
  "A friend is someone who knows all about you and still loves you.",
  "Always forgive your enemies; nothing annoys them so much.",
  "Live as if you were to die tomorrow. Learn as if you were to live forever.",
  "It is never too late to be what you might have been.",
  "Everything you can imagine is real."
];

export default function TypingSpeed() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'result'
  const [gameState, setGameState] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentQuote, setCurrentQuote] = useState('');
  const [userInput, setUserInput] = useState('');
  const [wpm, setWpm] = useState(0);
  const [copied, setCopied] = useState(false);
  const [totalCharactersTyped, setTotalCharactersTyped] = useState(0);

  const [bestWpm, setBestWpm] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-typingspeed-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isNewBest, setIsNewBest] = useState(false);
  const [prevBestWpm, setPrevBestWpm] = useState(0);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const totalCharactersRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    totalCharactersRef.current = totalCharactersTyped;
  }, [totalCharactersTyped]);

  const loadNewQuote = useCallback(() => {
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setCurrentQuote(randomQuote);
    setUserInput('');
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setWpm(0);
    setTotalCharactersTyped(0);
    totalCharactersRef.current = 0;
    loadNewQuote();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('result');

    // Calculate final WPM based on standard (5 chars = 1 word) over GAME_DURATION
    const finalWpm = Math.floor((totalCharactersRef.current / 5) / (GAME_DURATION / 60));
    setWpm(finalWpm);

    if (bestWpm > 0 && finalWpm <= bestWpm) {
      setIsNewBest(false);
    }

    if (finalWpm > bestWpm) {
      setPrevBestWpm(bestWpm);
      setIsNewBest(true);
      setBestWpm(finalWpm);
      try {
        localStorage.setItem('axiom-typingspeed-best', finalWpm.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Typing Speed', score: finalWpm + ' WPM' });
      updateArcadeBest(profile, 'typing-speed', 'Typing Speed', finalWpm, finalWpm + ' WPM');
    }
  }, [bestWpm, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'waiting' || gameState === 'result') && e.key === 'Enter') {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I typed ${wpm} WPM in Axiom Typing Speed! ⌨️`;
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

  const handleChange = (e) => {
    if (gameState !== 'playing') return;
    const value = e.target.value;
    setUserInput(value);

    // Check if the current typed word is correct so far
    let isCorrectSoFar = true;
    for (let i = 0; i < value.length; i++) {
        if (value[i] !== currentQuote[i]) {
            isCorrectSoFar = false;
            break;
        }
    }

    if (!isCorrectSoFar) {
        // Maybe play error sound if we want, but let's keep it quiet or add visual indicator
        // sfx.error() isn't standard, click is fine or no sound
    }

    if (value === currentQuote) {
        sfx.piece();
        setTotalCharactersTyped(prev => prev + value.length);
        loadNewQuote();
    }
  };

  const renderQuote = () => {
    return currentQuote.split('').map((char, index) => {
      let color = 'opacity-50'; // un-typed
      if (index < userInput.length) {
        color = userInput[index] === char ? 'text-[var(--forest)]' : 'text-[var(--crimson)] bg-red-100 dark:bg-red-900/30';
      }
      return (
        <span key={index} className={`${color} transition-colors`}>
          {char}
        </span>
      );
    });
  };

  // Calculate live WPM
  const elapsed = GAME_DURATION - timeLeft;
  const liveWpm = elapsed > 0 ? Math.floor(((totalCharactersTyped + (userInput === currentQuote.substring(0, userInput.length) ? userInput.length : 0)) / 5) / (elapsed / 60)) : 0;

  return (
    <div className="fade-in max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Typing Speed</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: {timeLeft}s | WPM: {gameState === 'playing' ? liveWpm : wpm}
        </p>
        {bestWpm > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best WPM: {bestWpm}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Type the phrases as fast and accurately as possible in 60 seconds!
            </p>
            <button onClick={startGame} className="btn-primary">
              Start Test <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="flex flex-col items-center mb-6">
               <div className="font-display text-3xl opacity-90 text-[var(--forest)]">{wpm} WPM</div>
               {isNewBest && prevBestWpm > 0 && (
                 <div className="font-mono text-xs text-[var(--forest)] tracking-widest uppercase mt-2 pulse-soft">
                   +{wpm - prevBestWpm} WPM faster!
                 </div>
               )}
               {!isNewBest && bestWpm > 0 && (
                 <div className="font-mono text-xs opacity-60 tracking-widest uppercase mt-2">
                   {bestWpm - wpm} WPM slower than best
                 </div>
               )}
             </div>
             <div className="flex gap-4">
               <button onClick={startGame} className="btn-primary">
                  Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 min-h-[200px]">
          <div className="text-2xl sm:text-3xl font-display leading-relaxed text-center" style={{ minHeight: '100px' }}>
            {currentQuote && renderQuote()}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={handleChange}
            className="w-full max-w-lg text-center text-xl font-display p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
            placeholder="Start typing..."
            disabled={gameState !== 'playing'}
            autoFocus
            autoComplete="off"
            spellCheck="false"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>
    </div>
  );
}
