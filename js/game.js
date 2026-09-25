// game.js — fixed-timestep game loop and state machine.

import { CANVAS, TIMESTEP, WORLD, PLAYER, PROJECTILE, PROJECTILE_CULL_MARGIN, CAMERA, RESEARCH_GOLEM, RESEARCH_GOLEM_EXIT, GRADUATION, PICKUP, PLATFORM, TUTORIAL, BACKGROUND, BACKGROUNDS, LANDMARK, DEBUG, STAIRCASE, CONFETTI, HUD, HITSTOP, DEATH_BURST, SHAKE, HAZARD, BOSS_APPROACH, GRADUATION_ENTRANCE, ENEMY_MATHBOOK } from './config.js';
import { initInput, clearFrameInput, resetInput, setInputSuppressed } from './input.js';
import { getImage } from './assets.js';
import { createPlayer, updatePlayer, drawPlayer, damagePlayer, applyPickup, spawnBark } from './player.js';
import { createMathbookEnemy, createInboxEnemy, createFootballHelmetEnemy, updateEnemy, activateEnemy, damageEnemy, contactDamageFor, drawEnemy, shotHitbox } from './enemies.js';
import {
  createResearchGolem,
  activateResearchGolem,
  updateResearchGolem,
  damageResearchGolem,
  drawResearchGolem,
  drawResearchGolemHpBar,
  drawResearchGolemClaims,
  findResearchGolemClaimHit,
  resolveClaimShot,
  createGraduationBoss,
  activateGraduationBoss,
  updateGraduationBoss,
  damageGraduationBoss,
  drawGraduationBoss,
  drawGraduationBossHpBar,
  drawGraduationProjectile,
  drawGraduationFloorWarnings,
  clearGraduationHazards,
  graduationSlabHitsPlayer,
} from './bosses.js';
import { LEVEL, LEVEL_BOUNDS, TUTORIAL_END_X, DEBUG_START_X, entryY } from './level.js';
import {
  createReception,
  skipReception,
  updateReception,
  applyReceptionWalls,
  receptionPlatforms,
  receptionCameraFraming,
  drawReceptionScenery,
  drawReceptionSpeech,
  drawReceptionHud,
} from './reception.js';
import { updateMusic, playMusicCue } from './music.js';

const FIXED_DT = 1 / TIMESTEP.hz;

// Top-level game state machine (task 3.8). PLAYING is the gameplay loop;
// TITLE (4.1) and COMIC (4.3) are real DOM screens owned by ui.js/
// comics.js. APPLICATION (4.9) isn't a screen at all -- reaching it
// navigates straight to public/application.html, ending the game there
// (AGENTS.md §5: canvas renders gameplay only, DOM renders narrative).
export const STATE = { TITLE: 'title', COMIC: 'comic', PLAYING: 'playing', APPLICATION: 'application' };

// One listener, set once by ui.js at startup (task 4.3) -- not a general
// event system, just how game.js tells the DOM layer "the state changed,
// here's what's active now" so it can show/hide the right screen.
let stateChangeListener = null;
export function subscribeToStateChange(listener) {
  stateChangeListener = listener;
}

function setGameState(next) {
  gameState = next;
  setTutorialVisible(Boolean(next === STATE.PLAYING && player && player.x < TUTORIAL_END_X));
  if (stateChangeListener) stateChangeListener(gameState, { comicId: activeComicId });
}

// The utspring title card is narrative copy, so it is DOM, not canvas
// (AGENTS.md §5). Same one-listener shape as subscribeToStateChange
// above: game.js owns the timing, ui.js owns the element. The opacity is
// driven from simulation time rather than a CSS transition, so the card
// freezes and resumes exactly with the rest of the game when the tab is
// hidden (task 3.10).
let titleCardListener = null;
export function subscribeToTitleCard(listener) {
  titleCardListener = listener;
}

function setTitleCard(visible, opacity) {
  if (titleCardListener) titleCardListener(visible, opacity);
}

// The three opening control hints are DOM text over gameplay. The game owns
// their visibility; ui.js owns the element, like the other DOM overlays.
let tutorialVisibilityListener = null;
let tutorialVisible = false;
export function subscribeToTutorialVisibility(listener) {
  tutorialVisibilityListener = listener;
}

function setTutorialVisible(visible) {
  if (visible === tutorialVisible) return;
  tutorialVisible = visible;
  if (tutorialVisibilityListener) tutorialVisibilityListener(visible);
}

// The focus/visibility hint (task 3.10) is UI copy, so it is DOM and not
// canvas (AGENTS.md §5). Same one-listener shape as the title card above:
// game.js owns when it shows, ui.js owns the element.
let resumeHintListener = null;
export function subscribeToResumeHint(listener) {
  resumeHintListener = listener;
}

// Called every frame, so it has to be idempotent: only a change is passed
// on. Visibility is recomputed rather than latched, because the window can
// already be unfocused when the game moves between states -- an earlier
// version latched it once on the way into the frozen branch and, when the
// window happened to be unfocused on the title screen, never showed the
// hint again for the rest of the session.
let resumeHintVisible = false;
function setResumeHint(visible) {
  if (visible === resumeHintVisible) return;
  resumeHintVisible = visible;
  if (resumeHintListener) resumeHintListener(visible);
}

let ctx;
let player;
let camera;
let projectiles;
let enemies;
let boss;
let graduationBoss;
let pickups;
let platforms; // task C: { x, y, width, height }, one-way landable rectangles
let tutorialBlock; // the single solid jump block in the opening
let stairSurface; // [[x, y], ...] the utspring staircase's walking line (level.js 'stair-surface'), or null
let checkpoints; // sorted ascending by x
let nextCheckpointIndex;
let backgroundSections; // sorted ascending: [{ name, xStart, xEnd, background }]
let landmarks; // [{ landmark, x, parallax }], drawn behind everything
// Pacing instrumentation (task 6.8). Accumulated inside the fixed step,
// so it stops dead while the tab is hidden and never counts time the
// player wasn't there for (task 3.10).
let levelElapsed = 0;
let sectionElapsed = 0;
let timedSectionIndex = -1;
let utspringTrigger; // { x, descentX, markY } -- hands control to the utspring at x, or null
let utspringClouds; // [{ x, y, text, shownFor }] -- level.js 'utspring-cloud'
let thoughtTriggers; // sorted ascending by x: [{ x, text, duration }] -- level.js 'thought-trigger'
let nextThoughtTriggerIndex;
let activeThought = null; // { text, timeLeft } while one is over Jakob's head
let comicTriggers; // sorted ascending by x: [{ x, comicId, next }]
let nextComicTriggerIndex;
// Task B: the currently-closed arena wall, and the boss that owns it.
// null whenever no fight is active. Set the instant a boss activates;
// cleared the instant that boss dies.
let arenaWallX = null;
let arenaLockCameraX = null;
let lockedBoss = null;
// Research Golem venue repair task: the world x of the venue's own exit
// door (level.js RESEARCH_GOLEM_EXIT_X, carried on the boss-research-golem
// entry as exitX), or null before the level's loaded. Together with
// boss.activationX this is the whole explicit interior/exterior state --
// see researchGolemInterior() below.
let researchGolemExitX = null;
// Backtrack/re-entry repair task (§7/§10): a one-way ratchet, independent of
// arenaWallX (which drops the instant a boss dies, fine for every other
// boss but not this venue -- the player must never walk back out the
// entrance even after winning, and never back in through the exit once
// they've left). null until the player first reaches the venue; then it
// only ever moves forward -- see applyResearchGolemBoundary.
let researchGolemBoundaryX = null;
// Post-boss exit repair task (§9): mirrors bossApproaches/approachPhase
// above but far simpler -- one trigger, one timer, no phases, no camera or
// comic. See level.js RESEARCH_GOLEM_EXIT_WALK_TRIGGER_X and
// updateResearchGolemExitWalk.
let researchGolemExitWalkTriggerX = null;
// The Graduation arena's camera frame (level.js GRADUATION_ARENA_FRAME,
// carried on the boss-graduation entry as arenaFrame): { left, right, top }
// in world space, or null. See graduationArenaFraming().
let graduationArenaFrame = null;
let exitWalkActive = false;
let exitWalkTimer = 0;
// The Clinic reception encounter (reception.js), or null if the level has
// none. reception.js owns all of its state; game.js only calls in.
let reception = null;
let spawnPoint;
// Hitstop (config.js HITSTOP): while this is running the fixed step does
// nothing at all -- no movement, no timers, no attacks. One counter, not
// a scheduler: a second hit during a freeze extends it to whichever
// request is longer rather than queueing behind it.
let hitstopTimer = 0;
// Screen shake (config.js SHAKE). Two numbers, not a list of sources:
// a louder shake overrides a quieter one already running rather than
// adding to it, so nothing can compound its way past maxAmplitude.
let shakeTimer = 0;
let shakeAmplitude = 0;
// Previous boss phase/stage, compared each step. A phase change is worth
// a shake, and watching for the change here is what keeps bosses.js from
// having to know that presentation exists.
let lastBossPhase = null;
let lastGraduationStage = null;
let wasPlayerDead = false;
let accumulator = 0;
let lastTime = 0;

let gameState = STATE.TITLE;
let activeComicId = null;
let pendingComicNext = null; // STATE to enter once the active comic advances
let queuedComicIds = []; // comics still to show after the active one, before pendingComicNext

export function startGame(canvas) {
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  ctx = canvas.getContext('2d');
  // Pixel-art scaling everywhere (AGENTS.md background direction): images
  // are drawn scaled -- runtime background/landmark delivery files are
  // resized off their display box (scripts/runtime-assets.py) -- and
  // bilinear smoothing visibly blurs that detail away. The transition
  // blend canvases already disable this locally; without it here too,
  // ordinary (non-transition) rendering looked blurrier than mid-transition.
  ctx.imageSmoothingEnabled = false;
  initInput();

  loadLevel();
  player = createPlayer(spawnPoint.x, spawnPoint.y);
  camera = { x: 0, y: 0, zoom: 1 };
  projectiles = [];
  applyDebugStart();
  setGameState(STATE.TITLE);

  accumulator = 0;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// Called by ui.js when the real DOM title screen's Start button is clicked
// (task 4.1). resetInput clears whatever keyboard state that click itself
// may have left behind -- a focused button also fires its click on Space's
// keyup, and Space is also how the comic viewer advances a panel (task
// 4.3), so without this a leftover press could bleed into the next frame
// and skip straight through the very first comic panel.
export function startFromTitle() {
  if (gameState !== STATE.TITLE) return;
  resetInput();
  // The ?start= development shortcut goes straight to gameplay.
  if (debugStartActive) {
    setGameState(STATE.PLAYING);
    return;
  }
  enterComic('intro', STATE.PLAYING);
}

// Development shortcut (level.js DEBUG_START_X): with ?start=<name> in the
// URL, stand the player at that x with everything before it already done --
// one-shot sequences spent, bosses and enemies behind it dead, pickups
// behind it collected, checkpoints behind it reached. Without the query
// parameter this does nothing.
let debugStartActive = false;
function applyDebugStart() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('start');
  const startX = name ? DEBUG_START_X[name] : undefined;
  if (startX === undefined) return;
  debugStartActive = true;

  spawnPoint = { x: startX, y: spawnPoint.y };
  player.x = startX;
  camera.x = startX - CANVAS.width / 2;
  if (utspringTrigger && utspringTrigger.x < startX) {
    utspringPhase = UTSPRING.DONE;
    afterUtspringClock = Infinity; // long over -- no fade-in on arrival
  }
  while (bossApproaches[nextBossApproachIndex] && bossApproaches[nextBossApproachIndex].x < startX) nextBossApproachIndex += 1;
  while (comicTriggers[nextComicTriggerIndex] && comicTriggers[nextComicTriggerIndex].x < startX) nextComicTriggerIndex += 1;
  while (checkpoints[nextCheckpointIndex] && checkpoints[nextCheckpointIndex].x < startX) nextCheckpointIndex += 1;
  while (thoughtTriggers[nextThoughtTriggerIndex] && thoughtTriggers[nextThoughtTriggerIndex].x < startX) nextThoughtTriggerIndex += 1;
  for (const enemy of enemies) if (enemy.x < startX) enemy.alive = false;
  for (const bossEntity of [boss, graduationBoss]) if (bossEntity && bossEntity.activationX < startX) bossEntity.alive = false;
  if (researchGolemExitX !== null && researchGolemExitX < startX) {
    researchGolemBoundaryX = researchGolemExitX;
    researchGolemExitWalkTriggerX = null;
  }
  for (const pickup of pickups) {
    if (pickup.x < startX) {
      pickup.collected = true;
      if (!pickup.comics) applyPickup(player, pickup.outfit);
    }
  }
  if (utspringPhase === UTSPRING.DONE && player.outfit === 'none') applyPickup(player, 'studentmossa');
  if (reception && reception.triggerX < startX) skipReception(reception);
  // &round=N: the Clinic reception starts at round N after its intro.
  const round = Number(params.get('round'));
  if (reception && round > 1) reception.debugStartRound = round;
}

// Called by comics.js when the comic viewer's last panel is dismissed
// (task 4.3) -- proceeds to whatever the comic was leading into: back to
// PLAYING for the pre-boss comics, or to APPLICATION for the final one.
// Same resetInput reasoning as startFromTitle: the dismissal itself may
// have been a Space press, and PLAYING reads Space as jump.
export function advanceFromComic() {
  if (gameState !== STATE.COMIC) return;
  // Undoes beginBossApproach's setInputSuppressed(true) (task 3) if this
  // comic followed a boss approach -- harmless no-op otherwise. Nothing
  // reads input while gameState is COMIC, so it doesn't matter that this
  // runs at dismissal rather than the instant the comic opened; it only
  // has to be off again before PLAYING resumes below.
  setInputSuppressed(false);
  resetInput();
  // A chain of comics (the armour pickup's): straight on to the next
  // one, no gameplay between.
  if (queuedComicIds.length > 0) {
    activeComicId = queuedComicIds.shift();
    setGameState(STATE.COMIC);
    return;
  }
  setGameState(pendingComicNext);
  activeComicId = null;
  pendingComicNext = null;
}

// comicIds: one id, or an array played back to back before `next`.
function enterComic(comicIds, next) {
  const [comicId, ...rest] = [].concat(comicIds);
  queuedComicIds = rest;
  // Task 3, playtest round 2: clears whatever gameplay input was held or
  // buffered the instant a comic opens (e.g. left mouse still down from
  // firing when a boss-room trigger fires), so nothing carried over from
  // before it can bleed through. comics.js's own showComic adds the
  // ~400ms click/Space lockout (config.js COMIC) on top of this -- this
  // applies to every comic, not only the boss ones.
  resetInput();
  activeComicId = comicId;
  pendingComicNext = next;
  setGameState(STATE.COMIC);
}

// --- The utspring (PLAN.md task 3.5) ---------------------------------------
//
// The first milestone in the game, and the only moment where the player
// is not fighting. Everything up to here is run, jump and shoot; for five
// seconds the game hands the moment over instead of asking the player to
// earn it with reflexes. It is also a real Swedish ritual -- utspring,
// running out of school on graduation day -- so it reads as a
// celebration, not as a reward screen.
//
// This is one scripted sequence, hardcoded for this one moment. It is
// deliberately NOT a cutscene framework (AGENTS.md §7.10). If a second
// scripted beat is ever needed, that is when to generalise, not now.
//
// The beat, in order:
//   CLIMB    input handed over at the foot of the staircase; auto-walk up
//            the climb and across the top landing, camera widened; the
//            ceremony music starts
//   DESCENT  auto-run down the staircase with the
//            speed ramping up, camera widened, confetti falling
//   FLASH    the player stops; a brief white flash; the studentmössa
//            appears on the sprite underneath it
//   CARD     the DOM title card holds, then fades
//   DONE     control returns, and this can never run again
//
// From the top landing on it is the sum of the four timings in config.js,
// 5.25 s; the climb before it adds ~1.9 s.
const UTSPRING = { IDLE: 'idle', CLIMB: 'climb', DESCENT: 'descent', FLASH: 'flash', CARD: 'card', DONE: 'done' };
let utspringPhase = UTSPRING.IDLE;
let utspringTimer = 0;
// s since the utspring ended (DONE). Drives landmarks placed with
// showAfterUtspring (level.js), which stay hidden through the celebration
// and fade in once control returns.
let afterUtspringClock = 0;
let confetti = [];

function isUtspringRunning() {
  return utspringPhase !== UTSPRING.IDLE && utspringPhase !== UTSPRING.DONE;
}

// Called first in every step, so the auto-run speed is already set by the
// time updatePlayer reads it.
function updateUtspring(dt) {
  if (utspringPhase === UTSPRING.DONE) {
    afterUtspringClock += dt;
    return;
  }

  if (utspringPhase === UTSPRING.IDLE) {
    // Fires exactly once per playthrough: the phase leaves IDLE here and
    // only ever ends at DONE, which returns above.
    if (!utspringTrigger || player.x < utspringTrigger.x) return;
    beginUtspring();
    return;
  }

  utspringTimer += dt;
  updateConfetti(dt);
  updateUtspringClouds(dt);

  if (utspringPhase === UTSPRING.CLIMB) {
    // Walks up the climb at normal speed (applyStairSurface keeps his feet
    // on it) and across the top landing, until he reaches the descent line.
    if (player.x < utspringTrigger.descentX) return;
    beginDescent();
    return;
  }

  if (utspringPhase === UTSPRING.DESCENT) {
    // Speed increases gradually over the descent, ending above normal run
    // speed. Linear, and level.js places the stop (UTSPRING_END_X) from
    // exactly this ramp: down the staircase and on across the floor to
    // Polhemskolan as the timer expires.
    const t = Math.min(1, utspringTimer / STAIRCASE.descentDuration);
    player.autoRun = PLAYER.moveSpeed * (1 + (STAIRCASE.speedRampMultiplier - 1) * t);
    if (utspringTimer >= STAIRCASE.descentDuration) {
      player.autoRun = 0; // arrival: comes to a stop
      // The studentmössa goes on under the flash, so the swap is never
      // seen happening -- the flash is what covers it.
      applyPickup(player, 'studentmossa');
      enterUtspringPhase(UTSPRING.FLASH);
    }
    return;
  }

  if (utspringPhase === UTSPRING.FLASH) {
    if (utspringTimer >= STAIRCASE.flashDuration) enterUtspringPhase(UTSPRING.CARD);
    return;
  }

  // CARD: holds at full opacity, then fades. Control returns the moment
  // the fade finishes.
  const fadeElapsed = utspringTimer - STAIRCASE.cardHoldDuration;
  const opacity = fadeElapsed <= 0 ? 1 : Math.max(0, 1 - fadeElapsed / STAIRCASE.cardFadeDuration);
  setTitleCard(true, opacity);
  if (fadeElapsed >= STAIRCASE.cardFadeDuration) endUtspring();
}

function beginUtspring() {
  enterUtspringPhase(UTSPRING.CLIMB);
  // Input is ignored for the whole sequence, fire included, and
  // setInputSuppressed drops every held and pressed key on the way in and
  // on the way out -- so nothing the player mashed during these seconds
  // fires when control comes back.
  setInputSuppressed(true);
  player.invincible = true;
  player.autoRun = PLAYER.moveSpeed;
  // Started partway in, so the track's final chord lands on the title card
  // (config.js STAIRCASE.musicStartAt); exploration comes back after it.
  playMusicCue('student-ceremony', STAIRCASE.musicStartAt);
}

// The climb is done: Jakob is on the top landing, at the descent line.
function beginDescent() {
  enterUtspringPhase(UTSPRING.DESCENT);
  // Stand the player on their mark, the top landing. The climb keeps his
  // feet on the staircase, so this is normally a no-op; it only guards
  // against arriving mid-air (a jump already under way at the handover).
  player.y = utspringTrigger.markY - player.height;
  player.vy = 0;
  player.onGround = true;
  spawnConfetti();
}

// The utspring staircase is ground the player walks on, up and down
// (level.js STAIR_SURFACE): within its span, the floor under the player's
// centre is that line instead of WORLD.groundY. Called straight after
// updatePlayer. Nobody can be below it -- it is stone -- so feet that
// ended the step under it are lifted onto it (walking up, or landing from
// a jump). A player who was standing on the ground last step and is not
// jumping is also pulled down onto it when it drops away by no more than
// STAIRCASE.surfaceSnap, so walking or auto-running down a flight stays
// planted instead of hopping off every step. The utspring's descent is
// exactly that: the ordinary auto-run over this same line.
function applyStairSurface(wasGrounded) {
  if (!stairSurface || player.dead) return;
  const surfaceY = stairSurfaceYAt(player.x + player.width / 2);
  if (surfaceY === null) return;
  const feet = player.y + player.height;
  const inside = feet > surfaceY;
  const stepDown = wasGrounded && player.vy >= 0 && surfaceY - feet <= STAIRCASE.surfaceSnap;
  if (!inside && !stepDown) return;
  player.y = surfaceY - player.height;
  if (player.vy >= 0) {
    player.vy = 0;
    player.onGround = true;
  }
}

function stairSurfaceYAt(x) {
  const last = stairSurface.length - 1;
  if (x < stairSurface[0][0] || x > stairSurface[last][0]) return null;
  let i = 1;
  while (stairSurface[i][0] < x) i += 1;
  const [x0, y0] = stairSurface[i - 1];
  const [x1, y1] = stairSurface[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// Each cloud is revealed once the running player's centre comes within
// appearLead of it, then fades in over fadeInDuration.
function updateUtspringClouds(dt) {
  const feetX = player.x + player.width / 2;
  for (const cloud of utspringClouds) {
    if (cloud.shownFor > 0 || feetX >= cloud.x - STAIRCASE.clouds.appearLead) cloud.shownFor += dt;
  }
}

// World space, drawn behind the player: they are sky. They fade out with
// the title card and are gone once control returns.
function drawUtspringClouds(ctx) {
  if (!isUtspringRunning()) return;
  const spec = STAIRCASE.clouds;
  let fadeOut = 1;
  if (utspringPhase === UTSPRING.CARD) {
    fadeOut = Math.max(0, 1 - Math.max(0, utspringTimer - STAIRCASE.cardHoldDuration) / STAIRCASE.cardFadeDuration);
  }
  for (const cloud of utspringClouds) {
    if (cloud.shownFor <= 0) continue;
    const fadeIn = Math.min(1, cloud.shownFor / spec.fadeInDuration);
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;
    ctx.font = spec.bubble.font;
    const height = wrapThoughtText(ctx, cloud.text, spec.bubble.maxWidth).length * spec.bubble.lineHeight + spec.bubble.paddingY * 2;
    const bottom = cloud.y + height / 2 + spec.riseDistance * (1 - fadeIn);
    drawCloud(ctx, cloud.text, cloud.x, bottom, spec.bubble, null);
    ctx.restore();
  }
}

// Jakob's passing thought (level.js 'thought-trigger', at the Gothenburg
// sign, and the UF stand): shown over his head for the entry's duration. Nothing
// pauses and control is never taken -- like a bark.
function updateThoughtTriggers(dt) {
  if (activeThought) {
    activeThought.timeLeft -= dt;
    if (activeThought.timeLeft <= 0) activeThought = null;
  }
  const next = thoughtTriggers[nextThoughtTriggerIndex];
  if (next && !player.dead && player.x + player.width / 2 >= next.x) {
    activeThought = { text: next.text, timeLeft: next.duration };
    nextThoughtTriggerIndex += 1;
  }
}

function drawActiveThought(ctx) {
  if (!activeThought || player.dead) return;
  drawThoughtBubble(ctx, activeThought.text, player.x + player.width / 2, player.y);
}

function enterUtspringPhase(next) {
  utspringPhase = next;
  utspringTimer = 0;
}

function endUtspring() {
  utspringPhase = UTSPRING.DONE;
  setTitleCard(false, 0);
  confetti = [];
  player.autoRun = null;
  player.invincible = false;
  setInputSuppressed(false);
}

// --- The boss approach (task 3, playtest round 2; camera-reveal repair) ----
//
// A comic used to open the instant the player crossed a line, which meant
// it could land mid-stride, and a click/press meant for something else
// (fire, most often) could skip its first panel before it was ever read
// (see enterComic's resetInput and config.js COMIC). Both bosses get a
// short scripted sequence instead, driven by a small table (level.js's
// 'boss-approach' entries) rather than a cutscene framework (AGENTS.md
// §7.10).
//
// Both bosses run the same three phases -- REVEAL, REACT, WALK: the player
// stops dead, the camera glides on its own to an authored framing of the
// venue (level.js revealCameraX) and holds there, Jakob reacts, then he
// walks the rest of the way to the entrance with the camera still locked.
// No beat after the walk -- the comic opens the instant he reaches it.
//
// The one difference is the reaction: the Research Golem's is a bark
// (reactBark, held BOSS_APPROACH.reactDuration); Graduation's is a short
// run of thought bubbles over Jakob (thoughts, each held
// GRADUATION_ENTRANCE.thoughtDuration -- see drawApproachThought). An
// entry's walkDuration, when set, replaces BOSS_APPROACH.walkDuration.
const APPROACH = { REVEAL: 'reveal', REACT: 'react', WALK: 'walk' };
let bossApproaches; // sorted ascending by x: [{ x, comicId, arenaEntranceX, boss, revealCameraX, reactBark?, thoughts?, walkDuration? }]
let nextBossApproachIndex;
let approachPhase = null; // null whenever no approach is running
let approachTimer = 0;
let activeApproach = null;

// Called first in every step, same reasoning as updateUtspring: the
// sequence has to set autoRun before updatePlayer reads it this step.
function updateBossApproach(dt) {
  if (approachPhase === null) {
    const trigger = bossApproaches[nextBossApproachIndex];
    if (!trigger || player.x < trigger.x) return;
    nextBossApproachIndex += 1;
    beginBossApproach(trigger);
    return;
  }

  approachTimer += dt;

  if (approachPhase === APPROACH.REVEAL) {
    // Player stopped; arenaLockCameraX was set to the reveal target in
    // beginBossApproach, and updateCamera's existing easing (below) is
    // already gliding camera.x toward it every frame -- no separate pan
    // code needed here, just the wait.
    if (approachTimer >= BOSS_APPROACH.revealDuration) {
      if (activeApproach.reactBark) spawnBark(player, activeApproach.reactBark);
      approachPhase = APPROACH.REACT;
      approachTimer = 0;
    }
    return;
  }

  if (approachPhase === APPROACH.REACT) {
    // Camera stays locked at the same reveal target throughout -- nothing
    // to do here but hold for the reaction to read, then start walking.
    if (approachTimer >= reactDuration(activeApproach)) {
      player.autoRun = PLAYER.moveSpeed;
      approachPhase = APPROACH.WALK;
      approachTimer = 0;
    }
    return;
  }

  // WALK
  if (approachTimer >= (activeApproach.walkDuration ?? BOSS_APPROACH.walkDuration)) {
    player.autoRun = 0; // arrival: comes to a stop
    // Lands exactly on the arena's own activation line -- see the note on
    // RESEARCH_GOLEM_TAKEOVER_X/GRADUATION_TAKEOVER_X in level.js -- so the
    // real fight (checkBossActivation) starts the instant control returns
    // from the comic, with no further walking needed. No post-walk beat:
    // "comic ends → gameplay immediately" starts with the walk itself
    // ending at the door.
    player.x = activeApproach.arenaEntranceX;
    endBossApproach();
  }
}

function reactDuration(approach) {
  return approach.thoughts ? approach.thoughts.length * GRADUATION_ENTRANCE.thoughtDuration : BOSS_APPROACH.reactDuration;
}

function beginBossApproach(trigger) {
  activeApproach = trigger;
  approachTimer = 0;
  // Input ignored throughout (fire included), same as the utspring --
  // setInputSuppressed drops whatever was held/buffered on the way in, and
  // endBossApproach below never turns it back on before the comic's own
  // lockout (config.js COMIC) takes over, so there is no gap between the
  // two.
  setInputSuppressed(true);
  player.invincible = true;

  // Stop dead first -- the camera moves, not Jakob. arenaLockCameraX is
  // the same override updateCamera already respects for the boss-fight
  // framing further down this file; reusing it here is what "the simplest
  // boss-specific scripted movement possible" (task brief) means -- no
  // second camera system.
  player.autoRun = 0;
  approachPhase = APPROACH.REVEAL;
  arenaLockCameraX = trigger.revealCameraX;
}

// Graduation's thought bubbles (level.js 'boss-approach' thoughts): one at
// a time over Jakob during REACT, each for GRADUATION_ENTRANCE
// .thoughtDuration. World space, after the player, like the barks.
function drawApproachThought(ctx) {
  if (approachPhase !== APPROACH.REACT || !activeApproach.thoughts) return;
  const index = Math.min(activeApproach.thoughts.length - 1, Math.floor(approachTimer / GRADUATION_ENTRANCE.thoughtDuration));
  drawThoughtBubble(ctx, activeApproach.thoughts[index], player.x + player.width / 2, player.y);
}

// A thought over Jakob's head: a cloud (drawCloud) with its trailing
// puffs pointing down at him.
function drawThoughtBubble(ctx, text, headX, headTopY) {
  const spec = GRADUATION_ENTRANCE.thoughtBubble;
  drawCloud(ctx, text, headX + spec.offsetX, headTopY - spec.gapAboveHead, spec, headX);
}

// A cloud: a rounded body ringed with scallops, and -- when tailX is given
// -- two small puffs trailing down toward that x. Every circle is stroked
// first and filled second, so the fills cover the inner halves of the
// outlines and only the cloud's outer edge is left drawn.
function drawCloud(ctx, text, centerX, bottom, spec, tailX) {
  ctx.save();
  ctx.font = spec.font;
  const lines = wrapThoughtText(ctx, text, spec.maxWidth);
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const width = textWidth + spec.paddingX * 2;
  const height = lines.length * spec.lineHeight + spec.paddingY * 2;
  const left = centerX - width / 2;
  const top = bottom - height;

  const circles = [];
  const r = spec.bump;
  const stepsX = Math.max(2, Math.round(width / (r * 1.6)));
  const stepsY = Math.max(1, Math.round(height / (r * 1.6)));
  for (let i = 0; i <= stepsX; i++) {
    const x = left + (width * i) / stepsX;
    circles.push([x, top, r], [x, bottom, r]);
  }
  for (let i = 1; i < stepsY; i++) {
    const y = top + (height * i) / stepsY;
    circles.push([left, y, r], [left + width, y, r]);
  }
  // The trailing puffs, from the cloud down toward the head.
  if (tailX !== null) {
    circles.push([tailX + (centerX - tailX) * 0.35, bottom + r * 1.5, r * 0.55]);
    circles.push([tailX + (centerX - tailX) * 0.1, bottom + r * 2.9, r * 0.35]);
  }

  ctx.lineWidth = spec.borderWidth * 2; // half of it ends up hidden under the fill
  ctx.strokeStyle = spec.border;
  for (const [x, y, radius] of circles) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeRect(left, top, width, height);
  ctx.fillStyle = spec.fill;
  for (const [x, y, radius] of circles) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(left, top, width, height);

  ctx.fillStyle = spec.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, left + width / 2, top + spec.paddingY + i * spec.lineHeight + 2));
  ctx.restore();
}

function wrapThoughtText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function endBossApproach() {
  const comicId = activeApproach.comicId;
  approachPhase = null;
  approachTimer = 0;
  activeApproach = null;
  player.autoRun = null;
  player.invincible = false;
  enterComic(comicId, STATE.PLAYING);
}

// The size of the visible world rectangle while the camera is widened.
// Confetti is spawned across it and culled against it.
function widenedViewSize() {
  return { width: CANVAS.width / STAIRCASE.zoomOut, height: CANVAS.height / STAIRCASE.zoomOut };
}

// Not a particle system (AGENTS.md §7.10): a fixed number of small
// coloured rectangles, spawned once, scattered through a tall band above
// the view and across the whole horizontal run the descent will cover, so
// they keep drifting into frame for the rest of the sequence.
function spawnConfetti() {
  const view = widenedViewSize();
  const runLength = PLAYER.moveSpeed * ((1 + STAIRCASE.speedRampMultiplier) / 2) * STAIRCASE.descentDuration;
  // Anchored on the player, not on the camera: the camera eases toward its
  // target rather than snapping, so at the instant the sequence starts it
  // may still be some way behind. The player is where the confetti has to
  // be. The band runs a whole descent's worth further right, so pieces
  // keep drifting in ahead as the run carries on.
  const left = player.x + player.width / 2 - view.width / 2;
  const top = player.y + player.height / 2 - view.height / 2;
  confetti = [];
  for (let i = 0; i < CONFETTI.count; i++) {
    confetti.push({
      x: left + Math.random() * (view.width + runLength),
      y: top - Math.random() * CONFETTI.spawnBandHeight,
      vx: (Math.random() * 2 - 1) * CONFETTI.driftSpeed,
      vy: CONFETTI.fallSpeedMin + Math.random() * (CONFETTI.fallSpeedMax - CONFETTI.fallSpeedMin),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() * 2 - 1) * CONFETTI.spinSpeedMax,
      color: CONFETTI.colors[i % CONFETTI.colors.length],
    });
  }
}

function updateConfetti(dt) {
  if (confetti.length === 0) return;
  const view = widenedViewSize();
  const cullBelow = camera.y + (CANVAS.height + view.height) / 2 + CONFETTI.cullMargin;
  for (const piece of confetti) {
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;
  }
  confetti = confetti.filter((piece) => piece.y < cullBelow);
}

// --- Death bursts -----------------------------------------------------
//
// Deliberately the same shape as the confetti above, and for the same
// reason (AGENTS.md §7.10): a plain list of rectangles with their own
// timers, not a particle system. Each burst is one fading ghost of the
// body plus a handful of shards. They live in world space and are drawn
// with everything else inside the camera transform.
let deathBursts = [];

function spawnDeathBurst(entity, scale) {
  const centerX = entity.x + entity.width / 2;
  const centerY = entity.y + entity.height / 2;
  const shards = [];
  const count = Math.round(DEATH_BURST.particleCount * scale);
  for (let i = 0; i < count; i++) {
    // Fanned evenly around the circle, then jittered, so the burst reads
    // as a burst rather than as a spray in one direction.
    const angle = (i / count) * Math.PI * 2 + Math.random() * DEATH_BURST.particleAngleJitter;
    const speed = DEATH_BURST.particleSpeed * scale * (1 - DEATH_BURST.particleSpread * Math.random());
    shards.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  deathBursts.push({
    x: entity.x,
    y: entity.y,
    width: entity.width,
    height: entity.height,
    ghostTimer: DEATH_BURST.ghostDuration,
    shardTimer: DEATH_BURST.particleDuration,
    shards,
  });
}

function updateDeathBursts(dt) {
  if (deathBursts.length === 0) return;
  for (const burst of deathBursts) {
    burst.ghostTimer -= dt;
    burst.shardTimer -= dt;
    for (const shard of burst.shards) {
      shard.vy += DEATH_BURST.particleGravity * dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
    }
  }
  deathBursts = deathBursts.filter((burst) => burst.ghostTimer > 0 || burst.shardTimer > 0);
}

function drawDeathBursts(ctx) {
  for (const burst of deathBursts) {
    ctx.fillStyle = DEATH_BURST.color;

    if (burst.ghostTimer > 0) {
      const life = burst.ghostTimer / DEATH_BURST.ghostDuration; // 1 at death, 0 at the end
      const scale = 1 + (DEATH_BURST.ghostScale - 1) * (1 - life);
      const width = burst.width * scale;
      const height = burst.height * scale;
      ctx.globalAlpha = life;
      ctx.fillRect(
        Math.round(burst.x + burst.width / 2 - width / 2),
        Math.round(burst.y + burst.height / 2 - height / 2),
        width,
        height
      );
    }

    if (burst.shardTimer > 0) {
      const life = burst.shardTimer / DEATH_BURST.particleDuration;
      const size = DEATH_BURST.particleSize * life; // shrink away rather than blink out
      ctx.globalAlpha = life;
      for (const shard of burst.shards) {
        ctx.fillRect(Math.round(shard.x - size / 2), Math.round(shard.y - size / 2), size, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// Level-data-driven comic beats (story beats 5, 9 and 11 in AGENTS.md §3):
// once the player's x crosses a comic-trigger entry, gameplay pauses into
// the comic viewer. `next` is 'playing' to resume the fight ahead, or
// 'application' for the final comic, which ends the game there -- no
// Paradox fight (AGENTS.md §3).
function checkComicTriggers() {
  const trigger = comicTriggers[nextComicTriggerIndex];
  if (trigger && player.x >= trigger.x) {
    nextComicTriggerIndex += 1;
    enterComic(trigger.comicId, trigger.next === 'application' ? STATE.APPLICATION : STATE.PLAYING);
  }
}

// Spawns every entity from LEVEL (level.js). Moving an enemy or the boss
// means editing that data, not this function.
function loadLevel() {
  spawnPoint = null;
  enemies = [];
  boss = null;
  graduationBoss = null;
  pickups = [];
  platforms = [];
  tutorialBlock = null;
  stairSurface = null;
  utspringTrigger = null;
  utspringClouds = [];
  activeThought = null;
  deathBursts = [];
  shakeTimer = 0;
  shakeAmplitude = 0;
  lastBossPhase = null;
  lastGraduationStage = null;
  const checkpointXs = [];
  const sections = [];
  const triggers = [];
  const approaches = [];
  const thoughtEntries = [];
  landmarks = [];
  levelElapsed = 0;
  sectionElapsed = 0;
  timedSectionIndex = -1;
  approachPhase = null;
  approachTimer = 0;
  activeApproach = null;
  researchGolemExitX = null;
  researchGolemExitWalkTriggerX = null;
  researchGolemBoundaryX = null;
  graduationArenaFrame = null;
  exitWalkActive = false;
  exitWalkTimer = 0;
  reception = null;

  for (const entry of LEVEL) {
    const y = entryY(entry);
    if (entry.type === 'player-spawn') {
      spawnPoint = { x: entry.x, y };
    } else if (entry.type === 'enemy-mathbook') {
      enemies.push(createMathbookEnemy(entry.x, y, { hp: entry.hp, idleDuration: entry.idleDuration }));
    } else if (entry.type === 'enemy-inbox') {
      enemies.push(createInboxEnemy(entry.x, y));
    } else if (entry.type === 'enemy-helmet') {
      enemies.push(createFootballHelmetEnemy(entry.x, y, { minX: entry.minX, maxX: entry.maxX }));
    } else if (entry.type === 'boss-research-golem') {
      boss = createResearchGolem(entry.x, y, entry.activationX);
      researchGolemExitX = entry.exitX ?? null;
      researchGolemExitWalkTriggerX = entry.exitWalkTriggerX ?? null;
    } else if (entry.type === 'boss-graduation') {
      graduationBoss = createGraduationBoss(entry.x, y, entry.activationX);
      graduationArenaFrame = entry.arenaFrame ?? null;
    } else if (entry.type === 'tutorial-block') {
      tutorialBlock = { x: entry.x, y, width: TUTORIAL.blockWidth, height: TUTORIAL.blockHeight };
    } else if (entry.type === 'stair-surface') {
      stairSurface = entry.points;
    } else if (entry.type === 'platform') {
      platforms.push({ x: entry.x, y, width: PLATFORM.width, height: PLATFORM.height });
    } else if (entry.type === 'pickup') {
      const sprite = PICKUP.sprites[entry.outfit];
      pickups.push({
        x: entry.x,
        y,
        width: sprite ? sprite.width : PICKUP.width,
        height: sprite ? sprite.height : PICKUP.height,
        outfit: entry.outfit,
        comics: entry.comics ?? null, // set: touching opens these comics instead of changing outfit
        next: entry.next ?? null,
        collected: false,
      });
      checkpointXs.push(entry.x); // AGENTS.md §6: invisible checkpoints at each pickup
    } else if (entry.type === 'checkpoint') {
      checkpointXs.push(entry.x);
    } else if (entry.type === 'background-section') {
      sections.push({ name: entry.name, xStart: entry.xStart, xEnd: entry.xEnd, background: entry.background, music: entry.music, ground: entry.ground });
    } else if (entry.type === 'landmark') {
      landmarks.push({ landmark: entry.landmark, x: entry.x, parallax: entry.parallax, showAfterUtspring: entry.showAfterUtspring ?? false });
    } else if (entry.type === 'utspring-trigger') {
      utspringTrigger = { x: entry.x, descentX: entry.descentX, markY: y };
    } else if (entry.type === 'utspring-cloud') {
      utspringClouds.push({ x: entry.x, y, text: entry.text, shownFor: 0 });
    } else if (entry.type === 'thought-trigger') {
      thoughtEntries.push({ x: entry.x, text: entry.text, duration: entry.duration });
    } else if (entry.type === 'comic-trigger') {
      triggers.push({ x: entry.x, comicId: entry.comicId, next: entry.next });
    } else if (entry.type === 'reception-encounter') {
      reception = createReception(entry);
    } else if (entry.type === 'boss-approach') {
      approaches.push({
        x: entry.x,
        comicId: entry.comicId,
        arenaEntranceX: entry.arenaEntranceX,
        boss: entry.boss,
        revealCameraX: entry.revealCameraX,
        // The reaction: a bark (Research Golem) or thought bubbles
        // (Graduation). walkDuration is optional -- see updateBossApproach.
        reactBark: entry.reactBark,
        thoughts: entry.thoughts,
        walkDuration: entry.walkDuration,
      });
    }
  }

  sections.sort((a, b) => a.xStart - b.xStart);
  backgroundSections = sections;

  checkpointXs.sort((a, b) => a - b);
  checkpoints = checkpointXs.map((x) => ({ x, y: entryY({ type: 'checkpoint' }) }));
  nextCheckpointIndex = 0;

  triggers.sort((a, b) => a.x - b.x);
  comicTriggers = triggers;
  nextComicTriggerIndex = 0;

  approaches.sort((a, b) => a.x - b.x);
  bossApproaches = approaches;
  nextBossApproachIndex = 0;

  thoughtEntries.sort((a, b) => a.x - b.x);
  thoughtTriggers = thoughtEntries;
  nextThoughtTriggerIndex = 0;
}

// Focus/visibility handling (task 3.10): true whenever the tab is hidden
// (switched away, minimized) or the window itself isn't focused (alt-tabbed
// to another app). The music pauses on the same check (updateMusic).
let wasUnfocused = false;

function isUnfocused() {
  return document.hidden || !document.hasFocus();
}

function loop(now) {
  const unfocused = isUnfocused();
  updateMusic(currentMusic(), unfocused);
  // Only during gameplay: the title and comic screens are DOM screens
  // stacked over the canvas and have no simulation to freeze, so there is
  // nothing there for a "click to resume" to be about.
  setResumeHint(unfocused && gameState === STATE.PLAYING);
  if (unfocused) {
    // Frozen: no stepping, no accumulating. requestAnimationFrame keeps
    // getting scheduled below so the loop is instantly ready the moment
    // focus returns -- nothing to "wake up".
    wasUnfocused = true;
    render();
    clearFrameInput();
    requestAnimationFrame(loop);
    return;
  }

  if (wasUnfocused) {
    // Just regained focus/visibility. Drop the entire unfocused interval
    // rather than clamping it into one big (or several capped) catch-up
    // steps -- PLAN.md task 3.10: no jump in simulation, nothing advances
    // for time the player wasn't there to see.
    wasUnfocused = false;
    lastTime = now;
    accumulator = 0;
  }

  let delta = (now - lastTime) / 1000;
  lastTime = now;
  if (delta > TIMESTEP.maxFrameDelta) delta = TIMESTEP.maxFrameDelta;

  // Only PLAYING has a simulation to step. TITLE, COMIC and APPLICATION
  // are DOM screens with no fixed-timestep work of their own -- their own
  // input (clicks, Space) is handled by ui.js/comics.js directly, not
  // read from here.
  if (gameState === STATE.PLAYING) {
    accumulator += delta;
    while (accumulator >= FIXED_DT && gameState === STATE.PLAYING) {
      step(FIXED_DT);
      accumulator -= FIXED_DT;
      // An edge-triggered press belongs to the fixed step that read it,
      // not to the rendered frame. A rendered frame does not always run a
      // step -- whenever the display refreshes faster than 60 Hz, and at
      // 60 Hz too whenever vsync jitter leaves the accumulator just short
      // of one step -- and clearing per rendered frame silently threw
      // those presses away, so jumps were being dropped.
      clearFrameInput();
    }
  } else {
    accumulator = 0;
    clearFrameInput();
  }

  render();
  requestAnimationFrame(loop);
}

// Which music track should be playing (music.js). Each background section
// names its track in level.js; the two boss fights override that while
// they are running -- the Research Golem only until it falls (exploration
// is back for the walk out), Graduation from its first attack to the end
// of the game. Comics are silent (author request: the soundtrack doesn't
// fit them; they may get their own sound later): the music fades out as a
// comic opens and the right track comes back when it ends, picking up
// where it left off. A scripted boss approach doesn't change the music --
// it keeps whatever was playing, because its walk can wake the boss a step
// before the comic opens and the boss music must start with the fight
// itself, not under the approach.
let gameplayMusic = null;
function currentMusic() {
  if (gameState === STATE.TITLE || gameState === STATE.COMIC || gameState === STATE.APPLICATION) return null;
  if (approachPhase !== null && gameplayMusic !== null) return gameplayMusic;
  if (boss && boss.active && boss.alive) gameplayMusic = 'research-golem';
  else if (graduationBoss && graduationBoss.active) gameplayMusic = 'graduation';
  else gameplayMusic = backgroundSections[sectionIndexAt(player.x)].music ?? null;
  return gameplayMusic;
}

function step(dt) {
  // Hitstop consumes whole simulation steps. Nothing below runs, so the
  // frame the shot landed on is what stays on screen for the freeze --
  // including the enemy's hit flash.
  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    return;
  }

  // Before the player updates: the sequence owns their movement while it
  // is running, so it has to set autoRun for this step first.
  updateUtspring(dt);
  updateBossApproach(dt);
  updateResearchGolemExitWalk(dt);
  updateReception(reception, dt, player);
  const extraPlatforms = receptionPlatforms(reception);
  const walkablePlatforms = tutorialBlock ? platforms.concat(tutorialBlock) : platforms;
  const previousPlayerX = player.x;
  const wasGrounded = player.onGround;
  const spawned = updatePlayer(player, dt, spawnPoint, extraPlatforms ? walkablePlatforms.concat(extraPlatforms) : walkablePlatforms);
  applyTutorialBlock(previousPlayerX);
  applyStairSurface(wasGrounded);
  updateThoughtTriggers(dt);
  setTutorialVisible(player.x < TUTORIAL_END_X);
  if (spawned.length > 0) projectiles.push(...spawned);
  checkBossActivation();
  checkEnemyActivation();
  applySolidWalls();
  applyArenaWall();
  applyResearchGolemBoundary();
  applyGraduationBoundary();
  applyReceptionWalls(reception, player);
  updateProjectiles(dt);
  for (const enemy of enemies) {
    const enemySpawned = updateEnemy(enemy, dt, player);
    if (enemySpawned.length > 0) projectiles.push(...enemySpawned);
  }
  const bossSpawned = updateResearchGolem(boss, dt);
  if (bossSpawned.length > 0) projectiles.push(...bossSpawned);
  const graduationSpawned = updateGraduationBoss(graduationBoss, dt, player);
  if (graduationSpawned.length > 0) projectiles.push(...graduationSpawned);
  const hpBeforeHits = player.hp;
  resolveProjectileHits();
  resolveEnemyContact();
  // Graduation's rising slabs: timed damage zones, not projectiles.
  if (graduationSlabHitsPlayer(graduationBoss, player)) damagePlayer(player, GRADUATION.contactDamage);
  if (player.hp < hpBeforeHits) requestShake(SHAKE.playerDamage);
  watchBossPhaseChanges();
  resolvePickups();
  advanceCheckpoint();
  handleDeathTransition();
  checkComicTriggers();
  updateDeathBursts(dt);
  if (shakeTimer > 0) shakeTimer -= dt;
  advancePacingTimers(dt);
  updateCamera(dt);
}

function resolvePickups() {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    if (aabbOverlap(player, pickup)) {
      pickup.collected = true;
      if (pickup.comics) {
        enterComic(pickup.comics, pickup.next === 'application' ? STATE.APPLICATION : STATE.PLAYING);
        return;
      }
      applyPickup(player, pickup.outfit);
    }
  }
}

// AGENTS.md §6: invisible checkpoints. spawnPoint only ever moves forward
// as the player reaches each one, in level order.
function advanceCheckpoint() {
  const next = checkpoints[nextCheckpointIndex];
  if (next && player.x >= next.x) {
    spawnPoint = { x: next.x, y: next.y };
    nextCheckpointIndex += 1;
  }
}

// Death-during-boss handling (task 2.6): the moment death happens, clear
// every hostile projectile (boss- or enemy-owned) so respawning doesn't
// immediately walk the player back into fire they never had a chance to
// see. Fast respawn and the boss keeping its HP are already true by
// construction -- respawnPlayer (player.js) never touches boss state, and
// PLAYER.respawnDelay is short. Graduation also has attacks still to come
// that are not projectiles yet (queued shots, a wind-up in progress);
// clearGraduationHazards drops those too.
function handleDeathTransition() {
  if (player.dead && !wasPlayerDead) {
    projectiles = projectiles.filter((projectile) => projectile.owner === 'player');
    clearGraduationHazards(graduationBoss);
  }
  wasPlayerDead = player.dead;
}

// Bosses stand still and are solid walls (solidWall in their config): the
// player can't walk behind either one, so both fights always happen with
// the player facing right, by design.
function applyTutorialBlock(previousPlayerX) {
  if (!tutorialBlock || player.dead || !aabbOverlap(player, tutorialBlock)) return;
  // The top is already handled as a one-way platform in updatePlayer. Only
  // stop a side crossing while the player's feet are below that top.
  if (previousPlayerX + player.width <= tutorialBlock.x && player.vx > 0) {
    player.x = tutorialBlock.x - player.width;
  } else if (previousPlayerX >= tutorialBlock.x + tutorialBlock.width && player.vx < 0) {
    player.x = tutorialBlock.x + tutorialBlock.width;
  }
}

function applySolidWalls() {
  clampBehindSolidBoss(boss, RESEARCH_GOLEM);
  clampBehindSolidBoss(graduationBoss, GRADUATION);
}

function clampBehindSolidBoss(bossEntity, spec) {
  if (!spec.solidWall || !bossEntity.alive) return;
  const maxX = bossEntity.x - player.width;
  if (player.x > maxX) player.x = maxX;
}

// Task B: a sleeping boss can otherwise just be run past -- the level's
// only obstacle up to that point is contact damage, not a barrier. Waking
// a boss closes an invisible wall exactly where the player crossed and
// locks the camera to frame the whole arena, so the fight can't be
// skipped and nothing scrolls out of view mid-dodge. Both clear the
// instant that boss dies.
function checkBossActivation() {
  activateBossIfReached(boss, activateResearchGolem);
  activateBossIfReached(graduationBoss, activateGraduationBoss);

  if (lockedBoss && !lockedBoss.alive) {
    arenaWallX = null;
    arenaLockCameraX = null;
    lockedBoss = null;
  }
}

function activateBossIfReached(bossEntity, activate) {
  if (!bossEntity || bossEntity.active || !bossEntity.alive) return;
  if (player.x < bossEntity.activationX) return;

  activate(bossEntity, player); // task 1: starts the first wind-up immediately
  arenaWallX = bossEntity.activationX;
  lockedBoss = bossEntity;
  const arenaCenterX = (arenaWallX + bossEntity.x + bossEntity.width) / 2;
  arenaLockCameraX = arenaCenterX - CANVAS.width / 2;
  // The Graduation arena is framed zoomed out (graduationArenaFraming).
  // The player has just stepped out of the comic into it, so the camera
  // cuts straight to that framing rather than gliding in from the portal
  // shot outside -- that shot belongs to a different place.
  if (bossEntity === graduationBoss) {
    const framing = graduationArenaFraming();
    if (framing) {
      camera.x = framing.x;
      camera.y = framing.y;
      camera.zoom = framing.zoom;
    }
  }
  // Backtrack repair task (§7): this venue's own boundary, independent of
  // arenaWallX above -- only the Research Golem needs one that outlives the
  // fight (see applyResearchGolemBoundary). Graduation is untouched.
  if (bossEntity === boss) researchGolemBoundaryX = bossEntity.activationX;
}

// Backtrack/re-entry repair task (§7/§10): keeps the player from ever
// walking back through either of the venue's own doors. Deliberately
// separate from arenaWallX, which checkBossActivation drops the instant
// the boss dies -- fine for every other boss, but this venue must stay
// one-way for the whole time the player is inside AND after they've left
// (task brief §10: walking back toward the façade must not reopen the
// interior). Sets once, on activation, then only ever ratchets forward --
// from the entrance door to the exit door, the moment the player actually
// crosses it -- never back.
function applyResearchGolemBoundary() {
  if (researchGolemBoundaryX === null) return;
  if (researchGolemExitX !== null && player.x >= researchGolemExitX) researchGolemBoundaryX = researchGolemExitX;
  if (player.x < researchGolemBoundaryX) player.x = researchGolemBoundaryX;
}

// The Graduation arena is one-way too: once the fight has started, the
// player can never walk back out through the portal -- not during the
// fight (arenaWallX already covers that) and not after it, when arenaWallX
// drops. Behind the portal is the Haga street, not more arena.
function applyGraduationBoundary() {
  if (!graduationBoss || !graduationBoss.active) return;
  if (player.x < graduationBoss.activationX) player.x = graduationBoss.activationX;
}

// Post-boss exit repair task (§9): a short, quiet auto-walk through the
// exit door -- control taken a short distance before it, Jakob carried the
// rest of the way at normal speed, control given back just past it -- so
// the arena/Haga render-state flip (RESEARCH_GOLEM_EXIT_X) reads as an
// authored beat instead of a cut mid-stride. One-shot: fires once, then
// disarms itself. Same primitives as updateBossApproach's WALK phase
// (player.autoRun, setInputSuppressed), just without the phases, camera
// move or comic that entrance gets -- this is deliberately smaller.
function updateResearchGolemExitWalk(dt) {
  if (researchGolemExitWalkTriggerX === null) return;

  if (!exitWalkActive) {
    if (player.x < researchGolemExitWalkTriggerX) return;
    exitWalkActive = true;
    exitWalkTimer = 0;
    setInputSuppressed(true);
    player.invincible = true;
    player.autoRun = PLAYER.moveSpeed;
    return;
  }

  exitWalkTimer += dt;
  if (exitWalkTimer >= RESEARCH_GOLEM_EXIT.walkDuration) {
    player.autoRun = null;
    player.invincible = false;
    setInputSuppressed(false);
    exitWalkActive = false;
    researchGolemExitWalkTriggerX = null; // one-shot: never fires again
  }
}

// task 1: the maths book and football helmet get the same proximity
// activation the bosses already had -- see config.js ACTIVATION.
function checkEnemyActivation() {
  for (const enemy of enemies) {
    if (enemy.active === false && player.x >= enemy.activationX) activateEnemy(enemy);
  }
}

function applyArenaWall() {
  if (arenaWallX !== null && player.x < arenaWallX) player.x = arenaWallX;
}

function updateProjectiles(dt) {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx * dt;
    if (projectile.gravity) projectile.vy += projectile.gravity * dt;
    projectile.y += (projectile.vy || 0) * dt;
    projectile.life -= dt;
    // Presentation clock for the authored boss projectile art. Only boss
    // shots carry it; everything else leaves it undefined and draws the
    // plain rectangle below.
    if (projectile.age !== undefined) projectile.age += dt;
  }
  // Task B: culled the instant a projectile leaves the camera's active
  // area, regardless of remaining lifetime -- a correctness fix on its
  // own, since nothing should be able to travel a whole section of the
  // level, independent of whether the boss that fired it was dormant.
  // Measured against what is actually on screen, so a zoomed-out camera
  // (the Graduation arena) doesn't cull shots while they are still in view.
  const view = visibleWorldRect();
  const cullLeft = view.left - PROJECTILE_CULL_MARGIN;
  const cullRight = view.left + view.width + PROJECTILE_CULL_MARGIN;
  projectiles = projectiles.filter(
    (projectile) =>
      projectile.life > 0 &&
      projectile.x + projectile.width > cullLeft &&
      projectile.x < cullRight &&
      // Nothing survives below the floor. The arcing and fanned boss
      // patterns have no ground interaction, so they used to sink through
      // the floor line and keep travelling inside it -- a hazard-coloured
      // object moving around underneath the ground the player stands on.
      // This cannot change what can hit anyone: the player's feet rest on
      // groundY, so a projectile whose top is at or below groundY is
      // entirely beneath them and could never have overlapped.
      projectile.y < WORLD.groundY &&
      // Graduation's falling books stop AT the floor: gone the step their
      // bottom edge reaches it, rather than sliding into the ground.
      !(projectile.removeOnLanding && projectile.y + projectile.height >= WORLD.groundY)
  );
}

function resolveProjectileHits() {
  for (const projectile of projectiles) {
    // Hostile: fired by a boss or an enemy (e.g. the maths book). Only the
    // player owner tag means "vs enemies/bosses" below.
    if (projectile.owner !== 'player') {
      if (aabbOverlap(projectile, player)) {
        damagePlayer(player, projectile.contactDamage);
        projectile.life = 0;
      }
      continue;
    }

    // Player-owned: vs enemies, then vs whichever boss is alive.
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (aabbOverlap(projectile, shotHitbox(enemy))) {
        // hp before/after is what separates a shot that did damage from
        // one that was merely absorbed -- the Endless Inbox can't be shot
        // down at all, so it shouldn't feel like a hit landed.
        const hpBefore = enemy.hp;
        const killed = damageEnemy(enemy, 1);
        if (killed) spawnDeathBurst(enemy, 1);
        if (killed) requestShake(SHAKE.enemyDeath);
        if (killed) requestHitstop(HITSTOP.enemyDeath);
        else if (enemy.hp < hpBefore) requestHitstop(HITSTOP.enemyHit);
        projectile.life = 0;
        break;
      }
    }
    if (projectile.life <= 0) continue;

    if (boss.alive) {
      if (boss.phase === 'claim') {
        const claim = findResearchGolemClaimHit(boss, projectile);
        if (claim) {
          resolveClaimShot(boss, claim);
          projectile.life = 0;
        }
      } else if (aabbOverlap(projectile, boss)) {
        const hpBefore = boss.hp;
        damageResearchGolem(boss, 1);
        if (boss.hp < hpBefore) requestHitstop(boss.alive ? HITSTOP.enemyHit : HITSTOP.enemyDeath);
        if (!boss.alive) spawnDeathBurst(boss, DEATH_BURST.bossScale);
        projectile.life = 0;
      }
    }
    if (projectile.life <= 0) continue;

    if (graduationBoss.alive && aabbOverlap(projectile, graduationBoss)) {
      const hpBefore = graduationBoss.hp;
      damageGraduationBoss(graduationBoss, 1);
      if (graduationBoss.hp < hpBefore) {
        requestHitstop(graduationBoss.alive ? HITSTOP.enemyHit : HITSTOP.enemyDeath);
      }
      if (!graduationBoss.alive) spawnDeathBurst(graduationBoss, DEATH_BURST.bossScale);
      projectile.life = 0;
    }
  }
  projectiles = projectiles.filter((projectile) => projectile.life > 0);
}

// A longer freeze already running is never shortened by a later, smaller
// request -- two shots landing back to back should not cut the first
// impact short.
function requestHitstop(seconds) {
  if (seconds > hitstopTimer) hitstopTimer = seconds;
}

// A bigger shake replaces a smaller one that is still running; a smaller
// one never cuts a bigger one short. Requests never add together, so the
// ceiling in config.js is a real ceiling.
function requestShake(amplitude) {
  const capped = Math.min(amplitude, SHAKE.maxAmplitude);
  if (shakeTimer > 0 && capped < shakeAmplitude) return;
  shakeAmplitude = capped;
  shakeTimer = SHAKE.duration;
}

// The Research Golem's phase ('phaseA' -> 'claim' -> 'phaseB' -> 'dead')
// and Graduation's stage ('stage1' -> 'stage2' -> 'dead') are both set
// inside bosses.js. Rather than have the bosses reach out and ask for
// presentation, game.js simply notices when one changed.
function watchBossPhaseChanges() {
  if (boss.active && boss.phase !== lastBossPhase) {
    if (lastBossPhase !== null) requestShake(SHAKE.bossPhaseChange);
    lastBossPhase = boss.phase;
  }
  if (graduationBoss.active && graduationBoss.stage !== lastGraduationStage) {
    if (lastGraduationStage !== null) requestShake(SHAKE.bossPhaseChange);
    lastGraduationStage = graduationBoss.stage;
  }
}

// Decays linearly to nothing over SHAKE.duration. Screen space, applied
// only to the world transform -- see the note in config.js SHAKE.
function shakeOffset() {
  if (shakeTimer <= 0) return { x: 0, y: 0 };
  const remaining = shakeTimer / SHAKE.duration;
  const amplitude = shakeAmplitude * remaining;
  const phase = (SHAKE.duration - shakeTimer) * SHAKE.frequency * Math.PI * 2;
  // Different rates on the two axes, so it reads as a knock rather than
  // as a diagonal slide.
  return { x: Math.sin(phase) * amplitude, y: Math.cos(phase * 1.7) * amplitude * 0.6 };
}

function resolveEnemyContact() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    // contactDamageFor can return 0 now (the helmet while recovering), and
    // damagePlayer would otherwise still burn the invulnerability window on
    // a hit that did nothing -- skip the call entirely rather than let a
    // real subsequent hit go unfelt because of it.
    const damage = contactDamageFor(enemy);
    if (damage > 0 && aabbOverlap(player, enemy)) {
      damagePlayer(player, damage);
    }
  }
}

function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Deadzone camera: the target can move freely inside a centered box before
// the camera starts catching up, then eases toward keeping it at the edge
// of that box. Smoothing is an exponential ease, framerate-independent.
function updateCamera(dt) {
  const targetCenterX = player.x + player.width / 2;
  const targetCenterY = player.y + player.height / 2;

  const halfDeadzoneW = CAMERA.deadzoneWidth / 2;
  const halfDeadzoneH = CAMERA.deadzoneHeight / 2;

  const viewCenterX = camera.x + CANVAS.width / 2;
  const viewCenterY = camera.y + CANVAS.height / 2;

  // The reception encounter frames its whole arena -- x, y and zoom
  // together -- while it runs (reception.js receptionCameraFraming).
  const framing = receptionCameraFraming(reception) ?? graduationArenaFraming();

  let desiredX = camera.x;
  if (framing) {
    desiredX = framing.x;
  } else if (arenaLockCameraX !== null) {
    // Task B: while a boss arena is active, the camera holds a fixed
    // framing of the whole arena instead of following the player, so
    // nothing scrolls out of view while dodging.
    desiredX = arenaLockCameraX;
  } else {
    const dx = targetCenterX - viewCenterX;
    if (dx > halfDeadzoneW) desiredX = camera.x + (dx - halfDeadzoneW);
    else if (dx < -halfDeadzoneW) desiredX = camera.x + (dx + halfDeadzoneW);
  }

  let desiredY = camera.y;
  const dy = targetCenterY - viewCenterY;
  if (framing) desiredY = framing.y;
  else if (dy > halfDeadzoneH) desiredY = camera.y + (dy - halfDeadzoneH);
  else if (dy < -halfDeadzoneH) desiredY = camera.y + (dy + halfDeadzoneH);

  const ease = 1 - Math.exp(-CAMERA.smoothing * dt);
  camera.x += (desiredX - camera.x) * ease;
  camera.y += (desiredY - camera.y) * ease;

  // The view widens for the whole utspring (task 3.5). No zoom system was
  // built for it: the camera transform in render() already applies
  // camera.zoom, so this is one target value, eased by the same smoothing
  // every other camera motion uses.
  let targetZoom = isUtspringRunning() ? STAIRCASE.zoomOut : 1;
  if (framing) targetZoom = framing.zoom;
  const zoomEase = 1 - Math.exp(-CAMERA.zoomSmoothing * dt);
  camera.zoom += (targetZoom - camera.zoom) * zoomEase;
}

// The Graduation arena's camera: zoomed out to show the whole arena art,
// x, y and zoom together, the same shape as receptionCameraFraming. Held
// for as long as the player is inside the arena -- the fight, the armour
// and the final comic all happen inside this one shot.
function graduationArenaFraming() {
  if (!graduationArenaFrame || !graduationInterior()) return null;
  const frame = graduationArenaFrame;
  const zoom = CANVAS.width / (frame.right - frame.left);
  // visibleWorldRect: the view's left/top edge is camera + (size - size / zoom) / 2.
  const x = frame.left - (CANVAS.width - CANVAS.width / zoom) / 2;
  const y = frame.top - (CANVAS.height - CANVAS.height / zoom) / 2;
  return { x, y, zoom };
}

// Which section a world x falls in. Sections are contiguous and sorted,
// so the first one the x falls short of is the answer; anything past the
// last section keeps wearing it.
function sectionIndexAt(x) {
  for (let i = 0; i < backgroundSections.length; i++) {
    if (x < backgroundSections[i].xEnd) return i;
  }
  return backgroundSections.length - 1;
}

function advancePacingTimers(dt) {
  levelElapsed += dt;
  const index = sectionIndexAt(player.x);
  if (index !== timedSectionIndex) {
    timedSectionIndex = index;
    sectionElapsed = 0;
  }
  sectionElapsed += dt;
}

// The world rectangle currently on screen. Everything below fills exactly
// this, so a background costs the same whether its section is 2,000px
// long or 20,000.
// The ground: the flat colour slab it has always been, with the shared
// cobblestone-and-dirt artwork repeated across it (config.js
// WORLD.groundTexture). The slab stays underneath as the base fill, so
// the frames before the asset loads look exactly like they used to and a
// failed load can never show sky below the floor.
//
// Anchored to WORLD.groundY, not the other way round: the image's top row
// is the top of the cobblestones, so drawing it AT groundY puts the
// stones' surface on the collision line and the player's feet on the
// stones. Tiles are 1:1 at native size (no runtime scale factor, no
// resampling) and their positions come from world x via floor division,
// never a running counter -- so the art cannot drift relative to the
// collision surface as the camera moves, and a tile lands in the same
// place whichever direction the player arrived from.
//
// Only the visible span is tiled, the same way the background layers
// already limit themselves, with the same screen-shake bleed so a shake
// cannot slide the tiles off the edge of the frame.
function drawGround(ctx) {
  const insideGraduation = graduationInterior();
  const texture = insideGraduation
    ? WORLD.graduationGroundTexture
    : researchGolemInterior() ? WORLD.arenaGroundTexture : WORLD.groundTexture;
  // The Graduation floor's tiling starts at the arena art's own left edge
  // (config.js WORLD.graduationGroundTexture); every other floor tiles from
  // world x 0.
  const originX = insideGraduation ? graduationArenaFrame.left : 0;

  ctx.fillStyle = texture.fillColor ?? WORLD.groundColor;
  ctx.fillRect(
    LEVEL_BOUNDS.renderLeft,
    WORLD.groundY,
    LEVEL_BOUNDS.renderRight - LEVEL_BOUNDS.renderLeft,
    WORLD.groundDepth
  );

  const image = getImage(texture.path);
  if (!image) return; // not loaded (or failed) yet -- the slab above stands in

  const view = visibleWorldRect();
  const bleed = SHAKE.maxAmplitude * 2;
  const left = Math.max(LEVEL_BOUNDS.renderLeft, view.left - bleed);
  const right = Math.min(LEVEL_BOUNDS.renderRight, view.left + view.width + bleed);

  for (
    let tileX = originX + Math.floor((left - originX) / texture.tileWidth) * texture.tileWidth;
    tileX < right;
    tileX += texture.tileWidth
  ) {
    // raise (optional, config.js): px of the tile drawn ABOVE groundY, for
    // a floor whose art has things standing up out of the surface the
    // player walks on (the Graduation balustrade's capstones).
    ctx.drawImage(image, tileX, WORLD.groundY - (texture.raise ?? 0), texture.tileWidth, texture.tileHeight);
  }

  // A section with its own floor (level.js `ground`: the Clinic) covers
  // the one above across exactly its own x range, tiled from its start.
  for (const section of backgroundSections) {
    if (!section.ground || section.xEnd < left || section.xStart > right) continue;
    const floor = WORLD[section.ground];
    const floorImage = getImage(floor.path);
    if (!floorImage) continue;
    const from = Math.max(left, section.xStart);
    const to = Math.min(right, section.xEnd);
    ctx.save();
    ctx.beginPath();
    ctx.rect(from, WORLD.groundY, to - from, WORLD.groundDepth);
    ctx.clip();
    ctx.fillStyle = WORLD.groundColor;
    ctx.fillRect(from, WORLD.groundY, to - from, WORLD.groundDepth);
    for (let tileX = section.xStart + Math.floor((from - section.xStart) / floor.tileWidth) * floor.tileWidth; tileX < to; tileX += floor.tileWidth) {
      ctx.drawImage(floorImage, tileX, WORLD.groundY, floor.tileWidth, floor.tileHeight);
    }
    ctx.restore();
  }
}

function visibleWorldRect() {
  const width = CANVAS.width / camera.zoom;
  const height = CANVAS.height / camera.zoom;
  return {
    width,
    height,
    left: camera.x + (CANVAS.width - width) / 2,
    top: camera.y + (CANVAS.height - height) / 2,
  };
}

// The boundary band selects the two active environments and their weights.
// Their layers are composited by depth below, never as two complete stacks.
function drawBackground(ctx) {
  if (!backgroundSections || backgroundSections.length === 0) return;

  const refX = camera.x + CANVAS.width / 2;
  const half = BACKGROUND.blendBandWidth / 2;

  for (let i = 0; i < backgroundSections.length - 1; i++) {
    const boundary = backgroundSections[i].xEnd;
    if (refX > boundary - half && refX < boundary + half) {
      const blend = (refX - (boundary - half)) / BACKGROUND.blendBandWidth; // 0 -> 1
      drawBackgroundDepths(ctx, backgroundSections[i], backgroundSections[i + 1], blend);
      return;
    }
  }

  drawBackgroundDepths(ctx, backgroundSections[sectionIndexAt(refX)]);
}

// Composite the transition within each depth, then draw depths globally.
// Weighted premultiplied-alpha addition gives (1-t)*A + t*B, rather than
// stacking two opaque mid scenes. Scratch canvases are allocated only once.
const backgroundDepths = ['sky', 'far', 'mid', 'near'];
let backgroundBlendCanvases;

function backgroundDepth(layer) {
  if (layer.depth) return layer.depth;
  if (layer.source.type === 'color' || layer.source.type === 'gradient') return 'sky';
  // Legacy silhouette placeholders are the close scenery in each section.
  return 'near';
}

// Takes the section objects, not just their background keys, because a
// layer with an opening tile (drawImageTile) has to know where its own
// section starts in the world -- that is the one thing about a background
// that is level layout rather than a property of the background itself.
function drawBackgroundDepths(ctx, outgoingSection, incomingSection, blend = 0) {
  const outgoing = BACKGROUNDS[outgoingSection.background]?.layers ?? [];
  const incoming = BACKGROUNDS[incomingSection?.background]?.layers ?? [];
  if (!incomingSection) {
    for (const depth of backgroundDepths) {
      for (const layer of outgoing) {
        if (backgroundDepth(layer) === depth) drawBackgroundLayer(ctx, layer, outgoingSection.xStart);
      }
    }
    return;
  }
  if (!backgroundBlendCanvases) {
    backgroundBlendCanvases = Array.from({ length: 3 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS.width;
      canvas.height = CANVAS.height;
      return canvas;
    });
  }
  const transform = ctx.getTransform();
  for (const depth of backgroundDepths) {
    for (const [index, layers] of [outgoing, incoming].entries()) {
      const sectionStartX = (index === 0 ? outgoingSection : incomingSection).xStart;
      const scratch = backgroundBlendCanvases[index].getContext('2d');
      scratch.resetTransform();
      scratch.clearRect(0, 0, CANVAS.width, CANVAS.height);
      scratch.imageSmoothingEnabled = false;
      scratch.setTransform(transform);
      for (const layer of layers) {
        if (backgroundDepth(layer) === depth) drawBackgroundLayer(scratch, layer, sectionStartX);
      }
    }
    const mixed = backgroundBlendCanvases[2].getContext('2d');
    mixed.clearRect(0, 0, CANVAS.width, CANVAS.height);
    mixed.globalCompositeOperation = 'source-over';
    mixed.globalAlpha = 1 - blend;
    mixed.drawImage(backgroundBlendCanvases[0], 0, 0);
    mixed.globalCompositeOperation = 'lighter';
    mixed.globalAlpha = blend;
    mixed.drawImage(backgroundBlendCanvases[1], 0, 0);
    mixed.globalAlpha = 1;
    mixed.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.resetTransform();
    ctx.drawImage(backgroundBlendCanvases[2], 0, 0);
    ctx.restore();
  }
}

// One legacy `parallax` value still applies to both axes. A layer can opt
// into independent depth with parallaxX/parallaxY; unspecified axes fall
// back to the legacy value, then to ordinary world tracking (1). Grounded
// architecture uses parallaxY: 1, making shiftY zero so its baseline moves
// through screen space exactly as WORLD.groundY does when camera.y changes.
function drawBackgroundLayer(ctx, layer, sectionStartX = 0) {
  const view = visibleWorldRect();
  const parallaxX = layer.parallaxX ?? layer.parallax ?? 1;
  const parallaxY = layer.parallaxY ?? layer.parallax ?? 1;
  const shiftX = camera.x * (1 - parallaxX);
  const shiftY = camera.y * (1 - parallaxY);
  // Overfilled by the screen-shake ceiling (doubled, since the utspring
  // pull-back means a screen-space pixel can be more than a world pixel).
  // Without it a shake slides the fills off the edge of the screen and
  // leaves a bare strip down the side of the frame.
  const bleed = SHAKE.maxAmplitude * 2;
  // In this translated space, the visible span starts here.
  const left = view.left - shiftX - bleed;
  const right = left + view.width + bleed * 2;

  ctx.save();
  ctx.translate(shiftX, shiftY);
  const source = layer.source;

  const fillWidth = right - left;
  const fillTop = view.top - shiftY - bleed;
  const fillHeight = view.height + bleed * 2;

  if (source.type === 'color') {
    ctx.fillStyle = source.color;
    ctx.fillRect(left, fillTop, fillWidth, fillHeight);
  } else if (source.type === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.groundY);
    gradient.addColorStop(0, source.from);
    gradient.addColorStop(1, source.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(left, fillTop, fillWidth, fillHeight);
  } else if (source.type === 'silhouette') {
    drawSilhouette(ctx, source, left, right);
  } else if (source.type === 'image') {
    // A parallax layer tiles in its OWN shifted space, not world space: a
    // point t in it lands on screen at t + camera.x * (1 - parallaxX). So
    // anchoring the opening tile to the section's world start means
    // sectionStartX * parallaxX, which is the t that puts the tile's left
    // edge exactly on the section boundary as the camera reaches it. Using
    // the raw world x here put the tile most of a screen away.
    drawImageTile(ctx, source, left, right, sectionStartX * parallaxX);
  }

  ctx.restore();
}

// One strip of bars standing on the ground line, repeated across the
// visible span. Bars are spread evenly across tileWidth and a 0 height is
// a gap. The +1 on each bar's width closes the seam between neighbours.
function drawSilhouette(ctx, source, left, right) {
  const { color, tileWidth, heights } = source;
  const barWidth = tileWidth / heights.length;
  ctx.fillStyle = color;
  for (let tileX = Math.floor(left / tileWidth) * tileWidth; tileX < right; tileX += tileWidth) {
    for (let i = 0; i < heights.length; i++) {
      const height = heights[i];
      if (height <= 0) continue;
      ctx.fillRect(tileX + i * barWidth, WORLD.groundY - height, barWidth + 1, height);
    }
  }
}

// A strip of ordinary (non-seamless) artwork, repeated across the visible
// span the way drawSilhouette repeats its rects. Tiles alternate
// orientation -- even repeats normal, odd mirrored -- so a normal tile's
// right edge always meets its own mirror image at the seam, which is
// pixel-identical by construction (BACKGROUND-ASSET-SPEC.md's empty edge
// margins keep that seam on empty sky rather than a symmetrical doubled
// shape). Parity comes from the tile's world position
// (floor(tileX / tileWidth)), never a running counter, so it can never
// depend on which direction the player approached from or where the
// camera started.
//
// displayHeight and baselineY are both measured in the strip's approved
// display space (BACKGROUND-ASSET-SPEC.md), never the loaded image's own
// pixel size -- a runtime delivery file can be stored at a smaller
// resolution (scripts/runtime-assets.py RUNTIME_SIZE) and is scaled back
// up to displayHeight here, the same way landmarks already scale to their
// own configured width/height regardless of native resolution.
// An `openingPath` layer (USA) plays one authored establishing tile at the
// section's own start and then repeats `path` for the rest of it. That is
// the only case where tiling is anchored to the section rather than to
// world zero: an opening tile has to land on the section boundary, so its
// index 0 is measured from tileOriginX (the caller has already converted
// the section's world start into this layer's parallax space). Every other
// layer keeps the world-anchored parity it has always had, or its own fixed
// `tileOffset` if it names one -- see the note above originX below.
function drawImageTile(ctx, source, left, right, tileOriginX = 0) {
  const image = resolveBackgroundImage(source);
  if (!image) return; // not loaded (or failed) yet -- draw nothing this frame, not an error
  const { tileWidth, displayHeight, baselineY, openingPath, tileOffset } = source;
  const drawY = WORLD.groundY - baselineY;

  // A layer without an opening tile keeps the world-anchored parity it has
  // always had (originX 0) unless it names its own fixed `tileOffset` -- a
  // constant phase shift, in this layer's own shifted space, that keeps two
  // strips sharing a section (e.g. goteborg-city's far/mid) from seaming at
  // the same world x. Two layers with close tileWidths both anchored at 0
  // put their transparent tile edges at (almost) the same spot every
  // repeat, so neither ever covers the other's gap; a fixed offset applies
  // everywhere that source is drawn, not just from one section's start,
  // which is what a property of the layer itself should do.
  const originX = openingPath ? tileOriginX : (tileOffset ?? 0);
  // Resolved once, not per tile: at most one tile in a frame is the opening.
  const openingImage = openingPath
    ? resolveBackgroundImage({ ...source, path: openingPath })
    : null;

  for (let index = Math.floor((left - originX) / tileWidth); originX + index * tileWidth < right; index++) {
    const tileX = originX + index * tileWidth;
    const opening = openingPath && index === 0;
    if (opening && !openingImage) continue; // same "skip a frame" rule as above
    const tile = opening ? openingImage : image;
    // The opening strip is its own piece of art with its own ground line,
    // so it carries its own baseline. Without it the two strips in this
    // layer would meet the world ground at different heights and one of
    // them would float (config.js openingBaselineY).
    const tileDrawY = opening && source.openingBaselineY !== undefined
      ? WORLD.groundY - source.openingBaselineY
      : drawY;
    // The opening tile is always drawn as authored; the repeats keep the
    // alternating mirror that makes each seam meet its own reflection.
    const mirrored = !opening && (((index % 2) + 2) % 2) === 1; // floor-mod: correct for negative indices too
    ctx.save();
    if (mirrored) {
      ctx.translate(tileX + tileWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tile, 0, tileDrawY, tileWidth, displayHeight);
    } else {
      ctx.drawImage(tile, tileX, tileDrawY, tileWidth, displayHeight);
    }
    ctx.restore();
  }
}

// Image sources choose their colour handling per asset. Full-colour is
// the safe default: authored RGB reaches the canvas unchanged. Explicit
// colorMode: 'tint' sources use source.color (the same field silhouette
// sources already have), composited over white-plus-alpha artwork so an
// atmospheric layer can still be recoloured without regeneration.
//
// Cached per path+colour rather than recomputed per frame: tinting is a
// full offscreen canvas draw plus a composite, and the same combination
// is asked for every frame a section is on screen. Full-colour sources,
// including sources with no colorMode field, return the loaded image
// straight from assets.js's own cache.
const tintedImageCache = new Map(); // `${path}::${color}` -> offscreen canvas

function resolveBackgroundImage(source) {
  const raw = getImage(source.path);
  if (!raw || source.colorMode !== 'tint' || !source.color) return raw;

  const key = `${source.path}::${source.color}`;
  let tinted = tintedImageCache.get(key);
  if (!tinted) {
    tinted = tintImage(raw, source.color);
    tintedImageCache.set(key, tinted);
  }
  return tinted;
}

function tintImage(image, color) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const tintCtx = canvas.getContext('2d');
  tintCtx.drawImage(image, 0, 0);
  // Keeps the source's own alpha (the white shapes) and replaces the RGB
  // under it with the section colour -- exactly what 'source-in' means:
  // the new fill only shows up where the existing content was opaque.
  tintCtx.globalCompositeOperation = 'source-in';
  tintCtx.fillStyle = color;
  tintCtx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// One-off background objects, each at its own parallax.
//
// A landmark is anchored to its own placement, which a tiled layer is
// not. Tiled layers repeat forever, so where their offset lands does not
// matter and `x - camera.x * parallax` is fine for them. Applying that
// same formula to a single placed object puts it at its stated x only
// when camera.x * parallax happens to land there: a landmark at x 6200
// with parallax 0.25 would not appear until the camera reached x 24800,
// most of a level later.
//
// So each landmark has a home -- the camera position that centres it --
// and drifts from there at its own rate. Place one at an x and that is
// where you meet it, whatever its parallax; parallax then only decides
// how fast it slides past once you are there.
// Research Golem venue repair task: the whole "never visible at the same
// time" rule (task brief) in one derived boolean, computed fresh from
// player.x every call rather than a flag toggled at trigger points -- it
// can never desync from where the player actually is, walking forward or
// back. True from the moment the comic hands control back at the arena's
// left door (boss.activationX) up to the moment the player reaches its
// right door (researchGolemExitX, level.js RESEARCH_GOLEM_EXIT_X). False
// throughout the pre-comic approach (REVEAL/REACT/WALK never move player.x
// past activationX -- see updateBossApproach) and again once outside.
function researchGolemInterior() {
  if (!boss || researchGolemExitX === null) return false;
  return player.x >= boss.activationX && player.x < researchGolemExitX;
}

// The Graduation venue's equivalent: the Haga street and the portal are
// drawn left of the activation line (the portal's opening), the arena from
// it onwards. The approach walk ends exactly on that line and the comic
// opens in the same step, so the arena is first drawn after the comic.
function graduationInterior() {
  if (!graduationBoss || !graduationArenaFrame) return false;
  return player.x >= graduationBoss.activationX;
}

function drawLandmarks(ctx) {
  const view = visibleWorldRect();
  const insideResearchGolem = researchGolemInterior();
  const insideGraduation = graduationInterior();
  for (const placement of landmarks) {
    // Explicit state, not draw-order masking (repair task): the façade (in
    // either its entrance or exit crop) and the enclosed arena must never
    // both be eligible to draw, regardless of how far their wide bounding
    // boxes reach into each other's world space.
    if (insideResearchGolem && placement.landmark.startsWith('research-golem-facade')) continue;
    if (!insideResearchGolem && placement.landmark === 'research-golem-arena') continue;
    if (insideGraduation && placement.landmark === 'graduation-portal') continue;
    if (!insideGraduation && placement.landmark === 'graduation-arena') continue;

    const spec = LANDMARK.types[placement.landmark];
    if (!spec) continue;
    // Hidden through the utspring celebration, then faded in.
    let fade = 1;
    if (placement.showAfterUtspring) {
      if (utspringPhase !== UTSPRING.DONE) continue;
      fade = Math.min(1, afterUtspringClock / LANDMARK.afterUtspringFadeIn);
    }

    const homeCameraX = placement.x - CANVAS.width / 2;
    const drawX = placement.x + (camera.x - homeCameraX) * (1 - placement.parallax);
    if (drawX + spec.width < view.left || drawX > view.left + view.width) continue;

    const image = spec.path ? resolveBackgroundImage(spec) : null;
    const groundY = WORLD.groundY;
    const footOffset = image && spec.baselineY !== undefined
      ? spec.baselineY * spec.height / image.height : spec.height;
    const top = groundY - footOffset;
    ctx.globalAlpha = (spec.alpha ?? LANDMARK.alpha) * fade;
    if (image) {
      ctx.drawImage(image, drawX, top, spec.width, spec.height);
    } else {
      ctx.fillStyle = spec.color;
      ctx.fillRect(Math.round(drawX), Math.round(top), spec.width, spec.height);
      ctx.fillStyle = LANDMARK.labelColor;
      ctx.font = LANDMARK.labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(spec.label, Math.round(drawX + spec.width / 2), Math.round(top - LANDMARK.labelGap));
    }
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);

  if (gameState === STATE.TITLE) return; // real DOM screen (ui.js) covers the canvas
  if (gameState === STATE.COMIC) return; // real DOM screen (comics.js) covers the canvas
  // APPLICATION: ui.js's state-change subscriber navigates to
  // application.html the instant this state is entered (task 4.9) --
  // there is never a frame left to render it on canvas.
  if (gameState === STATE.APPLICATION) return;

  ctx.save();
  // Screen shake, before anything else: a flat screen-space nudge of the
  // whole world. Applied here and nowhere else, so the HUD drawn after
  // ctx.restore() never moves and never becomes hard to read.
  const shake = shakeOffset();
  ctx.translate(shake.x, shake.y);
  // Zoom centered on the screen, then pan by the camera -- at zoom 1 this
  // is exactly the plain translate(-camera.x, -camera.y) it replaces.
  ctx.translate(CANVAS.width / 2, CANVAS.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-(camera.x + CANVAS.width / 2), -(camera.y + CANVAS.height / 2));

  drawBackground(ctx);
  drawLandmarks(ctx);
  drawUtspringClouds(ctx);

  drawGround(ctx);

  drawPlatforms(ctx);
  drawTutorialBlock(ctx);
  drawGraduationFloorWarnings(ctx, graduationBoss);
  drawReceptionScenery(ctx, reception);
  drawPickups(ctx);
  drawPlayer(ctx, player);
  drawApproachThought(ctx);
  drawActiveThought(ctx);
  drawReceptionSpeech(ctx, reception, player, camera.zoom, visibleWorldRect());
  for (const enemy of enemies) drawEnemy(ctx, enemy);
  drawResearchGolem(ctx, boss);
  drawResearchGolemHpBar(ctx, boss);
  drawResearchGolemClaims(ctx, boss);
  drawGraduationBoss(ctx, graduationBoss);
  drawGraduationBossHpBar(ctx, graduationBoss);
  drawProjectiles(ctx);
  drawDeathBursts(ctx);
  drawConfetti(ctx);
  ctx.restore();

  // Screen space, after the camera transform is unwound: the HUD must not
  // pan or scale with the world (notably during the staircase pull-back).
  drawPlayerHud(ctx);
  drawReceptionHud(ctx, reception);
  // Over everything, HUD included: the arrival flash is the whole screen.
  drawUtspringFlash(ctx);
  drawDebugOverlay(ctx);
}

// Pacing overlay (task 6.8). Plain text in a corner, screen space, drawn
// last. A development tool: with DEBUG.overlay false this returns before
// touching the canvas, so nothing about it can reach a player.
function drawDebugOverlay(ctx) {
  if (!DEBUG.overlay) return;

  const index = sectionIndexAt(player.x);
  const section = backgroundSections[index];
  const lines = [
    `x ${Math.round(player.x)}`,
    `section ${index + 1}/${backgroundSections.length}  ${section ? section.name : '-'}`,
    `in section ${sectionElapsed.toFixed(1)}s`,
    `level total ${levelElapsed.toFixed(1)}s`,
  ];

  const height = lines.length * DEBUG.lineHeight + DEBUG.paddingY * 2;
  const x = DEBUG.marginX;
  const y = CANVAS.height - DEBUG.marginY - height;

  ctx.fillStyle = DEBUG.backgroundColor;
  ctx.fillRect(x, y, DEBUG.width, height);
  ctx.fillStyle = DEBUG.color;
  ctx.font = DEBUG.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + DEBUG.paddingX, y + DEBUG.paddingY + (i + 1) * DEBUG.lineHeight - 4);
  }
}

function drawConfetti(ctx) {
  for (const piece of confetti) {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-CONFETTI.width / 2, -CONFETTI.height / 2, CONFETTI.width, CONFETTI.height);
    ctx.restore();
  }
}

// The arrival flash (task 3.5): full white at the start of the phase,
// gone by the end of it, revealing the studentmössa that was put on
// underneath.
function drawUtspringFlash(ctx) {
  if (utspringPhase !== UTSPRING.FLASH) return;
  ctx.globalAlpha = Math.max(0, 1 - utspringTimer / STAIRCASE.flashDuration);
  ctx.fillStyle = STAIRCASE.flashColor;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.globalAlpha = 1;
}

// One square per hit point, filled while held. The player has had three HP
// and no way to read them; the bosses' bars made that asymmetry obvious.
function drawPlayerHud(ctx) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = HUD.borderColor;
  for (let i = 0; i < PLAYER.maxHp; i++) {
    const x = HUD.marginX + i * (HUD.hpPipSize + HUD.hpPipGap);
    ctx.fillStyle = i < player.hp ? HUD.filledColor : HUD.emptyColor;
    ctx.fillRect(x, HUD.marginY, HUD.hpPipSize, HUD.hpPipSize);
    ctx.strokeRect(x, HUD.marginY, HUD.hpPipSize, HUD.hpPipSize);
  }
}

function drawTutorialBlock(ctx) {
  if (!tutorialBlock) return;
  const { x, y, width, height } = tutorialBlock;
  const sprite = TUTORIAL.sprite;
  const image = getImage(sprite.path);
  if (image) {
    ctx.drawImage(image, Math.round(x + sprite.offsetX), Math.round(y + sprite.offsetY), sprite.width, sprite.height);
    return;
  }
  ctx.fillStyle = TUTORIAL.blockColor;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = TUTORIAL.blockEdgeColor;
  ctx.lineWidth = TUTORIAL.blockEdgeWidth;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = TUTORIAL.blockTopColor;
  ctx.fillRect(x, y, width, TUTORIAL.blockTopHeight);
}

function drawPlatforms(ctx) {
  for (const platform of platforms) {
    const x = Math.round(platform.x);
    const y = Math.round(platform.y);
    ctx.fillStyle = PLATFORM.color;
    ctx.fillRect(x, y, platform.width, platform.height);
    // The landable surface, called out explicitly -- see PLATFORM in
    // config.js for why the body colour alone was not enough.
    ctx.fillStyle = PLATFORM.topHighlightColor;
    ctx.fillRect(x, y, platform.width, PLATFORM.topHighlightHeight);
  }
}

function drawPickups(ctx) {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const sprite = PICKUP.sprites[pickup.outfit];
    const image = sprite && getImage(sprite.path);
    if (sprite) {
      if (image) {
        const width = sprite.drawWidth ?? pickup.width;
        const height = sprite.drawHeight ?? pickup.height;
        ctx.drawImage(image, Math.round(pickup.x + (pickup.width - width) / 2),
          Math.round(pickup.y + pickup.height - height), width, height);
      }
      continue;
    }
    ctx.fillStyle = PICKUP.colors[pickup.outfit];
    ctx.fillRect(Math.round(pickup.x), Math.round(pickup.y), pickup.width, pickup.height);

    ctx.fillStyle = PICKUP.labelColor;
    ctx.font = PICKUP.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      PICKUP.labels[pickup.outfit],
      Math.round(pickup.x + pickup.width / 2),
      Math.round(pickup.y - PICKUP.labelGapAboveBox)
    );
  }
}

// The boss's authored projectile art (config.js
// RESEARCH_GOLEM.projectileSprite): three patterns, five frames each.
// Returns true when it drew, so the caller can skip the rectangle and its
// rim -- those stay for the player's shots, the maths book's, and for any
// frame where the sheet has not loaded.
//
// Presentation only. The art is drawn around the projectile's own hitbox
// and a little larger than it, exactly as the enemies' sprites are; the
// rectangle below is still what every collision is measured against.
function drawBossProjectileSprite(ctx, projectile, x, y) {
  if (!projectile.patternId) return false;
  const spec = RESEARCH_GOLEM.projectileSprite;
  const row = spec.rows[projectile.patternId];
  if (!row) return false;
  const image = getImage(spec.path);
  if (!image) return false;

  const frame = Math.floor(projectile.age / spec.frameDuration) % spec.columns;
  // Centred on the hitbox, except the ground shot, which stands on it --
  // see the anchor note in config.js.
  const drawX = Math.round(x + projectile.width / 2 - row.width / 2);
  const drawY = row.anchor === 'bottom'
    ? Math.round(y + projectile.height - row.height)
    : Math.round(y + projectile.height / 2 - row.height / 2);
  // Art drawn pointing one way (row.facing) is mirrored for a shot
  // travelling the other way, around the art's own centre.
  const mirror = (row.facing === 'right' && projectile.vx < 0) || (row.facing === 'left' && projectile.vx > 0);
  ctx.save();
  if (mirror) {
    ctx.translate(drawX + row.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(drawX + row.width / 2), 0);
  }
  ctx.drawImage(
    image,
    frame * spec.cellWidth, row.row * spec.cellHeight, spec.cellWidth, spec.cellHeight,
    drawX, drawY, row.width, row.height,
  );
  ctx.restore();
  return true;
}

// The maths book's shot: its +, = or - (enemies.js fireMathbookProjectile),
// centred on the hitbox. Falls back to the plain rectangle until the sheet
// has loaded.
function drawMathbookProjectile(ctx, projectile) {
  if (projectile.mathbookSymbol === undefined) return false;
  const spec = ENEMY_MATHBOOK.projectileSprite;
  const image = getImage(spec.path);
  if (!image) return false;
  const cell = image.height; // square cells, one row
  const x = projectile.x + projectile.width / 2 - spec.drawCell / 2;
  const y = projectile.y + projectile.height / 2 - spec.drawCell / 2;
  ctx.drawImage(image, projectile.mathbookSymbol * cell, 0, cell, cell, x, y, spec.drawCell, spec.drawCell);
  return true;
}

function drawProjectiles(ctx) {
  for (const projectile of projectiles) {
    const x = Math.round(projectile.x);
    const y = Math.round(projectile.y);
    if (projectile.owner === 'player') {
      // A streak trailing the shot, on the side it came from. Player
      // shots travel at 900 px/s against 150-420 for everything hostile,
      // so a trail reads instantly as "that one is mine".
      const trailX = projectile.vx >= 0 ? x - PROJECTILE.trailLength : x + projectile.width;
      ctx.globalAlpha = PROJECTILE.trailAlpha;
      ctx.fillStyle = PROJECTILE.color;
      ctx.fillRect(trailX, y, PROJECTILE.trailLength, projectile.height);
      ctx.globalAlpha = 1;
    }

    if (drawBossProjectileSprite(ctx, projectile, x, y)) continue;
    if (drawMathbookProjectile(ctx, projectile)) continue;
    if (drawGraduationProjectile(ctx, projectile, x, y)) continue;

    ctx.fillStyle = projectile.color || PROJECTILE.color;
    ctx.fillRect(x, y, projectile.width, projectile.height);

    // Both kinds get a rim so they read against a bright background as
    // well as a dark one, but deliberately different rims: hostile shots
    // take HAZARD's thick near-black one, the player's a thin cool one.
    if (projectile.owner === 'player') {
      ctx.strokeStyle = PROJECTILE.outlineColor;
      ctx.lineWidth = PROJECTILE.outlineWidth;
    } else {
      ctx.strokeStyle = HAZARD.outlineColor;
      ctx.lineWidth = HAZARD.projectileOutlineWidth;
    }
    ctx.strokeRect(x, y, projectile.width, projectile.height);
  }
}
