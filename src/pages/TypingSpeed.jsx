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

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const totalCharactersRef = useRef(0);
  const startGameRef = useRef(null);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'result')) {
        e.preventDefault();
        startGameRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

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

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState]);
  const startGame = useCallback(() => {
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
  }, [loadNewQuote]);
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON') return;
        if (gameState === 'waiting' || gameState === 'result') {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [gameState, startGame]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('result');

    // Calculate final WPM based on standard (5 chars = 1 word) over GAME_DURATION
    const finalWpm = Math.floor((totalCharactersRef.current / 5) / (GAME_DURATION / 60));
    setWpm(finalWpm);

    if (finalWpm > bestWpm) {
      setBestWpm(finalWpm);
      try {
        localStorage.setItem('axiom-typingspeed-best', finalWpm.toString());
      } catch {}
      if (profile) recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Typing Speed', score: finalWpm + ' WPM' });
      if (profile) updateArcadeBest(profile, 'typing-speed', 'Typing Speed', finalWpm, finalWpm + ' WPM');
    }
  }, [bestWpm, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const getRatingMessage = (w) => {
    if (w >= 100) return "⚡ Superhuman!";
    if (w >= 80) return "🐆 Excellent!";
    if (w >= 60) return "🏃 Good!";
    if (w >= 40) return "🚶 Average!";
    return "🐢 Keep practicing!";
  };

  const getNextTierMessage = (w) => {
    if (w >= 100) return "You're at the top tier!";
    if (w >= 80) return `${100 - w} WPM to Superhuman tier`;
    if (w >= 60) return `${80 - w} WPM to Excellent tier`;
    if (w >= 40) return `${60 - w} WPM to Good tier`;
    return `${40 - w} WPM to Average tier`;
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I typed ${wpm} WPM in Axiom Typing Speed! ${getRatingMessage(wpm)}`;
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

  const isError = userInput.length > 0 && !currentQuote.startsWith(userInput);

  return (
    <div className="fade-in max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Typing Speed</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Time: <span className="text-[var(--ink)] font-bold">{Math.max(0, timeLeft)}s</span> | WPM: <span className="score-display text-[var(--ink)] font-bold">{gameState === 'playing' ? liveWpm : wpm}</span>
        </p>
        {bestWpm > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best WPM: {bestWpm}
          </p>
        )}
      </section>

      <div className="w-full max-w-2xl border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10 min-h-[300px]">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4">
              Type the phrases as fast and accurately as possible in 60 seconds!<br/>
              <span className="text-sm opacity-60 mt-2 block font-mono tracking-widest uppercase">Target: ≥ 60 WPM for 🚀</span>
            </p>
            <button onClick={startGame} className="btn-primary mb-2">
              Start Test <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
            <p className="font-mono text-xs opacity-60">Press Enter</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Time's Up!</div>
             <div className="font-display text-3xl mb-1 opacity-90 text-[var(--forest)]">{wpm} WPM</div>
             <div className="font-display text-xl mb-1 text-[var(--ink)] opacity-90">{getRatingMessage(wpm)}</div>
             <div className="font-mono text-xs opacity-60 tracking-widest uppercase mb-6">{getNextTierMessage(wpm)}</div>
             <div className="flex gap-4 mb-2">
               <button onClick={startGame} className="btn-primary">
                  Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
             <p className="font-mono text-xs opacity-60">Press Enter to try again</p>
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
            aria-label="Type the quote"
            className={`w-full max-w-lg text-center text-xl font-display p-4 border hairline focus:outline-none focus:ring-2 transition-colors duration-150 ${
              isError
                ? 'bg-red-50 dark:bg-red-900/20 border-red-500 focus:ring-red-500 text-red-700 dark:text-red-300'
                : 'bg-[var(--bg-soft)] focus:ring-[var(--forest)]'
            }`}
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
