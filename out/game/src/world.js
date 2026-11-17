// The game's rules and state, with no drawing and no browser in it: the tug, the station, the
// pool of drifting debris, spawning, the tractor beam, collisions, fuel, hull, the hold, score
// and difficulty. step() advances one fixed step and returns what happened as bit flags, so the
// caller reacts (sound, screens) without the world knowing about either. Nothing here allocates
// after createWorld returns.

import {
  ATMOSPHERE, DIFFICULTY, FIELD, FUEL, GRAVITY, HOLD, HULL, SHIP, SPAWN, STATION, TRACTOR,
} from './config.js';
import {
  KIND_POD, createEntityPool, createShip, initPod, initRock, initSatellite,
} from './entities.js';
import {
  applyDrag, applyGravity, bounce, circleHit, clampSpeed, integrate, lerp, separate, wrapAngle,
} from './physics.js';

export const EVENT_CAPTURE = 1;
export const EVENT_DAMAGE = 2;
export const EVENT_DOCK = 4;
export const EVENT_BURN = 8;
export const EVENT_OVER = 16;

const PARTICLE_POOL = 420;
const POPUP_POOL = 14;
const MAX_SHAKE = 18;

/** Particle colours as RGB triples, kept here (the renderer only reads the numbers). */
const RGB = {
  capture: [92, 255, 176],
  gold: [255, 215, 94],
  cyan: [125, 240, 255],
  engine: [255, 179, 71],
  spark: [255, 244, 210],
  danger: [248, 113, 113],
  ember: [255, 140, 60],
  dock: [110, 231, 183],
  heat: [255, 90, 70],
  rock: [180, 190, 205],
};

function blankParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, r: 255, g: 255, b: 255, glow: false, drag: 2 };
}

function blankPopup() {
  return { active: false, x: 0, y: 0, vy: 0, life: 0, text: '', color: '#fff' };
}

export function createWorld(random) {
  const ship = createShip();
  const entities = createEntityPool(SPAWN.maxLive);
  const particles = [];
  for (let i = 0; i < PARTICLE_POOL; i += 1) particles.push(blankParticle());
  const popups = [];
  for (let i = 0; i < POPUP_POOL; i += 1) popups.push(blankPopup());
  const station = {
    angle: STATION.startAngle, x: 0, y: 0, radius: STATION.radius,
    omega: STATION.omegaStart, orbitCy: STATION.orbitCyStart, orbitR: STATION.radiusStart,
  };
  const state = {
    ship, entities, particles, popups, station,
    score: 0, elapsed: 0, diff: 0, level: 1,
    spawnTimer: 0, shake: 0, shakeX: 0, shakeY: 0, over: false, cause: null,
  };

  function freeEntity() {
    for (let i = 0; i < entities.length; i += 1) if (!entities[i].active) return entities[i];
    return null;
  }

  function freeParticle() {
    for (let i = 0; i < particles.length; i += 1) if (!particles[i].active) return particles[i];
    return null;
  }

  function freePopup() {
    for (let i = 0; i < popups.length; i += 1) if (!popups[i].active) return popups[i];
    return null;
  }

  /** Spawn one particle; ignored when the pool is full. */
  function emit(x, y, vx, vy, life, size, r, g, b, glow) {
    const p = freeParticle();
    if (p === null) return;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.size = size; p.r = r; p.g = g; p.b = b; p.glow = glow;
    p.drag = glow ? 1.2 : 2.4;
  }

  /** A radial spray of particles. */
  function burst(x, y, rgb, n, speed, life, size, glow) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const sp = speed * (0.3 + random() * 0.7);
      emit(
        x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        life * (0.5 + random() * 0.5), size * (0.6 + random() * 0.8),
        rgb[0], rgb[1], rgb[2], glow,
      );
    }
  }

  function popup(x, y, text, color) {
    const p = freePopup();
    if (p === null) return;
    p.active = true;
    p.x = x; p.y = y; p.vy = -42; p.life = 1.0;
    p.text = text; p.color = color;
  }

  function shake(amount) {
    state.shake = Math.min(MAX_SHAKE, state.shake + amount);
  }

  function clampShip() {
    const s = ship;
    const pad = s.radius + 2;
    if (s.x < pad) s.x = pad;
    else if (s.x > FIELD.width - pad) s.x = FIELD.width - pad;
    if (s.y < pad) s.y = pad;
    else if (s.y > FIELD.height - pad) s.y = FIELD.height - pad;
  }

  function spawnInterval() {
    const base = lerp(SPAWN.intervalStart, SPAWN.intervalEnd, state.diff);
    return base * (0.8 + random() * 0.4);
  }

  function spawnDebris(dt) {
    state.spawnTimer -= dt;
    while (state.spawnTimer <= 0) {
      state.spawnTimer += spawnInterval();
      const e = freeEntity();
      if (e === null) break;
      const roll = random();
      if (roll < SPAWN.podWeight) initPod(e, random, state.diff);
      else if (roll < SPAWN.podWeight + SPAWN.rockWeight) initRock(e, random, state.diff);
      else initSatellite(e, random);
    }
  }

  function updateStation(dt) {
    const s = state.station;
    s.omega = lerp(STATION.omegaStart, STATION.omegaEnd, state.diff);
    s.orbitCy = lerp(STATION.orbitCyStart, STATION.orbitCyEnd, state.diff);
    s.orbitR = lerp(STATION.radiusStart, STATION.radiusEnd, state.diff);
    s.angle += s.omega * dt;
    s.x = STATION.orbitCx + Math.cos(s.angle) * s.orbitR;
    s.y = s.orbitCy + Math.sin(s.angle) * s.orbitR;
  }

  function updateDebris(dt) {
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (!e.active) continue;
      applyGravity(e, GRAVITY * e.gravity, dt);
      applyDrag(e, e.drag, dt);
      integrate(e, dt);
      e.angle += e.spin * dt;
      e.pulse += dt;
      if (e.x < -140 || e.x > FIELD.width + 140) e.active = false;
    }
  }

  function collideDebris() {
    for (let i = 0; i < entities.length; i += 1) {
      const a = entities[i];
      if (!a.active) continue;
      for (let j = i + 1; j < entities.length; j += 1) {
        const b = entities[j];
        if (!b.active) continue;
        if (circleHit(a, b)) {
          separate(a, b);
          bounce(a, b, 0.6);
        }
      }
    }
  }

  /** Debris that sinks into the atmosphere glows, sheds embers and burns up. */
  function burnDebris(dt) {
    let events = 0;
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (!e.active) continue;
      if (e.y > ATMOSPHERE.top) {
        e.burning = true;
        if (random() < dt * 24) {
          emit(
            e.x + (random() - 0.5) * e.radius * 2, e.y,
            (random() - 0.5) * 24, -30 - random() * 44,
            0.5, 2, RGB.ember[0], RGB.ember[1], RGB.ember[2], false,
          );
        }
        if (e.y > ATMOSPHERE.surface) {
          e.active = false;
          burst(e.x, e.y, RGB.ember, 14, 150, 0.6, 2.6, true);
          events |= EVENT_BURN;
        }
      }
    }
    return events;
  }

  function updateShip(dt, controls) {
    const s = ship;
    s.angle += controls.turn * SHIP.turnRate * dt;
    s.thrusting = false;
    s.beamOn = false;
    if (controls.thrust && s.fuel > 0) {
      s.thrusting = true;
      s.vx += Math.cos(s.angle) * SHIP.thrustAccel * dt;
      s.vy += Math.sin(s.angle) * SHIP.thrustAccel * dt;
      s.fuel = Math.max(0, s.fuel - FUEL.thrustDrain * dt);
      // Engine exhaust.
      const tailX = s.x - Math.cos(s.angle) * s.radius;
      const tailY = s.y - Math.sin(s.angle) * s.radius;
      for (let i = 0; i < 2; i += 1) {
        emit(
          tailX, tailY,
          -Math.cos(s.angle) * (120 + random() * 60) + (random() - 0.5) * 30,
          -Math.sin(s.angle) * (120 + random() * 60) + (random() - 0.5) * 30,
          0.35, 2.4, RGB.engine[0], RGB.engine[1], RGB.engine[2], true,
        );
      }
    }
    s.aimX = controls.aimX;
    s.aimY = controls.aimY;
    if (controls.beam && s.fuel > 0) {
      s.beamOn = true;
      s.fuel = Math.max(0, s.fuel - FUEL.beamDrain * dt);
    }
    applyGravity(s, GRAVITY, dt);
    applyDrag(s, SHIP.drag, dt);
    integrate(s, dt);
    clampSpeed(s, SHIP.maxSpeed);
    clampShip();
    if (s.invulnerable > 0) s.invulnerable = Math.max(0, s.invulnerable - dt);
  }

  /** Whether the beam currently points at (or has nearly reeled in) an entity. */
  function beamAimedAt(s, e) {
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    const aim = Math.atan2(s.aimY - s.y, s.aimX - s.x);
    const toE = Math.atan2(e.y - s.y, e.x - s.x);
    const da = Math.abs(wrapAngle(toE - aim));
    return da < TRACTOR.cone || d < TRACTOR.captureRadius * 1.4;
  }

  /** Reel the nearest pod inside the beam's cone toward the ship. */
  function applyBeam(dt) {
    const s = ship;
    s.beamHit = false;
    if (!s.beamOn) return;
    const aim = Math.atan2(s.aimY - s.y, s.aimX - s.x);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (!e.active || e.kind !== KIND_POD) continue;
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > TRACTOR.range) continue;
      const da = Math.abs(wrapAngle(Math.atan2(dy, dx) - aim));
      if (da > TRACTOR.cone) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best === null) return;
    s.beamHit = true;
    s.beamTX = best.x;
    s.beamTY = best.y;
    const dx = best.x - s.x;
    const dy = best.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const falloff = 1 - Math.min(1, d / TRACTOR.range);
    const accel = (TRACTOR.force * falloff) / best.mass;
    best.vx -= (dx / d) * accel * dt;
    best.vy -= (dy / d) * accel * dt;
    if (random() < dt * 40) {
      emit(best.x, best.y, (random() - 0.5) * 20, (random() - 0.5) * 20, 0.3, 1.6, RGB.cyan[0], RGB.cyan[1], RGB.cyan[2], true);
    }
  }

  function shipDebris() {
    let events = 0;
    const s = ship;
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (!e.active) continue;
      if (!circleHit(s, e)) continue;
      if (e.kind === KIND_POD) {
        if (s.beamOn && beamAimedAt(s, e) && s.hold + e.hold <= HOLD.capacity) {
          e.active = false;
          s.hold += e.hold;
          state.score += e.value;
          popup(e.x, e.y - e.radius - 8, '+' + e.value, e.size === 2 ? '#ffd75e' : '#5cffb0');
          burst(e.x, e.y, RGB.capture, 20, 200, 0.6, 2.2, true);
          burst(e.x, e.y, RGB.spark, 10, 140, 0.4, 1.6, false);
          shake(3);
          events |= EVENT_CAPTURE;
        } else {
          bounce(s, e, 0.4);
        }
      } else {
        bounce(s, e, 0.55);
        if (s.invulnerable <= 0) {
          s.invulnerable = SHIP.invulnerable;
          s.hull = Math.max(0, s.hull - e.damage);
          popup(s.x, s.y - 26, '-' + e.damage, '#f87171');
          burst(e.x, e.y, RGB.danger, 18, 220, 0.55, 2.4, true);
          burst(e.x, e.y, RGB.rock, 12, 160, 0.5, 2, false);
          shake(9);
          events |= EVENT_DAMAGE;
        }
      }
    }
    return events;
  }

  /** Dock at the station when arriving slowly: refuel, offload, small celebration. */
  function shipStation(dt) {
    const s = ship;
    const st = state.station;
    const dx = s.x - st.x;
    const dy = s.y - st.y;
    const d = Math.hypot(dx, dy);
    if (d < STATION.dockRadius) {
      const speed = Math.hypot(s.vx, s.vy);
      if (speed <= STATION.dockSpeed) {
        if (!s.docked) {
          s.docked = true;
          s.fuel = FUEL.max;
          s.hold = 0;
          popup(st.x, st.y - 34, 'DOCKED', '#6ee7b7');
          burst(st.x, st.y, RGB.dock, 24, 180, 0.7, 2.5, true);
          burst(st.x, st.y, RGB.cyan, 12, 120, 0.6, 3, true);
          shake(3);
          return EVENT_DOCK;
        }
      } else {
        // Arrived too hot: bounce off the station's shell, no damage.
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);
        s.x = st.x + nx * (STATION.dockRadius + 1);
        s.y = st.y + ny * (STATION.dockRadius + 1);
        const dot = s.vx * nx + s.vy * ny;
        if (dot < 0) {
          s.vx -= 1.6 * dot * nx;
          s.vy -= 1.6 * dot * ny;
        }
        shake(2);
      }
    } else {
      s.docked = false;
    }
    return 0;
  }

  /** The ship's own descent into the atmosphere: heat damage, then destruction. */
  function shipHeat(dt) {
    const s = ship;
    if (s.y > ATMOSPHERE.top) {
      s.hull = Math.max(0, s.hull - HULL.heatDrain * dt);
      if (random() < dt * 30) {
        emit(
          s.x + (random() - 0.5) * 30, s.y + (random() - 0.5) * 30,
          (random() - 0.5) * 44, -40, 0.4, 2, RGB.heat[0], RGB.heat[1], RGB.heat[2], false,
        );
      }
      if (random() < dt * 6) shake(2);
    }
    if (s.y > ATMOSPHERE.surface) s.hull = 0;
  }

  function checkOver() {
    if (state.over) return 0;
    if (ship.hull <= 0 || ship.fuel <= 0) {
      state.over = true;
      state.cause = ship.fuel <= 0 && ship.hull > 0 ? 'fuel' : 'hull';
      ship.hull = Math.max(0, ship.hull);
      ship.fuel = Math.max(0, ship.fuel);
      return EVENT_OVER;
    }
    return 0;
  }

  /** The title screen's idle tug: it lazily orbits its spawn point with an occasional puff. */
  function hoverShip(dt) {
    const s = ship;
    s.angle = state.elapsed * 0.4;
    const ang = state.elapsed * 0.3;
    s.x = SHIP.spawnX + Math.cos(ang) * 70;
    s.y = SHIP.spawnY + Math.sin(ang) * 52;
    s.vx = -Math.sin(ang) * 70 * 0.3;
    s.vy = Math.cos(ang) * 52 * 0.3;
    s.thrusting = Math.sin(state.elapsed * 5) > 0.55;
    if (s.thrusting) {
      const tailX = s.x - Math.cos(s.angle) * s.radius;
      const tailY = s.y - Math.sin(s.angle) * s.radius;
      emit(tailX, tailY, -Math.cos(s.angle) * 90, -Math.sin(s.angle) * 90, 0.3, 2, RGB.engine[0], RGB.engine[1], RGB.engine[2], true);
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updatePopups(dt) {
    for (let i = 0; i < popups.length; i += 1) {
      const p = popups[i];
      if (!p.active) continue;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  function reset() {
    const s = ship;
    s.x = SHIP.spawnX;
    s.y = SHIP.spawnY;
    s.vx = 0;
    s.vy = 0;
    s.angle = -Math.PI / 2;
    s.hull = HULL.max;
    s.fuel = FUEL.max;
    s.hold = 0;
    s.invulnerable = 0;
    s.docked = false;
    s.thrusting = false;
    s.beamOn = false;
    s.beamHit = false;
    for (let i = 0; i < entities.length; i += 1) entities[i].active = false;
    for (let i = 0; i < particles.length; i += 1) particles[i].active = false;
    for (let i = 0; i < popups.length; i += 1) popups[i].active = false;
    state.score = 0;
    state.elapsed = 0;
    state.diff = 0;
    state.level = 1;
    state.spawnTimer = SPAWN.intervalStart * 0.6;
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    state.over = false;
    state.cause = null;
    state.station.angle = STATION.startAngle;
  }

  /**
   * One fixed step. `controls` is { thrust, turn, beam, aimX, aimY }. With `harmless` set (the
   * title screen's backdrop) the field lives but nothing touches the ship and nothing scores.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.diff = Math.min(1, state.elapsed / DIFFICULTY.rampSeconds);
    state.level = 1 + Math.floor(state.diff * (DIFFICULTY.maxLevel - 1));

    updateStation(dt);
    spawnDebris(dt);
    updateDebris(dt);
    collideDebris();
    events |= burnDebris(dt);

    if (harmless) {
      hoverShip(dt);
    } else {
      updateShip(dt, controls);
      applyBeam(dt);
      events |= shipDebris();
      events |= shipStation(dt);
      shipHeat(dt);
      events |= checkOver();
    }

    updateParticles(dt);
    updatePopups(dt);
    state.shake = Math.max(0, state.shake - state.shake * 8 * dt);
    state.shakeX = (random() * 2 - 1) * state.shake;
    state.shakeY = (random() * 2 - 1) * state.shake;
    return events;
  }

  reset();
  return { state, reset, step };
}
