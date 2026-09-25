// comic-data.js — comic panel list and speech bubbles (PLAN.md task 4.3).
//
// This is the whole comic viewer's design surface: swapping a comic to new
// artwork with a different panel count or composition means editing this
// file only, never comics.js.
//
// Panel images live in public/assets/comics/, produced from
// art-source/comics/ by scripts/slice-comics.py (never hand-cropped, never
// loaded from art-source at runtime -- AGENTS.md §6). That script's own
// cut positions (which pixel rows became which panel) live in
// scripts/panel-cuts.json, not here -- this file only needs the resulting
// panel images, not the source page geometry.
//
// Bubble position/size are fractions of the PANEL's own rendered box
// (0..1), so they hold up at any scale. `tail` names the side the tail
// points toward (where the speaker is relative to the bubble), and is
// purely a rendering hint. `kind` is 'speech' (pointed tail) or 'thought'
// (trailing circles).
//
// Dialogue source:
// - Comic 1 uses Jakob's supplied v2 intro with its dialogue in the art.
// - Comics 2-5 are Jakob's v1 pages (art-source/comics/*-v1.png). Their
//   English dialogue is painted into the artwork itself, so their panels
//   carry no HTML bubbles. This is a deliberate, author-requested
//   exception to AGENTS.md §6's "comic artwork contains no text".
// - Where a page puts two panels side by side (comic-4), each is its own
//   image (scripts/slice-comics.py splitX) and the right-hand one carries
//   `sameRow: true`: it appears on its own click, beside its partner.

export const COMICS = {
  intro: {
    panels: [
      { image: 'comic-1-panel-1.webp', bubbles: [] },
      { image: 'comic-1-panel-2.webp', bubbles: [] },
      { image: 'comic-1-panel-3.webp', bubbles: [] },
      { image: 'comic-1-panel-4.webp', bubbles: [] },
      { image: 'comic-1-panel-5.webp', bubbles: [] },
    ],
  },

  'pre-research-golem': {
    panels: [
      { image: 'comic-2-panel-1.webp', bubbles: [] },
      { image: 'comic-2-panel-2.webp', bubbles: [] },
      { image: 'comic-2-panel-3.webp', bubbles: [] },
      { image: 'comic-2-panel-4.webp', bubbles: [] },
      { image: 'comic-2-panel-5.webp', bubbles: [] },
      { image: 'comic-2-panel-6.webp', bubbles: [] },
    ],
  },

  'pre-graduation': {
    panels: [
      { image: 'comic-3-panel-1.webp', bubbles: [] },
      { image: 'comic-3-panel-2.webp', bubbles: [] },
      { image: 'comic-3-panel-3.webp', bubbles: [] },
      { image: 'comic-3-panel-4.webp', bubbles: [] },
      { image: 'comic-3-panel-5.webp', bubbles: [] },
      { image: 'comic-3-panel-6.webp', bubbles: [] },
      { image: 'comic-3-panel-7.webp', bubbles: [] },
    ],
  },

  // Opens the moment the armour pickup is touched after Graduation
  // (level.js); 'final' follows it directly, with no gameplay between.
  armour: {
    panels: [
      { image: 'comic-4-panel-1.webp', bubbles: [] },
      { image: 'comic-4-panel-2.webp', bubbles: [], sameRow: true },
      { image: 'comic-4-panel-3.webp', bubbles: [] },
      { image: 'comic-4-panel-4.webp', bubbles: [], sameRow: true },
      { image: 'comic-4-panel-5.webp', bubbles: [] },
      { image: 'comic-4-panel-6.webp', bubbles: [], sameRow: true },
      { image: 'comic-4-panel-7.webp', bubbles: [] },
      { image: 'comic-4-panel-8.webp', bubbles: [] },
    ],
  },

  final: {
    panels: [
      { image: 'comic-5-panel-1.webp', bubbles: [] },
      { image: 'comic-5-panel-2.webp', bubbles: [] },
      { image: 'comic-5-panel-3.webp', bubbles: [] },
      { image: 'comic-5-panel-4.webp', bubbles: [] },
      { image: 'comic-5-panel-5.webp', bubbles: [] },
    ],
  },
};
