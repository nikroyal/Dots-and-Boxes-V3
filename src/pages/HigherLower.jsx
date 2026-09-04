import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const MAX_SCORE = 999;

export default function HigherLower() {
  const { profile } = useAuth();
  // states: 'start' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(0);
  const [nextNumber, setNextNumber] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lastAction, setLastAction] = useState(null); // 'higher' or 'lower'

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higherlower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const startGame = useCallback(() => {
    sfx.click();
    setScore(0);
    setGameState('playing');
    const firstNum = Math.floor(Math.random() * 100) + 1;
    let secondNum;
    do {
      secondNum = Math.floor(Math.random() * 100) + 1;
    } while (secondNum === firstNum);

    setCurrentNumber(firstNum);
    setNextNumber(secondNum);
    setLastAction(null);
  }, []);

  const endGame = useCallback((finalScore) => {
    sfx.loss();
    setGameState('gameover');

    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-higherlower-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher Lower', score: finalScore });
      updateArcadeBest(profile, 'higher-lower', 'Higher Lower', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  const handleGuess = useCallback((guess) => {
    if (gameState !== 'playing') return;
    setLastAction(guess);

    const isHigher = nextNumber > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (isCorrect) {
      sfx.piece();
      const newScore = score + 1;
      setScore(newScore);

      setCurrentNumber(nextNumber);

      let newNextNum;
      do {
        newNextNum = Math.floor(Math.random() * 100) + 1;
      } while (newNextNum === nextNumber);
      setNextNumber(newNextNum);

    } else {
      endGame(score);
    }
  }, [gameState, currentNumber, nextNumber, score, endGame]);

  const handleKeyDownRef = useRef();

  useEffect(() => {
    handleKeyDownRef.current = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (gameState === 'start' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          handleGuess('higher');
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleGuess('lower');
        }
      }
    };
  }, [gameState, startGame, handleGuess]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I scored ${score} in Axiom Higher Lower! ⬆️⬇️`;
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

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="w-full max-w-md border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">

        {gameState === 'start' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] w-full text-center">
             <div className="font-display text-3xl mb-4">Will the next number be higher or lower?</div>
             <p className="opacity-60 max-w-[250px] mx-auto text-sm mb-8">
               Numbers are between 1 and 100.
             </p>
             <button onClick={startGame} className="btn-primary w-full text-lg py-3 max-w-[200px]">
               Start Game (Enter)
             </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center w-full fade-in min-h-[300px] justify-center">

            <div className="text-center mb-10">
               <div className="font-mono text-sm uppercase tracking-widest opacity-50 mb-2">Current Number</div>
               <div className="font-display text-7xl text-[var(--ink)]">{currentNumber}</div>
            </div>

            <div className="flex gap-4 w-full">
              <button
                onClick={() => handleGuess('higher')}
                className="btn-primary flex-1 py-4 text-xl flex flex-col items-center gap-2 hover:bg-[var(--forest)] hover:border-[var(--forest)]"
              >
                <span>Higher</span>
                <span className="opacity-50 text-xs font-mono">(↑)</span>
              </button>
              <button
                onClick={() => handleGuess('lower')}
                className="btn-primary flex-1 py-4 text-xl flex flex-col items-center gap-2 hover:bg-[var(--crimson)] hover:border-[var(--crimson)]"
              >
                <span>Lower</span>
                <span className="opacity-50 text-xs font-mono">(↓)</span>
              </button>
            </div>

          </div>
        )}

        {gameState === 'gameover' && (
           <div className="flex flex-col items-center justify-center min-h-[300px] w-full text-center fade-in">
             <div className="font-display text-3xl mb-2 text-[var(--crimson)]">Wrong!</div>
             <div className="font-mono text-sm opacity-60 mb-6">
                The number was <span className="text-[var(--ink)] font-bold text-lg">{nextNumber}</span>
             </div>

             <div className="font-display text-5xl text-[var(--ochre)] mb-8">
               Score: {score}
             </div>

             <div className="flex gap-4 w-full justify-center">
               <button onClick={startGame} className="btn-primary">
                 Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-secondary">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
