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

import { CANVAS, WORLD, PLAYER, ENEMY_MATHBOOK, ENEMY_INBOX, ENEMY_HELMET, RESEARCH_GOLEM, RESEARCH_GOLEM_EXIT, GRADUATION, GRADUATION_ENTRANCE, LANDMARK, PICKUP, PLATFORM, STAIRCASE, BOSS_APPROACH } from './config.js';

const SPAWN_X = 120;

// Two standard platform heights (task C: "fixed standard dimensions",
// AGENTS.md §5) -- variety without inventing a size per placement. Both
// comfortably under the player's own max jump apex (~153px, from
// PLAYER.jumpVelocity/WORLD.gravity), so every platform is reachable with
// room to spare -- "generous, not precise" (PLAN.md task C).
const CLEARANCE_LOW = 90;
const CLEARANCE_HIGH = 130;
const platformTop = (clearance) => WORLD.groundY - clearance;

// Boss arenas are sized from their own art (door/portal to where the boss
// stands), not from a travel-time target. Both stay flat (task C) -- no
// platform is ever placed inside either.

// --- Lund (10,000px: SPAWN_X to the end of the utspring) ------------------
// Shortened from 12,600px (author feedback: Lund ran too long), with two
// ground books added to fill the space. The maths book (the
// enemy-behaviours brief): one behaviour, placed five times so it plays
// differently each time despite identical logic --
//   1  MATHBOOK_1_X             alone, flat ground, nothing else on screen.
//                               The game's shooting tutorial; this
//                               encounter cannot be lost.
//   -  MATHBOOK_GROUND_A_X      on the ground after the first two jumps.
//   2  MATHBOOK_2_PLATFORM_X    on a ledge -- jump-timed shot, or walk under.
//   3  MATHBOOK_3_PLATFORM_X    past a real gap between two platforms --
//                               jump it while its shot may be in the air,
//                               or skip it at ground level like the ledge.
//   -  MATHBOOK_GROUND_B_X      on the ground before the last jump and the
//                               climb to the staircase.
const MATHBOOK_1_X = SPAWN_X + 780; // 900 -- alone; nothing else until PLATFORM_A_X
const PLATFORM_A_X = MATHBOOK_1_X + 1100; // 2000 -- quiet stretch, then a jump
const PLATFORM_B_X = PLATFORM_A_X + 800; // 2800 -- clustered with A
const MATHBOOK_GROUND_A_X = PLATFORM_B_X + 700; // 3500
const MATHBOOK_2_PLATFORM_X = PLATFORM_B_X + 1300; // 4100 -- carries the ledge book
const GAP_APPROACH_PLATFORM_X = MATHBOOK_2_PLATFORM_X + 1300; // 5400 -- launch side of the gap
const MATHBOOK_3_GAP_WIDTH = 200; // px -- comfortably under the ~268px max jump range
const MATHBOOK_3_PLATFORM_X = GAP_APPROACH_PLATFORM_X + PLATFORM.width + MATHBOOK_3_GAP_WIDTH; // 5820 -- carries the far-side book
const MATHBOOK_GROUND_B_X = MATHBOOK_3_PLATFORM_X + 950; // 6770

// Checkpoints (AGENTS.md §6: invisible checkpoints; polish-pass audit
// finding A2). Before this, Lund carried none at all -- the only
// checkpoint anywhere in the section was UTSPRING_END_X, so dying at the
// gap jump (6,820) replayed the entire section from SPAWN_X (120), about
// 18.6s of running back through content that had already been cleared.
// Three checkpoints keep every death in Lund short:
const CHECKPOINT_AFTER_MATHBOOK_1_X = MATHBOOK_1_X + 200; // 1100 -- past the tutorial book
const CHECKPOINT_BEFORE_GAP_X = GAP_APPROACH_PLATFORM_X - 300; // 5100 -- short of the gap jump
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
// its full 10,000px.
const UTSPRING_END_X = SPAWN_X + 10000; // 10120

// Background-transition repair: the Lund-utspring -> Göteborg-city section
// boundary used to sit at UTSPRING_END_X itself. BACKGROUND.blendBandWidth
// (config.js, 400px centred on the boundary) then straddled the exact point
// where the auto-run stops and the studentmössa celebration (flash, card
// hold, card fade -- STAIRCASE below) plays out with the camera sitting
// still: Göteborg sat fading in at a constant ~50% blend for the whole
// celebration, and had already started fading in during the final ~200px of
// the descent itself. Moving the boundary a clear buffer past UTSPRING_END_X
// means the blend band cannot be reached until the player has walked forward
// after control returns -- the celebration and the run that ends it stay
// visually Lund/Polhem throughout, and Göteborg only starts revealing itself
// once the player is moving through it again.
const LUND_GOTEBORG_BACKGROUND_X = UTSPRING_END_X + 600; // 10720
const STAIRCASE_START_X = UTSPRING_END_X - UTSPRING_RUN_LENGTH; // 8770 -- the handover line
const CHECKPOINT_AT_STAIRCASE_TOP_X = STAIRCASE_START_X - 1; // 8769 -- see the note above
const STAIRCASE_ASCENT_X = STAIRCASE_START_X - STAIR_ASCENT_STEPS * PLATFORM.width; // 8330

const PLATFORM_C_X = STAIRCASE_ASCENT_X - 1100; // 7230 -- last ordinary jump before the climb

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

// --- Göteborg (6,900px: the end of the utspring to the Golem's line) -----
// Shortened again from 9,200px (author feedback: still too long), and four
// maths books added so the stretch isn't empty running: one on each high
// platform (E, G) and a pair on the ground between the two clusters.
// Level-compression pass: this section was 18,400px, almost exactly half of
// which was one uninterrupted "quiet stretch" between platforms E and F
// (9,500px of empty running -- more than the whole Lund section). Halving
// the section means cutting that gap down, not removing any enemy,
// platform or the approach to the Research Golem building. Every beat that
// existed before (both platform clusters, the quiet breather between them,
// the approach comic and activation line) is still here, just closer
// together. All four platforms keep their original relative clustering
// (D+E close together, F+G close together) -- only the long gap shrank.
const PLATFORM_D_X = UTSPRING_END_X + 1000; // 11120
const PLATFORM_E_X = PLATFORM_D_X + 900; // 12020 -- clustered with D, carries a book
const GOTEBORG_MATHBOOK_A_X = PLATFORM_E_X + 1100; // 13120 -- ground
const GOTEBORG_MATHBOOK_B_X = GOTEBORG_MATHBOOK_A_X + 800; // 13920 -- ground, paired with A
const PLATFORM_F_X = PLATFORM_E_X + 2600; // 14620 -- after the ground pair (was 4,200 of empty running)
const PLATFORM_G_X = PLATFORM_F_X + 900; // 15520 -- clustered with F, carries a book
const GOLEM_COMIC_X = PLATFORM_G_X + 1500; // 17020 -- comic-trigger spacing only; the background boundary sits at GOLEM_ACTIVATION_X (see SECTION_HANDELS_X)
const GOLEM_ACTIVATION_X = GOLEM_COMIC_X + 500; // 17520 = UTSPRING_END_X + 7,400 (6,900 section + 500 comic-to-activation)
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
// ARENA_WIDTH=600 placeholder gap.
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

// --- Clinic: reception (~2,400px) --------------------------------------
// The reception encounter (reception.js, PROTOTYPE) is Clinic's one beat,
// replacing the Endless Inbox placement that used to stand here. The
// section is the arena plus a short lead-in and run-out, so resizing the
// arena resizes the section and pushes everything downstream along.
const SECTION_CLINIC_X = SECTION_HAGA_X + HAGA_LENGTH; // 26283
const RECEPTION_LEAD_IN = 200; // px of section before the arena's left edge
const RECEPTION_ARENA_WIDTH = 1700; // px -- the camera zooms to fit exactly this
const RECEPTION_RUN_OUT = 500; // px after the arena before USA begins
const RECEPTION_ARENA_LEFT_X = SECTION_CLINIC_X + RECEPTION_LEAD_IN; // 26483
const RECEPTION_ARENA_RIGHT_X = RECEPTION_ARENA_LEFT_X + RECEPTION_ARENA_WIDTH; // 28183
const CLINIC_LENGTH = RECEPTION_LEAD_IN + RECEPTION_ARENA_WIDTH + RECEPTION_RUN_OUT; // 2400
// The red-cross sign stands just inside the arena's left edge; walking a
// little past it is what takes control (the sketch's "moves a bit in front
// of the sign"). The desk stands at the far right, its front edge being the
// arena's right wall until the encounter is done.
const RECEPTION_SIGN_X = RECEPTION_ARENA_LEFT_X + 70;
const RECEPTION_TRIGGER_X = RECEPTION_ARENA_LEFT_X + 200;
const RECEPTION_DESK_X = RECEPTION_ARENA_RIGHT_X - 60 - 180; // 180 = config.js RECEPTION.desk.width

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
const SECTION_PORTAL_HAGA_X = PLATFORM_L_X + 1400; // 35431 -- where USA ends

// --- Haga: the Graduation portal lead-in (~1,500px) ------------------------
// A short Göteborg Haga street that exists only to ground the portal in the
// world before the Graduation arena: no platforms, no enemies. Its length
// is just enough for the Haga look to finish fading in
// (BACKGROUND.blendBandWidth) and be walked through for a moment before the
// portal comes into view.
const PORTAL_LEAD_IN = 1500; // px from USA's end to the portal's opening
const PORTAL_OPENING_X = SECTION_PORTAL_HAGA_X + PORTAL_LEAD_IN; // 36931 -- world x of the portal's opening centre
const PORTAL_OPENING_LOCAL_X = 220; // the opening's centre in the portal art (config.js LANDMARK.types 'graduation-portal')
const PORTAL_WIDTH = LANDMARK.types['graduation-portal'].width; // 440
const PORTAL_X = PORTAL_OPENING_X - PORTAL_OPENING_LOCAL_X; // 36711 -- the art's left edge

// The line the scripted walk ends on, the comic opens on and the arena
// starts from: Jakob standing centred in the portal's opening. Same role as
// GOLEM_ACTIVATION_X for the Research Golem -- the exterior (Haga + portal)
// is drawn left of it, the arena from it onwards (game.js
// graduationInterior()).
const GRADUATION_ACTIVATION_X = PORTAL_OPENING_X - PLAYER.width / 2; // 36907

// Same boss-approach trick as the Golem's (RESEARCH_GOLEM_TAKEOVER_X), with
// Graduation's own longer walk, so control is taken just as the portal
// starts to come into view.
const GRADUATION_TAKEOVER_X = GRADUATION_ACTIVATION_X - PLAYER.moveSpeed * GRADUATION_ENTRANCE.walkDuration; // 36187

// The reveal framing: the locked shot ends GRADUATION_ENTRANCE.revealMarginRight
// past the portal's right edge -- only the area up to and around the
// portal -- and holds through the thoughts and the walk.
const GRADUATION_REVEAL_CAMERA_X = PORTAL_X + PORTAL_WIDTH + GRADUATION_ENTRANCE.revealMarginRight - CANVAS.width; // 35931

// --- Graduation arena -------------------------------------------------------
// The arena is the `graduation-arena` artwork (boss-2-arena-v1.png), one
// image placed so its own painted portal lines up with the Haga portal's
// opening -- the player steps in through one and out of the other. Like
// the Research Golem venue, exterior and interior share world x but are
// never drawn at the same time. Local x positions measured on the
// 1831px-wide art: portal opening 318; the boss stands at 1340 -- as far
// right as a shot fired from the portal mouth still reaches (the shot
// leaves at local 342 and its front travels PROJECTILE.width + speed *
// lifetime = 1004px, to 1346). The armour and the final comic sit between
// him and the art's right edge, inside the camera frame below.
const GRADUATION_ARENA_PORTAL_LOCAL_X = 318;
const GRADUATION_ARENA_BOSS_LOCAL_X = 1340;
const GRADUATION_ARENA_WIDTH = LANDMARK.types['graduation-arena'].width; // 1831
const GRADUATION_ARENA_IMAGE_X = PORTAL_OPENING_X - GRADUATION_ARENA_PORTAL_LOCAL_X;
// The world rectangle the arena camera frames (game.js
// graduationArenaFraming, which zooms so left..right fills the screen):
// from the art's top edge down to visibleDepth below the floor line
// (config.js WORLD.graduationGroundTexture) -- never as far as the empty
// sky under the floating floor. That height fixes the frame's width at the
// screen's aspect ratio; the frame keeps the art's right edge and gives up
// the rest on the left, the decorative side behind the portal, so the
// floor between the portal and the boss stays fully in shot.
const GRADUATION_ARENA_FRAME_TOP = WORLD.groundY - LANDMARK.types['graduation-arena'].baselineY;
const GRADUATION_ARENA_FRAME_HEIGHT = WORLD.groundY + WORLD.graduationGroundTexture.visibleDepth - GRADUATION_ARENA_FRAME_TOP;
const GRADUATION_ARENA_FRAME_WIDTH = Math.min(GRADUATION_ARENA_WIDTH, GRADUATION_ARENA_FRAME_HEIGHT * CANVAS.width / CANVAS.height); // ~1710
const GRADUATION_ARENA_FRAME = {
  left: GRADUATION_ARENA_IMAGE_X + GRADUATION_ARENA_WIDTH - GRADUATION_ARENA_FRAME_WIDTH,
  right: GRADUATION_ARENA_IMAGE_X + GRADUATION_ARENA_WIDTH,
  top: GRADUATION_ARENA_FRAME_TOP,
};

const GRADUATION_X = GRADUATION_ARENA_IMAGE_X + GRADUATION_ARENA_BOSS_LOCAL_X;
const ARMOUR_X = GRADUATION_X + GRADUATION.width + 80; // local 1580
const FINAL_COMIC_X = ARMOUR_X + 100; // local 1680, inside the frame

// --- Background sections ----------------------------------------------------
// Ten sections, in level order (level-compression pass: was eight, split by
// inserting the new short Haga exterior after the Research Golem arena --
// NEW LEVEL FLOW -- then the short Haga portal lead-in before Graduation). The order is deliberate and is NOT chronological: the
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
//   1  Lund -- town                       0    3,700       10.3 s
//   2  Polhem -- the school           3,700    3,630       10.1 s
//   3  Lund -- the utspring           7,330    3,390        9.4 s
//   4  Göteborg -- the city          10,720    6,800       18.9 s
//   5  Handels -- Golem arena        17,520    1,815        5.0 s
//   6  Haga -- Göteborg exterior     19,335    2,048        5.7 s
//   7  Clinic -- reception           21,383    2,400        6.7 s (+ the encounter itself)
//   8  USA -- the stadium            23,783    7,100       19.7 s
//   9  Haga -- portal lead-in        30,883    1,476        4.1 s (scripted from 31,639)
//  10  GU -- Graduation arena        32,359    1,796        5.0 s
//                                            -------      -------
//                                            34,155       94.9 s
//
// (Boss-fight duration is not distance-based and isn't part of the "at
// 360 px/s" column above; the Handels and GU rows are their arenas' own
// activation-to-exit width, not a fight-time estimate either. Row 5's
// length is set by RESEARCH_GOLEM_EXIT_X, the venue's own explicit exit
// line -- see the render-state repair note above GOLEM_ACTIVATION_X.)
const SECTION_POLHEM_X = 3700; // moved in with Lund's shortening (was 4,200)
const SECTION_LUND_RETURN_X = STAIRCASE_ASCENT_X - 1000; // 7330
// Göteborg's backdrop starts at LUND_GOTEBORG_BACKGROUND_X (13320), a buffer
// past UTSPRING_END_X (12720) -- see that constant's own note above for why
// this is deliberately not the same line the studentmössa run/celebration
// ends on.
//
// Background-transition repair: this used to be GOLEM_COMIC_X (21920), which
// put the boundary 500px before GOLEM_ACTIVATION_X -- i.e. still in the
// middle of the scripted approach (reveal/react/walk/comic), all of which
// happens outside the venue (researchGolemInterior() is false throughout).
// The blend band therefore faded the real Göteborg skyline out into
// handels-interior's flat fallback colour while the façade was still being
// presented, leaving a visible void beside it. Moving the boundary to
// GOLEM_ACTIVATION_X -- the exact x researchGolemInterior() itself uses --
// means the outdoor Göteborg background (with its real far/mid skyline)
// now covers the entire approach, reveal and comic, and only gives way to
// the enclosed interior look at the same instant the venue's own explicit
// interior state turns true.
const SECTION_HANDELS_X = GOLEM_ACTIVATION_X; // 22420 -- matches researchGolemInterior()'s own boundary
// SECTION_HAGA_X, SECTION_CLINIC_X and SECTION_USA_X are defined above, next
// to the entity chains they bound.
// Same reasoning as SECTION_HANDELS_X: the outdoor Haga look covers the
// whole portal approach and only gives way at the instant the arena's own
// interior state (game.js graduationInterior()) turns true.
const SECTION_GU_X = GRADUATION_ACTIVATION_X; // 36907
const LEVEL_END_X = FINAL_COMIC_X + 500; // 37471

// Landmark placements. Parallax is per placement, not per landmark: how
// far away a thing reads is a layout decision, and the same object could
// sit on the horizon in one place and close by in another.
const UF_STAND_X = 1800;
const POLHEM_MECH_X = 5300; // inside the shortened Polhem section (was 6,200)
const STADIUM_X = USA_HELMET_X + 600; // same close spacing to the helmet as before
// World props (author request). Placement x is the art's left edge.
const SIGN_LUND_ARROW_X = SPAWN_X + 330; // early in the first Lund backdrop
// Centred on the switch from the distant Lund skyline to the Lund streets.
const SIGN_WELCOME_LUND_X = SECTION_POLHEM_X - LANDMARK.types['sign-welcome-lund'].width / 2;
// Just after the utspring ends, before the Göteborg backdrop starts to
// fade in (BACKGROUND.blendBandWidth / 2 = 200px before its boundary).
// The zoomed-out celebration camera can see this spot, so the sign is
// hidden until the celebration is over and then fades in
// (showAfterUtspring below, config.js LANDMARK.afterUtspringFadeIn).
const SIGN_GOTHENBURG_X = UTSPRING_END_X + 250;
// Hanging over the way out of the Clinic, straddling the change to USA and
// clear of the reception arena's right edge.
const DEPARTURES_BOARD_X = SECTION_USA_X - 480;

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
  { type: 'background-section', name: 'Lund — the utspring', xStart: SECTION_LUND_RETURN_X, xEnd: LUND_GOTEBORG_BACKGROUND_X, background: 'lund-utspring' },
  { type: 'background-section', name: 'Göteborg — the city', xStart: LUND_GOTEBORG_BACKGROUND_X, xEnd: SECTION_HANDELS_X, background: 'goteborg-city' },
  { type: 'background-section', name: 'Handels — Golem arena', xStart: SECTION_HANDELS_X, xEnd: SECTION_HAGA_X, background: 'handels-interior' },
  { type: 'background-section', name: 'Haga — Göteborg exterior', xStart: SECTION_HAGA_X, xEnd: SECTION_CLINIC_X, background: 'goteborg-haga' },
  { type: 'background-section', name: 'Clinic — reception', xStart: SECTION_CLINIC_X, xEnd: SECTION_USA_X, background: 'clinic-reception' },
  { type: 'background-section', name: 'USA — the stadium', xStart: SECTION_USA_X, xEnd: SECTION_PORTAL_HAGA_X, background: 'usa-stadium' },
  { type: 'background-section', name: 'Haga — portal lead-in', xStart: SECTION_PORTAL_HAGA_X, xEnd: SECTION_GU_X, background: 'goteborg-haga-portal' },
  { type: 'background-section', name: 'GU — Graduation arena', xStart: SECTION_GU_X, xEnd: LEVEL_END_X, background: 'gu-ceremony' },

  // Landmarks: one-off background objects at a single x, each scrolling
  // at its own rate. Not tiled, not gameplay -- nothing collides with
  // them.
  { type: 'landmark', landmark: 'uf-stand', x: UF_STAND_X, parallax: 1 },
  { type: 'landmark', landmark: 'polhem-mech', x: POLHEM_MECH_X, parallax: 1 },
  { type: 'landmark', landmark: 'stadium', x: STADIUM_X, parallax: 0.35 },
  { type: 'landmark', landmark: 'sign-lund-arrow', x: SIGN_LUND_ARROW_X, parallax: 1 },
  { type: 'landmark', landmark: 'sign-welcome-lund', x: SIGN_WELCOME_LUND_X, parallax: 1 },
  { type: 'landmark', landmark: 'sign-gothenburg-arrow', x: SIGN_GOTHENBURG_X, parallax: 1, showAfterUtspring: true },
  { type: 'landmark', landmark: 'departures-board', x: DEPARTURES_BOARD_X, parallax: 1 },

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
  // Graduation venue art: the portal outside, the arena inside. Same
  // explicit-state rule as above -- game.js graduationInterior() decides
  // which of the two is drawn.
  { type: 'landmark', landmark: 'graduation-portal', x: PORTAL_X, parallax: 1 },
  { type: 'landmark', landmark: 'graduation-arena', x: GRADUATION_ARENA_IMAGE_X, parallax: 1 },

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

  // Filler book on the ground (Lund shortening pass).
  { type: 'enemy-mathbook', x: MATHBOOK_GROUND_A_X },

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

  // Filler book on the ground before the last jump (Lund shortening pass).
  { type: 'enemy-mathbook', x: MATHBOOK_GROUND_B_X },

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
  // Göteborg's maths books (shortening pass): one on each high platform,
  // a pair on the ground between the two clusters.
  {
    type: 'enemy-mathbook',
    x: PLATFORM_E_X + (PLATFORM.width - ENEMY_MATHBOOK.width) / 2,
    y: platformTop(CLEARANCE_HIGH) - ENEMY_MATHBOOK.height,
  },
  { type: 'enemy-mathbook', x: GOTEBORG_MATHBOOK_A_X },
  { type: 'enemy-mathbook', x: GOTEBORG_MATHBOOK_B_X },

  // The Endless Inbox and the football helmet used to stand here. Task
  // 6.8's section order puts the admin enemy in the Clinic and the
  // football helmet in USA, both of which come AFTER the Research Golem,
  // so both moved down this file. See the note on the section table.

  { type: 'platform', x: PLATFORM_F_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_G_X, y: platformTop(CLEARANCE_HIGH) },
  {
    type: 'enemy-mathbook',
    x: PLATFORM_G_X + (PLATFORM.width - ENEMY_MATHBOOK.width) / 2,
    y: platformTop(CLEARANCE_HIGH) - ENEMY_MATHBOOK.height,
  },

  // Story beat 5 (AGENTS.md §3): the camera-reveal repair task's scripted
  // sequence (game.js updateBossApproach) -- stop, camera reveal, Jakob's
  // reaction, walk to the door, comic, then BOSS 1. revealCameraX and
  // reactBark fill the REVEAL/REACT phases; Graduation's entry below runs
  // the same phases with thought bubbles instead of a bark.
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

  // The Clinic reception encounter (reception.js, PROTOTYPE step 1: intro
  // + Rounds 1-3). All positions below are measured from the arena's left
  // edge -- dx along, clearance = height above the ground of the surface
  // (0 = the ground itself). Platforms pop in when the round starts and
  // stay; the player's max jump rise is ~150px, so each step up between
  // neighbouring platforms stays under ~115px.
  //
  // round1Items appear ONE AT A TIME, in this order.
  {
    type: 'reception-encounter',
    triggerX: RECEPTION_TRIGGER_X,
    arenaLeftX: RECEPTION_ARENA_LEFT_X,
    arenaRightX: RECEPTION_ARENA_RIGHT_X,
    signX: RECEPTION_SIGN_X,
    deskX: RECEPTION_DESK_X,
    // Three tiers of blocks (~100, ~215, ~320 above the ground), centred
    // between the sign (dx 70) and the desk (dx 1460) with roughly the
    // same ~90px gap on each side. Nothing LOW sits over where Jakob gets
    // control (dx ~200) -- only the middle tier, so he never starts with a
    // block at head height. A fourth tier (~430) is an idea held back for
    // the final round.
    platforms: [
      { dx: 185, clearance: 210 }, // G  middle, high over the start
      { dx: 415, clearance: 100 }, // A  low
      { dx: 435, clearance: 320 }, // E  top, over A -- reached from G
      { dx: 675, clearance: 210 }, // B  middle -- reached from A or C
      { dx: 905, clearance: 100 }, // C  low
      { dx: 935, clearance: 320 }, // F  top, over C -- reached from B or D
      { dx: 1145, clearance: 220 }, // D  middle -- reached from C
    ],
    round1Items: [
      { dx: 525, clearance: 100 }, // on A
      { dx: 785, clearance: 210 }, // up on B
      { dx: 1415, clearance: 0 }, // down on the floor, right in front of the desk
      { dx: 1045, clearance: 320 }, // all the way up on F
    ],
    // Round 2: four files (again one at a time), zig-zagging across the
    // arena, while sorting these cards -- left to right as they sit in the
    // tray -- into the matching boxes.
    // Colours: 'green' | 'yellow' | 'red' (config.js RECEPTION.sorting).
    round2Items: [
      { dx: 545, clearance: 320 }, // up on E, top left
      { dx: 1255, clearance: 220 }, // over on D, right
      { dx: 295, clearance: 210 }, // back on G, far left
      { dx: 1015, clearance: 100 }, // down on C, middle
    ],
    round2Cards: ['yellow', 'green', 'red', 'yellow', 'green'],
    // Round 3, the overload. A fourth tier of blocks pops in (~430 up,
    // each reached from a top-tier block beside it). Eight tasks in PAIRS:
    // the first two appear together, the next two once both are done, and
    // so on -- each pair split across the arena. `kind` is only what it
    // looks like: 'file', 'complaint' or 'globe' (a non-EU patient). The
    // cards come as one face-up DECK, listed top card first: only the top
    // card can be moved.
    round3Platforms: [
      { dx: 660, clearance: 430 }, // H  between E and F
      { dx: 1180, clearance: 430 }, // I  right of F
    ],
    round3Items: [
      // pair 1
      { dx: 1290, clearance: 430, kind: 'globe' }, // top of I, far right
      { dx: 295, clearance: 210, kind: 'file' }, // G, far left
      // pair 2
      { dx: 770, clearance: 430, kind: 'complaint' }, // top of H, middle
      { dx: 1415, clearance: 0, kind: 'file' }, // floor, in front of the desk
      // pair 3
      { dx: 525, clearance: 100, kind: 'file' }, // A, low left
      { dx: 1045, clearance: 320, kind: 'complaint' }, // F, upper right
      // pair 4
      { dx: 545, clearance: 320, kind: 'globe' }, // E, upper left
      { dx: 1255, clearance: 220, kind: 'file' }, // D, middle right
    ],
    round3Cards: ['green', 'red', 'red', 'yellow', 'green', 'yellow', 'red', 'green', 'yellow', 'red'], // top first
  },
  { type: 'platform', x: PLATFORM_J_X, y: platformTop(CLEARANCE_HIGH) },

  // The football helmet (USA, exchange semester): idle, telegraph, charge,
  // recover -- "dodge, then punish". Flat open ground, no platform: its
  // ENEMY_HELMET.minX/maxX (centred on this x) already bound the charge to
  // this stretch on their own.
  { type: 'enemy-helmet', x: USA_HELMET_X },

  { type: 'platform', x: PLATFORM_K_X, y: platformTop(CLEARANCE_LOW) },
  { type: 'platform', x: PLATFORM_L_X, y: platformTop(CLEARANCE_HIGH) },

  // Story beat 9 (AGENTS.md §3): the portal. Control is taken as it comes
  // into view, the camera frames it, Jakob thinks, walks into it, comic,
  // then BOSS 2 -- the Research Golem's pattern above, with thought
  // bubbles (config.js GRADUATION_ENTRANCE) and its own walk length.
  {
    type: 'boss-approach',
    x: GRADUATION_TAKEOVER_X,
    comicId: 'pre-graduation',
    arenaEntranceX: GRADUATION_ACTIVATION_X,
    boss: 'graduation',
    revealCameraX: GRADUATION_REVEAL_CAMERA_X,
    thoughts: GRADUATION_ENTRANCE.thoughts,
    walkDuration: GRADUATION_ENTRANCE.walkDuration,
  },
  // Same reasoning as the checkpoint on GOLEM_ACTIVATION_X: a respawn lands
  // in the arena's own portal, never outside it.
  { type: 'checkpoint', x: GRADUATION_ACTIVATION_X },
  // arenaFrame: what the zoomed-out arena camera shows (see
  // GRADUATION_ARENA_FRAME above).
  { type: 'boss-graduation', x: GRADUATION_X, activationX: GRADUATION_ACTIVATION_X, arenaFrame: GRADUATION_ARENA_FRAME },

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

// Development shortcut, not a feature: opening the game with ?start=<name>
// (e.g. index.html?start=clinic) drops the player at one of these x
// positions with everything before it already done -- so an encounter can
// be replayed without replaying the whole level up to it. Adding &round=N
// (e.g. ?start=clinic&round=3) starts the Clinic reception at that round.
// game.js applyDebugStart. Without the query parameter nothing here is used.
export const DEBUG_START_X = {
  // Just short of the Lund streets (the Welcome to Lund sign).
  lund: SECTION_POLHEM_X - 500,
  // Just after the utspring, in front of the Gothenburg sign.
  goteborg: UTSPRING_END_X + 20,
  clinic: SECTION_CLINIC_X - 150,
  // Past the Clinic encounter, approaching the departures board and USA.
  usa: SECTION_USA_X - 800,
  // The end of USA, just before the Haga portal lead-in.
  graduation: SECTION_PORTAL_HAGA_X - 400,
};
