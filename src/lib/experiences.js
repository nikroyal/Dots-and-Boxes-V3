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
