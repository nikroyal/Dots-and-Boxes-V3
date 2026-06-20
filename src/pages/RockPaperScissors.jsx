import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { sfx } from '../lib/sound';

const CHOICES = ['Rock', 'Paper', 'Scissors'];

const EMOJIS = {
  'Rock': '✊',
  'Paper': '✋',
  'Scissors': '✌️',
};

const WIN_MAP = {
  'Rock': 'Scissors',
  'Paper': 'Rock',
  'Scissors': 'Paper',
};

export default function RockPaperScissors() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'result'
  const [playerChoice, setPlayerChoice] = useState(null);
  const [computerChoice, setComputerChoice] = useState(null);
  const [resultMessage, setResultMessage] = useState('');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-rps-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChoice = (choice) => {
    if (gameState === 'playing' || gameState === 'result') return; // Prevent multiple clicks

    sfx.click();
    setPlayerChoice(choice);
    setGameState('playing');

    // Simulate computer thinking
    timeoutRef.current = setTimeout(() => {
      const compChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
      setComputerChoice(compChoice);

      let msg = '';
      if (choice === compChoice) {
        msg = 'It\'s a tie!';
        sfx.notify();
        setStreak(0); // Reset streak on tie
      } else if (WIN_MAP[choice] === compChoice) {
        msg = 'You win!';
        sfx.win();
        setStreak((s) => s + 1);
      } else {
        msg = 'You lose!';
        sfx.loss();
        setStreak(0); // Reset streak on loss
      }
      setResultMessage(msg);
      setGameState('result');
    }, 500); // 500ms delay for suspense
  };

  useEffect(() => {
    if (gameState === 'result' && streak > bestStreak) {
      setBestStreak(streak);
      try {
        localStorage.setItem('axiom-rps-best', streak.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Rock Paper Scissors', score: streak + ' streak' });
    }
  }, [gameState, streak, bestStreak, profile]);

  const resetGame = () => {
    sfx.click();
    setGameState('waiting');
    setPlayerChoice(null);
    setComputerChoice(null);
    setResultMessage('');
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Rock Paper Scissors</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Current Streak: {streak}
        </p>
        {bestStreak > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Streak: {bestStreak}
          </p>
        )}
      </section>

      <div className="flex flex-col items-center border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 w-full max-w-md">

        {gameState === 'result' || gameState === 'playing' ? (
           <div className="flex w-full justify-between items-center mb-8">
              <div className="flex flex-col items-center">
                 <span className="font-mono text-xs mb-2 opacity-50 uppercase tracking-widest">You</span>
                 <div className="text-6xl">{EMOJIS[playerChoice]}</div>
              </div>
              <div className="text-2xl opacity-30 font-display">VS</div>
              <div className="flex flex-col items-center">
                 <span className="font-mono text-xs mb-2 opacity-50 uppercase tracking-widest">Comp</span>
                 <div className="text-6xl fade-in">{gameState === 'result' ? EMOJIS[computerChoice] : '❓'}</div>
              </div>
           </div>
        ) : (
          <div className="text-center mb-8 font-display text-2xl opacity-70">
            Choose your weapon
          </div>
        )}

        {gameState === 'result' ? (
          <div className="flex flex-col items-center fade-in">
             <div className={`font-display text-3xl mb-6 ${resultMessage === 'You win!' ? 'text-[var(--forest)]' : resultMessage === 'You lose!' ? 'text-[var(--crimson)]' : ''}`}>
                {resultMessage}
             </div>
             <button onClick={resetGame} className="btn-primary">
                Play Again
             </button>
          </div>
        ) : (
          <div className="flex gap-4">
            {CHOICES.map((choice) => (
              <button
                key={choice}
                onClick={() => handleChoice(choice)}
                disabled={gameState === 'playing'}
                className="w-20 h-20 sm:w-24 sm:h-24 text-4xl sm:text-5xl border hairline rounded flex items-center justify-center bg-[var(--bg-soft)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                aria-label={`Choose ${choice}`}
              >
                {EMOJIS[choice]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
