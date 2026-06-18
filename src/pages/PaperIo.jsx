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

function indexOf(x, y, size = SIZE) {
  return y * size + x;
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

function fillRect(grid, owner, x1, y1, x2, y2, size = SIZE) {
  for (let y = clamp(y1, 0, size - 1); y <= clamp(y2, 0, size - 1); y++) {
    for (let x = clamp(x1, 0, size - 1); x <= clamp(x2, 0, size - 1); x++) {
      grid[indexOf(x, y, size)] = owner;
    }
  }
}

function countOwner(grid, owner) {
  let count = 0;
  for (const cell of grid) if (cell === owner) count++;
  return count;
}

function createGame(settings) {
  const isCustom = settings.mode === 'custom';
  const difficultyConfig = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
  const customBots = isCustom ? Number(settings.customBots) : difficultyConfig.bots;
  const customSize = isCustom ? Number(settings.customSize) : SIZE;

  const grid = new Array(customSize * customSize).fill(EMPTY);
  const midX = Math.floor(customSize / 2);
  const midY = Math.floor(customSize / 2);
  fillRect(grid, 0, midX - 3, midY - 3, midX + 3, midY + 3, customSize);

  const bots = Array.from({ length: customBots }, (_, i) => {
    const side = i % 4;
    // Spread bots out roughly based on the customSize
    const x = Math.floor(secureRandom() * (customSize - 10)) + 5;
    const y = Math.floor(secureRandom() * (customSize - 10)) + 5;
    fillRect(grid, i + 1, x - 1, y - 1, x + 1, y + 1, customSize);
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
    player: { x: midX, y: midY, dx: 1, dy: 0, nextDx: 1, nextDy: 0, trail: [] },
    bots,
    captured: 0,
    startedAt: Date.now(),
    overReason: '',
    settings,
    size: customSize
  };
}

function turnBot(bot, drift, game) {
  if ((crypto.getRandomValues(new Uint32Array(1))[0] % 100) / 100 > drift) return;
  const turns = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ].filter(dir => !(dir.dx === -bot.dx && dir.dy === -bot.dy));

  // Smarter Bot logic: Assign weights to directions
  let bestTurns = [];
  let bestScore = -Infinity;

  for (const turn of turns) {
    const nx = bot.x + turn.dx;
    const ny = bot.y + turn.dy;

    // Default low weight
    let score = 0;

    const customSize = game.size || SIZE;

    if (nx <= 0 || nx >= customSize - 1 || ny <= 0 || ny >= customSize - 1) {
      score = -100; // Penalize moving out of bounds
    } else {
      const idx = indexOf(nx, ny, customSize);
      const cellOwner = game.grid[idx];

      if (cellOwner === bot.id) {
        score = -10; // Avoid staying inside their own captured territory unnecessarily
      } else if (cellOwner === TRAIL) {
        score = 50;  // High value to hunting enemy trail
      } else if (cellOwner === EMPTY) {
        score = 20;  // Medium value for capturing empty space
      } else if (cellOwner === 0) {
        score = 10;  // Okay value for attacking player's territory
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTurns = [turn];
    } else if (score === bestScore) {
      bestTurns.push(turn);
    }
  }

  const pick = bestTurns[Math.floor(secureRandom() * bestTurns.length)];
  bot.dx = pick.dx;
  bot.dy = pick.dy;
}

function closeLoop(game) {
  const customSize = game.size || SIZE;
  const { grid, player } = game;
  if (!player.trail.length) return 0;
  let minX = player.x;
  let maxX = player.x;
  let minY = player.y;
  let maxY = player.y;

  for (const cell of player.trail) {
    const x = cell % customSize;
    const y = Math.floor(cell / customSize);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    grid[cell] = 0;
  }

  let gained = 0;
  for (let y = clamp(minY, 0, customSize - 1); y <= clamp(maxY, 0, customSize - 1); y++) {
    for (let x = clamp(minX, 0, customSize - 1); x <= clamp(maxX, 0, customSize - 1); x++) {
      const idx = indexOf(x, y, customSize);
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
  const customSize = game.size || SIZE;
  const { grid, player } = game;

  if (!(player.nextDx === -player.dx && player.nextDy === -player.dy)) {
    player.dx = player.nextDx;
    player.dy = player.nextDy;
  }

  const nx = player.x + player.dx;
  const ny = player.y + player.dy;
  if (nx < 0 || nx >= customSize || ny < 0 || ny >= customSize) {
    game.overReason = 'You ran into the edge of the arena.';
    return false;
  }

  const nextIdx = indexOf(nx, ny, customSize);
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
    turnBot(bot, config.drift, game);
    let bx = bot.x + bot.dx;
    let by = bot.y + bot.dy;
    if (bx <= 0 || bx >= customSize - 1) {
      bot.dx *= -1;
      bx = bot.x + bot.dx;
    }
    if (by <= 0 || by >= customSize - 1) {
      bot.dy *= -1;
      by = bot.y + bot.dy;
    }
    bot.x = bx;
    bot.y = by;
    const botIdx = indexOf(bot.x, bot.y, customSize);
    if (botIdx === indexOf(player.x, player.y, customSize) || grid[botIdx] === TRAIL) {
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

  const customSize = game.size || SIZE;

  // Base scale on a standard 46-cell size so the player remains the same physical size,
  // even if the grid is massive (like 150x150).
  const cell = Math.min(width, height) / Math.min(customSize, 46);

  // Center the camera on the player
  const ox = (width / 2) - ((game.player.x + 0.5) * cell);
  const oy = (height / 2) - ((game.player.y + 0.5) * cell);

  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);

  // Calculate visible bounds to optimize rendering
  const minVisX = Math.max(0, Math.floor(-ox / cell));
  const minVisY = Math.max(0, Math.floor(-oy / cell));
  const maxVisX = Math.min(customSize, Math.ceil((width - ox) / cell));
  const maxVisY = Math.min(customSize, Math.ceil((height - oy) / cell));

  for (let y = minVisY; y < maxVisY; y++) {
    for (let x = minVisX; x < maxVisX; x++) {
      const owner = game.grid[indexOf(x, y, customSize)];
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

  for (let i = (minVisX % 2 === 0 ? minVisX : minVisX - 1); i <= maxVisX; i += 2) {
      if (i >= 0 && i <= customSize) {
        ctx.beginPath();
        ctx.moveTo(ox + i * cell, oy + minVisY * cell);
        ctx.lineTo(ox + i * cell, oy + maxVisY * cell);
        ctx.stroke();
      }
  }

  for (let i = (minVisY % 2 === 0 ? minVisY : minVisY - 1); i <= maxVisY; i += 2) {
      if (i >= 0 && i <= customSize) {
        ctx.beginPath();
        ctx.moveTo(ox + minVisX * cell, oy + i * cell);
        ctx.lineTo(ox + maxVisX * cell, oy + i * cell);
        ctx.stroke();
      }
  }

  // Draw Arena Bounds
  ctx.strokeStyle = 'rgba(255,50,50,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(ox, oy, customSize * cell, customSize * cell);

  // Draw Player
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(ox + (game.player.x + 0.5) * cell, oy + (game.player.y + 0.5) * cell, cell * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(ox + (game.player.x + 0.5) * cell, oy + (game.player.y + 0.5) * cell, cell * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Draw Bots
  for (const bot of game.bots) {
    if (bot.x >= minVisX - 1 && bot.x <= maxVisX + 1 && bot.y >= minVisY - 1 && bot.y <= maxVisY + 1) {
      ctx.fillStyle = bot.color;
      ctx.beginPath();
      ctx.arc(ox + (bot.x + 0.5) * cell, oy + (bot.y + 0.5) * cell, cell * 0.46, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function makeHud(game) {
  const customSize = game.size || SIZE;

  let maxId = 0;
  for (let i = 0; i < game.bots.length; i++) {
    if (game.bots[i].id > maxId) maxId = game.bots[i].id;
  }

  const counts = new Array(maxId + 1).fill(0);
  for (let i = 0; i < game.grid.length; i++) {
    const cell = game.grid[i];
    if (cell >= 0 && cell <= maxId) {
      counts[cell]++;
    }
  }

  const playerCells = counts[0];
  let rank = 1;
  for (let i = 0; i < game.bots.length; i++) {
    if (counts[game.bots[i].id] > playerCells) rank++;
  }

  const pct = (playerCells / (customSize * customSize)) * 100;
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
  const [settings, setSettings] = useState({ version: '2', mode: 'classic', difficulty: 'normal', customSize: 46, customBots: 8, customSpeed: 125 });
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

    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const onTouchEnd = (e) => {
      const game = gameRef.current;
      if (!game || screen !== 'playing') return;

      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
          game.player.nextDx = dx > 0 ? 1 : -1;
          game.player.nextDy = 0;
        }
      } else {
        if (Math.abs(dy) > 30) {
          game.player.nextDx = 0;
          game.player.nextDy = dy > 0 ? 1 : -1;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [screen]);

  useEffect(() => {
    let raf = 0;
    const loop = (time) => {
      const canvas = canvasRef.current;
      const game = gameRef.current;
      if (canvas && game) drawGame(canvas, game);
      if (screen === 'playing' && game) {
        const diffMs = game.settings.mode === 'custom' ? Number(game.settings.customSpeed) : DIFFICULTY[game.settings.difficulty].tickMs;
        const elapsed = lastFrameRef.current ? Math.min(time - lastFrameRef.current, 200) : 0;
        tickRef.current += elapsed;
        while (tickRef.current >= diffMs) {
          tickRef.current -= diffMs;
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
            {screen === 'menu' && <Overlay title="Paper.io" body="Choose a version, pick a difficulty, then claim as much territory as you can." action={<button onClick={start} className="btn-primary w-full max-w-[200px] mt-6"><Play size={14} /> Start Game</button>} />}
            {screen === 'paused' && <Overlay title="Paused" body="Resume when you are ready. Your run is kept in this tab." action={<button onClick={() => setScreen('playing')} className="btn-primary w-full max-w-[200px] mt-6"><Play size={14} /> Resume</button>} />}
            {screen === 'over' && <Overlay title="Game over" body={reason} action={<button onClick={start} className="btn-primary w-full max-w-[200px] mt-6"><RotateCcw size={14} /> Play Again</button>} />}
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
            {settings.mode === 'custom' && (
              <>
                <div>
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-2">Map Size ({settings.customSize}x{settings.customSize})</div>
                  <input type="range" min="20" max="150" value={settings.customSize} onChange={e => setSettings(s => ({ ...s, customSize: Number(e.target.value) }))} className="w-full accent-[var(--ink)]" />
                </div>
                <div>
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-2">Bot Count ({settings.customBots})</div>
                  <input type="range" min="0" max="40" value={settings.customBots} onChange={e => setSettings(s => ({ ...s, customBots: Number(e.target.value) }))} className="w-full accent-[var(--ink)]" />
                </div>
                <div>
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-2">Game Speed ({settings.customSpeed}ms)</div>
                  <input type="range" min="20" max="300" value={settings.customSpeed} onChange={e => setSettings(s => ({ ...s, customSpeed: Number(e.target.value) }))} className="w-full accent-[var(--ink)]" />
                </div>
              </>
            )}
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

function Overlay({ title, body, action }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white p-6 text-center">
      <div className="flex flex-col items-center">
        <div className="font-display text-5xl leading-none mb-3">{title}</div>
        <p className="font-display text-xl opacity-75 max-w-md">{body}</p>
        {action}
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
