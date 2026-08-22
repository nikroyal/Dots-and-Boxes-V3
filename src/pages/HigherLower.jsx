import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';
import { ArrowUp, ArrowDown, Play, RotateCcw, Trophy } from 'lucide-react';

export default function HigherLower() {
  const { profile } = useAuth();

  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [previousNumber, setPreviousNumber] = useState(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-higher-lower-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const generateNumber = (exclude) => {
    let num;
    do {
      num = Math.floor(Math.random() * 100) + 1;
    } while (num === exclude);
    return num;
  };

  const startGame = () => {
    sfx.click();
    setScore(0);
    setIsNewBest(false);
    setCurrentNumber(generateNumber(null));
    setPreviousNumber(null);
    setGameState('playing');
  };

  const handleGuess = (guess) => {
    const nextNum = generateNumber(currentNumber);

    const isHigher = nextNum > currentNumber;
    const guessedRight = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

    if (guessedRight) {
      sfx.achievement(); // positive feedback sound
      setScore((prev) => prev + 1);
      setPreviousNumber(currentNumber);
      setCurrentNumber(nextNum);
    } else {
      sfx.loss();
      setPreviousNumber(currentNumber);
      setCurrentNumber(nextNum);

      let gotNewBest = false;
      if (score > bestScore) {
        gotNewBest = true;
        setBestScore(score);
        setIsNewBest(true);
        try {
          localStorage.setItem('axiom-higher-lower-best', score.toString());
        } catch {}
      }

      if (profile && score > 0 && gotNewBest) {
        updateArcadeBest(profile.id, 'higher-lower', 'Higher or Lower', score, score + ' points');
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, {
          game: 'Higher or Lower',
          score: score + ' points'
        });
      }

      setGameState('gameover');
    }
  };

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto py-8 px-4">
      <div className="flex items-center justify-between w-full mb-8">
        <h1 className="text-3xl font-bold text-ink">Higher or Lower</h1>
        <div className="flex items-center gap-2 text-forest font-mono">
          <Trophy className="w-5 h-5" />
          <span className="text-lg">Best: {bestScore}</span>
        </div>
      </div>

      <div className="w-full bg-white border-2 border-ink rounded-lg p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-center">
        {gameState === 'waiting' && (
          <div className="space-y-6">
            <p className="text-ink/70">Guess if the next number (1-100) will be higher or lower.</p>
            <button
              onClick={startGame}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-forest text-white font-bold rounded hover:bg-forest/90 transition-colors w-full sm:w-auto"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="space-y-8">
            <div className="flex justify-between text-sm font-mono text-ink/60 px-4">
              <span>Score: {score}</span>
            </div>

            <div className="flex flex-col items-center justify-center gap-4">
              <div className="text-sm text-ink/60 uppercase tracking-wider font-bold">Current Number</div>
              <div className="text-6xl font-bold text-ink bg-sand/30 w-32 h-32 flex items-center justify-center rounded-lg border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                {currentNumber}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleGuess('higher')}
                className="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-4 bg-forest text-white font-bold rounded border-2 border-ink hover:bg-forest/90 transition-transform active:translate-y-1"
              >
                <ArrowUp className="w-8 h-8" />
                Higher
              </button>
              <button
                onClick={() => handleGuess('lower')}
                className="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-4 bg-crimson text-white font-bold rounded border-2 border-ink hover:bg-crimson/90 transition-transform active:translate-y-1"
              >
                <ArrowDown className="w-8 h-8" />
                Lower
              </button>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="space-y-6">
            <div className="text-crimson font-bold text-xl uppercase tracking-widest">Game Over</div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-ink/60">The next number was</div>
              <div className="text-4xl font-bold text-ink">{currentNumber}</div>
            </div>

            <div className="text-5xl font-black text-ink my-6">
              Score: {score}
            </div>

            {isNewBest && score > 0 && (
              <div className="text-forest font-bold animate-pulse">
                New Best Score!
              </div>
            )}

            <button
              onClick={startGame}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ink text-white font-bold rounded hover:bg-ink/80 transition-colors w-full sm:w-auto mt-4"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
