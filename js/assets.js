// assets.js — asset loading + manifest (AGENTS.md §5).
//
// The first runtime art pass integrates the approved Lund background
// strips and landmarks. Every path remains project-relative so the same
// manifest works locally and on GitHub Pages.

export const MANIFEST = [
  { path: 'assets/backgrounds/lund-town-far.webp' },
  { path: 'assets/backgrounds/lund-town-mid.webp' },
  { path: 'assets/backgrounds/polhem-school-mid.webp' },
  { path: 'assets/backgrounds/polhem-staircase-mid.webp' },
  { path: 'assets/backgrounds/uf-stand.webp' },
  { path: 'assets/backgrounds/polhem-mech.webp' },
  { path: 'assets/backgrounds/goteborg-city-far.webp' },
  { path: 'assets/backgrounds/goteborg-city-mid.webp' },
  { path: 'assets/backgrounds/goteborg-haga-mid.webp' },
  { path: 'assets/backgrounds/research-golem-facade-entrance.webp' },
  { path: 'assets/backgrounds/research-golem-facade-exit.webp' },
  { path: 'assets/backgrounds/research-golem-arena.webp' },
  { path: 'assets/backgrounds/usa-far.webp' },
  { path: 'assets/backgrounds/usa-mid-columbia.webp' },
  { path: 'assets/backgrounds/usa-mid-campus.webp' },
  { path: 'assets/backgrounds/world-ground-v2.webp' },
  { path: 'assets/backgrounds/arena1-ground.webp' },
  { path: 'assets/backgrounds/sign-lund-arrow.webp' },
  { path: 'assets/backgrounds/sign-welcome-lund.webp' },
  { path: 'assets/backgrounds/sign-gothenburg-arrow.webp' },
  { path: 'assets/backgrounds/departures-board.webp' },
  { path: 'assets/backgrounds/graduation-portal.webp' },
  { path: 'assets/backgrounds/graduation-arena.webp' },
  { path: 'assets/backgrounds/graduation-ground.webp' },
  { path: 'assets/enemies/math-book-idle.webp' },
  { path: 'assets/enemies/math-book-open.webp' },
  { path: 'assets/enemies/football-helmet-idle.webp' },
  { path: 'assets/enemies/football-helmet-telegraph.webp' },
  { path: 'assets/bosses/research-golem.webp' },
  { path: 'assets/bosses/boss-projectiles.webp' },
  { path: 'assets/bosses/graduation-boss.webp' },
  { path: 'assets/player/base.png' },
  { path: 'assets/player/studentmossa.png' },
  { path: 'assets/player/suit.png' },
  { path: 'assets/player/armour.png' },
  { path: 'assets/player/base-animation.png' },
  { path: 'assets/player/studentmossa-animation.png' },
  { path: 'assets/player/suit-animation.png' },
];

// Loaded images, keyed by the same path used in MANIFEST -- background.js
// (task 2, background art prep) reads these back by path for its 'image'
// source layers rather than each caller tracking its own Image objects.
const imageCache = new Map();

// Returns the loaded image for a manifest path, or undefined if it hasn't
// settled yet (still loading, or never listed). Callers that can render
// without it just skip a frame's draw rather than treating this as an
// error -- the same "a failed/missing asset never blocks the game"
// principle as loadAssets below, just for a single lookup instead of the
// whole loading screen.
export function getImage(path) {
  return imageCache.get(path);
}

// Loads every entry in MANIFEST, reporting progress via onProgress(0..1)
// as each one settles. A failed asset still counts toward progress rather
// than hanging the loading screen forever -- a missing file is a bug to
// fix, not a reason to trap the player on the title screen.
export function loadAssets(onProgress) {
  const total = MANIFEST.length;
  if (total === 0) {
    onProgress(1);
    return Promise.resolve();
  }

  let settled = 0;
  const reportOne = () => {
    settled += 1;
    onProgress(settled / total);
  };

  return Promise.all(MANIFEST.map((entry) => loadOne(entry).then(reportOne, reportOne)));
}

function loadOne(entry) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      imageCache.set(entry.path, image);
      resolve();
    };
    image.onerror = reject;
    image.src = entry.path;
  });
}
