// game.js — fixed-timestep game loop and state machine.

import { CANVAS, TIMESTEP, WORLD, PLAYER, PROJECTILE, PROJECTILE_CULL_MARGIN, CAMERA, RESEARCH_GOLEM, GRADUATION, PICKUP, PLATFORM, BACKGROUND, BACKGROUNDS, LANDMARK, DEBUG, STAIRCASE, CONFETTI, HUD } from './config.js';
import { initInput, clearFrameInput, resetInput, setInputSuppressed } from './input.js';
import { createPlayer, updatePlayer, drawPlayer, damagePlayer, applyPickup, spawnBark } from './player.js';
import { createTrashEnemy, createInboxEnemy, createExchangeEnemy, updateEnemy, damageEnemy, contactDamageFor, drawEnemy } from './enemies.js';
import {
  createResearchGolem,
  updateResearchGolem,
  damageResearchGolem,
  drawResearchGolem,
  drawResearchGolemHpBar,
  drawResearchGolemClaims,
  findResearchGolemClaimHit,
  resolveClaimShot,
  createGraduationBoss,
  updateGraduationBoss,
  damageGraduationBoss,
  drawGraduationBoss,
  drawGraduationBossHpBar,
} from './bosses.js';
import { LEVEL, entryY } from './level.js';

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

let ctx;
let player;
let camera;
let projectiles;
let enemies;
let boss;
let graduationBoss;
let pickups;
let platforms; // task C: { x, y, width, height }, one-way landable rectangles
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
let utspringTrigger; // { x, markY } that hands control to the utspring, or null
let comicTriggers; // sorted ascending by x: [{ x, comicId, next }]
let nextComicTriggerIndex;
// Task B: the currently-closed arena wall, and the boss that owns it.
// null whenever no fight is active. Set the instant a boss activates;
// cleared the instant that boss dies.
let arenaWallX = null;
let arenaLockCameraX = null;
let lockedBoss = null;
let spawnPoint;
let wasPlayerDead = false;
let accumulator = 0;
let lastTime = 0;

let gameState = STATE.TITLE;
let activeComicId = null;
let pendingComicNext = null; // STATE to enter once the active comic advances

export function startGame(canvas) {
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  ctx = canvas.getContext('2d');
  initInput();

  loadLevel();
  player = createPlayer(spawnPoint.x, spawnPoint.y);
  camera = { x: 0, y: 0, zoom: 1 };
  projectiles = [];
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
  enterComic('intro', STATE.PLAYING);
}

// Called by comics.js when the comic viewer's last panel is dismissed
// (task 4.3) -- proceeds to whatever the comic was leading into: back to
// PLAYING for the pre-boss comics, or to APPLICATION for the final one.
// Same resetInput reasoning as startFromTitle: the dismissal itself may
// have been a Space press, and PLAYING reads Space as jump.
export function advanceFromComic() {
  if (gameState !== STATE.COMIC) return;
  resetInput();
  setGameState(pendingComicNext);
  activeComicId = null;
  pendingComicNext = null;
}

function enterComic(comicId, next) {
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
//   DESCENT  input handed over, auto-run down the staircase with the
//            speed ramping up, camera widened, confetti falling
//   FLASH    the player stops; a brief white flash; the studentmössa
//            appears on the sprite underneath it
//   CARD     the DOM title card holds, then fades
//   DONE     control returns, and this can never run again
//
// Total length is the sum of the four timings in config.js: 5.25s, and
// it must stay under six.
const UTSPRING = { IDLE: 'idle', DESCENT: 'descent', FLASH: 'flash', CARD: 'card', DONE: 'done' };
let utspringPhase = UTSPRING.IDLE;
let utspringTimer = 0;
let confetti = [];

function isUtspringRunning() {
  return utspringPhase !== UTSPRING.IDLE && utspringPhase !== UTSPRING.DONE;
}

// Called first in every step, so the auto-run speed is already set by the
// time updatePlayer reads it.
function updateUtspring(dt) {
  if (utspringPhase === UTSPRING.DONE) return;

  if (utspringPhase === UTSPRING.IDLE) {
    // Fires exactly once per playthrough: the phase leaves IDLE here and
    // only ever ends at DONE, which returns above.
    if (!utspringTrigger || player.x < utspringTrigger.x) return;
    beginUtspring();
    return;
  }

  utspringTimer += dt;
  updateConfetti(dt);

  if (utspringPhase === UTSPRING.DESCENT) {
    // Speed increases gradually over the descent, ending above normal run
    // speed. Linear, and the staircase in level.js is sized from exactly
    // this ramp, so the player arrives at the bottom as the timer expires.
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
  enterUtspringPhase(UTSPRING.DESCENT);
  // Stand the player on their mark: the top of the first step. The
  // staircase descends from a raised landing, and the ground beneath it
  // is flat and open with no wall, so a player who simply held right
  // arrives under the stairs rather than on them -- and would otherwise
  // run the whole beat along level ground, never touching the staircase.
  // This is the one instant where placing the character is legitimate:
  // the sequence has just taken control and the player has none. Anyone
  // who climbed the approach platforms is already at this height, so it
  // is a no-op for them.
  player.y = utspringTrigger.markY - player.height;
  player.vy = 0;
  player.onGround = true;
  // Input is ignored for the whole sequence, fire included, and
  // setInputSuppressed drops every held and pressed key on the way in and
  // on the way out -- so nothing the player mashed during these five
  // seconds fires when control comes back.
  setInputSuppressed(true);
  player.invincible = true;
  player.autoRun = PLAYER.moveSpeed;
  spawnConfetti();
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

// Level-data-driven comic beats (story beats 5, 7 and 9 in AGENTS.md §3):
// once the player's x crosses a comic-trigger entry, pause gameplay into
// the comic placeholder. `next` is 'playing' to resume the fight ahead, or
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
  utspringTrigger = null;
  const checkpointXs = [];
  const sections = [];
  const triggers = [];
  landmarks = [];
  levelElapsed = 0;
  sectionElapsed = 0;
  timedSectionIndex = -1;

  for (const entry of LEVEL) {
    const y = entryY(entry);
    if (entry.type === 'player-spawn') {
      spawnPoint = { x: entry.x, y };
    } else if (entry.type === 'enemy-trash') {
      enemies.push(createTrashEnemy(entry.x, y));
    } else if (entry.type === 'enemy-inbox') {
      enemies.push(createInboxEnemy(entry.x, y));
    } else if (entry.type === 'enemy-exchange') {
      enemies.push(createExchangeEnemy(entry.x, y));
    } else if (entry.type === 'boss-research-golem') {
      boss = createResearchGolem(entry.x, y, entry.activationX);
    } else if (entry.type === 'boss-graduation') {
      graduationBoss = createGraduationBoss(entry.x, y, entry.activationX);
    } else if (entry.type === 'platform') {
      platforms.push({ x: entry.x, y, width: PLATFORM.width, height: PLATFORM.height });
    } else if (entry.type === 'pickup') {
      pickups.push({ x: entry.x, y, width: PICKUP.width, height: PICKUP.height, outfit: entry.outfit, collected: false });
      checkpointXs.push(entry.x); // AGENTS.md §6: invisible checkpoints at each pickup
    } else if (entry.type === 'checkpoint') {
      checkpointXs.push(entry.x);
    } else if (entry.type === 'background-section') {
      sections.push({ name: entry.name, xStart: entry.xStart, xEnd: entry.xEnd, background: entry.background });
    } else if (entry.type === 'landmark') {
      landmarks.push({ landmark: entry.landmark, x: entry.x, parallax: entry.parallax });
    } else if (entry.type === 'utspring-trigger') {
      utspringTrigger = { x: entry.x, markY: y };
    } else if (entry.type === 'comic-trigger') {
      triggers.push({ x: entry.x, comicId: entry.comicId, next: entry.next });
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
}

// Focus/visibility handling (task 3.10): true whenever the tab is hidden
// (switched away, minimized) or the window itself isn't focused (alt-tabbed
// to another app). No audio module exists yet to pause alongside this
// (Milestone 7) -- when one lands, it hooks into the same check.
let wasUnfocused = false;

function isUnfocused() {
  return document.hidden || !document.hasFocus();
}

function loop(now) {
  const unfocused = isUnfocused();
  if (unfocused) {
    // Frozen: no stepping, no accumulating. requestAnimationFrame keeps
    // getting scheduled below so the loop is instantly ready the moment
    // focus returns -- nothing to "wake up".
    wasUnfocused = true;
    render();
    drawUnfocusedHint();
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
  // are DOM/placeholder screens with no fixed-timestep work of their own
  // -- their own input (clicks, Space) is handled by ui.js/comics.js
  // directly, not read from here.
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

function step(dt) {
  // Before the player updates: the sequence owns their movement while it
  // is running, so it has to set autoRun for this step first.
  updateUtspring(dt);
  const spawned = updatePlayer(player, dt, spawnPoint, platforms);
  if (spawned.length > 0) projectiles.push(...spawned);
  checkBossActivation();
  applySolidWalls();
  applyArenaWall();
  updateProjectiles(dt);
  for (const enemy of enemies) updateEnemy(enemy, dt);
  const bossSpawned = updateResearchGolem(boss, dt);
  if (bossSpawned.length > 0) projectiles.push(...bossSpawned);
  const graduationSpawned = updateGraduationBoss(graduationBoss, dt);
  if (graduationSpawned.length > 0) projectiles.push(...graduationSpawned);
  resolveProjectileHits();
  resolveEnemyContact();
  resolvePickups();
  advanceCheckpoint();
  handleDeathTransition();
  checkComicTriggers();
  advancePacingTimers(dt);
  updateCamera(dt);
}

function resolvePickups() {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    if (aabbOverlap(player, pickup)) {
      pickup.collected = true;
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
// every hostile (boss-owned) projectile so respawning doesn't immediately
// walk the player back into fire they never had a chance to see. Fast
// respawn and the boss keeping its HP are already true by construction --
// respawnPlayer (player.js) never touches boss state, and
// PLAYER.respawnDelay is short.
function handleDeathTransition() {
  if (player.dead && !wasPlayerDead) {
    projectiles = projectiles.filter((projectile) => projectile.owner !== 'boss');
  }
  wasPlayerDead = player.dead;
}

// Bosses stand still and are solid walls (solidWall in their config): the
// player can't walk behind either one, so both fights always happen with
// the player facing right, by design.
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
  activateBossIfReached(boss);
  activateBossIfReached(graduationBoss);

  if (lockedBoss && !lockedBoss.alive) {
    arenaWallX = null;
    arenaLockCameraX = null;
    lockedBoss = null;
  }
}

function activateBossIfReached(bossEntity) {
  if (!bossEntity || bossEntity.active || !bossEntity.alive) return;
  if (player.x < bossEntity.activationX) return;

  bossEntity.active = true;
  arenaWallX = bossEntity.activationX;
  lockedBoss = bossEntity;
  const arenaCenterX = (arenaWallX + bossEntity.x + bossEntity.width) / 2;
  arenaLockCameraX = arenaCenterX - CANVAS.width / 2;
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
  }
  // Task B: culled the instant a projectile leaves the camera's active
  // area, regardless of remaining lifetime -- a correctness fix on its
  // own, since nothing should be able to travel a whole section of the
  // level, independent of whether the boss that fired it was dormant.
  const cullLeft = camera.x - PROJECTILE_CULL_MARGIN;
  const cullRight = camera.x + CANVAS.width + PROJECTILE_CULL_MARGIN;
  projectiles = projectiles.filter(
    (projectile) => projectile.life > 0 && projectile.x + projectile.width > cullLeft && projectile.x < cullRight
  );
}

function resolveProjectileHits() {
  for (const projectile of projectiles) {
    if (projectile.owner === 'boss') {
      if (aabbOverlap(projectile, player)) {
        damagePlayer(player, projectile.contactDamage);
        projectile.life = 0;
      }
      continue;
    }

    // Player-owned: vs enemies, then vs whichever boss is alive.
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (aabbOverlap(projectile, enemy)) {
        if (damageEnemy(enemy, 1)) spawnBark(player, enemy.type); // task 3.9
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
        damageResearchGolem(boss, 1);
        projectile.life = 0;
      }
    }
    if (projectile.life <= 0) continue;

    if (graduationBoss.alive && aabbOverlap(projectile, graduationBoss)) {
      damageGraduationBoss(graduationBoss, 1);
      projectile.life = 0;
    }
  }
  projectiles = projectiles.filter((projectile) => projectile.life > 0);
}

function resolveEnemyContact() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (aabbOverlap(player, enemy)) {
      damagePlayer(player, contactDamageFor(enemy));
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

  let desiredX = camera.x;
  if (arenaLockCameraX !== null) {
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
  if (dy > halfDeadzoneH) desiredY = camera.y + (dy - halfDeadzoneH);
  else if (dy < -halfDeadzoneH) desiredY = camera.y + (dy + halfDeadzoneH);

  const ease = 1 - Math.exp(-CAMERA.smoothing * dt);
  camera.x += (desiredX - camera.x) * ease;
  camera.y += (desiredY - camera.y) * ease;

  // The view widens for the whole utspring (task 3.5). No zoom system was
  // built for it: the camera transform in render() already applies
  // camera.zoom, so this is one target value, eased by the same smoothing
  // every other camera motion uses.
  const targetZoom = isUtspringRunning() ? STAIRCASE.zoomOut : 1;
  const zoomEase = 1 - Math.exp(-CAMERA.zoomSmoothing * dt);
  camera.zoom += (targetZoom - camera.zoom) * zoomEase;
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

// Backgrounds are chosen by what is on screen rather than clipped to
// their own x-range: a layer at parallax 0.15 does not sit still against
// the world, so clipping it at a world boundary would tear. Instead one
// section is drawn across the whole view, and inside a blend band the
// next one is drawn over it at a rising alpha.
//
// The band -- not the section -- decides who is outgoing and who is
// incoming, and that distinction matters. Picking "the section the view
// is in" and fading its neighbour towards it reverses the roles at the
// boundary, and because each background stacks three layers whose alphas
// compound, the two halves do not meet: measured across this boundary the
// incoming section jumped from about 75% back to 25% in one pixel of
// movement -- a backwards flicker exactly where the crossfade exists to
// prevent one. Anchoring on the band means alpha runs 0 -> 1 straight
// through, and nothing swaps over mid-fade.
//
// At alpha 1 the incoming section must fully hide the outgoing one, so
// every background needs at least one opaque full-view layer. All of them
// have one (see config.js BACKGROUNDS). Bands must also not overlap, so
// no section may be shorter than BACKGROUND.blendBandWidth.
function drawBackground(ctx) {
  if (!backgroundSections || backgroundSections.length === 0) return;

  const refX = camera.x + CANVAS.width / 2;
  const half = BACKGROUND.blendBandWidth / 2;

  for (let i = 0; i < backgroundSections.length - 1; i++) {
    const boundary = backgroundSections[i].xEnd;
    if (refX > boundary - half && refX < boundary + half) {
      const blend = (refX - (boundary - half)) / BACKGROUND.blendBandWidth; // 0 -> 1
      drawBackgroundLayers(ctx, backgroundSections[i].background, 1);
      drawBackgroundLayers(ctx, backgroundSections[i + 1].background, blend);
      return;
    }
  }

  drawBackgroundLayers(ctx, backgroundSections[sectionIndexAt(refX)].background, 1);
}

function drawBackgroundLayers(ctx, backgroundKey, alpha) {
  const background = BACKGROUNDS[backgroundKey];
  if (!background) return;
  ctx.globalAlpha = alpha;
  for (const layer of background.layers) drawBackgroundLayer(ctx, layer);
  ctx.globalAlpha = 1;
}

// Parallax is applied horizontally only. Vertically the layer stays in
// world space, which is what keeps a silhouette planted on the ground
// line instead of drifting off it when the camera moves or the utspring
// widens the view.
function drawBackgroundLayer(ctx, layer) {
  const view = visibleWorldRect();
  const shift = camera.x * (1 - layer.parallax);
  // In this translated space, the visible span starts here.
  const left = view.left - shift;
  const right = left + view.width;

  ctx.save();
  ctx.translate(shift, 0);
  const source = layer.source;

  if (source.type === 'color') {
    ctx.fillStyle = source.color;
    ctx.fillRect(left, view.top, view.width, view.height);
  } else if (source.type === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.groundY);
    gradient.addColorStop(0, source.from);
    gradient.addColorStop(1, source.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(left, view.top, view.width, view.height);
  } else if (source.type === 'silhouette') {
    drawSilhouette(ctx, source, left, right);
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

// One-off background objects, each at its own parallax.
//
// A landmark is anchored to its own placement, which a tiled layer is
// not. Tiled layers repeat forever, so where their offset lands does not
// matter and `x - camera.x * parallax` is fine for them. Applying that
// same formula to a single placed object puts it at its stated x only
// when camera.x * parallax happens to land there: the Polhem mech, at
// x 6200 and parallax 0.25, would not have come into view until the
// camera reached x 24800, most of a level later. It was never on screen.
//
// So each landmark has a home -- the camera position that centres it --
// and drifts from there at its own rate. Place one at an x and that is
// where you meet it, whatever its parallax; parallax then only decides
// how fast it slides past once you are there.
function drawLandmarks(ctx) {
  const view = visibleWorldRect();
  for (const placement of landmarks) {
    const spec = LANDMARK.types[placement.landmark];
    if (!spec) continue;

    const homeCameraX = placement.x - CANVAS.width / 2;
    const drawX = placement.x + (camera.x - homeCameraX) * (1 - placement.parallax);
    if (drawX + spec.width < view.left || drawX > view.left + view.width) continue;

    const top = WORLD.groundY - spec.height;
    ctx.fillStyle = spec.color;
    ctx.fillRect(Math.round(drawX), Math.round(top), spec.width, spec.height);
    ctx.fillStyle = LANDMARK.labelColor;
    ctx.font = LANDMARK.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(spec.label, Math.round(drawX + spec.width / 2), Math.round(top - LANDMARK.labelGap));
  }
}

// Level isn't bounded yet (no end-of-level data), so background fills just
// need to comfortably cover any reasonable play area. Task D's derived
// layout runs to just under 47,000; 60,000 leaves comfortable margin.
const WORLD_RENDER_LEFT = -5000;
const WORLD_RENDER_RIGHT = 60000;
const GROUND_COLOR = '#1b2333';

function render() {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);

  if (gameState === STATE.TITLE) return; // real DOM screen (ui.js) covers the canvas
  if (gameState === STATE.COMIC) return; // real DOM screen (comics.js) covers the canvas
  // APPLICATION: ui.js's state-change subscriber navigates to
  // application.html the instant this state is entered (task 4.9) --
  // there is never a frame left to render it on canvas.
  if (gameState === STATE.APPLICATION) return;

  ctx.save();
  // Zoom centered on the screen, then pan by the camera -- at zoom 1 this
  // is exactly the plain translate(-camera.x, -camera.y) it replaces.
  ctx.translate(CANVAS.width / 2, CANVAS.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-(camera.x + CANVAS.width / 2), -(camera.y + CANVAS.height / 2));

  drawBackground(ctx);
  drawLandmarks(ctx);

  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(WORLD_RENDER_LEFT, WORLD.groundY, WORLD_RENDER_RIGHT - WORLD_RENDER_LEFT, CANVAS.height - WORLD.groundY);

  drawPlatforms(ctx);
  drawPickups(ctx);
  drawPlayer(ctx, player);
  for (const enemy of enemies) drawEnemy(ctx, enemy);
  drawResearchGolem(ctx, boss);
  drawResearchGolemHpBar(ctx, boss);
  drawResearchGolemClaims(ctx, boss);
  drawGraduationBoss(ctx, graduationBoss);
  drawGraduationBossHpBar(ctx, graduationBoss);
  drawProjectiles(ctx);
  drawConfetti(ctx);
  ctx.restore();

  // Screen space, after the camera transform is unwound: the HUD must not
  // pan or scale with the world (notably during the staircase pull-back).
  drawPlayerHud(ctx);
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

function drawPlatforms(ctx) {
  ctx.fillStyle = PLATFORM.color;
  for (const platform of platforms) {
    ctx.fillRect(Math.round(platform.x), Math.round(platform.y), platform.width, platform.height);
  }
}

function drawPickups(ctx) {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
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

const UI_TEXT_COLOR = '#f7f3e3';

// Not a pause menu (PLAN.md task 3.10 forbids one) and not interactive:
// one line over the frozen frame so a stopped game reads as "waiting for
// you" instead of "crashed". It disappears by itself the moment focus
// returns -- there is nothing to dismiss and nothing to click.
function drawUnfocusedHint() {
  ctx.fillStyle = 'rgba(13, 17, 23, 0.55)';
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.fillStyle = UI_TEXT_COLOR;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Click to resume', CANVAS.width / 2, CANVAS.height / 2);
}

function drawProjectiles(ctx) {
  for (const projectile of projectiles) {
    ctx.fillStyle = projectile.color || PROJECTILE.color;
    ctx.fillRect(Math.round(projectile.x), Math.round(projectile.y), projectile.width, projectile.height);
  }
}
