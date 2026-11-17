// The screenshot scenes behind ?shot=title|play|over&seed=N. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame. The title
// scene runs the harmless backdrop; play salvages pods and docks; over first salvages a few pods
// then dives into the planet, guaranteeing a hull-breach game over with a score to show.

import { HOLD, STEP, TRACTOR } from './config.js';
import { KIND_POD } from './entities.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_GAMEOVER, SCREEN_PLAYING, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 22;
const END_LIMIT_SECONDS = 600;
const END_DIVE_AT = 7;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nearestPod(state) {
  let best = null;
  let bestD = Infinity;
  const s = state.ship;
  for (let i = 0; i < state.entities.length; i += 1) {
    const e = state.entities[i];
    if (!e.active || e.kind !== KIND_POD) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Steer the ship toward a point: turn to face it and thrust when slow or far. */
function flyToward(ship, tx, ty, c) {
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const dist = Math.hypot(dx, dy) || 1;
  const desired = Math.atan2(dy, dx);
  const da = wrapAngle(desired - ship.angle);
  c.turn = da > 0.06 ? 1 : da < -0.06 ? -1 : 0;
  const toward = (ship.vx * dx + ship.vy * dy) / dist;
  if (Math.abs(da) < 0.7 && (dist > 70 || toward < 40)) c.thrust = true;
}

/** One control frame: chase the nearest pod, dock when low, and (in `over`) dive at the end. */
function autopilot(state, mode) {
  const s = state.ship;
  const c = { thrust: false, turn: 0, beam: false, aimX: s.x + 40, aimY: s.y };

  if (mode === 'over' && state.elapsed >= END_DIVE_AT) {
    const down = Math.PI / 2;
    const da = wrapAngle(down - s.angle);
    c.turn = da > 0.05 ? 1 : da < -0.05 ? -1 : 0;
    if (Math.abs(da) < 0.6) c.thrust = true;
    c.aimX = s.x;
    c.aimY = s.y + 200;
    return c;
  }

  let target = null;
  let isStation = false;
  if (s.fuel < 30 || s.hold >= HOLD.capacity * 0.75) {
    target = state.station;
    isStation = true;
  } else {
    target = nearestPod(state);
  }

  if (target !== null) {
    flyToward(s, target.x, target.y, c);
    if (!isStation) {
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy);
      const da = Math.abs(wrapAngle(Math.atan2(dy, dx) - s.angle));
      if (d < TRACTOR.range && da < 0.8) {
        c.beam = true;
        c.aimX = target.x;
        c.aimY = target.y;
      }
    }
  } else {
    flyToward(s, 640, 200, c);
  }
  return c;
}

/** Stage the named scene and return the screen to draw over it, plus a best score to show. */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'over') {
    const idle = { thrust: false, turn: 0, beam: false, aimX: 640, aimY: 200 };
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step(STEP, idle, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'over' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let over = false;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state, name), false);
    if (events & EVENT_OVER) {
      over = true;
      break;
    }
  }
  return { screen: over ? SCREEN_GAMEOVER : SCREEN_PLAYING, best: 0 };
}
