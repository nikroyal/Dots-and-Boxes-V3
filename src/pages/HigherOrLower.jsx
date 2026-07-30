import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function HigherOrLower() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'playing', 'gameover'
  const [currentNumber, setCurrentNumber] = useState(null);
  const [nextNumber, setNextNumber] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higher-lower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Dedicated useEffect to handle game over side effects, avoiding stale reads
  // that would occur if we called these inside handleGuess
  useEffect(() => {
    if (gameState === 'gameover') {
      if (streak > bestStreak) {
        setBestStreak(streak);
        try {
          localStorage.setItem('axiom-higher-lower-best', streak.toString());
        } catch {}
        if (profile) {
          recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Higher or Lower', score: streak });
          updateArcadeBest(profile, 'higher-or-lower', 'Higher or Lower', streak, streak.toString());
        }
      }
    }
  }, [gameState, streak, bestStreak, profile]);

  const generateNumber = (exclude) => {
    let num;
    do {
      num = Math.floor(Math.random() * 100) + 1;
    } while (num === exclude);
    return num;
  };

  const startGame = () => {
    sfx.click();
    const startNum = generateNumber(null);
    setCurrentNumber(startNum);
    setNextNumber(null);
    setStreak(0);
    setGameState('playing');
  };

  const handleGuess = (guess) => {
    if (gameState !== 'playing') return;

    const newNum = generateNumber(currentNumber);
    setNextNumber(newNum);

    const isHigher = newNum > currentNumber;
    const isCorrect = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (isCorrect) {
      sfx.piece();
      setStreak(s => s + 1);
      setTimeout(() => {
        setCurrentNumber(newNum);
        setNextNumber(null);
      }, 800);
    } else {
      sfx.loss();
      setGameState('gameover');
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Higher or Lower</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Streak: {streak}
        </p>
        {bestStreak > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestStreak}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md aspect-square flex flex-col items-center justify-center">
        {gameState === 'waiting' && (
          <div className="flex flex-col items-center justify-center">
            <p className="font-mono text-sm opacity-60 mb-6 text-center">Guess if the next number (1-100) will be higher or lower.</p>
            <button onClick={startGame} className="btn-primary">Start Game</button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex flex-col items-center justify-center">
             <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over</p>
             <p className="font-mono text-lg mb-6">Final Streak: {streak}</p>
             <p className="font-mono text-sm opacity-60 mb-6 text-center">The next number was {nextNumber}.</p>
             <button onClick={startGame} className="btn-primary">Play Again</button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="text-6xl font-display mb-8">
              {currentNumber}
            </div>

            {nextNumber !== null ? (
               <div className="text-4xl font-display mb-8 text-[var(--ochre)]">
                 {nextNumber}
               </div>
            ) : (
              <div className="flex gap-4 w-full justify-center mt-4">
                <button onClick={() => handleGuess('higher')} className="btn-ghost flex-1 text-xl py-4 flex flex-col items-center gap-2 border border-black/10 hover:bg-black/5">
                  <span>▲</span>
                  <span className="font-mono text-xs">Higher</span>
                </button>
                <button onClick={() => handleGuess('lower')} className="btn-ghost flex-1 text-xl py-4 flex flex-col items-center gap-2 border border-black/10 hover:bg-black/5">
                  <span>▼</span>
                  <span className="font-mono text-xs">Lower</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
