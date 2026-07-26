import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const COLORS = [
  { name: 'Red', value: 'var(--crimson)' },
  { name: 'Green', value: 'var(--forest)' },
  { name: 'Gold', value: 'var(--ochre)' },
  { name: 'Black', value: 'var(--ink)' },
];

const GAME_DURATION = 30000; // 30 seconds

export default function ColorMatch() {
  const { profile } = useAuth();
  // states: 'start' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [colorText, setColorText] = useState(COLORS[0]);
  const [colorFill, setColorFill] = useState(COLORS[0]);
  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef(null);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-colormatch-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const generateColors = useCallback(() => {
    const textIndex = Math.floor(Math.random() * COLORS.length);
    // 50% chance of match to keep it balanced
    const isMatch = Math.random() > 0.5;
    let fillIndex;
    if (isMatch) {
      fillIndex = textIndex;
    } else {
      fillIndex = Math.floor(Math.random() * (COLORS.length - 1));
      if (fillIndex >= textIndex) fillIndex++;
    }

    setColorText(COLORS[textIndex]);
    setColorFill(COLORS[fillIndex]);
  }, []);

  const startGame = useCallback(() => {
    sfx.click();
    if (timerRef.current) clearInterval(timerRef.current);
    setScore(0);
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    generateColors();
    startTimeRef.current = performance.now();

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      setTimeLeft(remaining);
    }, 16); // ~60fps updates for smooth timer display
  }, [generateColors]);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sfx.loss();
    setGameState('gameover');

    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem('axiom-colormatch-best', score.toString());
      } catch {}
      if (profile) recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Color Match', score: score.toString() });
      if (profile) updateArcadeBest(profile, 'color-match', 'Color Match', score, score.toString());
    }
  }, [score, bestScore, profile]);

  useEffect(() => {
    if (timeLeft <= 0 && gameState === 'playing') {
      endGame();
    }
  }, [timeLeft, gameState, endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);


  const getRating = (s) => {
    if (s >= 50) return "🦅 Eagle Eye";
    if (s >= 30) return "🦉 Sharp";
    if (s >= 15) return "🕊️ Good";
    return "🐢 Keep practicing";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const rating = getRating(score);
    const text = `I scored ${score} in Axiom Color Match! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  const handleAnswer = useCallback((isMatchClaim) => {
    if (gameState !== 'playing') return;

    const actualMatch = colorText.value === colorFill.value;

    if (isMatchClaim === actualMatch) {
      sfx.win();
      setScore(s => s + 1);
      generateColors();
    } else {
      endGame();
    }
  }, [gameState, colorText, colorFill, generateColors, endGame]);

  const handleKeyDownRef = useRef();

  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      if (gameState === 'playing') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleAnswer(true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleAnswer(false);
        }
      } else if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };
  }, [gameState, handleAnswer, startGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Color Match</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Does the word match the color?
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        {gameState === 'playing' && (
          <div className="absolute top-4 right-6 font-mono text-xl tracking-widest">
            {(timeLeft / 1000).toFixed(1)}s
          </div>
        )}

        {gameState === 'playing' && (
          <div className="absolute top-4 left-6 font-mono text-xl tracking-widest">
            Score: {score}
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[160px] w-full mt-8 mb-8">
          {gameState === 'start' && (
            <div className="text-center">
              <p className="mb-6 opacity-80 max-w-[250px]">
                Click 'Yes' if the meaning of the word matches its ink color. One mistake ends the game!
              </p>
              <button onClick={startGame} className="btn-primary w-full text-lg py-3">
                Start Game (Enter)
              </button>
            </div>
          )}

          {gameState === 'playing' && (
            <div
              className="font-display text-6xl tracking-tight transition-colors"
              style={{ color: colorFill.value }}
            >
              {colorText.name}
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="text-center fade-in w-full flex flex-col items-center">
              <div className="font-display text-3xl mb-2">Game Over!</div>
              <div className="font-display text-5xl text-[var(--crimson)] mb-2 pulse-soft">
                Score: {score}
              </div>
              <div className="font-display text-xl mb-6 opacity-90">{getRating(score)}</div>
              <div className="flex gap-4 w-full">
                <button onClick={startGame} className="btn-primary flex-1 text-lg py-3">
                  Play Again (Enter)
                </button>
                <button onClick={handleShare} className="btn-secondary flex-1 text-lg py-3">
                  {copied ? 'Copied!' : 'Share Result'}
                </button>
              </div>
            </div>
          )}
        </div>

        {gameState === 'playing' && (
          <div className="grid grid-cols-2 gap-4 w-full">
            <button
              onClick={() => handleAnswer(true)}
              className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1"
            >
              <span>Yes</span>
              <span className="text-[0.6rem] uppercase tracking-widest opacity-50">Left Arrow</span>
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="btn-secondary py-4 text-lg flex flex-col items-center justify-center gap-1"
            >
              <span>No</span>
              <span className="text-[0.6rem] uppercase tracking-widest opacity-50">Right Arrow</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
