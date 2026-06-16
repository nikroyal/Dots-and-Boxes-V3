import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/rpsLogic';
import { sfx } from '../lib/sound';
import { X, Trophy } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';

export default function LocalRps() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');

  const [game, setGame] = useState(null);
  const { confirm, dialog } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(3, null, ['p1', 'p2']));
    setSetup(false);
  };

  const handleMove = (choice) => {
    if (!game || game.finished) return;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const { newGame, claimed, error } = applyMove(game, choice, pid, playerIds);
    if (error) return;

    if (claimed > 0) sfx.claim();
    else sfx.line();

    setGame(newGame);
  };

  const quit = async () => {
    if (!game.finished && await confirm({ title: 'End this match?', body: 'Progress will be lost.', confirmLabel: 'Quit' })) {
      setSetup(true);
      setGame(null);
    } else if (game.finished) {
      setSetup(true);
      setGame(null);
    }
  };

  if (setup) {
    return (
      <div className="fade-in max-w-sm mx-auto space-y-8 py-8">
        <div className="text-center">
          <h1 className="font-display text-4xl mb-2">Rock Paper Scissors</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <form onSubmit={handleStart} className="card space-y-6">
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name (X)</label>
              <input value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <div>
              <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name (O)</label>
              <input value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">Start Match</button>
        </form>
      </div>
    );
  }

  const finished = game.finished;
  const isDraw = finished && game.winnerIdx === -1;
  const winnerName = isDraw ? 'Draw' : (game.winnerIdx === 0 ? p1Name : p2Name);
  const p1Turn = game.currentPlayerIdx === 0;

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {dialog}
      {finished && !isDraw && <Confetti />}

      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} />
          </button>
        </div>
        {!finished && (
          <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
            background: p1Turn ? 'var(--crimson)' : 'var(--ochre)',
            color: 'white'
          }}>
            {p1Turn ? p1Name : p2Name}'s Turn
          </div>
        )}
      </div>



      <div className="flex flex-col items-center justify-center py-8 gap-8">
        <div className="flex gap-8 items-center">
            <div className="text-center">
                <div className="font-display text-2xl mb-2">{p1Name}</div>
                <div className="text-4xl font-display text-[var(--crimson)]">{game.scores['p1']}</div>
            </div>
            <div className="font-display text-3xl opacity-50">VS</div>
            <div className="text-center">
                <div className="font-display text-2xl mb-2">{p2Name}</div>
                <div className="text-4xl font-display text-[var(--ochre)]">{game.scores['p2']}</div>
            </div>
        </div>

        {!finished && (
            <div className="flex flex-col items-center gap-4">
                <div className="font-mono text-sm tracking-widest uppercase opacity-70">
                    {game.currentPlayerIdx === 0 ? `${p1Name}'s Choice (Hidden)` : `${p2Name}'s Choice`}
                </div>
                <div className="flex gap-4">
                    {['R', 'P', 'S'].map(choice => {
                        const icons = { 'R': '✊ Rock', 'P': '✋ Paper', 'S': '✌️ Scissors' };
                        return (
                            <button key={choice}
                                    className="px-6 py-4 bg-[var(--paper)] border hairline hover:bg-[var(--bg-hover)] text-xl font-display transition-colors"
                                    onClick={() => {
                                        handleMove(choice);
                                        // Auto advance turn for RPS local since they share screen
                                        if (game.currentPlayerIdx === 0) {
                                            setGame(g => ({...g, currentPlayerIdx: 1}));
                                        } else {
                                            // applyMove will resolve the round, we just need to reset the display index
                                            setGame(g => ({...g, currentPlayerIdx: 0}));
                                        }
                                    }}>
                                {icons[choice]}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {game.roundHistory.length > 0 && (
            <div className="mt-8 space-y-2 text-center w-full max-w-md">
                <div className="font-mono text-xs tracking-widest uppercase opacity-50 mb-4">History</div>
                {game.roundHistory.map((h, i) => (
                    <div key={i} className="flex justify-between items-center bg-[var(--paper)] p-3 border hairline">
                        <div className="w-1/3 text-left font-display text-lg" style={{ color: 'var(--crimson)' }}>{h.p1Choice}</div>
                        <div className="w-1/3 font-mono text-xs opacity-50">Round {i + 1}</div>
                        <div className="w-1/3 text-right font-display text-lg" style={{ color: 'var(--ochre)' }}>{h.p2Choice}</div>
                    </div>
                ))}
            </div>
        )}
      </div>




      {finished && (
        <div className="card text-center max-w-sm mx-auto space-y-6 fade-up">
          <div>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--ochre)' }} />
            <h2 className="font-display text-3xl mb-1">{isDraw ? 'Draw!' : `${winnerName} Wins!`}</h2>
            <p className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Match Over</p>
          </div>
          <div className="flex gap-3 justify-center">
             <button onClick={() => setGame(createEmptyGame(3, null, ['p1', 'p2']))} className="btn-primary">
               Rematch
             </button>
             <button onClick={() => setSetup(true)} className="btn-ghost">
               Setup
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
