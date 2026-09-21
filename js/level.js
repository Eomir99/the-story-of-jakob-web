// level.js — the level as a data array. Moving, resizing or adding an
// entity means editing an entry here, never game.js's control flow
// (AGENTS.md §5). Positions are placeholder grey-box values; real level
// dressing (art, background) comes later (Milestone 7).
//
// Section lengths (tasks C/D) were originally derived from PLAYER.moveSpeed
// and PLAN.md task D's target section durations -- each section's length was
// the midpoint of its target range, in seconds, times moveSpeed:
//
//   moveSpeed = 360 px/s (config.js PLAYER.moveSpeed)
//   Lund              30-40s  -> midpoint 35.0s -> 35.0 * 360 = 12,600px
//
// The level-compression pass (PLAN.md, "shorten the level") replaced that
// duration-target method for everything after Lund: Göteborg was roughly
// 18,400px of mostly-empty travel, so it is now HALVED to 9,200px by
// shortening its quiet traversal gap, not by removing enemies or platforms.
// Everything downstream (the Research Golem arena, the new short Haga
// exterior, Clinic, USA and the Graduation arena) is reflowed to follow it,
// each sized to what its own content needs rather than to a fixed seconds
// target -- see the section table below for the current lengths.
//
// A section's own boss arena (activation line to the boss itself) is not
// part of any travel-time target -- it's counted separately below, sized
// for the fight rather than for travel time.
//
// That spacing alone would be long stretches of empty running, so task C's
// platforms fill it: every one forces a jump, and two also carry an
// enemy (noted at each). None sit inside a boss arena -- both stay flat
// per task C's constraint. Encounters cluster unevenly (two close
// together, then a quiet stretch, then one on a platform) rather than
// landing on a steady rhythm, which would read as filler.

import { CANVAS, WORLD, PLAYER, ENEMY_MATHBOOK, ENEMY_INBOX, ENEMY_HELMET, RESEARCH_GOLEM, RESEARCH_GOLEM_EXIT, GRADUATION, PICKUP, PLATFORM, STAIRCASE, BOSS_APPROACH } from './config.js';

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
    walkway: true,
  }));

// The approach climb, ending on a landing level with the first step so the
// top of the staircase reads as one continuous surface.
const stairAscent = () =>
  Array.from({ length: STAIR_ASCENT_STEPS }, (unused, i) => ({
    type: 'platform',
    x: STAIRCASE_ASCENT_X + i * PLATFORM.width,
    y: WORLD.groundY - (i + 1) * STAIR_ASCENT_RISE,
    walkway: true,
  }));

// --- Göteborg (9,200px: the end of the utspring to the Golem's line) -----
// Level-compression pass: this section was 18,400px, almost exactly half of
// which was one uninterrupted "quiet stretch" between platforms E and F
// (9,500px of empty running -- more than the whole Lund section). Halving
// the section means cutting that gap down, not removing any enemy,
// platform or the approach to the Research Golem building. Every beat that
// existed before (both platform clusters, the quiet breather between them,
// the approach comic and activation line) is still here, just closer
// together. All four platforms keep their original relative clustering
// (D+E close together, F+G close together) -- only the long gap shrank.
const PLATFORM_D_X = UTSPRING_END_X + 1200; // 13920
const PLATFORM_E_X = PLATFORM_D_X + 900; // 14820 -- clustered with D
const PLATFORM_F_X = PLATFORM_E_X + 4200; // 19020 -- quiet stretch, was 9,500
const PLATFORM_G_X = PLATFORM_F_X + 900; // 19920 -- clustered with F
const GOLEM_COMIC_X = PLATFORM_G_X + 2000; // 21920 -- background boundary only now (see SECTION_HANDELS_X)
const GOLEM_ACTIVATION_X = GOLEM_COMIC_X + 500; // 22420 = UTSPRING_END_X + 9,700 (9,200 section + 500 comic-to-activation) ✓
// Also the Research Golem venue's own entry line (RESEARCH_GOLEM_ENTRY_X
// below): the line the scripted approach walk ends exactly on, where the
// comic opens, and where the player is standing -- already just inside the
// arena's own left door (art-source/backgrounds/boss-1-arena-v2.png) --
// the instant it closes.

// The boss approach (task 3, playtest round 2; camera-reveal repair task):
// a short scripted sequence replaces the comic popping up the instant this
// line is crossed. RESEARCH_GOLEM_TAKEOVER_X is sized backwards from the
// activation line so the WALK phase (config.js BOSS_APPROACH.walkDuration
// at PLAYER.moveSpeed) lands the player exactly on it as the walk ends --
// the same "arrives as the timer runs out" trick STAIRCASE uses below.
// That means the real fight (bosses.js activation) starts the instant
// control returns from the comic, with no further walking needed.
const RESEARCH_GOLEM_TAKEOVER_X = GOLEM_ACTIVATION_X - PLAYER.moveSpeed * BOSS_APPROACH.walkDuration; // 21844

// --- Research Golem arena --------------------------------------------------
// Art integration pass (art-source/backgrounds/boss-1-arena-v2.png): the
// arena is the actual `research-golem-arena` artwork (config.js
// LANDMARK.types), a single enclosed hall image with a small entrance
// door, a centred globe pedestal and a small exit door, rather than a
// generic tiled interior. "Do not treat earlier coordinates for the old
// arena layout as sacred" (task brief) -- BOSS_X/GOLEM_EXIT_X/SUIT_X below
// are measured against the art's own door/pedestal positions, not the old
// ARENA_WIDTH=600 placeholder gap (Graduation, further down, still uses
// ARENA_WIDTH -- its own arena art doesn't exist yet).
//
// Local x positions, measured on the delivered 2172×724 v2 image: left
// door 165, centre pedestal 1086, right door 1980. ARENA_IMAGE_X is the
// image's placed left edge in world space, chosen so its own left door
// lines up with GOLEM_ACTIVATION_X -- see the note there.
const ARENA_LEFT_DOOR_LOCAL_X = 165;
const ARENA_CENTRE_LOCAL_X = 1086; // the globe pedestal -- where the boss stands
const ARENA_RIGHT_DOOR_LOCAL_X = 1980;
const ARENA_IMAGE_WIDTH = 2172;
const ARENA_IMAGE_X = GOLEM_ACTIVATION_X - ARENA_LEFT_DOOR_LOCAL_X; // 22255

const BOSS_X = ARENA_IMAGE_X + ARENA_CENTRE_LOCAL_X; // 23341 -- centre stage, at the pedestal
const GOLEM_EXIT_X = BOSS_X + RESEARCH_GOLEM.width; // 23481 -- where the player continues after winning

const SUIT_X = GOLEM_EXIT_X + 200; // 23681 -- before the art's own exit door
// (RESEARCH_GOLEM_EXIT_X, below): "the player retains normal control,
// continues right" (task brief) rather than an immediate cut from suit
// pickup to the exit.

// The venue's own exit line: the art's right door, in world space. This
// is the SINGLE authored line the repair task's explicit interior/exterior
// state is keyed on (see researchGolemInterior() in game.js) -- crossing it
// is what "uses that exit" means, not a separate trigger or a buffer past
// the door.
const RESEARCH_GOLEM_EXIT_X = ARENA_IMAGE_X + ARENA_RIGHT_DOOR_LOCAL_X; // 24235

// The camera-reveal target for the approach (game.js updateBossApproach,
// REVEAL phase): an authored framing, not derived from where the player
// happens to stop (task brief). Its right edge sits
// BOSS_APPROACH.revealDoorMarginRight before the venue's entry door, so
// the rest of the locked frame -- everything left of that -- is the
// façade "presenting" itself, and the door (and the whole walk to it)
// stays inside the same locked shot per the task's requirement that the
// camera hold through both the reaction and the walk.
const RESEARCH_GOLEM_REVEAL_CAMERA_X = GOLEM_ACTIVATION_X - (CANVAS.width - BOSS_APPROACH.revealDoorMarginRight); // 21540

// --- Haga: short post-boss Göteborg exterior (~2,048px, one background
// strip width) ---------------------------------------------------------
// New section (NEW LEVEL FLOW): after the suit pickup, the player exits
// back into Göteborg for a short beat before the Clinic -- just enough to
// read as "outside again", no new encounters. SECTION_HAGA_X is exactly
// RESEARCH_GOLEM_EXIT_X: the same line the repair task's explicit render
// state flips on, so the background-section fallback and the landmark
// gating always agree about where the venue ends -- no gap, no overlap.
const SECTION_HAGA_X = RESEARCH_GOLEM_EXIT_X; // 24235
const HAGA_LENGTH = 2048; // one background-strip tile width (BACKGROUND-ASSET-SPEC.md)
const PLATFORM_H_X = SECTION_HAGA_X + 300; // pure traversal, no enemy (Haga stays short and empty)
const PLATFORM_I_X = PLATFORM_H_X + 900; // clustered with H

// Door-role repair task: the façade has two doors and they are not
// interchangeable (AGENTS.md §3, task brief §11) -- the LARGE DOUBLE DOOR is
// the pre-boss entrance, the SMALL SIDE DOOR is the post-boss exit only.
// This used to place the same full façade image twice and align BOTH
// placements on the small door's local x, so the entrance silently opened
// at the wrong door. Each placement now uses its own crop (config.js
// LANDMARK.types 'research-golem-facade-entrance'/'-exit',
// scripts/runtime-assets.py FACADE_CROPS) with its own door measured in
// that crop's own local coordinates (crops start at the shared source's
// x=0 and x=1050 respectively, so these are also valid source-image x's).
const FACADE_MAIN_DOOR_LOCAL_X = 585; // large double door, entrance crop
const FACADE_SIDE_DOOR_LOCAL_X = 743; // small side door, exit crop (source x 1793 - 1050)
const FACADE_ENTRANCE_X = GOLEM_ACTIVATION_X - FACADE_MAIN_DOOR_LOCAL_X; // pre-boss placement, large double door
const FACADE_EXIT_X = SECTION_HAGA_X - FACADE_SIDE_DOOR_LOCAL_X; // post-boss placement, small side door

// Post-boss exit repair task (§9): a short auto-walk through the exit door
// so leaving reads as an authored beat, not an abrupt cut when the render
// state flips from arena to Haga right at RESEARCH_GOLEM_EXIT_X. Trigger
// sits a short distance before the door, comfortably after the suit pickup
// (SUIT_X); RESEARCH_GOLEM_EXIT.walkDuration (config.js) then carries the
// player the rest of the way, ending just past the door.
const RESEARCH_GOLEM_EXIT_WALK_TRIGGER_X = RESEARCH_GOLEM_EXIT_X - RESEARCH_GOLEM_EXIT.triggerMarginBeforeDoor;

// --- Clinic: reception (~2,048px) --------------------------------------
const SECTION_CLINIC_X = SECTION_HAGA_X + HAGA_LENGTH; // 26283
const CLINIC_LENGTH = 2048;
// The Endless Inbox (AGENTS.md §3, admin summer job) is Clinic's one beat;
// centred in the section with room either side for its activation lead
// distance (config.js ACTIVATION.enemyLeadDistance).
const CLINIC_INBOX_X = SECTION_CLINIC_X + 1024; // 27307

// --- USA: the stadium (~7,100px) ----------------------------------------
const SECTION_USA_X = SECTION_CLINIC_X + CLINIC_LENGTH; // 28331
const PLATFORM_J_X = SECTION_USA_X + 1200; // 29531
// The football helmet (USA, exchange semester) needs open ground to
// charge, not a small elevated platform, so it stands directly on the
// ground -- fitting for the "usa stadium" section's open field look
// (config.js BACKGROUNDS). It sits with generous room either side of it
// within the section for its ENEMY_HELMET.chargeRange (±450px around it).
const USA_HELMET_X = SECTION_USA_X + 3200; // 31531
const PLATFORM_K_X = USA_HELMET_X + 1600; // 33131
const PLATFORM_L_X = PLATFORM_K_X + 900; // 34031 -- clustered with K
const GRADUATION_COMIC_X = PLATFORM_L_X + 1400; // 35431 -- background boundary only now (see SECTION_GU_X)
const GRADUATION_ACTIVATION_X = GRADUATION_COMIC_X + 500; // 35931

// Same boss-approach trick as the Golem's, above.
const GRADUATION_APPROACH_X = GRADUATION_ACTIVATION_X - PLAYER.moveSpeed * BOSS_APPROACH.walkDuration; // 35355

// --- Graduation arena -------------------------------------------------------
// Same note as the Research Golem arena above: internal geometry
// (activation line to the boss, boss to the pickup/final comic) is
// unchanged, only its start position moved earlier. Per the new level flow,
// this arena goes on to use the same boss-specific world-space scenery
// approach as the Research Golem's rather than ordinary parallax strips
// (AGENTS.md §6, BACKGROUND-ASSET-SPEC.md) -- that art and its exact
// door/boss placement are future work, not this task.
const GRADUATION_X = GRADUATION_ACTIVATION_X + ARENA_WIDTH; // 36531
const ARMOUR_X = GRADUATION_X + GRADUATION.width + 200; // 36871
const FINAL_COMIC_X = GRADUATION_X + GRADUATION.width + 300; // 36971

// --- Background sections ----------------------------------------------------
// Nine sections, in level order (level-compression pass: was eight, split by
// inserting the new short Haga exterior after the Research Golem arena --
// NEW LEVEL FLOW). The order is deliberate and is NOT chronological: the
// Research Golem sits earlier than the events it follows in real life,
// because putting it immediately before the Graduation boss would stack two
// bosses back to back with almost no level between them. Pacing wins over
// chronology. Do not "fix" it.
//
// AGENTS.md §3's beat table matches this order (Endless Inbox in Clinic,
// exchange-semester/football-helmet in USA, both after boss 1) -- if the two
// ever drift apart again, this section order is the source of truth.
//
// Boundaries are measured off the landmarks and entity chains defined
// above, so moving the staircase or an arena carries its section with it.
// Each is one line, except SECTION_HAGA_X, SECTION_CLINIC_X and
// SECTION_USA_X, which are defined further up next to the entity chains
// they bound (Haga/Clinic/USA above).
//
//   #  section                        start    length   at 360 px/s
//   1  Lund -- town                       0    4,200       11.7 s
//   2  Polhem -- the school           4,200    5,730       15.9 s
//   3  Lund -- the utspring           9,930    2,790        7.8 s
//   4  Göteborg -- the city          12,720    9,200       25.6 s
//   5  Handels -- Golem arena        21,920    2,315        6.4 s
//   6  Haga -- Göteborg exterior     24,235    2,048        5.7 s
//   7  Clinic -- reception           26,283    2,048        5.7 s
//   8  USA -- the stadium            28,331    7,100       19.7 s
//   9  GU -- Graduation arena        35,431    2,040        5.7 s
//                                            -------      -------
//                                            37,471      103.5 s
//
// (Boss-fight duration is not distance-based and isn't part of the "at
// 360 px/s" column above; the Handels and GU rows are their arenas' own
// activation-to-exit width, not a fight-time estimate either. Row 5's
// length is set by RESEARCH_GOLEM_EXIT_X, the venue's own explicit exit
// line -- see the render-state repair note above GOLEM_ACTIVATION_X.)
const SECTION_POLHEM_X = 4200;
const SECTION_LUND_RETURN_X = STAIRCASE_ASCENT_X - 1000; // 9930
// UTSPRING_END_X (12720) starts Göteborg -- the backdrop still swaps
// exactly where the studentmössa is earned.
const SECTION_HANDELS_X = GOLEM_COMIC_X; // 21920 -- the interior opens mid-approach, just before the comic
// SECTION_HAGA_X, SECTION_CLINIC_X and SECTION_USA_X are defined above, next
// to the entity chains they bound.
const SECTION_GU_X = GRADUATION_COMIC_X; // 35431 -- same framing as Handels
const LEVEL_END_X = FINAL_COMIC_X + 500; // 37471

// Landmark placements. Parallax is per placement, not per landmark: how
// far away a thing reads is a layout decision, and the same object could
// sit on the horizon in one place and close by in another.
const UF_STAND_X = 1800;
const POLHEM_MECH_X = 6200;
const STADIUM_X = USA_HELMET_X + 600; // same close spacing to the helmet as before

// How far the ground is filled either side of the level proper. This is
// layout, not rendering trivia: it is "where the level's floor starts and
// stops", and it was two bare constants in game.js (-5000 and a flat
// 60000) that had to be re-checked by hand every time the level's length
// changed. Derived from the level's own end instead, so it follows.
const RENDER_MARGIN = 5000; // px
export const LEVEL_BOUNDS = {
  renderLeft: -RENDER_MARGIN,
  renderRight: LEVEL_END_X + RENDER_MARGIN, // 42,471
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
  { type: 'background-section', name: 'Handels — Golem arena', xStart: SECTION_HANDELS_X, xEnd: SECTION_HAGA_X, background: 'handels-interior' },
  { type: 'background-section', name: 'Haga — Göteborg exterior', xStart: SECTION_HAGA_X, xEnd: SECTION_CLINIC_X, background: 'goteborg-haga' },
  { type: 'background-section', name: 'Clinic — reception', xStart: SECTION_CLINIC_X, xEnd: SECTION_USA_X, background: 'clinic-reception' },
  { type: 'background-section', name: 'USA — the stadium', xStart: SECTION_USA_X, xEnd: SECTION_GU_X, background: 'usa-stadium' },
  { type: 'background-section', name: 'GU — Graduation arena', xStart: SECTION_GU_X, xEnd: LEVEL_END_X, background: 'gu-ceremony' },

  // Landmarks: one-off background objects at a single x, each scrolling
  // at its own rate. Not tiled, not gameplay -- nothing collides with
  // them.
  { type: 'landmark', landmark: 'uf-stand', x: UF_STAND_X, parallax: 1 },
  { type: 'landmark', landmark: 'polhem-mech', x: POLHEM_MECH_X, parallax: 1 },
  { type: 'landmark', landmark: 'stadium', x: STADIUM_X, parallax: 0.35 },

  // Research Golem venue art (AGENTS.md §6's boss-specific world-space
  // scenery). Door-role repair task: the façade is placed twice, once
  // before the arena and once after (FACADE_ENTRANCE_X/FACADE_EXIT_X,
  // above), but as two DIFFERENT crops of the same source now, not the
  // same full asset -- the entrance crop's large double door and the exit
  // crop's small side door, per each placement's actual role (§11), so it
  // still reads as the same building both times without either moment
  // being able to show the wrong door.
  //
  // Repair task: the façade and the arena used to rely on draw order alone
  // (the arena listed last so it painted over the façade wherever their
  // wide bounding boxes happened to overlap) -- fragile "hope the building
  // covers it" masking that could and did show the wrong thing. Visibility
  // is now an explicit state instead: game.js's drawLandmarks calls
  // researchGolemInterior() (player.x against boss.activationX and the
  // boss's own exitX, both set below) and skips both façade crops entirely
  // while inside, skips the arena entirely while outside. Draw order among
  // these three no longer matters for correctness; they are listed in
  // level order for readability only.
  { type: 'landmark', landmark: 'research-golem-facade-entrance', x: FACADE_ENTRANCE_X, parallax: 1 },
  { type: 'landmark', landmark: 'research-golem-facade-exit', x: FACADE_EXIT_X, parallax: 1 },
  { type: 'landmark', landmark: 'research-golem-arena', x: ARENA_IMAGE_X, parallax: 1 },

  { type: 'player-spawn', x: SPAWN_X },

  //   1  alone. Flat ground, nothing else on screen, no platform or gap
  //      until it's dealt with. Standing still and taking a hit costs some
  //      health and nothing else; walking backwards avoids it entirely.
  //      This is the shooting tutorial (AUDIT.md A1): a player who stands
  //      still here for 60s must still be alive. The second and third
  //      placements below pick up the faster/tougher default tuning in
  //      config.js (task 1); this one keeps the old, gentler numbers as an
  //      explicit per-instance override so the tutorial never gets harder.
  { type: 'enemy-mathbook', x: MATHBOOK_1_X, hp: 2, idleDuration: 6.2 },

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

  // Story beat 5 (AGENTS.md §3): the camera-reveal repair task's scripted
  // sequence (game.js updateBossApproach) -- stop, camera reveal, Jakob's
  // reaction, walk to the door, comic, then BOSS 1. revealCameraX and
  // reactBark are what tell updateBossApproach to run the REVEAL/REACT
  // phases at all; Graduation's own entry below carries neither, so it
  // keeps its older, simpler walk-then-beat flow unchanged (PLAN.md 6.8b:
  // its venue art is future work, not this task).
  {
    type: 'boss-approach',
    x: RESEARCH_GOLEM_TAKEOVER_X,
    comicId: 'pre-research-golem',
    arenaEntranceX: GOLEM_ACTIVATION_X,
    boss: 'research-golem',
    revealCameraX: RESEARCH_GOLEM_REVEAL_CAMERA_X,
    reactBark: 'research-golem-reveal',
  },
  // Ahead of the boss so dying mid-fight (task 2.6) doesn't mean a long
  // walk back across the whole level to retry it. Same position as the
  // arena's activation line (task B), so a respawn always lands at the
  // arena's mouth, never outside a closed wall.
  { type: 'checkpoint', x: GOLEM_ACTIVATION_X },
  // exitX: the venue's explicit exit line (repair task) -- game.js reads
  // this straight off the boss entity to decide interior vs. exterior
  // rendering (researchGolemInterior()); see RESEARCH_GOLEM_EXIT_X above.
  // exitWalkTriggerX: the short auto-walk-through-the-door beat (§9,
  // game.js updateResearchGolemExitWalk); see
  // RESEARCH_GOLEM_EXIT_WALK_TRIGGER_X above.
  {
    type: 'boss-research-golem',
    x: BOSS_X,
    activationX: GOLEM_ACTIVATION_X,
    exitX: RESEARCH_GOLEM_EXIT_X,
    exitWalkTriggerX: RESEARCH_GOLEM_EXIT_WALK_TRIGGER_X,
  },

  // Suit replaces studentmössa (AGENTS.md §3/§6).
  { type: 'pickup', outfit: 'suit', x: SUIT_X },

  // Haga: the short post-boss Göteborg exterior (NEW LEVEL FLOW). No enemy
  // type is assigned to this stretch -- it is deliberately just traversal,
  // establishing that the player is back outside before the Clinic.
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

  // Story beat 9 (AGENTS.md §3): approach, then comic, then BOSS 2 -- same
  // pattern as the golem's above.
  { type: 'boss-approach', x: GRADUATION_APPROACH_X, comicId: 'pre-graduation', arenaEntranceX: GRADUATION_ACTIVATION_X, boss: 'graduation' },
  // Ahead of Graduation, same reasoning as the checkpoint before the
  // Research Golem (task 2.6), inside its arena's activation line (task B).
  { type: 'checkpoint', x: GRADUATION_X - 100 },
  { type: 'boss-graduation', x: GRADUATION_X, activationX: GRADUATION_ACTIVATION_X },

  // Picked up immediately before the final comic (AGENTS.md §3).
  { type: 'pickup', outfit: 'armour', x: ARMOUR_X },
  // Story beat 11 (AGENTS.md §3): final comic, then straight to the application screen --
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
