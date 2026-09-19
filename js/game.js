// game.js — fixed-timestep game loop and state machine.

import { CANVAS, TIMESTEP, WORLD, PLAYER, PROJECTILE, CAMERA, RESEARCH_GOLEM, GRADUATION, PICKUP, SECTIONS, STAIRCASE, HUD } from './config.js';
import { initInput, clearFrameInput, resetInput } from './input.js';
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

let ctx;
let player;
let camera;
let projectiles;
let enemies;
let boss;
let graduationBoss;
let pickups;
let checkpoints; // sorted ascending by x
let nextCheckpointIndex;
let sectionBounds; // sorted ascending by x: [{ x, section }], x = -Infinity is section 'lund'
let staircaseZone; // { xStart, xEnd } or null
let comicTriggers; // sorted ascending by x: [{ x, comicId, next }]
let nextComicTriggerIndex;
let celebrationTimer = 0; // s remaining on the studentmossa pull-back hold
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
  celebrationTimer = 0;
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
  staircaseZone = null;
  const checkpointXs = [];
  const transitions = [];
  const triggers = [];

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
      boss = createResearchGolem(entry.x, y);
    } else if (entry.type === 'boss-graduation') {
      graduationBoss = createGraduationBoss(entry.x, y);
    } else if (entry.type === 'pickup') {
      pickups.push({ x: entry.x, y, width: PICKUP.width, height: PICKUP.height, outfit: entry.outfit, collected: false });
      checkpointXs.push(entry.x); // AGENTS.md §6: invisible checkpoints at each pickup
    } else if (entry.type === 'checkpoint') {
      checkpointXs.push(entry.x);
    } else if (entry.type === 'section-transition') {
      transitions.push({ x: entry.x, section: entry.section });
    } else if (entry.type === 'staircase-run') {
      staircaseZone = { xStart: entry.xStart, xEnd: entry.xEnd };
    } else if (entry.type === 'comic-trigger') {
      triggers.push({ x: entry.x, comicId: entry.comicId, next: entry.next });
    }
  }

  transitions.sort((a, b) => a.x - b.x);
  sectionBounds = [{ x: -Infinity, section: 'lund' }, ...transitions];

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
  const spawned = updatePlayer(player, dt, spawnPoint);
  if (spawned.length > 0) projectiles.push(...spawned);
  applySolidWalls();
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
  if (celebrationTimer > 0) celebrationTimer -= dt;
  updateCamera(dt);
}

function resolvePickups() {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    if (aabbOverlap(player, pickup)) {
      pickup.collected = true;
      applyPickup(player, pickup.outfit);
      // The studentmössa moment (AGENTS.md §3): earned by the staircase
      // run, not by defeating anything -- hold the pulled-back camera a
      // beat longer here. Suit/armour don't get this treatment.
      if (pickup.outfit === 'studentmossa') celebrationTimer = STAIRCASE.celebrationHoldDuration;
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

function updateProjectiles(dt) {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx * dt;
    if (projectile.gravity) projectile.vy += projectile.gravity * dt;
    projectile.y += (projectile.vy || 0) * dt;
    projectile.life -= dt;
  }
  projectiles = projectiles.filter((projectile) => projectile.life > 0);
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
  const dx = targetCenterX - viewCenterX;
  if (dx > halfDeadzoneW) desiredX = camera.x + (dx - halfDeadzoneW);
  else if (dx < -halfDeadzoneW) desiredX = camera.x + (dx + halfDeadzoneW);

  let desiredY = camera.y;
  const dy = targetCenterY - viewCenterY;
  if (dy > halfDeadzoneH) desiredY = camera.y + (dy - halfDeadzoneH);
  else if (dy < -halfDeadzoneH) desiredY = camera.y + (dy + halfDeadzoneH);

  const ease = 1 - Math.exp(-CAMERA.smoothing * dt);
  camera.x += (desiredX - camera.x) * ease;
  camera.y += (desiredY - camera.y) * ease;

  // Camera pull-back for the staircase run and the studentmössa moment
  // (task 3.5): zoomed out while inside the zone or during the
  // post-pickup celebration hold, back to normal otherwise.
  const inStaircaseZone =
    staircaseZone && player.x >= staircaseZone.xStart && player.x <= staircaseZone.xEnd;
  const targetZoom = inStaircaseZone || celebrationTimer > 0 ? STAIRCASE.zoomOut : 1;
  const zoomEase = 1 - Math.exp(-CAMERA.zoomSmoothing * dt);
  camera.zoom += (targetZoom - camera.zoom) * zoomEase;
}

// Level isn't bounded yet (no end-of-level data), so background fills just
// need to comfortably cover any reasonable play area.
const WORLD_RENDER_LEFT = -5000;
const WORLD_RENDER_RIGHT = 20000;
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

  drawSections(ctx);

  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(WORLD_RENDER_LEFT, WORLD.groundY, WORLD_RENDER_RIGHT - WORLD_RENDER_LEFT, CANVAS.height - WORLD.groundY);

  drawPickups(ctx);
  drawPlayer(ctx, player);
  for (const enemy of enemies) drawEnemy(ctx, enemy);
  drawResearchGolem(ctx, boss);
  drawResearchGolemHpBar(ctx, boss);
  drawResearchGolemClaims(ctx, boss);
  drawGraduationBoss(ctx, graduationBoss);
  drawGraduationBossHpBar(ctx, graduationBoss);
  drawProjectiles(ctx);
  ctx.restore();

  // Screen space, after the camera transform is unwound: the HUD must not
  // pan or scale with the world (notably during the staircase pull-back).
  drawPlayerHud(ctx);
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

// One continuous level, two places (AGENTS.md §3): the backdrop swaps at
// each section-transition entry in level.js, drawn in world space so the
// boundary scrolls past naturally -- no loading break, nothing pauses.
function drawSections(ctx) {
  for (let i = 0; i < sectionBounds.length; i++) {
    const bound = sectionBounds[i];
    const left = bound.x === -Infinity ? WORLD_RENDER_LEFT : bound.x;
    const right = i + 1 < sectionBounds.length ? sectionBounds[i + 1].x : WORLD_RENDER_RIGHT;
    ctx.fillStyle = SECTIONS[bound.section].backgroundColor;
    ctx.fillRect(left, 0, right - left, CANVAS.height);
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
