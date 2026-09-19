// level.js — the level as a data array. Moving, resizing or adding an
// entity means editing an entry here, never game.js's control flow
// (AGENTS.md §5). Positions are placeholder grey-box values; real level
// dressing (art, background) comes later (Milestone 7).

import { WORLD, PLAYER, ENEMY_TRASH, ENEMY_INBOX, ENEMY_EXCHANGE, RESEARCH_GOLEM, GRADUATION, PICKUP } from './config.js';

const BOSS_X = 2650;
const GRADUATION_X = 3300;

export const LEVEL = [
  { type: 'player-spawn', x: 120 },
  // The staircase run (utspring): camera pulls back while inside this zone
  // and holds through the studentmössa pickup at its far end (AGENTS.md
  // §3). No staircase geometry yet -- that's background art, Milestone 7;
  // the ground stays flat here.
  { type: 'staircase-run', xStart: 200, xEnd: 420 },
  { type: 'pickup', outfit: 'studentmossa', x: 420 },
  // Lund trash: one behaviour (identical createTrashEnemy/updateEnemy/
  // damageEnemy for all three), placed three ways so each plays
  // differently (task 3.6):
  //   ground  plain -- walk into it for contact damage, or shoot it from
  //           the ground, or jump over it. The baseline encounter.
  { type: 'enemy-trash', x: 620 },
  //   ledge   explicit y, elevated above standing reach -- contact-safe
  //           from the ground, only killable with a jump-timed shot
  //           (same height logic verified for the claim phase, task 2.5).
  //           Optional: skip it, or take the skill shot.
  { type: 'enemy-trash', x: 950, y: WORLD.groundY - ENEMY_TRASH.height - 110 },
  //   jump    ground level like the first, but placed with little runway
  //           after it (section transition follows almost immediately) --
  //           not enough room to safely shoot it down in passing, so
  //           clearing it means actually jumping it, not just plinking it.
  { type: 'enemy-trash', x: 1400 },
  { type: 'section-transition', x: 1550, section: 'goteborg' },
  { type: 'enemy-inbox', x: 1800 },
  { type: 'enemy-exchange', x: 2150 },
  // Story beat 5 (AGENTS.md §3): comic, then BOSS 1. Placed to resolve
  // before the pre-boss checkpoint below, so a death during the fight
  // respawns straight into the fight, not back into the comic.
  { type: 'comic-trigger', x: 2300, comicId: 'pre-research-golem', next: 'playing' },
  // Ahead of the boss so dying mid-fight (task 2.6) doesn't mean a long
  // walk back across the whole level to retry it.
  { type: 'checkpoint', x: 2450 },
  { type: 'boss-research-golem', x: BOSS_X },
  // Suit replaces studentmössa (AGENTS.md §3/§6).
  { type: 'pickup', outfit: 'suit', x: BOSS_X + RESEARCH_GOLEM.width + 200 },
  // Story beat 7: comic, then BOSS 2, same placement logic as the golem's.
  { type: 'comic-trigger', x: 3100, comicId: 'pre-graduation', next: 'playing' },
  // Ahead of Graduation, same reasoning as the checkpoint before the
  // Research Golem (task 2.6).
  { type: 'checkpoint', x: GRADUATION_X - 100 },
  { type: 'boss-graduation', x: GRADUATION_X },
  // Picked up immediately before the final comic (AGENTS.md §3).
  { type: 'pickup', outfit: 'armour', x: GRADUATION_X + GRADUATION.width + 200 },
  // Story beat 9: final comic, then straight to the application screen --
  // the game ends before the Paradox fight (AGENTS.md §3, "do not add a
  // Paradox fight").
  { type: 'comic-trigger', x: GRADUATION_X + GRADUATION.width + 300, comicId: 'final', next: 'application' },
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

// An entry's y: explicit y wins (elevated placements, e.g. task 3.6's
// ledge), otherwise it stands on the ground based on its own height.
export function entryY(entry) {
  if (entry.y !== undefined) return entry.y;
  return WORLD.groundY - ENTITY_HEIGHT[entry.type];
}
