export const EXPERIENCE_CATALOG = [
  {
    id: 'dots-and-boxes',
    name: 'Dots & Boxes',
    shortName: 'Dots',
    path: '/dots-and-boxes',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--forest)',
    description: 'The original online board game with lobbies, ranked play, replays, achievements, and local matches.',
    features: ['Online lobby', 'Local play', 'ELO ranks', 'Replays'],
    navItems: [
      { to: '/dots-and-boxes', label: 'Home' },
      { to: '/lobby', label: 'Lobby' },
      { to: '/local', label: 'Local' },
      { to: '/leaderboard', label: 'Ranks' },
      { to: '/history', label: 'History' },
      { to: '/achievements', label: 'Awards' },
    ],
    routePrefixes: [
      '/dots-and-boxes',
      '/lobby',
      '/local',
      '/match',
      '/leaderboard',
      '/history',
      '/replay',
      '/achievements',
    ],
  },
  {
    id: 'connect4',
    name: 'Connect 4',
    shortName: 'Connect 4',
    path: '/connect4',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--crimson)',
    description: 'Classic 4-in-a-row with custom colors. Play online or locally.',
    features: ['Online lobby', 'Local play', 'Custom colors'],
    navItems: [
      { to: '/connect4', label: 'Home' },
      { to: '/connect4/local', label: 'Local' },
    ],
    routePrefixes: [
      '/connect4',
    ],
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    shortName: 'Tic-Tac-Toe',
    path: '/tictactoe',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--ochre)',
    description: 'Classic 3x3 Tic-Tac-Toe. Play online or locally.',
    features: ['Online lobby', 'Local play'],
    navItems: [
      { to: '/tictactoe', label: 'Home' },
      { to: '/tictactoe/local', label: 'Local' },
    ],
    routePrefixes: [
      '/tictactoe',
    ],
  },
  {
    id: 'chess',
    name: 'Chess',
    shortName: 'Chess',
    path: '/chess',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--ink)',
    description: 'Classic Chess. Play online or locally with board flipping.',
    features: ['Online lobby', 'Local play', 'Board flip'],
    navItems: [
      { to: '/chess', label: 'Home' },
      { to: '/chess/local', label: 'Local' },
    ],
    routePrefixes: [
      '/chess',
    ],
  },
  {
    id: 'paper-io',
    name: 'Paper.io',
    shortName: 'Paper.io',
    path: '/paper-io',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--crimson)',
    immersive: true,
    description: 'A native Axiom territory-control arcade run with bots, selectable modes, live stats, and local awards.',
    features: ['Live bots', 'Modes', 'Stats', 'Awards'],
    navItems: [
      { to: '/paper-io', label: 'Play' },
      { to: '/paper-io#custom', label: 'Modes' },
      { to: '/paper-io#stats', label: 'Stats' },
      { to: '/paper-io#ach', label: 'Awards' },
    ],
    routePrefixes: ['/paper-io'],
  },
  {
    id: 'battleships',
    name: 'Battleships',
    shortName: 'Battleships',
    path: '/battleships',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--forest)',
    description: 'Classic naval combat game. Strategically place your fleet and sink the enemy before they sink you.',
    features: ['Local play', 'Smart AI opponent'],
    navItems: [
      { to: '/battleships', label: 'Play' },
    ],
    routePrefixes: ['/battleships'],
  },
  {
    id: 'memory-match',
    name: 'Memory Match',
    shortName: 'Memory',
    path: '/memory-match',
    kind: 'Puzzle',
    status: 'Live',
    accent: 'var(--ochre)',
    description: 'A classic memory game. Flip cards to find matching pairs.',
    features: ['Local play', 'Move tracking'],
    navItems: [
      { to: '/memory-match', label: 'Play' },
    ],
    routePrefixes: ['/memory-match'],
  },
  {
    id: 'sequence-memory',
    name: 'Sequence Memory',
    shortName: 'Sequence',
    path: '/sequence-memory',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--crimson)',
    description: 'Test your memory. Remember the sequence of pads and repeat it back.',
    features: ['Local play', 'Best score'],
    navItems: [
      { to: '/sequence-memory', label: 'Play' },
    ],
    routePrefixes: ['/sequence-memory'],
  },
  {
    id: 'snake',
    name: 'Snake',
    shortName: 'Snake',
    path: '/snake',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--forest)',
    description: 'Classic Snake game. Eat food, grow longer, avoid walls and yourself.',
    features: ['Local play', 'High score'],
    navItems: [
      { to: '/snake', label: 'Play' },
    ],
    routePrefixes: ['/snake'],
  },
  {
    id: 'reaction-timer',
    name: 'Reaction Timer',
    shortName: 'Reaction',
    path: '/reaction-timer',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--crimson)',
    description: 'Test your reflexes. Click as fast as you can when the color changes.',
    features: ['Local play', 'Best times'],
    navItems: [
      { to: '/reaction-timer', label: 'Play' },
    ],
    routePrefixes: ['/reaction-timer'],
  },
  {
    id: 'whack-a-mole',
    name: 'Whack-A-Mole',
    shortName: 'Whack-A-Mole',
    path: '/whack-a-mole',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--ochre)',
    description: 'Whack the moles as quickly as you can before time runs out.',
    features: ['Local play', 'Best score'],
    navItems: [
      { to: '/whack-a-mole', label: 'Play' },
    ],
    routePrefixes: ['/whack-a-mole'],
  },
  {
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    shortName: 'RPS',
    path: '/rock-paper-scissors',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--forest)',
    description: 'Classic Rock Paper Scissors. Play against the computer and build your winning streak.',
    features: ['Local play', 'Winning streak'],
    navItems: [
      { to: '/rock-paper-scissors', label: 'Play' },
    ],
    routePrefixes: ['/rock-paper-scissors'],
  },
  {
    id: 'district-exchange',
    name: 'District Exchange',
    shortName: 'District',
    path: '/district-exchange',
    kind: 'Strategy',
    status: 'Live',
    accent: 'var(--forest)',
    description: 'Buy, trade, and upgrade districts. Bankrupt your opponents in this classic property trading experience with a modern twist.',
    features: ['Local match'],
    navItems: [
      { to: '/district-exchange', label: 'Home' },
      { to: '/district-exchange/local', label: 'Local' },
    ],
    routePrefixes: ['/district-exchange'],
  },
  {
    id: 'circuit-maker',
    name: 'Circuit Maker',
    shortName: 'Circuits',
    path: '/circuit-maker',
    kind: 'Builder',
    status: 'Live',
    accent: 'var(--ochre)',
    immersive: true,
    description: 'A native Axiom logic-circuit workspace with gates, switches, LEDs, saving, loading, samples, and PNG export.',
    features: ['Logic gates', 'Projects', 'Samples', 'PNG export'],
    navItems: [
      { to: '/circuit-maker', label: 'Builder' },
      { to: '/circuit-maker#palette', label: 'Palette' },
      { to: '/circuit-maker#sampleBtn', label: 'Sample' },
      { to: '/circuit-maker#projectList', label: 'Projects' },
      { to: '/circuit-maker#exportPng', label: 'Export' },
    ],
    routePrefixes: ['/circuit-maker'],
  },
  {
    id: 'guess-the-number',
    name: 'Guess the Number',
    shortName: 'Guess',
    path: '/guess-the-number',
    kind: 'Arcade',
    status: 'Live',
    accent: 'var(--ochre)',
    description: 'A classic guessing game. Guess the secret number in as few attempts as possible.',
    features: ['Local play', 'Best score'],
    navItems: [
      { to: '/guess-the-number', label: 'Play' },
    ],
    routePrefixes: ['/guess-the-number'],
  },
];

export const DEFAULT_EXPERIENCE = {
  id: 'axiom',
  name: 'Axiom',
  shortName: 'Axiom',
  path: '/',
  kind: 'Hub',
  status: 'Live',
  navItems: [
    { to: '/', label: 'Explore' },
  ],
  routePrefixes: ['/'],
};

export const SHARED_NAV_ITEMS = [
  { to: '/friends', label: 'Friends' },
  { to: '/messages', label: 'Msgs', badge: 'unread' },
  { to: '/clubs', label: 'Clubs' },
];

export function getExperienceById(id) {
  return EXPERIENCE_CATALOG.find(experience => experience.id === id);
}

export function findExperienceByPath(pathname) {
  return EXPERIENCE_CATALOG.find(experience => {
    const prefixes = experience.routePrefixes || [experience.path];
    return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }) || DEFAULT_EXPERIENCE;
}

export function isImmersivePath(pathname) {
  return !!EXPERIENCE_CATALOG.find(experience => {
    if (!experience.immersive) return false;
    const prefixes = experience.routePrefixes || [experience.path];
    return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  });
}
