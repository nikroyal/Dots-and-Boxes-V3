import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/connect4Logic';
import { sfx } from '../lib/sound';
import { X, Trophy } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';

export default function LocalConnect4() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1Color, setP1Color] = useState('#E25C7A'); // crimson
  const [p2Color, setP2Color] = useState('#D9A85A'); // ochre
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);

  const [game, setGame] = useState(null);
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(6, 7, ['p1', 'p2']));
    setP1Wins(0);
    setP2Wins(0);
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

    if (newGame.finished) {
      if (newGame.winnerIdx === 0) setP1Wins(w => w + 1);
      else if (newGame.winnerIdx === 1) setP2Wins(w => w + 1);
    }
  };

  const quit = async () => {
    if (!game.finished && await confirm({ title: 'End this match?', body: 'Progress will be lost.', confirmLabel: 'Quit' })) {
      setSetup(true);
      setGame(null);
      setP1Wins(0);
      setP2Wins(0);
    } else if (game.finished) {
      setSetup(true);
      setGame(null);
      setP1Wins(0);
      setP2Wins(0);
    }
  };

  if (setup) {
    return (
      <div className="fade-in max-w-sm mx-auto space-y-8 py-8">
        <div className="text-center">
          <h1 className="font-display text-4xl mb-2">Connect 4</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <form onSubmit={handleStart} className="card space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input type="color" value={p1Color} onChange={e => setP1Color(e.target.value)} className="w-10 h-10 p-0 border-0 cursor-pointer" />
              <div className="flex-1">
                <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name</label>
                <input value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input type="color" value={p2Color} onChange={e => setP2Color(e.target.value)} className="w-10 h-10 p-0 border-0 cursor-pointer" />
              <div className="flex-1">
                <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name</label>
                <input value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
              </div>
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
      {confirmDialogEl}
      {finished && !isDraw && <Confetti />}

      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} />
          </button>
        </div>
        {!finished && (
          <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
            background: p1Turn ? `${p1Color}33` : `${p2Color}33`,
            color: p1Turn ? p1Color : p2Color
          }}>
            {p1Turn ? p1Name : p2Name}'s Turn
          </div>
        )}
      </div>

      <div className="flex justify-between items-center max-w-sm mx-auto px-4 mt-4 mb-2">
         <div className={`text-center ${p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-lg" style={{ color: p1Color }}>{p1Name}</div>
           <div className="font-mono text-sm">{p1Wins} Wins</div>
         </div>
         <div className={`text-center ${!p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-lg" style={{ color: p2Color }}>{p2Name}</div>
           <div className="font-mono text-sm">{p2Wins} Wins</div>
         </div>
      </div>


      <div className="flex justify-center py-8">
        <div className="bg-blue-600 p-4 rounded-xl shadow-xl flex gap-2">
          {Array(game.cols).fill(null).map((_, c) => (
            <div key={`col-${c}`} className="flex flex-col gap-2" onClick={() => !finished && handleMove(c)}>
              {Array(game.rows).fill(null).map((_, r) => {
                const pid = game.board[r][c];
                const bg = pid === 'p1' ? p1Color : pid === 'p2' ? p2Color : 'var(--paper)';
                return (
                  <div key={`cell-${r}-${c}`} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-colors duration-300 shadow-inner" style={{ background: bg, cursor: !finished ? 'pointer' : 'default' }}></div>
                );
              })}
            </div>
          ))}
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
             <button onClick={() => setGame(createEmptyGame(6, 7, ['p1', 'p2']))} className="btn-primary">
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
