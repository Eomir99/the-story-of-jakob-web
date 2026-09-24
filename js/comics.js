// comics.js — the comic viewer (PLAN.md task 4.3; task 2, playtest round
// 2: a stacking read, not a one-panel-at-a-time cutscene). Advancing
// appends the next panel to #comic-panel-list and scrolls it into view;
// nothing already on screen is ever removed. All content (panel images,
// bubble text and position) is comic-data.js; swapping a comic for new
// artwork never touches this file (AGENTS.md §5).

import { COMIC } from './config.js';
import { COMICS } from './comic-data.js';
import { advanceFromComic } from './game.js';

const ASSET_BASE = './assets/comics/';

let screen, scrollEl, panelListEl;
let currentPanels = [];
let currentPanelIndex = -1; // -1: showComic hasn't added the first panel yet
// Task 3, playtest round 2: a wall-clock deadline (COMIC.inputLockoutDuration
// after the comic opened), not a simulation timer -- the fixed-timestep
// step() doesn't run at all while a comic is showing (gameState !==
// PLAYING), so there is no per-frame dt for this to count down with.
let inputLockedUntil = 0;

export function initComicViewer() {
  screen = document.querySelector('#comic-screen');
  scrollEl = document.querySelector('#comic-scroll');
  panelListEl = document.querySelector('#comic-panel-list');
  if (!screen || !scrollEl || !panelListEl) return;

  // Click or Space advances a panel (PLAN.md 4.3). Scoped to "screen not
  // hidden" rather than game state, so comics.js never needs to know
  // about game.js's STATE beyond the one exported advance call.
  screen.addEventListener('click', advance);
  window.addEventListener('keydown', (event) => {
    if (screen.hidden) return;
    if (event.code === 'Space' || event.code === 'Enter') advance();
  });
}

export function showComic(comicId) {
  const comic = COMICS[comicId];
  if (!screen || !comic) return;
  currentPanels = comic.panels;
  currentPanelIndex = -1;
  panelListEl.innerHTML = '';
  scrollEl.scrollTop = 0;
  screen.hidden = false;
  // Task 3: ignore clicks/Space/Enter for a short window after opening --
  // see config.js COMIC. Catches a click or key meant for gameplay (most
  // often held/clicked fire) landing on the comic the instant it appears
  // and skipping panel 1 before it was ever read. game.js's enterComic
  // already cleared input.js's own held/buffered state just before this
  // runs, so the two together leave no gap for stray input to get through.
  inputLockedUntil = performance.now() + COMIC.inputLockoutDuration * 1000;
  addNextPanel(); // the first panel appears immediately, nothing to scroll to yet
}

export function hideComic() {
  if (screen) screen.hidden = true;
}

function advance() {
  if (!screen || screen.hidden) return;
  if (performance.now() < inputLockedUntil) return; // task 3: still in the open-lockout window
  if (currentPanelIndex >= currentPanels.length - 1) {
    advanceFromComic(); // last panel dismissed -- game.js decides what's next
    return;
  }
  addNextPanel();
}

// Appends one panel frame below whatever is already stacked, then scrolls
// so the new panel is what the eye lands on -- comfortably in view, not
// jammed at the bottom edge. Waits for the image to actually have its
// size (load event, or already cached/complete) before scrolling, since
// scrolling to an unsized image would land in the wrong place the instant
// it decodes and the page reflows under it.
//
// Side-by-side panels (comic-data.js `sameRow`): the row is laid out in
// full when its first panel appears, with the later ones present but
// invisible, so revealing each on its own click never shifts the row.
function addNextPanel() {
  currentPanelIndex += 1;
  const panel = currentPanels[currentPanelIndex];
  let frame;
  if (panel.sameRow) {
    frame = panelListEl.querySelector('.comic-frame--waiting');
    frame.classList.remove('comic-frame--waiting');
  } else {
    frame = buildPanelFrame(panel);
    const partners = [];
    for (let i = currentPanelIndex + 1; currentPanels[i] && currentPanels[i].sameRow; i++) partners.push(currentPanels[i]);
    if (partners.length === 0) {
      panelListEl.appendChild(frame);
    } else {
      const row = document.createElement('div');
      row.className = 'comic-row';
      row.appendChild(frame);
      for (const partner of partners) {
        const waiting = buildPanelFrame(partner);
        waiting.classList.add('comic-frame--waiting');
        row.appendChild(waiting);
      }
      panelListEl.appendChild(row);
    }
  }

  const img = frame.querySelector('img');
  const scrollToFrame = () => frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (img.complete) scrollToFrame();
  else img.addEventListener('load', scrollToFrame, { once: true });
}

function buildPanelFrame(panel) {
  const frame = document.createElement('div');
  frame.className = 'comic-frame';

  const img = document.createElement('img');
  img.className = 'comic-panel-image';
  img.alt = '';
  img.src = ASSET_BASE + panel.image;
  frame.appendChild(img);

  // Position/size are fractions of the panel's own rendered box (comic-
  // data.js), not the screen -- .comic-frame (ui.css) shrinks to exactly
  // the letterboxed image's box, so percentages here land on the artwork
  // at any scale, independent of how tall neighbouring stacked panels are.
  const bubbleLayer = document.createElement('div');
  bubbleLayer.className = 'comic-bubble-layer';
  for (const bubble of panel.bubbles || []) {
    bubbleLayer.appendChild(buildBubble(bubble));
  }
  frame.appendChild(bubbleLayer);

  return frame;
}

function buildBubble(bubble) {
  const el = document.createElement('div');
  el.className = `comic-bubble comic-bubble--${bubble.kind} comic-bubble--tail-${bubble.tail}`;
  el.style.left = `${bubble.x * 100}%`;
  el.style.top = `${bubble.y * 100}%`;
  el.style.width = `${bubble.w * 100}%`;
  el.textContent = bubble.text;
  return el;
}
