// config.js — every tunable gameplay value lives here (AGENTS.md §5).
// If a number affects how the game plays and it is not in this file,
// that is a bug.

export const CANVAS = {
  width: 1280,
  height: 720,
};

// Not a gameplay value -- application.html (a separate static page) reads
// this directly to show/hide its "DRAFT -- NOT FOR SEND" band. It lives
// here anyway on explicit direction (project chat, PLAN.md task 4.5): one
// flag, one obvious place, same as every other tunable in this file.
// Stays true until task 8.2's final content pass flips it.
export const DRAFT_COPY = true;

export const TIMESTEP = {
  hz: 60, // fixed simulation rate
  maxFrameDelta: 0.25, // seconds; clamps huge gaps (e.g. tab was backgrounded)
};

export const WORLD = {
  gravity: 2200, // px/s^2
  // Temporary flat ground for grey-box testing. Real terrain variation is
  // future art/level work; the ground itself stays one continuous surface.
  groundY: 620,
};

// Two places, one continuous level (AGENTS.md §3): only the backdrop swaps
// at a section-transition entry in level.js, never a loading break. Ground
// color stays constant -- only the "sky" differs.
export const SECTIONS = {
  lund: { backgroundColor: '#243247' },
  goteborg: { backgroundColor: '#33415c' },
};

export const PLAYER = {
  width: 48,
  height: 64,
  color: '#f6c453',
  moveSpeed: 360, // px/s
  jumpVelocity: -820, // px/s, negative is up
  maxFallSpeed: 1400, // px/s
  maxHp: 3,
  invulnerabilityDuration: 1.2, // s, after taking damage
  respawnDelay: 0.4, // s before control returns after death
};

// Player HUD (AGENTS.md §5: canvas renders gameplay; the player's health
// is gameplay state, not narrative UI, so it belongs here and not in the
// Milestone 4 DOM layer). Drawn in screen space, so the camera's zoom and
// pan never move it. Bosses have their own bar (§4); this is the player's.
export const HUD = {
  hpPipSize: 18, // px, one square per hit point
  hpPipGap: 8,
  marginX: 24,
  marginY: 24,
  filledColor: '#c9574b',
  emptyColor: '#2a3346',
  borderColor: '#0d1117',
};

export const PROJECTILE = {
  width: 14,
  height: 6,
  color: '#f7f3e3',
  speed: 900, // px/s
  lifetime: 1.1, // s before expiring
  fireCooldown: 0.28, // s between shots while held
};

export const CAMERA = {
  deadzoneWidth: 220, // px, total width of the horizontal dead zone
  deadzoneHeight: 140, // px, total height of the vertical dead zone
  smoothing: 6, // higher = camera catches up to the target faster
  zoomSmoothing: 3, // higher = zoom transitions catch up faster
};

// The staircase run and studentmössa moment (AGENTS.md §3): earned by
// running the staircase, not by defeating anything. Grey-box has no
// staircase art yet (Milestone 7) -- the camera pull-back and celebration
// hold are what make the beat read as a milestone in the meantime.
export const STAIRCASE = {
  zoomOut: 0.8, // camera scale while running the staircase / celebrating
  celebrationHoldDuration: 1.6, // s, extra pulled-back hold after the pickup
};

// Pickups (AGENTS.md §3/§6): studentmössa, suit, armour. Grey-box: plain
// rectangles, one color per outfit, labelled with text (AGENTS.md §5: this
// is exactly the kind of temporary gameplay label canvas text is for) --
// three same-sized boxes are otherwise indistinguishable from each other
// and, before this fix, studentmössa was even the same color as the
// player. "studentmössa" itself is never translated (AGENTS.md §3), so
// the label keeps the Swedish term; suit/armour are already English in
// the design.
export const PICKUP = {
  width: 32,
  height: 32,
  colors: {
    studentmossa: '#ffffff', // the studentmössa is a white cap
    suit: '#3d4a63',
    armour: '#8a8f98',
  },
  labels: {
    studentmossa: 'STUDENTMÖSSA',
    suit: 'SUIT',
    armour: 'ARMOUR',
  },
  labelFont: '14px sans-serif',
  labelColor: '#f7f3e3',
  labelGapAboveBox: 6, // px between the label's baseline and the box top
};

// Enemy roster (AGENTS.md §3). Three behaviours total: Lund trash is
// killable and stationary, one behaviour placed three times (task 3.6
// varies only where, never the logic); Endless Inbox can't be shot down,
// only gotten past; exchange patrols and is killable. Visual variants
// belong to art (Milestone 6), not new logic here.
export const ENEMY_TRASH = {
  width: 48,
  height: 48,
  color: '#c0524a',
  hp: 2,
  contactDamage: 1,
  hitFlashDuration: 0.12, // s
};

export const ENEMY_INBOX = {
  width: 56,
  height: 56,
  color: '#4a5568',
  contactDamage: 1,
  hitFlashDuration: 0.12, // s
};

export const ENEMY_EXCHANGE = {
  width: 44,
  height: 44,
  color: '#7a5ea8',
  hp: 2,
  contactDamage: 1,
  hitFlashDuration: 0.12, // s
  patrolSpeed: 90, // px/s
  patrolRange: 220, // px, total back-and-forth distance
};

// Kill barks (AGENTS.md §4: "Short spoken barks after each kill, tying the
// kill to a CV line... never pause the game"). Text lines are placeholder
// copy -- real CV lines are an open item (AGENTS.md §10) -- but the
// mechanism (spawn above the player, float up, fade, never block input)
// is real. One line per enemy type, cycled in order so repeat kills of the
// same type (the three Lund trash) don't repeat a line.
export const BARK = {
  displayDuration: 1.4, // s a bark stays on screen
  floatDistance: 26, // px it drifts upward over its lifetime
  offsetAboveHead: 16, // px above the player's top edge at spawn
  font: '16px sans-serif',
  color: '#f7f3e3',
  lines: {
    trash: ['Event logistics, UF Lund', 'Sponsor outreach, UF Lund', 'Team of 12, UF Lund'],
    exchange: ['Exchange semester abroad'],
  },
};

export const TELEGRAPH = {
  minDuration: 0.8, // s — AGENTS.md §4, do not go below this
  maxDuration: 1.0, // s
};

// Boss 1 — the Research Golem (AGENTS.md §4). Its world position is level
// layout, not a boss-intrinsic property, so it lives in level.js's LEVEL
// data, not here.
export const RESEARCH_GOLEM = {
  width: 140,
  height: 220,
  color: '#8a7c63',
  hitFlashDuration: 0.12, // s
  telegraphColor: '#e2b23c', // wind-up tell: boss glows toward this before firing
  maxHp: 30,
  contactDamage: 1,

  hpBar: {
    width: 220,
    height: 16,
    offsetY: 34, // px above the boss's top edge
    backgroundColor: '#1b2333',
    borderColor: '#0d1117',
    fillColor: '#c9574b',
  },

  // The boss is a fixed wall the player can't walk behind, so it can
  // always be fought facing right, by design (see project chat: bosses
  // stand at the right end of a bounded arena, never flip).
  solidWall: true,

  // HP fractions that trigger a claim phase. AGENTS.md §4: max two per
  // fight.
  claimThresholds: [0.66, 0.33],

  phaseA: {
    cyclePatterns: ['ground-shot', 'high-arc'],
    cycleInterval: 2.2, // s between attack starts — deliberately slow (tutorial)
  },
  phaseB: {
    cyclePatterns: ['ground-shot', 'high-arc', 'spread-burst'],
    cycleInterval: 1.3, // s between attack starts — faster
  },

  // Attack patterns as data: telegraph duration, projectile speed/angle,
  // repeat count. AGENTS.md §5.
  patterns: {
    'ground-shot': {
      telegraphDuration: 0.9,
      projectileSpeed: 420,
      projectileWidth: 20,
      projectileHeight: 14,
      color: '#c98a4b',
    },
    'high-arc': {
      telegraphDuration: 0.95,
      projectileSpeed: 360, // horizontal speed
      launchVy: -520, // px/s, negative is up
      gravity: 900, // px/s^2, arcs back down
      spawnHeightOffset: -40, // px above boss center
      projectileWidth: 18,
      projectileHeight: 18,
      color: '#c9574b',
    },
    'spread-burst': {
      telegraphDuration: 1.0,
      projectileSpeed: 360,
      repeatCount: 3,
      spreadAngleDeg: 26, // total fan angle across all projectiles
      projectileWidth: 16,
      projectileHeight: 10,
      color: '#c9574b',
    },
  },
};

// Claim phase (AGENTS.md §4). Written specifically for the Research Golem
// — do not reuse the "choose correctly" idea for any other boss or enemy.
export const CLAIM_PHASE = {
  wrongAnswerHealFraction: 0.04, // fraction of maxHp healed per wrong shot

  // Claims stack VERTICALLY in one column, not side by side. The boss is a
  // solid wall (RESEARCH_GOLEM.solidWall) so the player's horizontal
  // position is constrained; a horizontal-only shot consumed by whichever
  // claim it reaches first meant a side-by-side row was only ever hittable
  // in order from wherever the player stood, and the wall made the far one
  // physically unreachable. Stacking vertically means the player chooses
  // which claim to hit by jump TIMING (shoot low, mid, or near apex)
  // instead of by position. See project chat.
  claimWidth: 300,
  claimHeight: 52, // target; buildClaims shrinks it to fit the reachable band if needed
  claimGapY: 6,
  // Inset from the very top/bottom of the reachable shot-height band
  // (computed from actual jump physics in bosses.js, not hardcoded), so no
  // claim needs frame-perfect apex timing to hit.
  reachableBandInset: 4,

  promptText: 'Which claim is supported?',
  promptGapAboveClaims: 26, // px between the claim column and the prompt text
  evidenceMarkerColor: '#6fd67a',
  evidenceMarkerSize: 16,
  evidenceBobAmplitude: 6, // px, gentle floating motion
  evidenceBobSpeed: 3, // radians/s
  taunts: ["That's not it.", 'Try again.', 'Read the data again.'],
  tauntGapAboveClaims: 58, // px, above the prompt so they don't overlap

  // Claim content, a few words each, never sentences (they're read on
  // canvas above a moving boss). One set per claim phase (max two).
  sets: [
    [
      { text: '40% YoY growth', correct: true },
      { text: 'n = 12 survey', correct: false },
      { text: 'No control group', correct: false },
    ],
    [
      { text: 'Consistent across quarters', correct: true },
      { text: 'Cherry-picked date range', correct: false },
      { text: 'Anonymous single source', correct: false },
    ],
  ],
};

// Boss 2 — Graduation (AGENTS.md §4). "No new mechanics: the same
// patterns, faster and denser, over a shorter fight." Reuses
// RESEARCH_GOLEM.patterns directly -- literally the same attacks, not
// reinvented -- and the claim phase is Research-Golem-only, never reused
// here. "Larger sprite / heavier shake / music change" are spectacle
// (task 8.3), not this task; size/color stay grey-box placeholders here.
export const GRADUATION = {
  width: 140,
  height: 220,
  color: '#5b4a72',
  hitFlashDuration: 0.12, // s
  telegraphColor: '#e2b23c',
  maxHp: 20, // lower than the Research Golem's 30 -- a shorter fight
  contactDamage: 1,
  solidWall: true,

  hpBar: {
    width: 220,
    height: 16,
    offsetY: 34,
    backgroundColor: '#1b2333',
    borderColor: '#0d1117',
    fillColor: '#c9574b',
  },

  // No claim phase, so no invulnerable gate -- just an HP-triggered
  // speed-up part way through, reusing the same phase-cycling approach as
  // the Research Golem's phaseA/phaseB (not a new mechanic, same pattern
  // applied to a different boss).
  stage1: { cyclePatterns: ['ground-shot', 'high-arc', 'spread-burst'], cycleInterval: 0.9 },
  stage2: { cyclePatterns: ['ground-shot', 'spread-burst', 'high-arc', 'ground-shot'], cycleInterval: 0.55 },
  stage2Threshold: 0.5, // HP fraction that triggers the speed-up
};
