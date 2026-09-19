// enemies.js — the enemy roster (AGENTS.md §3). Three behaviours total:
//
//   trash    stationary, killable. One behaviour placed three times
//            (task 3.6 varies only where, never this logic).
//   inbox    stationary, cannot be shot down -- the "admin summer job
//            never ends" is represented literally: go around it, not
//            through it.
//   exchange patrols back and forth, killable.

import { ENEMY_TRASH, ENEMY_INBOX, ENEMY_EXCHANGE } from './config.js';

export function createTrashEnemy(x, y) {
  return {
    type: 'trash',
    x,
    y,
    width: ENEMY_TRASH.width,
    height: ENEMY_TRASH.height,
    hp: ENEMY_TRASH.hp,
    alive: true,
    hitFlash: 0,
  };
}

export function createInboxEnemy(x, y) {
  return {
    type: 'inbox',
    x,
    y,
    width: ENEMY_INBOX.width,
    height: ENEMY_INBOX.height,
    alive: true, // never dies; damageEnemy is a no-op for this type
    hitFlash: 0,
  };
}

export function createExchangeEnemy(x, y) {
  return {
    type: 'exchange',
    x,
    y,
    width: ENEMY_EXCHANGE.width,
    height: ENEMY_EXCHANGE.height,
    hp: ENEMY_EXCHANGE.hp,
    alive: true,
    hitFlash: 0,
    vx: ENEMY_EXCHANGE.patrolSpeed,
    minX: x - ENEMY_EXCHANGE.patrolRange / 2,
    maxX: x + ENEMY_EXCHANGE.patrolRange / 2,
  };
}

export function updateEnemy(enemy, dt) {
  if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
  if (!enemy.alive) return;

  if (enemy.type === 'exchange') {
    enemy.x += enemy.vx * dt;
    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      enemy.vx = Math.abs(enemy.vx);
    } else if (enemy.x >= enemy.maxX) {
      enemy.x = enemy.maxX;
      enemy.vx = -Math.abs(enemy.vx);
    }
  }
}

// Returns true when this call is the hit that killed the enemy, so game.js
// can trigger a kill bark (task 3.9) exactly once per death.
export function damageEnemy(enemy, amount) {
  if (!enemy.alive || enemy.type === 'inbox') return false;
  const config = enemy.type === 'exchange' ? ENEMY_EXCHANGE : ENEMY_TRASH;
  enemy.hp -= amount;
  enemy.hitFlash = config.hitFlashDuration;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}

export function contactDamageFor(enemy) {
  if (enemy.type === 'inbox') return ENEMY_INBOX.contactDamage;
  if (enemy.type === 'exchange') return ENEMY_EXCHANGE.contactDamage;
  return ENEMY_TRASH.contactDamage;
}

const COLOR = {
  trash: ENEMY_TRASH.color,
  inbox: ENEMY_INBOX.color,
  exchange: ENEMY_EXCHANGE.color,
};

export function drawEnemy(ctx, enemy) {
  if (!enemy.alive) return;
  const flashing = enemy.hitFlash > 0;
  ctx.fillStyle = flashing ? '#ffffff' : COLOR[enemy.type];
  ctx.fillRect(Math.round(enemy.x), Math.round(enemy.y), enemy.width, enemy.height);
}
