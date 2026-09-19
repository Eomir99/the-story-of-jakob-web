// player.js — movement, gravity, jump, ground collision, shooting,
// damage/death/respawn.

import { PLAYER, PROJECTILE, WORLD, PICKUP, BARK } from './config.js';
import { isActionDown, wasActionPressed } from './input.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    width: PLAYER.width,
    height: PLAYER.height,
    vx: 0,
    vy: 0,
    facing: 1, // 1 = right, -1 = left
    onGround: false,
    fireCooldown: 0,
    hp: PLAYER.maxHp,
    invulnerableFor: 0,
    dead: false,
    respawnTimer: 0,
    // Current outfit: 'none' | 'studentmossa' | 'suit' | 'armour'. A single
    // value, not a stacking inventory -- the suit replaces the
    // studentmössa (AGENTS.md §3/§6). Never reset on respawn: pickups are
    // permanent progress.
    outfit: 'none',
    barks: [], // active kill barks (task 3.9): { text, timer }
    barkCounts: {}, // per-enemy-type kill count, so lines cycle instead of repeating
  };
}

// Called by game.js the instant a kill lands. Never pauses the game
// (AGENTS.md §4) -- it only queues text to float above the player.
export function spawnBark(player, enemyType) {
  const lines = BARK.lines[enemyType];
  if (!lines || lines.length === 0) return;
  const count = player.barkCounts[enemyType] || 0;
  player.barkCounts[enemyType] = count + 1;
  player.barks.push({ text: lines[count % lines.length], timer: BARK.displayDuration });
}

function updateBarks(player, dt) {
  for (const bark of player.barks) bark.timer -= dt;
  player.barks = player.barks.filter((bark) => bark.timer > 0);
}

// Called by game.js when the player overlaps a pickup entity.
export function applyPickup(player, outfit) {
  player.outfit = outfit;
}

// spawnPoint is the last checkpoint. Milestone 3 (level.js) starts setting
// this to something other than the initial spawn as checkpoints are added.
// platforms (task C) are one-way: landable from above while falling, never
// solid from below or the sides, so a missed jump just drops the player
// back onto the ground below -- there is no gap to fall out of the level
// through. Returns any projectiles spawned this step, so game.js can own
// the projectile list rather than player.js reaching into shared state.
export function updatePlayer(player, dt, spawnPoint, platforms = []) {
  updateBarks(player, dt);

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawnPlayer(player, spawnPoint);
    return [];
  }

  const left = isActionDown('left');
  const right = isActionDown('right');
  const shooting = isActionDown('shoot');

  player.vx = 0;
  if (left && !right) player.vx = -PLAYER.moveSpeed;
  else if (right && !left) player.vx = PLAYER.moveSpeed;

  // Facing tracks movement, except while actively shooting: then it holds
  // steady so you can strafe/reposition around a boss without your shots
  // swinging away from it. Released shoot, facing resumes following movement.
  if (!shooting) {
    if (left && !right) player.facing = -1;
    else if (right && !left) player.facing = 1;
  }

  player.vy += WORLD.gravity * dt;
  if (player.vy > PLAYER.maxFallSpeed) player.vy = PLAYER.maxFallSpeed;

  if (wasActionPressed('jump') && player.onGround) {
    player.vy = PLAYER.jumpVelocity;
    player.onGround = false;
  }

  const feetBefore = player.y + player.height;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const feetAfter = player.y + player.height;

  // Platforms first: only while falling (vy >= 0) and only when this step
  // crossed the platform's top surface from above it -- a one-way landing,
  // never a ceiling, so jumping up through one from below is unobstructed.
  let landedOnPlatform = false;
  if (player.vy >= 0) {
    for (const platform of platforms) {
      const withinX = player.x + player.width > platform.x && player.x < platform.x + platform.width;
      if (withinX && feetBefore <= platform.y && feetAfter >= platform.y) {
        player.y = platform.y - player.height;
        player.vy = 0;
        landedOnPlatform = true;
        break;
      }
    }
  }

  const groundTop = WORLD.groundY - player.height;
  if (!landedOnPlatform && player.y >= groundTop) {
    player.y = groundTop;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = landedOnPlatform;
  }

  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.invulnerableFor > 0) player.invulnerableFor -= dt;

  const spawned = [];
  if (shooting && player.fireCooldown <= 0) {
    player.fireCooldown = PROJECTILE.fireCooldown;
    spawned.push(spawnProjectile(player));
  }
  return spawned;
}

function spawnProjectile(player) {
  const dir = player.facing;
  return {
    x: dir > 0 ? player.x + player.width : player.x - PROJECTILE.width,
    y: player.y + player.height / 2 - PROJECTILE.height / 2,
    width: PROJECTILE.width,
    height: PROJECTILE.height,
    vx: PROJECTILE.speed * dir,
    vy: 0,
    life: PROJECTILE.lifetime,
    owner: 'player',
    color: PROJECTILE.color,
  };
}

// Infinite lives: death costs a brief respawn, never a replay. Ignored while
// already invulnerable or mid-respawn, so contact with an enemy can't stack
// multiple hits in one graze.
export function damagePlayer(player, amount) {
  if (player.dead || player.invulnerableFor > 0) return;
  player.hp -= amount;
  player.invulnerableFor = PLAYER.invulnerabilityDuration;
  if (player.hp <= 0) {
    player.dead = true;
    player.respawnTimer = PLAYER.respawnDelay;
  }
}

function respawnPlayer(player, spawnPoint) {
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.hp = PLAYER.maxHp;
  player.dead = false;
  player.invulnerableFor = PLAYER.invulnerabilityDuration;
  // Barks belong to the run that earned them: one still floating at the
  // moment of death would otherwise reappear above the player at the
  // checkpoint, hundreds of pixels from the kill it describes.
  player.barks.length = 0;
}

export function drawPlayer(ctx, player) {
  if (player.dead) return;
  // Blink while invulnerable so the grace period reads clearly. Fading
  // rather than flashing white: the studentmossa outfit below is itself
  // white, so a white flash was invisible for the whole stretch of the
  // level where the player is wearing it.
  const blinking = player.invulnerableFor > 0 && Math.floor(player.invulnerableFor * 12) % 2 === 0;
  // Grey-box stand-in for the outfit change: tint the rectangle by the
  // current pickup's color. Real sprite swap/overlay arrives with art
  // (Milestone 6, AGENTS.md §6) -- this just makes the state change
  // observable before then.
  const baseColor = PICKUP.colors[player.outfit] || PLAYER.color;
  ctx.globalAlpha = blinking ? 0.35 : 1;
  ctx.fillStyle = baseColor;
  ctx.fillRect(Math.round(player.x), Math.round(player.y), player.width, player.height);
  ctx.globalAlpha = 1;

  drawBarks(ctx, player);
}

// Floats upward and fades over its lifetime; drawn above the player, never
// touching game state or input, so it can never pause anything (AGENTS.md §4).
function drawBarks(ctx, player) {
  if (player.barks.length === 0) return;
  const centerX = Math.round(player.x + player.width / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = BARK.font;
  for (const bark of player.barks) {
    const age = 1 - bark.timer / BARK.displayDuration; // 0 at spawn, 1 at expiry
    const y = Math.round(player.y - BARK.offsetAboveHead - BARK.floatDistance * age);
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = BARK.color;
    ctx.fillText(bark.text, centerX, y);
  }
  ctx.globalAlpha = 1;
}
