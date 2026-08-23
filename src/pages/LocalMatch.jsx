import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove, PLAYER_COLORS } from '../lib/gameLogic';
import { sfx } from '../lib/sound';
import { X, Trophy, RotateCcw } from 'lucide-react';
import Confetti from '../components/Confetti';
import BoxParticles from '../components/BoxParticles';
import { useConfirm } from '../components/ConfirmDialog';

export default function LocalMatch() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1Avatar, setP1Avatar] = useState('🐶');
  const [p2Avatar, setP2Avatar] = useState('🐱');
  const [p1LineStyle, setP1LineStyle] = useState('solid');
  const [p2LineStyle, setP2LineStyle] = useState('solid');

  const [game, setGame] = useState(null);
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(rows, cols, ['p1', 'p2']));
    setSetup(false);
  };

  const handleMove = (orient, r, c) => {
    if (!game || game.finished) return;
    const isP1 = game.currentPlayerIdx === 0;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const { newGame, claimed, error } = applyMove(game, orient, r, c, pid, playerIds);
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
          <h1 className="font-display text-4xl mb-2">Pass & Play</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <form onSubmit={handleStart} className="card space-y-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="p1-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name</label>
                <input id="p1-name" value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
              </div>
              <div className="w-16">
                <label htmlFor="p1-avatar" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Avatar</label>
                <input id="p1-avatar" value={p1Avatar} onChange={e => setP1Avatar(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring text-center" maxLength={8} />
              </div>
              <div className="w-24">
                <label htmlFor="p1-line" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Line</label>
                <select id="p1-line" value={p1LineStyle} onChange={e => setP1LineStyle(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring">
                  <option value="solid">Solid</option>
                  <option value="neon">Neon</option>
                  <option value="sketch">Sketch</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="p2-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name</label>
                <input id="p2-name" value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
              </div>
              <div className="w-16">
                <label htmlFor="p2-avatar" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Avatar</label>
                <input id="p2-avatar" value={p2Avatar} onChange={e => setP2Avatar(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring text-center" maxLength={8} />
              </div>
              <div className="w-24">
                <label htmlFor="p2-line" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Line</label>
                <select id="p2-line" value={p2LineStyle} onChange={e => setP2LineStyle(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring">
                  <option value="solid">Solid</option>
                  <option value="neon">Neon</option>
                  <option value="sketch">Sketch</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
               <div className="flex-1">
                 <label htmlFor="board-rows" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Rows</label>
                 <input id="board-rows" type="number" min="2" max="10" value={rows} onChange={e => setRows(Number(e.target.value))} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required />
               </div>
               <div className="flex-1">
                 <label htmlFor="board-cols" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Cols</label>
                 <input id="board-cols" type="number" min="2" max="10" value={cols} onChange={e => setCols(Number(e.target.value))} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required />
               </div>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">Start Match</button>
        </form>
      </div>
    );
  }

  const finished = game.finished;
  const isDraw = finished && game.scores['p1'] === game.scores['p2'];
  const winnerName = isDraw ? 'Draw' : (game.scores['p1'] > game.scores['p2'] ? p1Name : p2Name);

  const p1Turn = game.currentPlayerIdx === 0;

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {confirmDialogEl}
      {finished && !isDraw && <Confetti />}

      {/* Header */}
      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} aria-hidden="true" />
          </button>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">
            {rows}×{cols}
          </div>
        </div>
        {!finished && (
          <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
            background: p1Turn ? PLAYER_COLORS[0].soft : PLAYER_COLORS[1].soft,
            color: p1Turn ? PLAYER_COLORS[0].hex : PLAYER_COLORS[1].hex
          }}>
            {p1Turn ? p1Name : p2Name}'s Turn
          </div>
        )}
      </div>

      {/* Scores */}
      <div className="flex justify-between items-center max-w-lg mx-auto">
         <div className={`text-center ${p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-xl mb-1">{p1Name}</div>
           <div className="font-display text-4xl" style={{ color: PLAYER_COLORS[0].hex }}>{game.scores['p1']}</div>
         </div>
         <div className={`text-center ${!p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-xl mb-1">{p2Name}</div>
           <div className="font-display text-4xl" style={{ color: PLAYER_COLORS[1].hex }}>{game.scores['p2']}</div>
         </div>
      </div>

      {/* Board */}
      <div className="flex justify-center overflow-x-auto py-8">
        <svg
          width={cols * 60 + 20}
          height={rows * 60 + 20}
          className="select-none touch-none"
        >
          {/* Filters for Line Styles */}
          <defs>
            <filter id="style-neon" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="style-sketch" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Boxes */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const owner = game.boxes[`${r},${c}`];
              if (!owner) return null;
              const color = owner === 'p1' ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
              const lastMove = Array.isArray(game.moves) && game.moves.length > 0 ? game.moves[game.moves.length - 1] : undefined;
              const isJustClaimed = !!lastMove && lastMove.claimedBoxes?.some(b => b.r === r && b.c === c);
              return (
                <g key={`b-${r}-${c}`} className="box-filled">
                  <rect
                    x={c * 60 + 10} y={r * 60 + 10}
                    width={60} height={60}
                    fill={color.soft}
                  />
                  <text x={c * 60 + 40} y={r * 60 + 45} textAnchor="middle"
                        style={{ fontFamily: 'EB Garamond, serif', fontSize: 24, fontWeight: 500, fill: color.hex }}>
                    {owner === 'p1' ? p1Avatar || p1Name[0].toUpperCase() : p2Avatar || p2Name[0].toUpperCase()}
                  </text>
                  {isJustClaimed && <BoxParticles x={c * 60 + 40} y={r * 60 + 40} color={color.hex} />}
                </g>
              );
            })
          )}

          {/* Dots */}
          {Array.from({ length: rows + 1 }).map((_, r) =>
            Array.from({ length: cols + 1 }).map((_, c) => (
              <circle key={`d-${r}-${c}`} cx={c * 60 + 10} cy={r * 60 + 10} r={4} fill="var(--ink)" />
            ))
          )}

          {/* Lines */}
          {Array.from({ length: rows + 1 }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const owner = game.hLines[`${r},${c}`];
              const color = owner ? (owner === 'p1' ? PLAYER_COLORS[0].hex : PLAYER_COLORS[1].hex) : 'transparent';
              const lineStyle = owner ? (owner === 'p1' ? p1LineStyle : p2LineStyle) : null;
              return (
                <g key={`h-${r}-${c}`} onClick={() => !owner && handleMove('h', r, c)} className={!owner && !finished ? 'cursor-pointer group' : ''}>
                  <rect x={c * 60 + 14} y={r * 60 - 4 + 10} width={52} height={16} fill="transparent" />
                  <line
                    x1={c * 60 + 10} y1={r * 60 + 10}
                    x2={(c + 1) * 60 + 10} y2={r * 60 + 10}
                    stroke={color} strokeWidth={owner ? 6 : 4} strokeLinecap="round"
                    filter={owner && lineStyle !== 'solid' ? `url(#style-${lineStyle})` : undefined}
                    className={owner ? 'line-drawn-h' : (!finished ? 'stroke-black/10 dark:stroke-white/10 opacity-0 group-hover:opacity-100 transition-opacity' : '')}
                  />
                </g>
              );
            })
          )}

          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols + 1 }).map((_, c) => {
              const owner = game.vLines[`${r},${c}`];
              const color = owner ? (owner === 'p1' ? PLAYER_COLORS[0].hex : PLAYER_COLORS[1].hex) : 'transparent';
              const lineStyle = owner ? (owner === 'p1' ? p1LineStyle : p2LineStyle) : null;
              return (
                <g key={`v-${r}-${c}`} onClick={() => !owner && handleMove('v', r, c)} className={!owner && !finished ? 'cursor-pointer group' : ''}>
                  <rect x={c * 60 - 4 + 10} y={r * 60 + 14} width={16} height={52} fill="transparent" />
                  <line
                    x1={c * 60 + 10} y1={r * 60 + 10}
                    x2={c * 60 + 10} y2={(r + 1) * 60 + 10}
                    stroke={color} strokeWidth={owner ? 6 : 4} strokeLinecap="round"
                    filter={owner && lineStyle !== 'solid' ? `url(#style-${lineStyle})` : undefined}
                    className={owner ? 'line-drawn-v' : (!finished ? 'stroke-black/10 dark:stroke-white/10 opacity-0 group-hover:opacity-100 transition-opacity' : '')}
                  />
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Finished State */}
      {finished && (
        <div className="card text-center max-w-sm mx-auto space-y-6 fade-up">
          <div>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--ochre)' }} />
            <h2 className="font-display text-3xl mb-1">{isDraw ? 'Draw!' : `${winnerName} Wins!`}</h2>
            <p className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Match Over</p>
          </div>
          <div className="flex gap-3 justify-center">
             <button onClick={() => { setGame(createEmptyGame(rows, cols, ['p1', 'p2'])); }} className="btn-primary">
               <RotateCcw size={14} /> Play Again
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
