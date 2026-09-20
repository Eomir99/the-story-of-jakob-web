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

import { WORLD, PLAYER, ENEMY_MATHBOOK, ENEMY_INBOX, ENEMY_HELMET, RESEARCH_GOLEM, GRADUATION, PICKUP, PLATFORM, STAIRCASE } from './config.js';

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
// The maths book (the enemy-behaviours brief): one behaviour, placed three
// times so it plays differently each time despite identical logic --
//   1  MATHBOOK_1_X             alone, flat ground, nothing else on screen.
//                               The game's shooting tutorial; this
//                               encounter cannot be lost.
//   2  MATHBOOK_2_PLATFORM_X    on a ledge -- jump-timed shot, or walk under.
//   3  MATHBOOK_3_PLATFORM_X    past a real gap between two platforms --
//                               jump it while its shot may be in the air,
//                               or skip it at ground level like the ledge.
const MATHBOOK_1_X = SPAWN_X + 780; // 900 -- alone; nothing else until PLATFORM_A_X
const PLATFORM_A_X = MATHBOOK_1_X + 1400; // 2300 -- quiet stretch, then a jump
const PLATFORM_B_X = PLATFORM_A_X + 900; // 3200 -- clustered with A
const MATHBOOK_2_PLATFORM_X = PLATFORM_B_X + 1600; // 4800 -- carries the ledge book
const GAP_APPROACH_PLATFORM_X = MATHBOOK_2_PLATFORM_X + 1600; // 6400 -- launch side of the gap
const MATHBOOK_3_GAP_WIDTH = 200; // px -- comfortably under the ~268px max jump range
const MATHBOOK_3_PLATFORM_X = GAP_APPROACH_PLATFORM_X + PLATFORM.width + MATHBOOK_3_GAP_WIDTH; // 6820 -- carries the far-side book

// Checkpoints (AGENTS.md §6: invisible checkpoints; polish-pass audit
// finding A2). Before this, Lund carried none at all -- the only
// checkpoint anywhere in the section was UTSPRING_END_X, so dying at the
// gap jump (6,820) replayed the entire section from SPAWN_X (120), about
// 18.6s of running back through content that had already been cleared.
// Three checkpoints keep every death in Lund under ~15s of replay:
const CHECKPOINT_AFTER_MATHBOOK_1_X = MATHBOOK_1_X + 200; // 1100 -- past the tutorial book
const CHECKPOINT_BEFORE_GAP_X = GAP_APPROACH_PLATFORM_X - 300; // 6100 -- short of the gap jump
// STAIRCASE_START_X is defined below (it's derived from the descent
// timing); this checkpoint sits one pixel short of it. Reaching it means
// the ascent climb is already done, so respawning here drops the player
// right back at the top -- one step forward re-triggers the utspring
// exactly as if they'd just climbed it.

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
const STAIR_ASCENT_RISE = STAIR_TOP_CLEARANCE / STAIR_ASCENT_STEPS; // 80

// The top of the first step: the mark the handover stands the player on.
const STAIR_TOP_Y = WORLD.groundY - STAIR_TOP_CLEARANCE;

// Where the sequence ends is Lund's derived length; everything else in the
// staircase is measured backwards from there, so the section still runs
// its full 12,600px.
const UTSPRING_END_X = SPAWN_X + 12600; // 12720
const STAIRCASE_START_X = UTSPRING_END_X - UTSPRING_RUN_LENGTH; // 11370 -- the handover line
const CHECKPOINT_AT_STAIRCASE_TOP_X = STAIRCASE_START_X - 1; // 11369 -- see the note above
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
// 26020. Previously derived through the inbox and exchange placements,
// which now live in the Clinic and USA sections below (task 6.8's section
// order). The absolute position is unchanged -- this task moves no
// platform and changes no level length.
const PLATFORM_F_X = PLATFORM_E_X + 9500; // 26020 -- quiet stretch
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
// The two encounters this stretch previously had none of: the admin
// enemy belongs to the Clinic section and the football helmet to USA
// (task 6.8). Both sit in the quiet gaps between existing platforms, so
// nothing moved to make room for them.
const CLINIC_INBOX_X = 36200; // between platforms I and J
// The football helmet needs open ground to charge, not a small elevated
// platform, so it stands directly on the ground -- fitting for the "usa
// stadium" section's open field look (config.js BACKGROUNDS). It sits with
// generous room either side of it within the section (SECTION_USA_X to
// SECTION_GU_X below) for its ENEMY_HELMET.chargeRange.
const USA_HELMET_X = 40800; // between the USA boundary and platform K
const PLATFORM_L_X = PLATFORM_K_X + 1200; // 43960 -- clustered with K
const GRADUATION_COMIC_X = PLATFORM_L_X + 1400; // 45360
const GRADUATION_ACTIVATION_X = GOLEM_EXIT_X + 13500; // 45860 = GOLEM_EXIT_X + 13,500 ✓

// --- Graduation arena -------------------------------------------------------
const GRADUATION_X = GRADUATION_ACTIVATION_X + ARENA_WIDTH; // 46460
const ARMOUR_X = GRADUATION_X + GRADUATION.width + 200; // 46800
const FINAL_COMIC_X = GRADUATION_X + GRADUATION.width + 300; // 46900

// --- Background sections (task 6.8) ----------------------------------------
// Eight sections, in level order. The order is deliberate and is NOT
// chronological: the Research Golem sits earlier than the events it
// follows in real life, because putting it immediately before the
// Graduation boss would stack two bosses back to back with almost no
// level between them. Pacing wins over chronology. Do not "fix" it.
//
// This also means the roster in AGENTS.md §3 -- which lists the Endless
// Inbox and exchange-semester enemies under Göteborg, before boss 1 -- no
// longer matches where they stand. The section order here supersedes it.
//
// Boundaries are measured off the landmarks that already exist, so moving
// the staircase or an arena carries its section with it. Each is one line.
//
//   #  section                        start    length   at 360 px/s
//   1  Lund -- town                       0    4,200       11.7 s
//   2  Polhem -- the school           4,200    5,730       15.9 s
//   3  Lund -- the utspring           9,930    2,790        7.8 s
//   4  Göteborg -- the city          12,720   18,400       51.1 s
//   5  Handels -- Golem arena        31,120    1,780        4.9 s
//   6  Clinic -- reception           32,900    6,200       17.2 s
//   7  USA -- the stadium            39,100    6,260       17.4 s
//   8  GU -- Graduation arena        45,360    2,040        5.7 s
//                                            -------      -------
//                                            47,400      131.7 s
const SECTION_POLHEM_X = 4200;
const SECTION_LUND_RETURN_X = STAIRCASE_ASCENT_X - 1000; // 9930
// UTSPRING_END_X (12720) starts Göteborg -- the backdrop still swaps
// exactly where the studentmössa is earned.
const SECTION_HANDELS_X = GOLEM_COMIC_X; // 31120 -- the interior opens as the comic plays
const SECTION_CLINIC_X = SUIT_X + 340; // 32900 -- once the suit is collected
const SECTION_USA_X = 39100;
const SECTION_GU_X = GRADUATION_COMIC_X; // 45360 -- same framing as Handels
const LEVEL_END_X = FINAL_COMIC_X + 500; // 47400

// Landmark placements. Parallax is per placement, not per landmark: how
// far away a thing reads is a layout decision, and the same object could
// sit on the horizon in one place and close by in another.
const UF_STAND_X = 1800;
const POLHEM_MECH_X = 6200;
const STADIUM_X = 41400;

// How far the ground is filled either side of the level proper. This is
// layout, not rendering trivia: it is "where the level's floor starts and
// stops", and it was two bare constants in game.js (-5000 and a flat
// 60000) that had to be re-checked by hand every time the level's length
// changed. Derived from the level's own end instead, so it follows.
const RENDER_MARGIN = 5000; // px
export const LEVEL_BOUNDS = {
  renderLeft: -RENDER_MARGIN,
  renderRight: LEVEL_END_X + RENDER_MARGIN, // 52,400
};

export const LEVEL = [
  // Sections are level data: an x-range plus which background to wear.
  // The look itself (layers, parallax, colours) is a tunable and lives in
  // config.js BACKGROUNDS. Adding, reordering or resizing a section is a
  // data edit here; it is never a code edit.
  { type: 'background-section', name: 'Lund — town', xStart: 0, xEnd: SECTION_POLHEM_X, background: 'lund-town' },
  { type: 'background-section', name: 'Polhem — the school', xStart: SECTION_POLHEM_X, xEnd: SECTION_LUND_RETURN_X, background: 'polhem-school' },
  { type: 'background-section', name: 'Lund — the utspring', xStart: SECTION_LUND_RETURN_X, xEnd: UTSPRING_END_X, background: 'lund-utspring' },
  { type: 'background-section', name: 'Göteborg — the city', xStart: UTSPRING_END_X, xEnd: SECTION_HANDELS_X, background: 'goteborg-city' },
  { type: 'background-section', name: 'Handels — Golem arena', xStart: SECTION_HANDELS_X, xEnd: SECTION_CLINIC_X, background: 'handels-interior' },
  { type: 'background-section', name: 'Clinic — reception', xStart: SECTION_CLINIC_X, xEnd: SECTION_USA_X, background: 'clinic-reception' },
  { type: 'background-section', name: 'USA — the stadium', xStart: SECTION_USA_X, xEnd: SECTION_GU_X, background: 'usa-stadium' },
  { type: 'background-section', name: 'GU — Graduation arena', xStart: SECTION_GU_X, xEnd: LEVEL_END_X, background: 'gu-ceremony' },

  // Landmarks: one-off background objects at a single x, each scrolling
  // at its own rate. Not tiled, not gameplay -- nothing collides with
  // them.
  { type: 'landmark', landmark: 'uf-stand', x: UF_STAND_X, parallax: 0.6 },
  { type: 'landmark', landmark: 'polhem-mech', x: POLHEM_MECH_X, parallax: 0.25 },
  { type: 'landmark', landmark: 'stadium', x: STADIUM_X, parallax: 0.35 },

  { type: 'player-spawn', x: SPAWN_X },

  //   1  alone. Flat ground, nothing else on screen, no platform or gap
  //      until it's dealt with. Standing still and taking a hit costs some
  //      health and nothing else; walking backwards avoids it entirely.
  { type: 'enemy-mathbook', x: MATHBOOK_1_X },

  // Audit finding A2: the tutorial encounter is cleared, so a death from
  // here on no longer walks all the way back to SPAWN_X.
  { type: 'checkpoint', x: CHECKPOINT_AFTER_MATHBOOK_1_X },

  // Pure traversal platforms (task C: "force a jump"), breaking up the run
  // to the ledge. Neither carries anything -- forcing the jump is the
  // whole job.
  { type: 'platform', x: PLATFORM_A_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_B_X, y: platformTop(CLEARANCE_HIGH) },

  //   2  ledge. Contact-safe from the ground -- only killable with a
  //      jump-timed shot or by climbing up (same height logic verified for
  //      the claim phase, task 2.5). Optional: skip it, or take the skill
  //      shot.
  { type: 'platform', x: MATHBOOK_2_PLATFORM_X, y: platformTop(CLEARANCE_LOW) },
  {
    type: 'enemy-mathbook',
    x: MATHBOOK_2_PLATFORM_X + (PLATFORM.width - ENEMY_MATHBOOK.width) / 2,
    y: platformTop(CLEARANCE_LOW) - ENEMY_MATHBOOK.height,
  },

  // Audit finding A2: short of the gap jump, so a missed jump or a death
  // to the book on the far side never replays the ledge encounter too.
  { type: 'checkpoint', x: CHECKPOINT_BEFORE_GAP_X },

  //   3  behind a real gap between two platforms: a launch platform, then
  //      MATHBOOK_3_GAP_WIDTH of open air, then the book's platform.
  //      Reachable by jumping the gap while its slow shot may already be
  //      in flight, or skippable at ground level like the ledge.
  { type: 'platform', x: GAP_APPROACH_PLATFORM_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: MATHBOOK_3_PLATFORM_X, y: platformTop(CLEARANCE_LOW) },
  {
    type: 'enemy-mathbook',
    x: MATHBOOK_3_PLATFORM_X + (PLATFORM.width - ENEMY_MATHBOOK.width) / 2,
    y: platformTop(CLEARANCE_LOW) - ENEMY_MATHBOOK.height,
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
  //
  // `y` is the mark: the top of the first step, where the handover stands
  // the player. The ground below the staircase is flat and open -- there
  // is no wall to stop anyone simply holding right -- so without this a
  // player arrives *underneath* the stairs and runs the whole beat along
  // level ground, never touching the thing it is named after. Someone who
  // did climb the approach platforms is already at exactly this height,
  // so for them it changes nothing.
  // Audit finding A2: one pixel short of the trigger line, so a death
  // during the ascent climb resumes right at the top of it rather than
  // back at PLATFORM_C_X -- and since the ground here is open (no wall,
  // see the comment above), a respawn one step from the trigger simply
  // walks straight into the utspring on the very next step.
  { type: 'checkpoint', x: CHECKPOINT_AT_STAIRCASE_TOP_X },

  { type: 'utspring-trigger', x: STAIRCASE_START_X, y: STAIR_TOP_Y },

  // The checkpoint sits at the END of the sequence, after control
  // returns: someone who dies shortly afterwards resumes here already
  // wearing the studentmössa and never replays the cutscene. (It could
  // not re-trigger in any case -- game.js runs it once per playthrough --
  // but respawning behind it would still mean re-running the staircase on
  // foot for nothing.)
  { type: 'checkpoint', x: UTSPRING_END_X },

  { type: 'platform', x: PLATFORM_D_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_E_X, y: platformTop(CLEARANCE_HIGH) },

  // The Endless Inbox and the football helmet used to stand here. Task
  // 6.8's section order puts the admin enemy in the Clinic and the
  // football helmet in USA, both of which come AFTER the Research Golem,
  // so both moved down this file. See the note on the section table.

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

  // The Endless Inbox: can't be shot down, only gotten past (AGENTS.md
  // §3 -- the admin summer job).
  { type: 'enemy-inbox', x: CLINIC_INBOX_X },
  { type: 'platform', x: PLATFORM_J_X, y: platformTop(CLEARANCE_HIGH) },

  // The football helmet (USA, exchange semester): idle, telegraph, charge,
  // recover -- "dodge, then punish". Flat open ground, no platform: its
  // ENEMY_HELMET.minX/maxX (centred on this x) already bound the charge to
  // this stretch on their own.
  { type: 'enemy-helmet', x: USA_HELMET_X },

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
  'enemy-mathbook': ENEMY_MATHBOOK.height,
  'enemy-inbox': ENEMY_INBOX.height,
  'enemy-helmet': ENEMY_HELMET.height,
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
