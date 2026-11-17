// The bare mechanics: integration, damping, circle collisions and a few small maths helpers.
// Every function works on plain {x, y, vx, vy, radius, mass} shapes and holds no game state,
// so the world composes them freely.

export const TAU = Math.PI * 2;

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Keep an angle within (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Signed shortest turn from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

/** Add a constant downward acceleration. */
export function applyGravity(body, g, dt) {
  body.vy += g * dt;
}

/** Exponential damping: higher `drag` bleeds speed faster, for a drifty feel. */
export function applyDrag(body, drag, dt) {
  const f = Math.max(0, 1 - drag * dt);
  body.vx *= f;
  body.vy *= f;
}

/** Advance position by velocity. */
export function integrate(body, dt) {
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

/** Cap a body's speed at `max` while keeping its direction. */
export function clampSpeed(body, max) {
  const s = Math.hypot(body.vx, body.vy);
  if (s > max) {
    body.vx *= max / s;
    body.vy *= max / s;
  }
}

/** Whether two circles overlap. */
export function circleHit(a, b) {
  const r = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < r * r;
}

/** Push two overlapping circles apart, heavier ones moving less. Returns whether they touched. */
export function separate(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const overlap = a.radius + b.radius - d;
  if (overlap <= 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  const total = a.mass + b.mass;
  const wa = b.mass / total;
  const wb = a.mass / total;
  a.x += nx * overlap * wa;
  a.y += ny * overlap * wa;
  b.x -= nx * overlap * wb;
  b.y -= ny * overlap * wb;
  return true;
}

/** An impulse bounce between two circles, mass-weighted. */
export function bounce(a, b, restitution) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const nx = dx / d;
  const ny = dy / d;
  const rvx = a.vx - b.vx;
  const rvy = a.vy - b.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return; // already separating
  const total = a.mass + b.mass;
  const j = (-(1 + restitution) * vn) / total;
  a.vx += j * b.mass * nx;
  a.vy += j * b.mass * ny;
  b.vx -= j * a.mass * nx;
  b.vy -= j * a.mass * ny;
}
