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

  // How far below groundY the ground is actually filled in. This is not
  // cosmetic detail: the camera's vertical dead zone settles about 158px
  // down, and the utspring pull-back widens the view further, so a ground
  // slab only as deep as the canvas (100px) left roughly a fifth of every
  // frame showing the sky gradient BELOW the floor, for the entire game.
  // 600 covers the resting camera, the widened view and the screen shake
  // together, with room to spare -- and a taller fill costs nothing.
  groundDepth: 600,
  groundColor: '#1b2333',
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
  // Landmarks are scenery: nothing collides with them and nothing about
  // them can hurt anyone. Drawn at full opacity they did not read that
  // way -- the UF stand is a solid gold slab standing on the ground line
  // in the same plane as the player, and the Polhem mech looked more like
  // a platform than the actual platforms did. Held back to this, they
  // settle into the backdrop where they belong.
  alpha: 0.5,
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
  // A rim around the player, for the same reason the enemies have one
  // (HAZARD): eight background sections at wildly different brightnesses,
  // and no single fill colour reads against all of them. Wearing the
  // suit, the player was #3d4a63 -- within three hex digits of the
  // platforms (#3a4a63), and near enough to the USA stadium silhouette
  // (#3f5d78) and the stadium landmark (#2f4a63) to disappear into both.
  //
  // The rim means "this is a gameplay object", and the enemies, the
  // bosses and every projectile carry one too. What separates friend from
  // hazard is the FILL: warm orange-red is only ever something that hurts
  // you, and the player is never warm orange-red.
  outlineColor: '#141b26',
  outlineWidth: 3, // px

  // The invulnerability blink, after taking a hit. Alpha was 0.35, which
  // on the pale clinic and bright USA sections made the player almost
  // invisible for 1.2 s starting from the exact moment they most needed
  // to find themselves. Rate is blinks per second.
  invulnerableBlinkAlpha: 0.55,
  invulnerableBlinkRate: 12,
  moveSpeed: 360, // px/s
  jumpVelocity: -820, // px/s, negative is up
  maxFallSpeed: 1400, // px/s
  maxHp: 3,
  invulnerabilityDuration: 1.2, // s, after taking damage
  respawnDelay: 0.4, // s before control returns after death

  // Coyote time: how long after walking off a ledge a jump still works.
  // Without it a jump pressed a frame or two late simply does nothing and
  // reads as the game cheating -- the single most common reason a
  // non-gamer decides a platformer is "broken". It cannot make a jump
  // land that would not otherwise have landed: the jump starts from the
  // same height with the same arc, it is only the input deadline that
  // moves.
  coyoteTime: 0.1, // s

  // Jump buffering: a jump pressed slightly BEFORE landing is remembered
  // for this long and fires the moment the ground is under the player
  // again, instead of being thrown away. The mirror image of coyote time
  // -- together they cover both halves of "I pressed it and nothing
  // happened". Someone who is nervous about a jump presses early; that
  // must not be punished.
  jumpBufferTime: 0.12, // s

  // Variable jump height. Releasing jump while still rising clamps the
  // remaining upward speed to jumpVelocity * this, so a tap is a small
  // hop and a held key is exactly the jump it always was. This is
  // control, not difficulty: the maximum jump is unchanged, the player
  // simply gains a smaller one for fine adjustments. A clamp rather than
  // a per-frame multiply, so holding the key released for longer cannot
  // keep shaving the arc down.
  jumpCutMultiplier: 0.45,

  // Landing squash. Purely visual: the sprite compresses vertically and
  // spreads horizontally for a moment on touchdown, then eases back.
  // Nothing about the hitbox, the collision or the physics changes -- it
  // only sells the weight of the landing, which a static rectangle
  // otherwise has none of.
  landSquash: {
    duration: 0.12, // s to ease back to normal
    scaleY: 0.72, // vertical scale at the instant of impact
    scaleX: 1.14, // horizontal spread at the instant of impact
    // px/s of downward speed below which a landing is too gentle to be
    // worth showing -- stepping off a 24px platform should not thump.
    minImpactSpeed: 320,
  },
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

// The hostile look. One rule, applied to everything that can take a hit
// point off the player: enemies, bosses and every projectile they fire.
//
// The problem it solves is that this level runs through eight background
// sections whose brightness is nowhere near constant -- dark navy in
// Lund, gold columns in Handels, pale teal in the clinic, open blue sky
// in USA. A single flat colour cannot read against all of them, and the
// palette had collisions in both directions: the maths book's shot was
// exactly the UF stand's gold, and the Research Golem's ground shot
// disappeared into the Handels columns it flew across.
//
// A bright warm fill inside a near-black rim reads against all of them.
// The rim carries it on the bright sections, the fill carries it on the
// dark ones, and warm orange-red appears nowhere in the scenery, which
// is deliberately cool or muted everywhere.
//
// Wind-up tells stay gold (each entity's telegraphColor) and are NOT
// part of this. Gold means "about to happen", hazard orange-red means
// "this hurts you now" -- two different things a player has to tell
// apart at a glance.
export const HAZARD = {
  outlineColor: '#170907',
  projectileOutlineWidth: 3, // px
  bodyOutlineWidth: 3, // px, enemy and boss bodies
};

// The player's own shots. Everything here except the trail is deliberately
// the opposite of HAZARD's look, because in a crowded moment the one
// question that has to answer itself instantly is "is that mine or is
// that coming at me":
//
//   hostile   warm orange-red, chunky, slow, thick near-black rim
//   player's  cool white, thin, fast, thin cool rim, and a trail
//
// Cool against warm survives every background section in the level, and
// the trail only ever appears on the player's shots -- nothing hostile
// moves fast enough to have one.
//
// width/height are the hitbox as well as the look, so they are unchanged:
// the shot is no easier or harder to land than it was.
export const PROJECTILE = {
  width: 14,
  height: 6,
  color: '#eaf7ff', // cool white, against the hazard palette's warm orange-red
  outlineColor: '#12202e',
  outlineWidth: 2, // px
  trailLength: 26, // px of streak behind the shot -- drawn only, never collides
  trailAlpha: 0.4,
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

// Hitstop: the whole simulation stops dead for a few frames the instant
// a player shot does damage. It is the cheapest and largest single
// improvement to how shooting feels -- without it a hit is a number
// changing somewhere, with it the shot lands. Deliberately measured in
// frames, not in a "feel" fraction: at 60 Hz, 0.05 s is three frames.
//
// Keep these small. Long enough to notice is already too long: past
// about 0.12 s it stops reading as impact and starts reading as the game
// stuttering, which is the opposite of the intended impression.
// Damage flash. Both halves of "something just got hit": the thing that
// was hit, and the player when it is them. Per-entity durations stay on
// the entities (their own hitFlashDuration); what they flash TO lives
// here so the whole game speaks with one voice.
//
// The flash is blended by how much of the duration is left rather than
// replacing the colour outright for the whole window. A flat white fill
// for 0.12 s at a 0.28 s fire rate left the bosses white roughly half the
// time, which reads as a strobing slab rather than as a series of hits --
// and it hid the wind-up tell underneath it.
export const DAMAGE_FLASH = {
  enemyColor: '#ffffff', // enemies and bosses
  playerColor: '#ff5f4d', // the player -- red, never white: the studentmossa overlay is white
  playerDuration: 0.16, // s. Shown at full opacity even mid-blink, so a hit is never missed
};

// Death burst. Enemies and bosses used to vanish on the frame they died,
// which left the single most satisfying moment in the game with no
// payoff at all -- including beating the Research Golem, the centrepiece
// of the whole pitch.
//
// Built the same way the utspring confetti is (AGENTS.md 7.10: not a
// particle system, a fixed list of rectangles that expire). One colour
// for every death rather than the dead thing's own, so a burst always
// reads as "that died" and never as a new hazard appearing.
export const DEATH_BURST = {
  color: '#ffe6a8',

  // A ghost of the body, scaling up from where it stood and fading out.
  ghostDuration: 0.28, // s
  ghostScale: 1.7, // final scale, from 1

  // Shards thrown out from the centre.
  particleCount: 8,
  particleSize: 9, // px square, before it shrinks away
  particleSpeed: 300, // px/s at spawn
  particleSpread: 0.45, // 0..1 random variation in speed per shard
  particleAngleJitter: 0.4, // radians of random scatter off the even fan
  particleGravity: 1100, // px/s^2
  particleDuration: 0.45, // s

  // Bosses are a bigger event than a maths book. Multiplies the shard
  // count and how far they travel; the body ghost already scales itself,
  // since it is drawn at the boss's own size.
  bossScale: 2.2,
};

// Screen shake. Three sizes, in the order the game escalates: taking a
// hit, killing something, a boss changing phase (and dying, which is the
// last phase change it makes).
//
// Restrained on purpose. This is an interactive CV read by people who do
// not play games, and a shaking screen is the fastest way to make text
// unreadable and a viewer queasy. Two rules hold it in check:
//
//   - maxAmplitude caps every request, whatever it asks for.
//   - Only the world shakes. The HP pips, the pacing overlay and every
//     DOM control are drawn outside the camera transform and never move,
//     so nothing that has to be READ is ever in motion (game.js render).
export const SHAKE = {
  playerDamage: 5, // px
  enemyDeath: 7, // px
  bossPhaseChange: 11, // px -- also a boss death, the last phase change it makes
  duration: 0.22, // s, decaying linearly to nothing
  frequency: 34, // Hz
  maxAmplitude: 12, // px. A hard ceiling: no request may exceed this
};

export const HITSTOP = {
  enemyHit: 0.05, // s -- ~3 frames, any shot that takes hit points off something
  enemyDeath: 0.1, // s -- ~6 frames, a kill should land harder than a chip
};

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
  // Outfit tints, which are also the pickup boxes' colours. Both were
  // collisions: the suit sat on the platform colour and the USA
  // silhouette, and the armour was byte-identical to the football
  // helmet's dazed-and-vulnerable colour (ENEMY_HELMET.recoveryColor),
  // which is the one shade in the game that means "hit this now".
  // Both are now brighter and cooler than anything in the scenery, which
  // is desaturated throughout.
  colors: {
    suit: '#8d9bff',
    armour: '#dfe6f2',
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
  // A bright strip along the top edge of every platform. The body colour
  // alone sat inside the range the background silhouettes already use --
  // in the utspring section the staircase was actually DARKER than the
  // sky behind it and read as shadow. The highlight is the one thing in
  // the game that means "you can stand on this", and because it is on
  // every platform it means it everywhere.
  topHighlightColor: '#93b0d8',
  topHighlightHeight: 5, // px
};

// Enemy roster (AGENTS.md §3). Three behaviours total: the maths book is
// killable and stationary, one behaviour placed three times in Lund (task
// 3.6 varies only where, never the logic); Endless Inbox can't be shot
// down, only gotten past; the football helmet charges. Visual variants
// belong to art (Milestone 6), not new logic here.
//
// The maths book is the game's first enemy and its real job is to teach
// shooting: stationary, low HP, and it fires one slow projectile straight
// ahead on a repeating idle -> telegraph -> shot cycle. "Straight ahead"
// is always leftward -- the level runs one direction and the player
// always approaches a stationary book from the left, so firing left is
// always firing back toward wherever the player is coming from.
export const ENEMY_MATHBOOK = {
  width: 48,
  height: 48,
  color: '#8a5a3a', // closed cover
  telegraphColor: '#e2b23c', // opens toward this before firing
  hp: 2, // dies in two hits
  contactDamage: 1,
  hitFlashDuration: 0.12, // s

  firstShotDelay: 1.4, // s of idle before the very first telegraph
  // s between one shot and the next wind-up starting. Deliberately longer
  // than projectileLifetime below: only one shot is ever in flight at a
  // time (matches "fires A single slow projectile"), so a player who never
  // reacts at all still only ever faces one threat, never several stacked
  // shots closing the gap between hits. This is what makes "a player who
  // does nothing must not die there" actually true rather than just slow.
  idleDuration: 6.2,
  telegraphDuration: 0.9, // s -- AGENTS.md §4's 0.8-1.0s range applies to enemies too

  projectileSpeed: 150, // px/s -- slow enough to walk away from without hurrying
  projectileWidth: 22,
  projectileHeight: 14,
  projectileColor: '#ff6b3d', // hazard orange (HAZARD) -- was gold, the UF stand's exact colour
  // s. At 150 px/s this is the shot's RANGE: 3s = 450px, a third of the
  // screen. It was 6s = 900px, which is further than the distance from
  // the player's spawn (x 120) to this enemy (x 900) -- so a player who
  // read the controls and did not move for half a minute was hit at the
  // spawn point, repeatedly, and eventually died there without ever
  // having touched a key. idleDuration's note above claims "a player who
  // does nothing must not die there"; at 6s that simply was not true.
  projectileLifetime: 3,
};

// No hitFlashDuration: the Endless Inbox cannot be damaged at all
// (damageEnemy returns before touching it), so it can never flash, and a
// duration for a flash that cannot happen is a number waiting to mislead
// whoever reads this next.
export const ENEMY_INBOX = {
  width: 56,
  height: 56,
  color: '#4a5568',
  contactDamage: 1,
};

// The football helmet (USA, exchange semester): idle -> telegraph -> charge
// -> recovery, on a loop. It teaches "dodge, then punish" -- exactly what
// the Graduation boss later assumes the player already knows. Invulnerable
// outside recovery; recovery is the only time it can be hurt, and it deals
// no contact damage while dazed there.
export const ENEMY_HELMET = {
  width: 56,
  height: 56,
  color: '#5a7a9a',
  telegraphColor: '#e2b23c', // same wind-up tell colour as every other telegraph
  recoveryColor: '#8a95a8', // dazed -- visibly different so "hit it now" reads at a glance
  hp: 6, // two-to-three full cycles for a competent player
  contactDamage: 1,
  hitFlashDuration: 0.12, // s

  idleMinDuration: 0.6, // s of idle before it's willing to wind up again
  telegraphDuration: 0.9, // s -- AGENTS.md §4's 0.8-1.0s range
  chargeSpeed: 520, // px/s
  chargeMaxDuration: 1.4, // s hard cap, in case it never reaches a bound
  recoveryDuration: 1.5, // s, dazed and damageable -- the only time it can be hurt
  chargeRange: 900, // px total room it may charge within, centred on its spawn x

  // Skip starting a wind-up if the player is this close horizontally and
  // at least this far above the helmet's top -- directly overhead (e.g.
  // mid-jump over it), where the tell would be unreadable.
  noChargeHorizontalRange: 60,
  noChargeVerticalRange: 40,
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
    mathbook: [
      '[BARK PLACEHOLDER — CV line 1, maths book kill]',
      '[BARK PLACEHOLDER — CV line 2, maths book kill]',
      '[BARK PLACEHOLDER — CV line 3, maths book kill]',
    ],
    helmet: ['[BARK PLACEHOLDER — CV line, football helmet kill]'],
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
      color: '#ff8a3d', // was a tan that vanished against the Handels columns
    },
    'high-arc': {
      telegraphDuration: 0.95,
      projectileSpeed: 360, // horizontal speed
      launchVy: -520, // px/s, negative is up
      gravity: 900, // px/s^2, arcs back down
      spawnHeightOffset: -40, // px above boss center
      projectileWidth: 18,
      projectileHeight: 18,
      color: '#ff4d3d',
    },
    'spread-burst': {
      telegraphDuration: 1.0,
      projectileSpeed: 360,
      repeatCount: 3,
      spreadAngleDeg: 26, // total fan angle across all projectiles
      projectileWidth: 16,
      projectileHeight: 10,
      color: '#ff4d3d',
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

  // How a claim is drawn. This used to sit inside bosses.js's draw call as
  // literal colours, two font sizes and a bare -22 offset, which made the
  // one piece of canvas text a player actually has to READ the only piece
  // whose presentation could not be adjusted from this file.
  boxFillColor: '#1b2333',
  boxBorderColor: '#f7f3e3',
  boxBorderWidth: 2, // px
  textColor: '#f7f3e3',
  textFont: '20px sans-serif',
  promptFont: '18px sans-serif',
  promptColor: '#f7f3e3',
  tauntColor: '#f0806f',

  promptText: 'Which claim is supported?',
  promptGapAboveClaims: 26, // px between the claim column and the prompt text
  evidenceMarkerColor: '#6fd67a',
  evidenceMarkerSize: 16,
  // px left of the claim box the evidence marker floats. To the side and
  // not above, because the claims stack tightly enough that "above" lands
  // inside the claim on top of this one.
  evidenceMarkerGapX: 22,
  evidenceBobAmplitude: 6, // px, gentle floating motion
  evidenceBobSpeed: 3, // radians/s
  taunts: ["That's not it.", 'Try again.', 'Read the data again.'],
  // s. Doubles as the claim lockout (polish-pass audit finding A11): a
  // wrong shot closes all three claims for this long, not just the one
  // that was hit, so holding fire down cannot brute-force the phase by
  // spraying every reachable height until one lands. The taunt is what's
  // actually shown during the lockout, which is why the same duration
  // drives both -- there is one window, not two to keep in sync.
  tauntDuration: 2.0,
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
