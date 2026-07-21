import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const WORDS = [
  "REACT", "JAVASCRIPT", "PROGRAMMING", "COMPONENT", "INTERFACE",
  "APPLICATION", "DEVELOPER", "FRONTEND", "BACKEND", "DATABASE",
  "NETWORK", "SECURITY", "ALGORITHM", "VARIABLE", "FUNCTION",
  "FRAMEWORK", "LIBRARY", "DEBUGGING", "COMPILER", "SOFTWARE",
  "ENGINEER", "HARDWARE", "INTERNET", "PROTOCOL", "BROWSER"
];

const MAX_MISTAKES = 6;

export default function Hangman() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'won' | 'gameover'
  const [currentWord, setCurrentWord] = useState('');
  const [guessedLetters, setGuessedLetters] = useState(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [copied, setCopied] = useState(false);

  const [bestStreak, setBestStreak] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-hangman-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const stateRef = useRef({ gameState, guessedLetters, currentWord, mistakes, winStreak });
  useEffect(() => {
    stateRef.current = { gameState, guessedLetters, currentWord, mistakes, winStreak };
  }, [gameState, guessedLetters, currentWord, mistakes, winStreak]);

  const startGameRef = useRef(null);

  const startGame = useCallback(() => {
    sfx.click();
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    setCurrentWord(word);
    setGuessedLetters(new Set());
    setMistakes(0);
    setGameState('playing');
  }, []);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  const handleGuess = useCallback((letter) => {
    const state = stateRef.current;
    if (state.gameState !== 'playing' || state.guessedLetters.has(letter)) return;

    const newGuessed = new Set(state.guessedLetters);
    newGuessed.add(letter);
    setGuessedLetters(newGuessed);

    if (!state.currentWord.includes(letter)) {
      sfx.click();
      const newMistakes = state.mistakes + 1;
      setMistakes(newMistakes);
      if (newMistakes >= MAX_MISTAKES) {
        sfx.loss();
        setGameState('gameover');
      }
    } else {
      sfx.piece();
      // Check win
      const won = state.currentWord.split('').every(char => newGuessed.has(char) || char === ' ');
      if (won) {
        sfx.win();
        setGameState('won');
        const newStreak = state.winStreak + 1;
        setWinStreak(newStreak);

        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
          try {
            localStorage.setItem('axiom-hangman-best', newStreak.toString());
          } catch {}
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Hangman', score: newStreak + ' streak' });
          updateArcadeBest(profile, 'hangman', 'Hangman', newStreak, newStreak + ' streak');
        }
      }
    }
  }, [bestStreak, profile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const state = stateRef.current;
      if (e.key === 'Enter') {
        if (state.gameState !== 'playing') {
          e.preventDefault();
          if (state.gameState === 'gameover') {
             setWinStreak(0);
          }
          if (startGameRef.current) startGameRef.current();
        }
        return;
      }

      if (state.gameState === 'playing') {
        const key = e.key.toUpperCase();
        if (/^[A-Z]$/.test(key)) {
          handleGuess(key);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGuess]);

  const drawHangman = () => {
    const parts = [
      <line key="base" x1="10" y1="250" x2="150" y2="250" stroke="currentColor" strokeWidth="4" />,
      <line key="pole" x1="80" y1="250" x2="80" y2="20" stroke="currentColor" strokeWidth="4" />,
      <line key="top" x1="80" y1="20" x2="200" y2="20" stroke="currentColor" strokeWidth="4" />,
      <line key="rope" x1="200" y1="20" x2="200" y2="50" stroke="currentColor" strokeWidth="4" />,
      <circle key="head" cx="200" cy="80" r="30" stroke="currentColor" strokeWidth="4" fill="transparent" opacity={mistakes > 0 ? 1 : 0} />,
      <line key="body" x1="200" y1="110" x2="200" y2="170" stroke="currentColor" strokeWidth="4" opacity={mistakes > 1 ? 1 : 0} />,
      <line key="larm" x1="200" y1="130" x2="160" y2="160" stroke="currentColor" strokeWidth="4" opacity={mistakes > 2 ? 1 : 0} />,
      <line key="rarm" x1="200" y1="130" x2="240" y2="160" stroke="currentColor" strokeWidth="4" opacity={mistakes > 3 ? 1 : 0} />,
      <line key="lleg" x1="200" y1="170" x2="170" y2="220" stroke="currentColor" strokeWidth="4" opacity={mistakes > 4 ? 1 : 0} />,
      <line key="rleg" x1="200" y1="170" x2="230" y2="220" stroke="currentColor" strokeWidth="4" opacity={mistakes > 5 ? 1 : 0} />
    ];
    return parts;
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

  const getRatingMessage = (streak) => {
    if (streak >= 10) return "🔥 Unstoppable!";
    if (streak >= 5) return "🌟 Amazing!";
    if (streak >= 3) return "👍 Great Job!";
    return "🎮 Good start!";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I got a ${winStreak} win streak in Axiom Hangman! 🎯 ${getRatingMessage(winStreak)}`;
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
    <div className="fade-in max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-6">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Hangman</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Streak: {winStreak} | Mistakes: {mistakes}/{MAX_MISTAKES}
        </p>
        {bestStreak > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Streak: {bestStreak}
          </p>
        )}
      </section>

      <div className="w-full max-w-2xl border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10">

        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
            <button onClick={startGame} className="btn-primary mb-2">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
            <p className="font-mono text-xs opacity-60">Press Enter</p>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--crimson)]">Game Over!</div>
             <div className="font-mono text-sm opacity-80 mb-2">The word was:</div>
             <div className="font-mono text-2xl font-bold mb-6 text-[var(--ink)]">{currentWord}</div>
             <div className="flex gap-4 mb-2">
               <button onClick={() => { setWinStreak(0); startGame(); }} className="btn-primary">
                  Try Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
             <p className="font-mono text-xs opacity-60">Press Enter to restart</p>
          </div>
        )}

        {gameState === 'won' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-4xl mb-2 text-[var(--forest)]">You saved them!</div>
             <div className="font-mono text-sm opacity-80 mb-2">The word was:</div>
             <div className="font-mono text-2xl font-bold mb-6 text-[var(--ink)]">{currentWord}</div>
             <div className="flex gap-4 mb-2">
               <button onClick={startGame} className="btn-primary">
                  Next Word <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
             <p className="font-mono text-xs opacity-60">Press Enter for the next word</p>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-8 w-full">
          <svg width="280" height="280" viewBox="0 0 280 280" className="text-[var(--ink)]">
            {drawHangman()}
          </svg>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {currentWord.split('').map((char, index) => (
              <span key={index} className="w-8 h-10 border-b-4 border-[var(--ink)] flex items-center justify-center text-2xl font-mono font-bold uppercase">
                {(guessedLetters.has(char) || gameState === 'gameover') ? char : ''}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {alphabet.map(letter => (
              <button
                key={letter}
                onClick={() => handleGuess(letter)}
                disabled={guessedLetters.has(letter) || gameState !== 'playing'}
                className={`w-10 h-10 font-mono text-lg flex items-center justify-center rounded transition-colors
                  ${guessedLetters.has(letter)
                    ? currentWord.includes(letter)
                      ? 'bg-[var(--forest)] text-[var(--paper)]'
                      : 'bg-black/10 text-black/30'
                    : 'bg-[var(--bg-soft)] hover:bg-black/10 focus-ring'
                  }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Type letters on your keyboard to guess the word.
      </p>
    </div>
  );
}
