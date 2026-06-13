import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Settings, Sparkles, Trophy, Zap } from 'lucide-react';

const SIZE = 46;
const EMPTY = -1;
const TRAIL = -2;
const STORAGE_KEY = 'axiom-paper-io-best';

const DIFFICULTY = {
  easy: { bots: 5, tickMs: 155, drift: 0.12 },
  normal: { bots: 8, tickMs: 125, drift: 0.18 },
  hard: { bots: 12, tickMs: 100, drift: 0.24 },
  insane: { bots: 16, tickMs: 82, drift: 0.31 },
};

const PALETTE = {
  player: '#35d399',
  trail: '#f8d35c',
  bot: ['#e25c7a', '#7dd3fc', '#c084fc', '#f97316', '#a3e635', '#fb7185'],
  bg: '#09111f',
  line: 'rgba(255,255,255,0.08)',
};

function indexOf(x, y) {
  return y * SIZE + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readBest() {
  try { return Number(window.localStorage.getItem(STORAGE_KEY) || 0); }
  catch { return 0; }
}

function saveBest(value) {
  try { window.localStorage.setItem(STORAGE_KEY, String(value)); }
  catch {}
}

function fillRect(grid, owner, x1, y1, x2, y2) {
  for (let y = clamp(y1, 0, SIZE - 1); y <= clamp(y2, 0, SIZE - 1); y++) {
    for (let x = clamp(x1, 0, SIZE - 1); x <= clamp(x2, 0, SIZE - 1); x++) {
      grid[indexOf(x, y)] = owner;
    }
  }
}

function countOwner(grid, owner) {
  let count = 0;
  for (const cell of grid) if (cell === owner) count++;
  return count;
}

function createGame(settings) {
  const config = DIFFICULTY[settings.difficulty];
  const grid = new Array(SIZE * SIZE).fill(EMPTY);
  fillRect(grid, 0, 4, 19, 10, 25);

  const bots = Array.from({ length: config.bots }, (_, i) => {
    const side = i % 4;
    const x = side === 0 ? 34 : side === 1 ? 32 : 12 + (i * 5) % 24;
    const y = side === 2 ? 10 : side === 3 ? 35 : 8 + (i * 7) % 28;
    fillRect(grid, i + 1, x - 1, y - 1, x + 1, y + 1);
    return {
      id: i + 1,
      x,
      y,
      dx: side === 1 ? -1 : 1,
      dy: side === 2 ? 1 : 0,
      color: PALETTE.bot[i % PALETTE.bot.length],
    };
  });

  return {
    grid,
    player: { x: 7, y: 22, dx: 1, dy: 0, nextDx: 1, nextDy: 0, trail: [] },
    bots,
    captured: 0,
    startedAt: Date.now(),
    overReason: '',
    settings,
  };
}

function turnBot(bot, drift) {
  if (Math.random() > drift) return;
  const turns = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ].filter(dir => !(dir.dx === -bot.dx && dir.dy === -bot.dy));
  const pick = turns[Math.floor(Math.random() * turns.length)];
  bot.dx = pick.dx;
  bot.dy = pick.dy;
}

function closeLoop(game) {
  const { grid, player } = game;
  if (!player.trail.length) return 0;
  let minX = player.x;
  let maxX = player.x;
  let minY = player.y;
  let maxY = player.y;

  for (const cell of player.trail) {
    const x = cell % SIZE;
    const y = Math.floor(cell / SIZE);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    grid[cell] = 0;
  }

  let gained = 0;
  for (let y = clamp(minY, 0, SIZE - 1); y <= clamp(maxY, 0, SIZE - 1); y++) {
    for (let x = clamp(minX, 0, SIZE - 1); x <= clamp(maxX, 0, SIZE - 1); x++) {
      const idx = indexOf(x, y);
      if (grid[idx] !== 0) {
        grid[idx] = 0;
        gained++;
      }
    }
  }
  player.trail = [];
  game.captured += gained;
  return gained;
}

function stepGame(game) {
  const config = DIFFICULTY[game.settings.difficulty];
  const { grid, player } = game;

  if (!(player.nextDx === -player.dx && player.nextDy === -player.dy)) {
    player.dx = player.nextDx;
    player.dy = player.nextDy;
  }

  const nx = player.x + player.dx;
  const ny = player.y + player.dy;
  if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) {
    game.overReason = 'You ran into the edge of the arena.';
    return false;
  }

  const nextIdx = indexOf(nx, ny);
  if (grid[nextIdx] === TRAIL) {
    game.overReason = 'You crossed your own trail.';
    return false;
  }

  player.x = nx;
  player.y = ny;

  const currentOwner = grid[nextIdx];
  if (currentOwner === 0) {
    closeLoop(game);
  } else {
    grid[nextIdx] = TRAIL;
    player.trail.push(nextIdx);
  }

  for (const bot of game.bots) {
    turnBot(bot, config.drift);
    let bx = bot.x + bot.dx;
    let by = bot.y + bot.dy;
    if (bx <= 0 || bx >= SIZE - 1) {
      bot.dx *= -1;
      bx = bot.x + bot.dx;
    }
    if (by <= 0 || by >= SIZE - 1) {
      bot.dy *= -1;
      by = bot.y + bot.dy;
    }
    bot.x = bx;
    bot.y = by;
    const botIdx = indexOf(bot.x, bot.y);
    if (botIdx === indexOf(player.x, player.y) || grid[botIdx] === TRAIL) {
      game.overReason = 'A bot cut your trail.';
      return false;
    }
    if (grid[botIdx] === EMPTY) grid[botIdx] = bot.id;
  }

  return true;
}

function drawGame(canvas, game) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * ratio));
  const height = Math.max(320, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const cell = Math.min(width, height) / SIZE;
  const ox = (width - cell * SIZE) / 2;
  const oy = (height - cell * SIZE) / 2;
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const owner = game.grid[indexOf(x, y)];
      if (owner === EMPTY) continue;
      if (owner === TRAIL) ctx.fillStyle = PALETTE.trail;
      else if (owner === 0) ctx.fillStyle = PALETTE.player;
      else ctx.fillStyle = game.bots[(owner - 1) % game.bots.length]?.color || '#888';
      ctx.globalAlpha = owner === TRAIL ? 0.95 : 0.46;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  for (let i = 0; i <= SIZE; i += 2) {
    ctx.beginPath();
    ctx.moveTo(ox + i * cell, oy);
    ctx.lineTo(ox + i * cell, oy + SIZE * cell);
    ctx.moveTo(ox, oy + i * cell);
    ctx.lineTo(ox + SIZE * cell, oy + i * cell);
    ctx.stroke();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(ox + (game.player.x + 0.5) * cell, oy + (game.player.y + 0.5) * cell, cell * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(ox + (game.player.x + 0.5) * cell, oy + (game.player.y + 0.5) * cell, cell * 0.34, 0, Math.PI * 2);
  ctx.fill();

  for (const bot of game.bots) {
    ctx.fillStyle = bot.color;
    ctx.beginPath();
    ctx.arc(ox + (bot.x + 0.5) * cell, oy + (bot.y + 0.5) * cell, cell * 0.46, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeHud(game) {
  const playerCells = countOwner(game.grid, 0);
  const botAreas = game.bots.map(bot => countOwner(game.grid, bot.id));
  const rank = 1 + botAreas.filter(area => area > playerCells).length;
  const pct = (playerCells / (SIZE * SIZE)) * 100;
  return {
    territory: pct,
    captured: game.captured,
    rank,
    exposure: game.player.trail.length ? 'Exposed' : 'Safe',
    best: Math.max(readBest(), pct),
  };
}

export default function PaperIo() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const lastFrameRef = useRef(0);
  const tickRef = useRef(0);
  const [screen, setScreen] = useState('menu');
  const [settings, setSettings] = useState({ version: '2', mode: 'classic', difficulty: 'normal' });
  const [hud, setHud] = useState({ territory: 0, captured: 0, rank: '-', exposure: 'Safe', best: readBest() });
  const [reason, setReason] = useState('');

  const start = useCallback(() => {
    const game = createGame(settings);
    gameRef.current = game;
    tickRef.current = 0;
    lastFrameRef.current = 0;
    setHud(makeHud(game));
    setReason('');
    setScreen('playing');
  }, [settings]);

  const stopRun = useCallback((game) => {
    const finalHud = makeHud(game);
    if (finalHud.territory > readBest()) saveBest(finalHud.territory);
    setHud(finalHud);
    setReason(game.overReason || 'Your run ended.');
    setScreen('over');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const game = gameRef.current;
      if (!game) return;
      const key = e.key.toLowerCase();
      if (key === ' ' && screen === 'playing') {
        e.preventDefault();
        setScreen('paused');
        return;
      }
      if (screen !== 'playing') return;
      const dir = key === 'arrowup' || key === 'w' ? { dx: 0, dy: -1 }
        : key === 'arrowdown' || key === 's' ? { dx: 0, dy: 1 }
        : key === 'arrowleft' || key === 'a' ? { dx: -1, dy: 0 }
        : key === 'arrowright' || key === 'd' ? { dx: 1, dy: 0 }
        : null;
      if (dir) {
        e.preventDefault();
        game.player.nextDx = dir.dx;
        game.player.nextDy = dir.dy;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  useEffect(() => {
    let raf = 0;
    const loop = (time) => {
      const canvas = canvasRef.current;
      const game = gameRef.current;
      if (canvas && game) drawGame(canvas, game);
      if (screen === 'playing' && game) {
        const diff = DIFFICULTY[game.settings.difficulty];
        const elapsed = lastFrameRef.current ? Math.min(time - lastFrameRef.current, 200) : 0;
        tickRef.current += elapsed;
        while (tickRef.current >= diff.tickMs) {
          tickRef.current -= diff.tickMs;
          if (!stepGame(game)) {
            stopRun(game);
            break;
          }
        }
        setHud(makeHud(game));
      }
      lastFrameRef.current = time;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, stopRun]);

  const awards = useMemo(() => [
    { name: 'First Claim', done: hud.captured > 0 },
    { name: 'Ten Percent', done: hud.territory >= 10 },
    { name: 'Top Three', done: Number(hud.rank) <= 3 },
  ], [hud]);

  return (
    <div className="fade-in space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="border hairline overflow-hidden" style={{ background: '#09111f' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-white">
            <div>
              <div className="font-display text-2xl leading-tight">Paper.io</div>
              <div className="font-mono text-[0.65rem] tracking-widest uppercase text-white/50">Territory arcade</div>
            </div>
            <div className="flex gap-2">
              {screen === 'playing' && (
                <button onClick={() => setScreen('paused')} className="btn-ghost text-white border-white/20">
                  <Pause size={14} /> Pause
                </button>
              )}
              {screen === 'paused' && (
                <button onClick={() => setScreen('playing')} className="btn-primary">
                  <Play size={14} /> Resume
                </button>
              )}
              {screen !== 'playing' && <button onClick={start} className="btn-primary"><Play size={14} /> Play</button>}
            </div>
          </div>
          <div className="relative aspect-square max-h-[680px] mx-auto">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-label="Paper.io arena" />
            {screen === 'menu' && <Overlay title="Paper.io" body="Choose a version, pick a difficulty, then claim as much territory as you can." />}
            {screen === 'paused' && <Overlay title="Paused" body="Resume when you are ready. Your run is kept in this tab." />}
            {screen === 'over' && <Overlay title="Game over" body={reason} />}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Territory" value={`${hud.territory.toFixed(2)}%`} />
            <Stat label="Captured" value={hud.captured} />
            <Stat label="Rank" value={`#${hud.rank}`} />
            <Stat label="Exposure" value={hud.exposure} />
          </div>
          <div id="custom" className="card space-y-4">
            <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase opacity-60">
              <Settings size={13} /> Setup
            </div>
            <Segment label="Version" value={settings.version} onChange={version => setSettings(s => ({ ...s, version }))} options={[['1', 'Classic'], ['2', 'Paper.io 2']]} />
            <Segment label="Mode" value={settings.mode} onChange={mode => setSettings(s => ({ ...s, mode }))} options={[['classic', 'Classic'], ['custom', 'Custom']]} />
            <Segment label="Difficulty" value={settings.difficulty} onChange={difficulty => setSettings(s => ({ ...s, difficulty }))} options={Object.keys(DIFFICULTY).map(key => [key, key])} />
          </div>
          <div id="stats" className="card">
            <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-3">
              <Trophy size={13} /> Stats
            </div>
            <Stat label="Best territory" value={`${hud.best.toFixed(2)}%`} flat />
            <Stat label="Current difficulty" value={settings.difficulty} flat />
          </div>
          <div id="ach" className="card">
            <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-3">
              <Sparkles size={13} /> Awards
            </div>
            <div className="space-y-2">
              {awards.map(award => (
                <div key={award.name} className="flex items-center justify-between border hairline px-3 py-2">
                  <span className="font-display text-base">{award.name}</span>
                  <span className="font-mono text-[0.58rem] tracking-widest uppercase" style={{ color: award.done ? 'var(--forest)' : 'var(--ink)', opacity: award.done ? 1 : 0.35 }}>
                    {award.done ? 'Done' : 'Locked'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={start} className="btn-primary w-full"><RotateCcw size={14} /> New Run</button>
        </aside>
      </section>
      <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-45 text-center">
        Move with WASD or arrow keys. Close a loop by returning to your territory.
      </div>
    </div>
  );
}

function Overlay({ title, body }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white p-6 text-center">
      <div>
        <div className="font-display text-5xl leading-none mb-3">{title}</div>
        <p className="font-display text-xl opacity-75 max-w-md">{body}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, flat = false }) {
  return (
    <div className={flat ? 'flex items-center justify-between py-2 border-b hairline last:border-b-0' : 'border hairline p-4'}>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">{label}</div>
      <div className="font-display text-2xl font-medium tabular-nums capitalize">{value}</div>
    </div>
  );
}

function Segment({ label, value, onChange, options }) {
  return (
    <div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-2">{label}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="font-mono text-[0.58rem] tracking-widest uppercase px-2 py-2 border hairline focus-ring capitalize"
            style={{ background: value === id ? 'var(--ink)' : 'transparent', color: value === id ? 'var(--paper)' : 'var(--ink)' }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
