// comics.js — the comic viewer (PLAN.md task 4.3). A cutscene, not a
// scrolling page: exactly one panel is on screen at a time. All content
// (panel images, bubble text and position) is comic-data.js; swapping a
// comic for new artwork never touches this file (AGENTS.md §5).

import { COMICS } from './comic-data.js';
import { advanceFromComic } from './game.js';

const ASSET_BASE = './assets/comics/';

let screen, frame, imageEl, bubbleLayer;
let currentPanels = [];
let currentPanelIndex = 0;

export function initComicViewer() {
  screen = document.querySelector('#comic-screen');
  frame = document.querySelector('#comic-frame');
  imageEl = document.querySelector('#comic-panel-image');
  bubbleLayer = document.querySelector('#comic-bubble-layer');
  if (!screen || !frame || !imageEl || !bubbleLayer) return;

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
  currentPanelIndex = 0;
  screen.hidden = false;
  renderPanel();
}

export function hideComic() {
  if (screen) screen.hidden = true;
}

function advance() {
  if (!screen || screen.hidden) return;
  currentPanelIndex += 1;
  if (currentPanelIndex >= currentPanels.length) {
    advanceFromComic(); // last panel dismissed -- game.js decides what's next
    return;
  }
  renderPanel();
}

function renderPanel() {
  const panel = currentPanels[currentPanelIndex];
  imageEl.src = ASSET_BASE + panel.image;
  bubbleLayer.innerHTML = '';
  for (const bubble of panel.bubbles || []) {
    bubbleLayer.appendChild(buildBubble(bubble));
  }
}

// Position/size are fractions of the panel's own rendered box (comic-
// data.js), not the screen -- #comic-frame (ui.css) shrinks to exactly
// the letterboxed image's box, so percentages here land on the artwork
// at any scale.
function buildBubble(bubble) {
  const el = document.createElement('div');
  el.className = `comic-bubble comic-bubble--${bubble.kind} comic-bubble--tail-${bubble.tail}`;
  el.style.left = `${bubble.x * 100}%`;
  el.style.top = `${bubble.y * 100}%`;
  el.style.width = `${bubble.w * 100}%`;
  el.textContent = bubble.text;
  return el;
}
