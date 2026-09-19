// level.js — the level as a data array. Moving, resizing or adding an
// entity means editing an entry here, never game.js's control flow
// (AGENTS.md §5). Positions are placeholder grey-box values; real level
// dressing (art, background) comes later (Milestone 7).
//
// Section lengths (tasks C/D) are derived, not guessed, from PLAYER.moveSpeed
// and PLAN.md task D's target section durations -- each section's length is
// the midpoint of its target range, in seconds, times moveSpeed. Reported in
// full in the task D commit message so the arithmetic can be checked.
//
//   moveSpeed = 360 px/s (config.js PLAYER.moveSpeed)
//   Lund              30-40s  -> midpoint 35.0s -> 35.0 * 360 = 12,600px
//   Göteborg          45-60s  -> midpoint 52.5s -> 52.5 * 360 = 18,900px
//   Golem -> Graduation arena 30-45s -> midpoint 37.5s -> 37.5 * 360 = 13,500px
//
// A section's own boss arena (activation line to the boss itself) is not
// part of either duration target -- it's counted separately below, sized
// for the fight rather than for travel time.
//
// That spacing alone would be long stretches of empty running, so task C's
// platforms fill it: every one forces a jump, and two also carry an
// enemy (noted at each). None sit inside a boss arena -- both stay flat
// per task C's constraint. Encounters cluster unevenly (two close
// together, then a quiet stretch, then one on a platform) rather than
// landing on a steady rhythm, which would read as filler.

import { WORLD, PLAYER, ENEMY_TRASH, ENEMY_INBOX, ENEMY_EXCHANGE, RESEARCH_GOLEM, GRADUATION, PICKUP, PLATFORM, STAIRCASE } from './config.js';

const SPAWN_X = 120;

// Two standard platform heights (task C: "fixed standard dimensions",
// AGENTS.md §5) -- variety without inventing a size per placement. Both
// comfortably under the player's own max jump apex (~153px, from
// PLAYER.jumpVelocity/WORLD.gravity), so every platform is reachable with
// room to spare -- "generous, not precise" (PLAN.md task C).
const CLEARANCE_LOW = 90;
const CLEARANCE_HIGH = 130;
const platformTop = (clearance) => WORLD.groundY - clearance;

// Boss arenas: fixed width from activation line to the boss, sized for the
// fight (dodge room), not derived from a travel-time target. Both stay
// flat (task C) -- no platform is ever placed between an arena's
// activation entry and its own comic-trigger/checkpoint/boss entries.
const ARENA_WIDTH = 600;

// --- Lund (12,600px: SPAWN_X to the end of the utspring) ------------------
const TRASH_GROUND_X = SPAWN_X + 600; // 720
const TRASH_JUMP_X = TRASH_GROUND_X + 500; // 1220 -- clustered with the one above
const PLATFORM_A_X = TRASH_JUMP_X + 3200; // 4420 -- quiet stretch, then a jump
const PLATFORM_B_X = PLATFORM_A_X + 900; // 5320
const TRASH_LEDGE_PLATFORM_X = PLATFORM_B_X + 2200; // 7520 -- carries the ledge trash enemy

// --- The utspring staircase (PLAN.md task 3.5) ----------------------------
// The staircase is level data: a descending run of the ordinary platform
// entity, never a special shape in game.js. Its size is derived from the
// sequence's own timings in config.js, so the geometry and the auto-run
// can never drift apart.
//
// The descent auto-runs for STAIRCASE.descentDuration while ramping from
// PLAYER.moveSpeed to moveSpeed * speedRampMultiplier, so the distance
// covered is the average of the two speeds times the duration:
//
//   360 * ((1 + 1.5) / 2) * 3.0 = 1,350px
//
// One step short of that (floor(...) - 1) leaves a flat run-out at the
// bottom, so the player is standing on level ground when they come to a
// stop rather than still mid-drop off the last step.
const UTSPRING_RUN_LENGTH =
  PLAYER.moveSpeed * ((1 + STAIRCASE.speedRampMultiplier) / 2) * STAIRCASE.descentDuration; // 1350
const STAIR_STEPS = Math.max(1, Math.floor(UTSPRING_RUN_LENGTH / PLATFORM.width) - 1); // 5
const STAIR_TOP_CLEARANCE = STAIR_STEPS * STAIRCASE.stepDrop; // 220px above the ground

// Climbing to the top landing: as few platforms as reach it without any
// single hop exceeding CLEARANCE_HIGH, which is already a proven-reachable
// rise elsewhere in this file. 220 / 130 -> 2 hops of 110px each.
const STAIR_ASCENT_STEPS = Math.ceil(STAIR_TOP_CLEARANCE / CLEARANCE_HIGH); // 2
const STAIR_ASCENT_RISE = STAIR_TOP_CLEARANCE / STAIR_ASCENT_STEPS; // 110

// Where the sequence ends is Lund's derived length; everything else in the
// staircase is measured backwards from there, so the section still runs
// its full 12,600px.
const UTSPRING_END_X = SPAWN_X + 12600; // 12720
const STAIRCASE_START_X = UTSPRING_END_X - UTSPRING_RUN_LENGTH; // 11370 -- the handover line
const STAIRCASE_ASCENT_X = STAIRCASE_START_X - STAIR_ASCENT_STEPS * PLATFORM.width; // 10930

const PLATFORM_C_X = STAIRCASE_ASCENT_X - 1500; // 9430 -- last ordinary jump before the climb

// The descending run itself: one platform per step, each PLATFORM.width
// along and STAIRCASE.stepDrop further down. The final step sits one drop
// above the ground, and the ground carries the run-out.
const stairSteps = () =>
  Array.from({ length: STAIR_STEPS }, (unused, i) => ({
    type: 'platform',
    x: STAIRCASE_START_X + i * PLATFORM.width,
    y: WORLD.groundY - (STAIR_TOP_CLEARANCE - i * STAIRCASE.stepDrop),
  }));

// The approach climb, ending on a landing level with the first step so the
// top of the staircase reads as one continuous surface.
const stairAscent = () =>
  Array.from({ length: STAIR_ASCENT_STEPS }, (unused, i) => ({
    type: 'platform',
    x: STAIRCASE_ASCENT_X + i * PLATFORM.width,
    y: WORLD.groundY - (i + 1) * STAIR_ASCENT_RISE,
  }));

// --- Göteborg (18,900px: the end of the utspring to the Golem's line) ----
const PLATFORM_D_X = UTSPRING_END_X + 2000; // 14720
const PLATFORM_E_X = PLATFORM_D_X + 1800; // 16520 -- clustered with D
const INBOX_X = PLATFORM_E_X + 3500; // 20020 -- quiet stretch
const EXCHANGE_PLATFORM_X = INBOX_X + 2500; // 22520 -- carries the exchange enemy
const PLATFORM_F_X = EXCHANGE_PLATFORM_X + 3500; // 26020 -- quiet stretch
const PLATFORM_G_X = PLATFORM_F_X + 1600; // 27620 -- clustered with F
const GOLEM_COMIC_X = PLATFORM_G_X + 3500; // 31120
const GOLEM_ACTIVATION_X = GOLEM_COMIC_X + 500; // 31620 = UTSPRING_END_X + 18,900 ✓

// --- Research Golem arena --------------------------------------------------
const BOSS_X = GOLEM_ACTIVATION_X + ARENA_WIDTH; // 32220
const GOLEM_EXIT_X = BOSS_X + RESEARCH_GOLEM.width; // 32360 -- where the player continues after winning

// --- Golem exit to the Graduation arena's activation line (13,500px) ------
const SUIT_X = BOSS_X + RESEARCH_GOLEM.width + 200; // 32560
const PLATFORM_H_X = GOLEM_EXIT_X + 1000; // 33360
const PLATFORM_I_X = PLATFORM_H_X + 900; // 34260 -- clustered with H
const PLATFORM_J_X = PLATFORM_I_X + 4000; // 38260 -- quiet stretch
const PLATFORM_K_X = PLATFORM_J_X + 4500; // 42760 -- quiet stretch
const PLATFORM_L_X = PLATFORM_K_X + 1200; // 43960 -- clustered with K
const GRADUATION_COMIC_X = PLATFORM_L_X + 1400; // 45360
const GRADUATION_ACTIVATION_X = GOLEM_EXIT_X + 13500; // 45860 = GOLEM_EXIT_X + 13,500 ✓

// --- Graduation arena -------------------------------------------------------
const GRADUATION_X = GRADUATION_ACTIVATION_X + ARENA_WIDTH; // 46460
const ARMOUR_X = GRADUATION_X + GRADUATION.width + 200; // 46800
const FINAL_COMIC_X = GRADUATION_X + GRADUATION.width + 300; // 46900

export const LEVEL = [
  { type: 'player-spawn', x: SPAWN_X },

  // Lund trash: one behaviour (identical createTrashEnemy/updateEnemy/
  // damageEnemy for all three), placed three ways so each plays
  // differently (task 3.6):
  //   ground  plain -- walk into it for contact damage, or shoot it from
  //           the ground, or jump over it. The baseline encounter.
  { type: 'enemy-trash', x: TRASH_GROUND_X },
  //   jump    ground level like the first, clustered close behind it --
  //           not enough room to safely shoot it down in passing, so
  //           clearing it means actually jumping it, not just plinking it.
  { type: 'enemy-trash', x: TRASH_JUMP_X },

  // Pure traversal platforms (task C: "force a jump"), breaking up the
  // long run to the staircase. Neither carries anything -- forcing the
  // jump is the whole job.
  { type: 'platform', x: PLATFORM_A_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_B_X, y: platformTop(CLEARANCE_HIGH) },

  //   ledge   now a real platform (task C), not just a floating position --
  //           contact-safe from the ground, only killable with a jump-timed
  //           shot or by climbing up (same height logic verified for the
  //           claim phase, task 2.5). Optional: skip it, or take the skill
  //           shot.
  { type: 'platform', x: TRASH_LEDGE_PLATFORM_X, y: platformTop(CLEARANCE_LOW) },
  {
    type: 'enemy-trash',
    x: TRASH_LEDGE_PLATFORM_X + (PLATFORM.width - ENEMY_TRASH.width) / 2,
    y: platformTop(CLEARANCE_LOW) - ENEMY_TRASH.height,
  },

  { type: 'platform', x: PLATFORM_C_X, y: platformTop(CLEARANCE_LOW) },

  // The utspring (AGENTS.md §3, PLAN.md task 3.5). No enemy may ever be
  // placed between PLATFORM_C_X and UTSPRING_END_X: this is the one
  // moment in the game where the player is not fighting, and that is the
  // entire point of it.
  //
  // Climb to the top landing, then the descending staircase. Both are
  // ordinary one-way platforms -- the same entity used everywhere else.
  ...stairAscent(),
  ...stairSteps(),

  // Crossing the top of the staircase hands control over to the scripted
  // sequence in game.js, which auto-runs the descent, rains confetti,
  // flashes, puts the studentmössa on the player and shows the title
  // card before handing control back. Fires exactly once per playthrough.
  { type: 'utspring-trigger', x: STAIRCASE_START_X },

  // One continuous level, two places (AGENTS.md §3): the backdrop swaps
  // right where the studentmössa is earned, no loading break.
  { type: 'section-transition', x: UTSPRING_END_X, section: 'goteborg' },

  // The checkpoint sits at the END of the sequence, after control
  // returns: someone who dies shortly afterwards resumes here already
  // wearing the studentmössa and never replays the cutscene. (It could
  // not re-trigger in any case -- game.js runs it once per playthrough --
  // but respawning behind it would still mean re-running the staircase on
  // foot for nothing.)
  { type: 'checkpoint', x: UTSPRING_END_X },

  { type: 'platform', x: PLATFORM_D_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_E_X, y: platformTop(CLEARANCE_HIGH) },

  { type: 'enemy-inbox', x: INBOX_X },

  //   exchange  now carried on a platform (task C) -- same patrol logic,
  //             just elevated, so it reads as a different encounter from
  //             ground level despite being identical code.
  { type: 'platform', x: EXCHANGE_PLATFORM_X, y: platformTop(CLEARANCE_LOW) },
  {
    type: 'enemy-exchange',
    x: EXCHANGE_PLATFORM_X + (PLATFORM.width - ENEMY_EXCHANGE.width) / 2,
    y: platformTop(CLEARANCE_LOW) - ENEMY_EXCHANGE.height,
  },

  { type: 'platform', x: PLATFORM_F_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_G_X, y: platformTop(CLEARANCE_HIGH) },

  // Story beat 5 (AGENTS.md §3): comic, then BOSS 1. Placed well before
  // the arena's activation line so the wake-up beat (task B) can never
  // land mid-comic.
  { type: 'comic-trigger', x: GOLEM_COMIC_X, comicId: 'pre-research-golem', next: 'playing' },
  // Ahead of the boss so dying mid-fight (task 2.6) doesn't mean a long
  // walk back across the whole level to retry it. Same position as the
  // arena's activation line (task B), so a respawn always lands at the
  // arena's mouth, never outside a closed wall.
  { type: 'checkpoint', x: GOLEM_ACTIVATION_X },
  { type: 'boss-research-golem', x: BOSS_X, activationX: GOLEM_ACTIVATION_X },

  // Suit replaces studentmössa (AGENTS.md §3/§6).
  { type: 'pickup', outfit: 'suit', x: SUIT_X },

  // Golem exit to the Graduation arena: no enemy type is assigned to this
  // stretch (AGENTS.md §3 lists Lund's and Göteborg's rosters only), so
  // task C fills it with jump-forcing platforms alone rather than
  // inventing a new enemy.
  { type: 'platform', x: PLATFORM_H_X, y: platformTop(CLEARANCE_HIGH) },
  { type: 'platform', x: PLATFORM_I_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_J_X, y: platformTop(CLEARANCE_HIGH) },
  { type: 'platform', x: PLATFORM_K_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_L_X, y: platformTop(CLEARANCE_HIGH) },

  // Story beat 7: comic, then BOSS 2, same placement logic as the golem's.
  { type: 'comic-trigger', x: GRADUATION_COMIC_X, comicId: 'pre-graduation', next: 'playing' },
  // Ahead of Graduation, same reasoning as the checkpoint before the
  // Research Golem (task 2.6), inside its arena's activation line (task B).
  { type: 'checkpoint', x: GRADUATION_X - 100 },
  { type: 'boss-graduation', x: GRADUATION_X, activationX: GRADUATION_ACTIVATION_X },

  // Picked up immediately before the final comic (AGENTS.md §3).
  { type: 'pickup', outfit: 'armour', x: ARMOUR_X },
  // Story beat 9: final comic, then straight to the application screen --
  // the game ends before the Paradox fight (AGENTS.md §3, "do not add a
  // Paradox fight").
  { type: 'comic-trigger', x: FINAL_COMIC_X, comicId: 'final', next: 'application' },
];

// Height of each spawnable type, used to stand it on the ground by default.
const ENTITY_HEIGHT = {
  'player-spawn': PLAYER.height,
  'enemy-trash': ENEMY_TRASH.height,
  'enemy-inbox': ENEMY_INBOX.height,
  'enemy-exchange': ENEMY_EXCHANGE.height,
  'boss-research-golem': RESEARCH_GOLEM.height,
  'boss-graduation': GRADUATION.height,
  checkpoint: PLAYER.height,
  pickup: PICKUP.height,
};

// An entry's y: explicit y wins (elevated placements -- ledge/platform
// enemies, platforms themselves), otherwise it stands on the ground based
// on its own height.
export function entryY(entry) {
  if (entry.y !== undefined) return entry.y;
  return WORLD.groundY - ENTITY_HEIGHT[entry.type];
}
