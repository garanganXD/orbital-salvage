// Every tuning number, colour and label in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on screen size.
// Nothing here touches the browser or draws: this file is pure data.

/** The logical playfield, in pixels. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Downward gravity on the ship, in px/s^2. Debris feels a scaled-down share of it. */
export const GRAVITY = 60;

/** The planet: a huge disc whose visible cap fills the bottom of the field. */
export const PLANET = { cx: 640, cy: 1360, radius: 800 };

/**
 * The atmosphere is a shell above the planet's limb. Below `top` an object glows and sheds
 * embers; at `surface` it has burned up. The ship is hurt the same way, so falling into the
 * planet ends the run.
 */
export const ATMOSPHERE = { top: 470, surface: 560 };

/** The salvage tug. */
export const SHIP = {
  radius: 15,
  mass: 3,
  thrustAccel: 300,
  turnRate: 3.6,
  drag: 0.9,
  maxSpeed: 380,
  spawnX: 640,
  spawnY: 340,
  invulnerable: 0.7,
};

/** The orbiting station: it circles on an orbit that tightens and quickens as the run ramps up. */
export const STATION = {
  radius: 26,
  orbitCx: 640,
  orbitCyStart: 330,
  orbitCyEnd: 395,
  radiusStart: 210,
  radiusEnd: 135,
  omegaStart: 0.5,
  omegaEnd: 0.85,
  startAngle: -Math.PI / 2,
  dockRadius: 48,
  dockSpeed: 160,
};

/** The tractor beam: aim with the mouse, hold left button to reel a pod in. */
export const TRACTOR = {
  range: 430,
  cone: 0.5,
  force: 950,
  captureRadius: 40,
};

/** Hull and fuel pools, and how fast each action drains fuel. */
export const HULL = { max: 100, heatDrain: 26 };
export const FUEL = { max: 100, thrustDrain: 7, beamDrain: 5.5 };

/** The hold: how much salvaged cargo the tug can carry before it must dock and offload. */
export const HOLD = { capacity: 12 };

/** Cargo pods by size: bigger pods are worth more but weigh more (the beam pulls them slower). */
export const POD = { gravity: 0.25, drag: 0.8 };
export const PODS = [
  { radius: 13, mass: 1.0, value: 25, hold: 2 },
  { radius: 19, mass: 2.6, value: 60, hold: 4 },
  { radius: 27, mass: 5.0, value: 150, hold: 7 },
];

/** Fast rocks: the main hazard. Damage scales with radius. */
export const ROCK = {
  gravity: 0.55,
  drag: 0.3,
  minRadius: 11,
  maxRadius: 21,
  baseSpeed: 90,
  speedRamp: 130,
  jitter: 60,
};

/** Broken satellites: slower but heavy, they hit hard and spin as they drift. */
export const SATELLITE = { radius: 21, mass: 4, damage: 32, gravity: 0.18, drag: 0.5, spin: 0.8 };

/** Difficulty ramps over this many seconds, then holds at the top level. */
export const DIFFICULTY = { rampSeconds: 150, maxLevel: 10 };

/** Spawning: how often new debris appears, and the share each kind gets. */
export const SPAWN = {
  intervalStart: 1.05,
  intervalEnd: 0.42,
  maxLive: 46,
  podWeight: 0.52,
  rockWeight: 0.33,
  satWeight: 0.15,
};

/** The scene's palette. `pod` is indexed by pod size (small, medium, large). */
export const PALETTE = {
  space: '#04060e',
  spaceMid: '#0a1128',
  spaceLow: '#131d3d',
  star: '#dbe6ff',
  starDim: '#5f6f9f',
  planetTop: '#4a2a86',
  planetMid: '#2b1657',
  planetDeep: '#140a2e',
  band: '#6a3fc0',
  atmo: '#ff5f9e',
  atmoOuter: '#8b5cf6',
  atmoCyan: '#56d6ff',
  ship: '#eaf6ff',
  shipGlow: '#63d6ff',
  shipDark: '#9db8d8',
  engine: '#ffb45c',
  engineCore: '#fff3d6',
  pod: ['#57ffab', '#6fe0ff', '#ffd75e'],
  rock: '#9aa6b8',
  rockDark: '#545e6e',
  rockCrater: '#6a7484',
  sat: '#cdd7e6',
  satPanel: '#3a6ea8',
  satPanelDark: '#264d78',
  beam: '#7df0ff',
  beamCore: '#eafeff',
  hullGood: '#4ade80',
  hullMid: '#facc15',
  hullBad: '#f87171',
  fuel: '#38bdf8',
  fuelLow: '#f87171',
  text: '#eef4ff',
  muted: '#8ba2c8',
  dim: '#5a6b8f',
  panel: 'rgba(8,13,30,0.74)',
  panelEdge: '#2c3e63',
  accent: '#7df0ff',
  gold: '#ffd75e',
};

/** The one font family used everywhere. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'orbital-salvage.best';
