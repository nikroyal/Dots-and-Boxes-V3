import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const GAME_DURATION = 60; // 60 seconds

const WORDS = [
  "REACT", "JAVASCRIPT", "AXIOM", "GAME", "SCRAMBLE", "CODE", "DEVELOPER",
  "HTML", "CSS", "PROGRAM", "ENGINEER", "FRONTEND", "BACKEND", "DATABASE",
  "SERVER", "CLIENT", "BROWSER", "NETWORK", "INTERNET", "WEBSITE",
  "APPLICATION", "SOFTWARE", "HARDWARE", "COMPUTER", "LAPTOP", "DESKTOP",
  "KEYBOARD", "MOUSE", "MONITOR", "SCREEN", "DISPLAY", "PIXEL", "COLOR",
  "DESIGN", "USER", "INTERFACE", "EXPERIENCE", "TESTING", "DEBUG",
  "BUILD", "COMPILE", "EXECUTE", "RUN", "START", "STOP", "PAUSE", "PLAY",
  "SCORE", "TIME", "LEVEL", "POINT", "WIN", "LOSE", "FAIL", "SUCCESS",
  "PUZZLE", "LOGIC", "MATH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY",
  "HISTORY", "GEOGRAPHY", "LANGUAGE", "MUSIC", "ART", "SPORTS", "NATURE"
];

const shuffleString = (str) => {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

export default function WordScramble() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentWord, setCurrentWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-wordscramble-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const scoreRef = useRef(score);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const loadNewWord = useCallback(() => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    let scrambled = shuffleString(randomWord);
    // ensure it's actually scrambled (if length > 1)
    while (scrambled === randomWord && randomWord.length > 1) {
      scrambled = shuffleString(randomWord);
    }
    setCurrentWord(randomWord);
    setScrambledWord(scrambled);
    setUserInput('');
  }, []);

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    scoreRef.current = 0;
    loadNewWord();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    sfx.win();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-wordscramble-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Word Scramble', score: finalScore });
      updateArcadeBest(profile, 'word-scramble', 'Word Scramble', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  const getNextTierMessage = (s) => {
    if (s >= 200) return "You're at the top tier!";
    if (s >= 100) return `${200 - s} points to Wordsmith tier`;
    if (s >= 50) return `${100 - s} points to Smart tier`;
    return `${50 - s} points to Good tier`;
  };

  const getRatingMessage = (s) => {
    if (s >= 200) return "🧠 Wordsmith";
    if (s >= 100) return "🧠 Smart";
    if (s >= 50) return "🧠 Good";
    return "🧠 Beginner";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRatingMessage(score);
    const text = `I scored ${score} in Axiom Word Scramble! ${rating}`;
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (gameState === 'waiting' || gameState === 'gameover')) {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;

    if (userInput.trim().toUpperCase() === currentWord) {
      sfx.piece();
      setScore((s) => s + 10);
      loadNewWord();
    } else {
      sfx.click();
      setUserInput(''); // clear on wrong answer or keep it? Let's clear to indicate wrong
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Word Scramble</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score} <span className="ml-4">Time: {timeLeft}s</span>
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
            <button onClick={startGame} className="btn-primary">
              Start Game (Enter)
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Time's Up!</p>
            <p className="font-mono text-lg mb-1">Final Score: {score}</p>
            <p className="font-display text-xl mb-1 text-[var(--ink)] opacity-90">{getRatingMessage(score)}</p>
            <p className="font-mono text-xs opacity-60 tracking-widest uppercase mb-4">{getNextTierMessage(score)}</p>
            <p className="font-mono text-sm opacity-80 mb-6 text-[var(--crimson)]">Missed word: {currentWord}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again (Enter)
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-4xl sm:text-5xl font-mono tracking-[0.2em] uppercase font-bold text-[var(--ink)] break-all text-center">
            {scrambledWord || '...'}
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
            <input
              ref={inputRef}
              type="text"
              aria-label="Type word"
              value={userInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.trim().toUpperCase() === currentWord) {
                  sfx.piece();
                  setScore((s) => s + 10);
                  loadNewWord();
                } else {
                  setUserInput(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !userInput.trim()) {
                  e.preventDefault();
                }
              }}
              className="w-full text-center text-2xl font-display uppercase tracking-widest p-4 border hairline bg-[var(--bg-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
              placeholder="Type word..."
              disabled={gameState !== 'playing'}
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" className="hidden">Submit</button>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => loadNewWord()}
              disabled={gameState !== 'playing'}
              className="btn-ghost text-xs"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Unscramble as many words as you can in 60 seconds!
      </p>
    </div>
  );
}
