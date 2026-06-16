import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/mancalaLogic';
import { sfx } from '../lib/sound';
import { X, Trophy } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';

export default function LocalMancala() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');

  const [game, setGame] = useState(null);
  const { confirm, dialog } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(2, 6, ['p1', 'p2']));
    setSetup(false);
  };

  const handleMove = (c) => {
    if (!game || game.finished) return;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const { newGame, claimed, error } = applyMove(game, c, pid, playerIds);
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
          <h1 className="font-display text-4xl mb-2">Mancala</h1>
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



      <div className="flex justify-center py-8">
        <div className="inline-block bg-[var(--hairline-strong)] p-4 rounded-full">
          <div className="flex items-center gap-4">
            {/* Player 2 Store */}
            <div className="w-16 h-48 bg-[var(--paper)] rounded-full flex items-center justify-center text-4xl font-display" style={{ color: 'var(--ochre)' }}>
              {game.stores['p2']}
            </div>

            {/* Pits */}
            <div className="flex flex-col gap-2">
              {/* Player 2 Pits (Top row, left to right is visually opposite to internal logic, so we just map internal 0 to 5) */}
              <div className="flex gap-2">
                {game.board[0].map((stones, c) => (
                  <div key={`p2-pit-${c}`}
                       className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-display bg-[var(--paper)] ${!finished && !p1Turn && stones > 0 ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''}`}
                       onClick={() => !finished && !p1Turn && handleMove(c)}
                       style={{ color: 'var(--ochre)' }}>
                    {stones}
                  </div>
                ))}
              </div>

              {/* Player 1 Pits (Bottom row) */}
              <div className="flex gap-2">
                {game.board[1].map((stones, c) => (
                  <div key={`p1-pit-${c}`}
                       className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-display bg-[var(--paper)] ${!finished && p1Turn && stones > 0 ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''}`}
                       onClick={() => !finished && p1Turn && handleMove(c)}
                       style={{ color: 'var(--crimson)' }}>
                    {stones}
                  </div>
                ))}
              </div>
            </div>

            {/* Player 1 Store */}
            <div className="w-16 h-48 bg-[var(--paper)] rounded-full flex items-center justify-center text-4xl font-display" style={{ color: 'var(--crimson)' }}>
              {game.stores['p1']}
            </div>
          </div>
        </div>
      </div>




      {finished && (
        <div className="card text-center max-w-sm mx-auto space-y-6 fade-up">
          <div>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--ochre)' }} />
            <h2 className="font-display text-3xl mb-1">{isDraw ? 'Draw!' : `${winnerName} Wins!`}</h2>
            <p className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Match Over</p>
          </div>
          <div className="flex gap-3 justify-center">
             <button onClick={() => setGame(createEmptyGame(2, 6, ['p1', 'p2']))} className="btn-primary">
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
