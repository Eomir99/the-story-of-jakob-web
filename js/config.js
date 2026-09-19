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

// Background sections (PLAN.md task 6.8, brought forward). One continuous
// level, no loading break (AGENTS.md §3) -- only the scenery changes, and
// it changes because a player cannot judge distance against unchanging
// scenery. Changing scenery is what communicates progress.
//
// WHERE each section starts and ends is level layout, so it lives in
// level.js. WHAT it looks like is a tunable, so it lives here. Adding a
// section means one entry in each: a range there, a look here.
//
// Every look is a stack of exactly three layers, far to near, each with
// its own parallax factor and its own source. Sources are:
//
//   { type: 'color',      color }             flat field
//   { type: 'gradient',   from, to }          vertical, sky-top to ground
//   { type: 'silhouette', color, tileWidth, heights }
//
// A silhouette is one strip of bars standing on the ground line, repeated
// across the whole section -- `heights` are pixel heights spread evenly
// across `tileWidth`, and a 0 is a gap. Everything TILES horizontally:
// there are no oversized images now and there must be none later, so a
// section of any length costs the same.
//
// These are placeholders, deliberately flat and obvious. When the real
// artwork arrives it drops in as data -- a fourth source type taking an
// image path, with the tiling and parallax already handled.
export const BACKGROUND = {
  // px, centred on each boundary: the band over which the outgoing
  // section fades into the incoming one. A hard cut mid-run is jarring.
  blendBandWidth: 400,
};

// Standard parallax trio. Per-layer values below so any one section can
// deviate, but keeping them equal is what makes the level feel coherent.
const FAR = 0.15;
const MID = 0.35;
const NEAR = 0.6;

export const BACKGROUNDS = {
  // 1 -- Lund, the town. Dark base, pale line-art skyline (AGENTS.md §3).
  'lund-town': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#161d2b' } },
      { parallax: MID, source: { type: 'gradient', from: '#161d2b', to: '#243247' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#2e3d55', tileWidth: 420, heights: [80, 130, 60, 150, 95, 70, 120, 55] } },
    ],
  },

  // 2 -- Polhem, the school. Warmer brick, and the roofline goes blocky:
  // fewer, wider, flatter shapes than the town's.
  'polhem-school': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#2a2029' } },
      { parallax: MID, source: { type: 'gradient', from: '#2a2029', to: '#4a3230' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#5a3b33', tileWidth: 400, heights: [0, 170, 170, 170, 0, 140, 140, 0] } },
    ],
  },

  // 3 -- Lund again, for the utspring. Same skyline family as 1 on
  // purpose -- you are back where you started -- but lit brighter: this
  // is the celebration.
  'lund-utspring': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#24304a' } },
      { parallax: MID, source: { type: 'gradient', from: '#24304a', to: '#3a4a6b' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#54678c', tileWidth: 420, heights: [80, 130, 60, 150, 95, 70, 120, 55] } },
    ],
  },

  // 4 -- Göteborg. Cooler, and denser: more bars, narrower, taller.
  'goteborg-city': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#131c2e' } },
      { parallax: MID, source: { type: 'gradient', from: '#131c2e', to: '#22314d' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#31435f', tileWidth: 300, heights: [110, 180, 90, 200, 140, 170, 100, 160, 130, 190] } },
    ],
  },

  // 5 -- Handels, the Research Golem arena. An interior, so the far layer
  // is a flat wall and NOT a sky gradient -- that alone reads as "indoors"
  // after four outdoor sections. Gold columns near. You have arrived
  // somewhere, not walked into more corridor.
  'handels-interior': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#101a30' } },
      { parallax: MID, source: { type: 'gradient', from: '#16233d', to: '#1d2b49' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#a98b4a', tileWidth: 360, heights: [0, 240, 0, 240, 0, 240] } },
    ],
  },

  // 6 -- the clinic reception. Pale teal and flat: the one bright, empty,
  // clinical stretch in the level. Kept muted rather than white so the
  // player and projectiles still read against it.
  'clinic-reception': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#7fa8a5' } },
      { parallax: MID, source: { type: 'color', color: '#8fb7b3' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#6d938f', tileWidth: 480, heights: [60, 60, 60, 0, 60, 60, 60, 0] } },
    ],
  },

  // 7 -- USA, the stadium. Open bright sky and a low wide bowl -- the
  // widest, lowest silhouette in the level, against the tallest sky.
  'usa-stadium': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#5b8fc9' } },
      { parallax: MID, source: { type: 'gradient', from: '#5b8fc9', to: '#a9cbe8' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#3f5d78', tileWidth: 640, heights: [50, 70, 80, 80, 80, 80, 70, 50] } },
    ],
  },

  // 8 -- GU, the Graduation arena. Dark ceremonial blue, sparse tall
  // columns. The other arena, and it should read as one.
  'gu-ceremony': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#0e1730' } },
      { parallax: MID, source: { type: 'gradient', from: '#0e1730', to: '#1a2748' } },
      { parallax: NEAR, source: { type: 'silhouette', color: '#2f3f6b', tileWidth: 240, heights: [0, 300, 0, 0] } },
    ],
  },
};

// Landmarks: one-off background objects placed at a single x rather than
// tiled, each scrolling at its own parallax rate (set per placement in
// level.js, since how far away a thing reads is a layout decision).
// Labelled placeholder rectangles until the art pass.
export const LANDMARK = {
  labelFont: '13px sans-serif',
  labelColor: '#f7f3e3',
  labelGap: 8, // px between the label's baseline and the box top
  types: {
    // AGENTS.md §3: "a UF (Junior Achievement Sweden) reference in the
    // background". Never abbreviated on first appearance.
    'uf-stand': { label: 'UF (Junior Achievement Sweden) STAND', width: 200, height: 130, color: '#c9a227' },
    // AGENTS.md §3: "the Polhem mech sleeping on the skyline".
    'polhem-mech': { label: 'POLHEM MECH (asleep)', width: 460, height: 340, color: '#46506b' },
    stadium: { label: 'STADIUM', width: 900, height: 260, color: '#2f4a63' },
  },
};

// Development pacing overlay (PLAN.md task 6.8). Turns pacing from a
// feeling into a number that can be checked against the target section
// durations. A development tool, not UI -- it is not styled, and with
// `overlay` false nothing about it reaches the screen.
//
// MUST stay false in anything sent to anyone.
export const DEBUG = {
  overlay: false,
  font: '14px monospace',
  color: '#8fe3a0',
  backgroundColor: 'rgba(13, 17, 23, 0.72)',
  width: 300,
  lineHeight: 18,
  paddingX: 10,
  paddingY: 8,
  marginX: 24,
  marginY: 24, // from the BOTTOM edge -- the HP pips own the top-left
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

// Boss projectile lifetime (task B) -- was hardcoded to 4s directly in
// bosses.js, which at up to 420px/s let a shot travel over 1600px: most of
// a level section. This is a shared backstop lifetime for every boss
// pattern; PROJECTILE_CULL_MARGIN below is the primary defense (it removes
// a projectile as soon as it leaves the visible area, regardless of
// remaining life), but nothing should rely on the camera check alone --
// every projectile still needs its own hard cap.
export const BOSS_PROJECTILE_LIFETIME = 3; // s

// Projectile culling (task B): a correctness fix independent of boss
// dormancy below -- nothing should ever survive long enough to travel a
// whole section of the level. Checked every step against the camera's
// current position, on top of each projectile's own lifetime above.
export const PROJECTILE_CULL_MARGIN = 200; // px outside the camera's view before removal

export const CAMERA = {
  deadzoneWidth: 220, // px, total width of the horizontal dead zone
  deadzoneHeight: 140, // px, total height of the vertical dead zone
  smoothing: 6, // higher = camera catches up to the target faster
  zoomSmoothing: 3, // higher = zoom transitions catch up faster
};

// The utspring — the staircase run and the studentmössa (AGENTS.md §3,
// PLAN.md task 3.5). A scripted five-second sequence, not a pickup you
// walk into: approach, handover, descent, confetti, flash, title card,
// control back. Everything below is one of its tunables.
//
// The whole beat must stay under six seconds:
//   descentDuration + flashDuration + cardHoldDuration + cardFadeDuration
//   = 3.0 + 0.25 + 1.6 + 0.4 = 5.25 s  ✓
// If any of these are raised, check that sum again.
export const STAIRCASE = {
  // --- Geometry. level.js derives the actual platform run from these:
  // the number of steps, the height of the top landing and the approach
  // platforms that climb to it all fall out of the numbers here, so the
  // staircase always matches how far the auto-run actually travels.
  // px each step sits below the one before it. This also sets how high
  // the top landing is (steps x drop), and so how far the handover has to
  // lift a player who arrived along the ground instead of climbing the
  // approach platforms -- see beginUtspring in game.js. Keep it shallow:
  // raising it makes that lift more visible.
  stepDrop: 32,

  // --- Timings
  descentDuration: 3.0, // s of auto-run from the handover to the stop
  speedRampMultiplier: 1.5, // final auto-run speed, as a multiple of PLAYER.moveSpeed
  flashDuration: 0.25, // s of white flash; the studentmössa appears under it
  cardHoldDuration: 1.6, // s the title card holds at full opacity
  cardFadeDuration: 0.4, // s it fades out over; control returns when it's gone

  zoomOut: 0.8, // camera scale for the whole sequence — the view widens
  flashColor: '#ffffff',
};

// Confetti for the utspring (PLAN.md task 3.5). Deliberately not a
// particle system (AGENTS.md §7.10): a fixed number of small coloured
// rectangles, spawned once when the descent starts, falling with some
// drift and spin, culled when they leave the view.
export const CONFETTI = {
  count: 180,
  width: 10,
  height: 14,
  colors: ['#f6c453', '#c9574b', '#6fd67a', '#f7f3e3', '#5aa9e6', '#d98cc4'],
  fallSpeedMin: 180, // px/s
  fallSpeedMax: 420, // px/s
  driftSpeed: 70, // px/s, max horizontal drift in either direction
  spinSpeedMax: 5, // radians/s, in either direction
  spawnBandHeight: 1200, // px above the view that pieces start scattered through
  cullMargin: 60, // px below the view before a piece is removed
};

// The studentmössa on the player sprite. AGENTS.md §6: an overlay drawn
// on the base character, never a second animation set. Grey-box
// placeholder — a white cap with a brim and a tassel. When the real
// overlay art lands (task 6.4), drawStudentmossa in player.js becomes a
// single drawImage call and these numbers become its offset.
export const STUDENTMOSSA_OVERLAY = {
  capWidth: 44, // px, wider than the head — obviously a placeholder
  capHeight: 8,
  brimWidth: 22,
  brimHeight: 9,
  offsetY: -10, // px above the player's top edge
  color: '#ffffff',
  brimColor: '#151a23',
  tasselColor: '#c9574b', // deliberately not PLAYER.color, or it vanishes into the sprite
  tasselLength: 16,
  tasselWidth: 3,
};

// Pickups (AGENTS.md §3/§6): suit and armour. Grey-box: plain rectangles,
// one color per outfit, labelled with text (AGENTS.md §5: this is exactly
// the kind of temporary gameplay label canvas text is for) -- same-sized
// boxes are otherwise indistinguishable from each other.
//
// The studentmössa is deliberately absent: it is no longer a box you walk
// into but the reward at the end of the utspring sequence (STAIRCASE
// above, PLAN.md task 3.5), so it has no pickup entity, colour or label.
export const PICKUP = {
  width: 32,
  height: 32,
  colors: {
    suit: '#3d4a63',
    armour: '#8a8f98',
  },
  labels: {
    suit: 'SUIT',
    armour: 'ARMOUR',
  },
  labelFont: '14px sans-serif',
  labelColor: '#f7f3e3',
  labelGapAboveBox: 6, // px between the label's baseline and the box top
};

// Platforms (task C, AGENTS.md §5: "fixed standard dimensions for...
// platforms"). One-way: landable from above, never solid from the sides
// or below (player.js). Every instance is this same size -- only x/y vary
// in level.js -- so "wide, forgiving" (PLAN.md task C) is true everywhere
// by construction, not something each placement has to get right.
export const PLATFORM = {
  width: 220,
  height: 24,
  color: '#3a4a63',
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
