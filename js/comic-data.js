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
// Dialogue source and a known gap:
// - comic-1 ("intro") has no reference art with dialogue in
//   art-source/comics/reference/ -- only comics 2-4 do. Its panels ship
//   with empty bubbles (shown as-is) until Jakob supplies the intended
//   lines.
// - Comics 2-4's lines below are transcribed from
//   art-source/comics/reference/comic-{2,3,4}-no-text.png (Swedish
//   dialogue painted into an earlier art pass; that reference is never
//   loaded at runtime, it only exists to read the intended lines from).
//   Every transcribed line is reported in the task 4.3 summary for Jakob
//   to correct. One line (comic-3, panel 3) has an uncertain speaker
//   attribution -- flagged there and in that summary.
// - Per AGENTS.md §3, dialogue stays in the Swedish it was written in;
//   this is deliberate, not an inconsistency to fix.

export const COMICS = {
  intro: {
    panels: [
      { image: 'comic-1-panel-1.webp', bubbles: [] },
      { image: 'comic-1-panel-2.webp', bubbles: [] },
      { image: 'comic-1-panel-3.webp', bubbles: [] },
      { image: 'comic-1-panel-4.webp', bubbles: [] },
    ],
  },

  'pre-research-golem': {
    panels: [
      {
        image: 'comic-2-panel-1.webp',
        bubbles: [
          { text: 'Vad är det här??', x: 0.08, y: 0.12, w: 0.32, tail: 'left', kind: 'speech' },
        ],
      },
      {
        image: 'comic-2-panel-2.webp',
        bubbles: [
          { text: 'Jag är din första stora prövning', x: 0.03, y: 0.08, w: 0.35, tail: 'right', kind: 'speech' },
        ],
      },
      {
        image: 'comic-2-panel-3.webp',
        bubbles: [
          { text: 'Jaha, vadå för prövning?', x: 0.38, y: 0.1, w: 0.3, tail: 'left', kind: 'speech' },
        ],
      },
      {
        image: 'comic-2-panel-4.webp',
        bubbles: [
          {
            text: 'En sann ekonom måste kunna göra riktig dataanalys',
            x: 0.03,
            y: 0.05,
            w: 0.35,
            tail: 'right',
            kind: 'speech',
          },
          { text: 'Gör dig redo för strid!', x: 0.03, y: 0.32, w: 0.3, tail: 'right', kind: 'speech' },
        ],
      },
      {
        image: 'comic-2-panel-5.webp',
        bubbles: [
          {
            text: 'Hearts of Iron har förberett mig för precis detta!!!',
            x: 0.03,
            y: 0.06,
            w: 0.38,
            tail: 'down',
            kind: 'speech',
          },
        ],
      },
    ],
  },

  'pre-graduation': {
    panels: [
      {
        image: 'comic-3-panel-1.webp',
        bubbles: [
          { text: 'Här kommer du inte förbi!!!', x: 0.42, y: 0.05, w: 0.34, tail: 'right', kind: 'speech' },
        ],
      },
      {
        image: 'comic-3-panel-2.webp',
        bubbles: [
          {
            text: 'Hahaha, jag har raidat mythic WoW, du är ingen match',
            x: 0.55,
            y: 0.3,
            w: 0.4,
            tail: 'left',
            kind: 'thought',
          },
        ],
      },
      {
        image: 'comic-3-panel-3.webp',
        bubbles: [
          // Speaker uncertain: no character is drawn in this panel (it's
          // a close-up on the boss). Read as the boss's taunt answering
          // panel 2's thought, but could be the boy talking about
          // himself -- flagged in the task 4.3 summary, confirm with
          // Jakob before treating this as settled.
          { text: 'HAHAH, en nörd har inte en chans mot mig', x: 0.03, y: 0.55, w: 0.32, tail: 'right', kind: 'speech' },
        ],
      },
      {
        image: 'comic-3-panel-4.webp',
        bubbles: [
          { text: 'Det får vi se', x: 0.05, y: 0.62, w: 0.22, tail: 'down', kind: 'thought' },
        ],
      },
    ],
  },

  final: {
    panels: [
      {
        image: 'comic-4-panel-1.webp',
        bubbles: [
          { text: 'Det var det då…', x: 0.14, y: 0.05, w: 0.2, tail: 'down', kind: 'speech' },
          {
            text: 'Ännu en seger. Kanske var det slutet ändå?',
            x: 0.26,
            y: 0.3,
            w: 0.26,
            tail: 'left',
            kind: 'speech',
          },
        ],
      },
      {
        image: 'comic-4-panel-2.webp',
        bubbles: [
          // "FINAL BOSS MUSIC STARTS PLAYING" is painted directly into
          // the artwork (AGENTS.md §4.3 notes) -- not a bubble, left alone.
          { text: '…!?', x: 0.2, y: 0.08, w: 0.12, tail: 'down', kind: 'speech' },
          { text: 'Va…? Vad är det som låter?', x: 0.75, y: 0.55, w: 0.22, tail: 'left', kind: 'speech' },
        ],
      },
      {
        image: 'comic-4-panel-3.webp',
        bubbles: [
          { text: '…!', x: 0.06, y: 0.55, w: 0.1, tail: 'down', kind: 'speech' },
          { text: 'Vad i hela…?', x: 0.05, y: 0.68, w: 0.2, tail: 'down', kind: 'speech' },
        ],
      },
      {
        image: 'comic-4-panel-4.webp',
        bubbles: [
          { text: 'Välkommen, modiga besökare.', x: 0.02, y: 0.1, w: 0.28, tail: 'right', kind: 'speech' },
          { text: 'Historien tar aldrig slut.', x: 0.02, y: 0.32, w: 0.26, tail: 'right', kind: 'speech' },
          { text: 'Det finns alltid en ny utmaning.', x: 0.02, y: 0.52, w: 0.28, tail: 'right', kind: 'speech' },
          { text: 'Är du redo att tänka större?', x: 0.72, y: 0.62, w: 0.26, tail: 'left', kind: 'speech' },
        ],
      },
      {
        image: 'comic-4-panel-5.webp',
        bubbles: [
          { text: 'Då kör vi. Jag är redo.', x: 0.06, y: 0.05, w: 0.26, tail: 'down', kind: 'speech' },
        ],
      },
    ],
  },
};
