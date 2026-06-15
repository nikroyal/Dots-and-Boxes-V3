// Pure game logic — no Firebase, no React. Used by both client rendering
// and Firestore transactions.

// Player colors. Each entry has light- and dark-theme variants. The
// CSS `--theme` media-query trick doesn't work inside SVG inline styles
// (which is most of where colors are used), so we provide a `forTheme()`
// helper that resolves at render time from the active document theme.
//
// Both variants are calibrated to maintain ~4.5:1 contrast against their
// theme's --paper background, so box-owner initials and drawn lines are
// readable in both light and dark themes.
const PLAYER_COLORS_LIGHT = [
  { name: 'Ink',     hex: '#1A1A1A', soft: 'rgba(26,26,26,0.08)' },
  { name: 'Crimson', hex: '#B91C3C', soft: 'rgba(185,28,60,0.08)' },
  { name: 'Ochre',   hex: '#B7791F', soft: 'rgba(183,121,31,0.10)' },
  { name: 'Forest',  hex: '#2F6B3F', soft: 'rgba(47,107,63,0.10)' },
];
const PLAYER_COLORS_DARK = [
  // In dark theme, Ink #1A1A1A is invisible. Use the light off-white
  // tone (matching --ink in [data-theme='dark']) for player 1.
  { name: 'Ink',     hex: '#ECECE8', soft: 'rgba(236,236,232,0.12)' },
  { name: 'Crimson', hex: '#E25C7A', soft: 'rgba(226,92,122,0.14)' },
  { name: 'Ochre',   hex: '#D9A85A', soft: 'rgba(217,168,90,0.14)' },
  { name: 'Forest',  hex: '#6FB87E', soft: 'rgba(111,184,126,0.14)' },
];

function currentTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') || 'light';
}

// PLAYER_COLORS is a getter-style export: callers do `PLAYER_COLORS[i].hex`
// so we wrap an array of getter objects. Tracking theme transitions in
// pure-data form keeps the call sites identical.
export const PLAYER_COLORS = [0, 1, 2, 3].map(i => ({
  get name() { return PLAYER_COLORS_LIGHT[i].name; },
  get hex()  { return (currentTheme() === 'dark' ? PLAYER_COLORS_DARK : PLAYER_COLORS_LIGHT)[i].hex; },
  get soft() { return (currentTheme() === 'dark' ? PLAYER_COLORS_DARK : PLAYER_COLORS_LIGHT)[i].soft; },
}));

export function createEmptyGame(rows, cols, playerIds) {
  return {
    rows, cols,
    // Use flat objects keyed by "r,c" so Firestore can store them
    // (nested arrays of arrays are awkward in Firestore).
    hLines: {}, // "r,c" -> playerId
    vLines: {}, // "r,c" -> playerId
    boxes:  {}, // "r,c" -> playerId
    currentPlayerIdx: 0,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    moveCount: 0,
    moves: [], // for replay: { type:'h'|'v', r, c, by, ts }
  };
}

export const hKey = (r, c) => `${r},${c}`;
export const vKey = (r, c) => `${r},${c}`;
export const bKey = (r, c) => `${r},${c}`;

export function checkBoxComplete(game, r, c) {
  return game.hLines[hKey(r, c)]     != null
      && game.hLines[hKey(r + 1, c)] != null
      && game.vLines[vKey(r, c)]     != null
      && game.vLines[vKey(r, c + 1)] != null;
}

// Apply a move and return { newGame, claimed, finished, winnerIdx }
export function applyMove(game, orientation, r, c, playerId, playerIds) {
  // Targeted shallow clone — much faster than JSON.parse(JSON.stringify(...)).
  // Only mutate-target fields are copied; rows/cols/etc. don't change so we
  // share references for them.
  const newGame = {
    rows: game.rows,
    cols: game.cols,
    hLines: { ...game.hLines },
    vLines: { ...game.vLines },
    boxes: { ...game.boxes },
    currentPlayerIdx: game.currentPlayerIdx,
    scores: { ...game.scores },
    moveCount: game.moveCount,
    moves: [...game.moves],
  };

  if (orientation === 'h') {
    if (r < 0 || r > newGame.rows || c < 0 || c >= newGame.cols)
      return { error: 'invalid-coords' };
    if (newGame.hLines[hKey(r, c)] != null)
      return { error: 'already-played' };
    newGame.hLines[hKey(r, c)] = playerId;
  } else if (orientation === 'v') {
    if (r < 0 || r >= newGame.rows || c < 0 || c > newGame.cols)
      return { error: 'invalid-coords' };
    if (newGame.vLines[vKey(r, c)] != null)
      return { error: 'already-played' };
    newGame.vLines[vKey(r, c)] = playerId;
  } else {
    return { error: 'invalid-orientation' };
  }

  // Check box completion
  let claimed = 0;
  let claimedBoxes = [];
  if (orientation === 'h') {
    if (r > 0           && checkBoxComplete(newGame, r - 1, c)) { newGame.boxes[bKey(r - 1, c)] = playerId; claimed++; claimedBoxes.push({r: r - 1, c}); }
    if (r < newGame.rows && checkBoxComplete(newGame, r,     c)) { newGame.boxes[bKey(r, c)]     = playerId; claimed++; claimedBoxes.push({r, c}); }
  } else {
    if (c > 0           && checkBoxComplete(newGame, r, c - 1)) { newGame.boxes[bKey(r, c - 1)] = playerId; claimed++; claimedBoxes.push({r, c: c - 1}); }
    if (c < newGame.cols && checkBoxComplete(newGame, r, c))     { newGame.boxes[bKey(r, c)]     = playerId; claimed++; claimedBoxes.push({r, c}); }
  }

  newGame.scores[playerId] = (newGame.scores[playerId] || 0) + claimed;
  newGame.moveCount++;
  newGame.moves.push({ type: orientation, r, c, by: playerId, claimed, claimedBoxes, ts: Date.now() });

  // Advance turn unless they claimed a box (extra turn rule)
  if (claimed === 0) {
    newGame.currentPlayerIdx = (newGame.currentPlayerIdx + 1) % playerIds.length;
  }

  // Check finish
  const totalBoxes = newGame.rows * newGame.cols;
  const totalClaimed = Object.values(newGame.scores).reduce((a, b) => a + b, 0);
  let finished = false;
  let winnerIdx = null;
  if (totalClaimed >= totalBoxes) {
    finished = true;
    let max = -1;
    let tied = false;
    playerIds.forEach((id, idx) => {
      if (newGame.scores[id] > max) { max = newGame.scores[id]; winnerIdx = idx; tied = false; }
      else if (newGame.scores[id] === max) { tied = true; }
    });
    if (tied) winnerIdx = -1; // draw
  }

  return { newGame, claimed, finished, winnerIdx };
}

// ELO calculation (simple two-player version)
// K-factor = 32 (standard for casual)
// Defensive against bad data: any non-finite input gets replaced with the
// default 1000, and outputs are clamped to a sane range (100..3500) so a
// corrupt rating can't propagate or, worse, write NaN to Firestore (which
// would reject the entire profile write and silently lose stats).
export function computeElo(ratingA, ratingB, scoreA) {
  const A = Number.isFinite(ratingA) ? ratingA : 1000;
  const B = Number.isFinite(ratingB) ? ratingB : 1000;
  const s = Number.isFinite(scoreA) ? scoreA : 0.5;
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (B - A) / 400));
  const expectedB = 1 - expectedA;
  const clamp = (n) => Math.max(100, Math.min(3500, Math.round(n)));
  const newA = clamp(A + K * (s - expectedA));
  const newB = clamp(B + K * ((1 - s) - expectedB));
  return { newA, newB, deltaA: newA - A, deltaB: newB - B };
}
