// The things that drift through the debris field: the player's tug and the three kinds of
// debris (cargo pods, rocks, satellites). Each kind is described once here, and the world pools
// these records so nothing is allocated after boot.

import { FIELD, FUEL, HULL, POD, PODS, ROCK, SATELLITE, SHIP } from './config.js';

export const KIND_POD = 'pod';
export const KIND_ROCK = 'rock';
export const KIND_SAT = 'satellite';

/** An empty entity record; the world's pool is filled with these once. */
function blankEntity() {
  return {
    active: false,
    kind: null,
    size: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    radius: 0, mass: 0,
    angle: 0, spin: 0,
    value: 0, hold: 0, damage: 0,
    gravity: 0, drag: 0,
    shapeSeed: 0, pulse: 0, burning: false,
  };
}

/** A fixed pool of entity records, reused forever. */
export function createEntityPool(count) {
  const pool = [];
  for (let i = 0; i < count; i += 1) pool.push(blankEntity());
  return pool;
}

/** A fresh salvage tug at its spawn point. */
export function createShip() {
  return {
    x: SHIP.spawnX, y: SHIP.spawnY, vx: 0, vy: 0, angle: -Math.PI / 2,
    radius: SHIP.radius, mass: SHIP.mass,
    hull: HULL.max, fuel: FUEL.max, hold: 0,
    invulnerable: 0, docked: false,
    thrusting: false, beamOn: false, beamHit: false,
    aimX: SHIP.spawnX, aimY: SHIP.spawnY, beamTX: 0, beamTY: 0,
  };
}

/** Turn a pooled record into a cargo pod. Bigger pods appear more often as difficulty rises. */
export function initPod(e, random, diff) {
  const roll = random();
  const smallShare = 0.55 - 0.2 * diff;
  const mediumShare = smallShare + 0.3;
  const size = roll < smallShare ? 0 : roll < mediumShare ? 1 : 2;
  const spec = PODS[size];
  e.active = true;
  e.kind = KIND_POD;
  e.size = size;
  e.radius = spec.radius;
  e.mass = spec.mass;
  e.value = spec.value;
  e.hold = spec.hold;
  e.gravity = POD.gravity;
  e.drag = POD.drag;
  e.x = random() * FIELD.width;
  e.y = -e.radius - random() * 50;
  e.vx = (random() - 0.5) * 70;
  e.vy = 25 + random() * 35;
  e.spin = (random() - 0.5) * 1.5;
  e.angle = random() * Math.PI * 2;
  e.pulse = random() * Math.PI * 2;
  e.shapeSeed = random();
  e.burning = false;
}

/** Turn a pooled record into a fast rock, speeding up with difficulty. */
export function initRock(e, random, diff) {
  e.active = true;
  e.kind = KIND_ROCK;
  e.size = 0;
  e.radius = ROCK.minRadius + random() * (ROCK.maxRadius - ROCK.minRadius);
  e.mass = e.radius * 0.5;
  e.damage = Math.round(e.radius * 1.7);
  e.gravity = ROCK.gravity;
  e.drag = ROCK.drag;
  e.x = random() * FIELD.width;
  e.y = -e.radius - random() * 40;
  e.vy = ROCK.baseSpeed + ROCK.speedRamp * diff + random() * ROCK.jitter;
  e.vx = (random() - 0.5) * 140;
  e.spin = (random() - 0.5) * 2;
  e.angle = random() * Math.PI * 2;
  e.pulse = random() * Math.PI * 2;
  e.shapeSeed = random();
  e.burning = false;
}

/** Turn a pooled record into a drifting broken satellite. */
export function initSatellite(e, random) {
  e.active = true;
  e.kind = KIND_SAT;
  e.size = 0;
  e.radius = SATELLITE.radius;
  e.mass = SATELLITE.mass;
  e.damage = SATELLITE.damage;
  e.gravity = SATELLITE.gravity;
  e.drag = SATELLITE.drag;
  e.x = random() * FIELD.width;
  e.y = -e.radius - random() * 60;
  e.vx = (random() - 0.5) * 40;
  e.vy = 18 + random() * 22;
  e.spin = SATELLITE.spin * (random() < 0.5 ? -1 : 1);
  e.angle = random() * Math.PI * 2;
  e.pulse = random() * Math.PI * 2;
  e.shapeSeed = random();
  e.burning = false;
}
