// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with space. The scene (background,
// planet, station, debris, tug, beam, particles) is drawn under the screen-shake offset, then the
// HUD and the title/pause/game-over overlays are drawn steady on top. Everything is deterministic:
// no wall clock and no unseeded randomness, so the screenshot scenes always render the same frame.

import { ATMOSPHERE, FIELD, FONT, PALETTE, PLANET, STATION, TRACTOR } from './config.js';
import { KIND_POD, KIND_ROCK, KIND_SAT } from './entities.js';
import { createRandom } from './random.js';
import { createHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAYING = 'playing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_GAMEOVER = 'gameover';

const TAU = Math.PI * 2;

/** Convert a hex colour like '#7df0ff' to its [r, g, b] parts. */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const hud = createHud(context);
  const view = { scale: 1, x: 0, y: 0 };

  // A fixed, seeded starfield (deterministic for screenshots).
  const starRandom = createRandom(20261117);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * FIELD.height,
      r: 0.5 + starRandom() * 1.4,
      phase: starRandom() * TAU,
      base: 0.25 + starRandom() * 0.65,
      speed: 0.8 + starRandom() * 2.2,
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Client-pixel coordinates to field coordinates (the inverse of the view transform). */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = weight + ':' + size;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRectPath(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.arcTo(x + w, y, x + w, y + r, r);
    context.lineTo(x + w, y + h - r);
    context.arcTo(x + w, y + h, x + w - r, y + h, r);
    context.lineTo(x + r, y + h);
    context.arcTo(x, y + h, x, y + h - r, r);
    context.lineTo(x, y + r);
    context.arcTo(x, y, x + r, y, r);
    context.closePath();
  }

  /** A soft additive glow disc. */
  function glow(x, y, r, hex, a) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    const g = context.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    context.fillStyle = g;
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
    context.restore();
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    roundRectPath(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawBackground(state) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.space);
    g.addColorStop(0.62, PALETTE.spaceMid);
    g.addColorStop(1, PALETTE.spaceLow);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Faint nebula glows for depth.
    glow(470, 210, 340, '#7a5ae0', 0.07);
    glow(900, 330, 260, '#3a8adf', 0.06);

    // Stars, twinkling on the simulation clock.
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const tw = 0.55 + 0.45 * Math.sin(state.elapsed * s.speed + s.phase);
      context.fillStyle = rgba(PALETTE.star, s.base * tw);
      context.fillRect(s.x, s.y, s.r, s.r);
    }
  }

  function drawPlanet(state) {
    const t = state.elapsed;
    // The disc.
    const g = context.createRadialGradient(PLANET.cx, PLANET.cy - 120, PLANET.radius * 0.55, PLANET.cx, PLANET.cy, PLANET.radius);
    g.addColorStop(0, PALETTE.planetTop);
    g.addColorStop(0.5, PALETTE.planetMid);
    g.addColorStop(1, PALETTE.planetDeep);
    context.fillStyle = g;
    context.beginPath();
    context.arc(PLANET.cx, PLANET.cy, PLANET.radius, 0, TAU);
    context.fill();

    // Cloud bands, clipped to the disc.
    context.save();
    context.beginPath();
    context.arc(PLANET.cx, PLANET.cy, PLANET.radius, 0, TAU);
    context.clip();
    for (let i = 0; i < 3; i += 1) {
      const by = ATMOSPHERE.surface + 18 + i * 34;
      context.fillStyle = rgba(PALETTE.band, 0.1 + 0.04 * Math.sin(t * 0.4 + i));
      context.fillRect(0, by, FIELD.width, 16 + i * 6);
    }
    context.restore();

    // The atmosphere: a magenta shell and a cyan limb line.
    context.save();
    context.globalCompositeOperation = 'lighter';
    const ag = context.createLinearGradient(0, ATMOSPHERE.top, 0, ATMOSPHERE.surface);
    ag.addColorStop(0, rgba(PALETTE.atmo, 0));
    ag.addColorStop(0.55, rgba(PALETTE.atmo, 0.1 + 0.05 * Math.sin(t * 0.7)));
    ag.addColorStop(1, rgba(PALETTE.atmo, 0.34));
    context.fillStyle = ag;
    context.fillRect(0, ATMOSPHERE.top, FIELD.width, ATMOSPHERE.surface - ATMOSPHERE.top);
    const lg = context.createLinearGradient(0, ATMOSPHERE.surface - 26, 0, ATMOSPHERE.surface + 14);
    lg.addColorStop(0, rgba(PALETTE.atmoCyan, 0));
    lg.addColorStop(0.5, rgba(PALETTE.atmoCyan, 0.28));
    lg.addColorStop(1, rgba(PALETTE.atmoCyan, 0));
    context.fillStyle = lg;
    context.fillRect(0, ATMOSPHERE.surface - 26, FIELD.width, 40);
    context.restore();
    context.fillStyle = rgba(PALETTE.atmo, 0.5);
    context.fillRect(0, ATMOSPHERE.surface - 1, FIELD.width, 2);
  }

  function drawStation(state) {
    const st = state.station;
    const x = st.x;
    const y = st.y;
    const r = st.radius;
    const t = state.elapsed;

    // A beacon column so the station reads from across the field.
    context.save();
    context.globalCompositeOperation = 'lighter';
    const bg = context.createLinearGradient(0, y - 240, 0, y);
    bg.addColorStop(0, rgba(PALETTE.atmoCyan, 0));
    bg.addColorStop(1, rgba(PALETTE.atmoCyan, 0.12));
    context.fillStyle = bg;
    context.fillRect(x - 18, y - 240, 36, 240);
    context.restore();

    glow(x, y, r * 3.2, PALETTE.accent, 0.35);
    context.strokeStyle = PALETTE.atmoCyan;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.stroke();
    context.strokeStyle = rgba(PALETTE.ship, 0.5);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, r * 0.55, 0, TAU);
    context.stroke();
    context.fillStyle = PALETTE.ship;
    context.beginPath();
    context.arc(x, y, r * 0.4, 0, TAU);
    context.fill();
    for (let k = 0; k < 3; k += 1) {
      const a = t * 0.8 + (k * TAU) / 3;
      context.strokeStyle = rgba(PALETTE.ship, 0.6);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
      context.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      context.stroke();
    }
    const blink = Math.sin(t * 6) > 0 ? 1 : 0.25;
    const la = t * 0.8 + Math.PI / 2;
    context.fillStyle = rgba(PALETTE.gold, blink);
    context.beginPath();
    context.arc(x + Math.cos(la) * r, y + Math.sin(la) * r, 3, 0, TAU);
    context.fill();
  }

  function drawPod(e) {
    const x = e.x;
    const y = e.y;
    const r = e.radius;
    const col = PALETTE.pod[e.size];
    const pulse = 0.55 + 0.45 * Math.sin(e.pulse * 4);
    glow(x, y, r * 2.4, col, 0.4 * pulse);
    context.save();
    context.translate(x, y);
    context.rotate(e.angle);
    roundRectPath(-r, -r * 0.72, r * 2, r * 1.44, r * 0.72);
    context.fillStyle = col;
    context.fill();
    roundRectPath(-r * 0.55, -r * 0.34, r * 1.1, r * 0.2, r * 0.1);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fill();
    context.restore();
  }

  function drawRock(e) {
    context.save();
    context.translate(e.x, e.y);
    context.rotate(e.angle);
    const segs = 8;
    context.beginPath();
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * TAU;
      const rr = e.radius * (0.72 + 0.3 * Math.sin(e.shapeSeed * 40 + i * 2.1));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = PALETTE.rock;
    context.fill();
    context.strokeStyle = PALETTE.rockDark;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.rockCrater;
    context.beginPath();
    context.arc(-e.radius * 0.22, -e.radius * 0.12, e.radius * 0.2, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(e.radius * 0.24, e.radius * 0.22, e.radius * 0.13, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawSatellite(e) {
    context.save();
    context.translate(e.x, e.y);
    context.rotate(e.angle);
    context.fillStyle = PALETTE.satPanelDark;
    context.fillRect(-e.radius * 1.9, -e.radius * 0.75, e.radius * 1.1, e.radius * 1.5);
    context.fillRect(e.radius * 0.8, -e.radius * 0.75, e.radius * 1.1, e.radius * 1.5);
    context.fillStyle = PALETTE.satPanel;
    context.fillRect(-e.radius * 2.0, -e.radius * 0.85, e.radius * 1.3, e.radius * 1.7);
    context.fillRect(e.radius * 0.7, -e.radius * 0.85, e.radius * 1.3, e.radius * 1.7);
    context.fillStyle = PALETTE.sat;
    context.beginPath();
    context.arc(0, 0, e.radius * 0.8, 0, TAU);
    context.fill();
    context.strokeStyle = PALETTE.rockDark;
    context.lineWidth = 1.5;
    context.stroke();
    context.strokeStyle = PALETTE.sat;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(e.radius * 0.4, -e.radius * 0.7);
    context.lineTo(e.radius * 1.2, -e.radius * 1.7);
    context.stroke();
    context.fillStyle = PALETTE.sat;
    context.beginPath();
    context.arc(e.radius * 1.2, -e.radius * 1.7, e.radius * 0.28, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawEntity(e, state) {
    if (e.kind === KIND_POD) drawPod(e);
    else if (e.kind === KIND_ROCK) drawRock(e);
    else if (e.kind === KIND_SAT) drawSatellite(e);
    if (e.burning) glow(e.x, e.y, e.radius * 2.2, PALETTE.atmo, 0.25);
  }

  function drawShip(state) {
    const s = state.ship;
    const x = s.x;
    const y = s.y;
    const a = s.angle;
    if (s.thrusting) glow(x - Math.cos(a) * s.radius, y - Math.sin(a) * s.radius, s.radius * 1.6, PALETTE.engine, 0.5);
    if (s.invulnerable > 0 && Math.floor(s.invulnerable * 20) % 2 === 0) {
      context.strokeStyle = rgba(PALETTE.shipGlow, 0.6);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, s.radius + 7, 0, TAU);
      context.stroke();
    }
    context.save();
    context.translate(x, y);
    context.rotate(a);
    context.beginPath();
    context.moveTo(s.radius * 1.7, 0);
    context.lineTo(-s.radius * 0.9, -s.radius * 0.95);
    context.lineTo(-s.radius * 0.35, 0);
    context.lineTo(-s.radius * 0.9, s.radius * 0.95);
    context.closePath();
    context.fillStyle = PALETTE.ship;
    context.fill();
    context.strokeStyle = PALETTE.shipGlow;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.shipGlow;
    context.beginPath();
    context.arc(s.radius * 0.45, 0, s.radius * 0.4, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.shipDark;
    context.fillRect(-s.radius * 1.05, -s.radius * 0.35, s.radius * 0.4, s.radius * 0.7);
    context.restore();
    glow(x + Math.cos(a) * s.radius * 1.7, y + Math.sin(a) * s.radius * 1.7, s.radius * 1.2, PALETTE.shipGlow, 0.25);
  }

  function drawBeam(state) {
    const s = state.ship;
    if (!s.beamOn) return;
    const aim = Math.atan2(s.aimY - s.y, s.aimX - s.x);
    const endX = s.beamHit ? s.beamTX : s.x + Math.cos(aim) * TRACTOR.range;
    const endY = s.beamHit ? s.beamTY : s.y + Math.sin(aim) * TRACTOR.range;
    const startX = s.x + Math.cos(aim) * s.radius;
    const startY = s.y + Math.sin(aim) * s.radius;
    const wob = Math.sin(state.elapsed * 14) * 3;

    context.save();
    context.globalCompositeOperation = 'lighter';
    const wide = context.createLinearGradient(startX, startY, endX, endY);
    wide.addColorStop(0, rgba(PALETTE.beam, 0.28));
    wide.addColorStop(1, rgba(PALETTE.beam, 0.06));
    context.strokeStyle = wide;
    context.lineWidth = 16;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.strokeStyle = rgba(PALETTE.beamCore, 0.9);
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    for (let k = 1; k <= 3; k += 1) {
      const f = k / 4;
      const bx = startX + (endX - startX) * f;
      const by = startY + (endY - startY) * f + wob * (1 - f);
      context.strokeStyle = rgba(PALETTE.beam, 0.35);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(bx, by, 8 - k * 1.5 + wob * 0.3, 0, TAU);
      context.stroke();
    }
    context.restore();

    if (s.beamHit) {
      const rr = 16 + Math.sin(state.elapsed * 10) * 3;
      context.strokeStyle = rgba(PALETTE.gold, 0.9);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(s.beamTX, s.beamTY, rr, 0, TAU);
      context.stroke();
      context.beginPath();
      context.arc(s.beamTX, s.beamTY, rr * 0.5, 0, TAU);
      context.stroke();
    }
  }

  function drawParticles(state) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    const ps = state.particles;
    for (let i = 0; i < ps.length; i += 1) {
      const p = ps[i];
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      if (p.glow) {
        const rr = p.size * (2 - a);
        const g = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        g.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${0.4 * a})`);
        g.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
        context.fillStyle = g;
        context.beginPath();
        context.arc(p.x, p.y, rr, 0, TAU);
        context.fill();
      } else {
        context.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
        context.beginPath();
        context.arc(p.x, p.y, p.size * a + 0.5, 0, TAU);
        context.fill();
      }
    }
    context.restore();
  }

  function drawPopups(state) {
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    for (let i = 0; i < state.popups.length; i += 1) {
      const t = state.popups[i];
      if (!t.active) continue;
      const a = Math.max(0, Math.min(1, t.life));
      context.font = '700 18px ' + FONT;
      context.lineWidth = 4;
      context.strokeStyle = 'rgba(6,10,24,0.8)';
      context.strokeText(t.text, t.x, t.y);
      context.fillStyle = t.color;
      context.fillText(t.text, t.x, t.y);
    }
  }

  function drawTitle(state, best) {
    const vg = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 180, FIELD.width / 2, FIELD.height / 2, 740);
    vg.addColorStop(0, 'rgba(4,6,14,0.22)');
    vg.addColorStop(1, 'rgba(4,6,14,0.72)');
    context.fillStyle = vg;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    context.textAlign = 'center';
    context.save();
    context.shadowColor = rgba(PALETTE.accent, 0.8);
    context.shadowBlur = 40;
    context.fillStyle = PALETTE.text;
    context.font = '900 92px ' + FONT;
    context.fillText('ORBITAL SALVAGE', FIELD.width / 2, 200);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.accent;
    context.font = '900 92px ' + FONT;
    context.fillText('ORBITAL SALVAGE', FIELD.width / 2, 200);
    context.restore();
    context.fillStyle = PALETTE.muted;
    context.font = '500 26px ' + FONT;
    context.fillText('Reel in the cargo pods before the planet takes them.', FIELD.width / 2, 252);

    panel(FIELD.width / 2 - 290, 300, 580, 196);
    const rows = [
      ['WASD / ARROWS', 'thrust and rotate'],
      ['MOUSE', 'aim the tractor beam'],
      ['HOLD LEFT CLICK', 'reel pods into the hold'],
      ['DOCK AT THE STATION', 'offload cargo and refuel'],
    ];
    context.textAlign = 'left';
    let ly = 336;
    for (let i = 0; i < rows.length; i += 1) {
      context.fillStyle = PALETTE.accent;
      context.font = '600 19px ' + FONT;
      context.fillText(rows[i][0], FIELD.width / 2 - 250, ly);
      context.fillStyle = PALETTE.muted;
      context.font = '400 19px ' + FONT;
      context.fillText(rows[i][1], FIELD.width / 2 + 16, ly);
      ly += 38;
    }

    context.textAlign = 'center';
    if (best > 0) {
      context.fillStyle = PALETTE.gold;
      context.font = '700 22px ' + FONT;
      context.fillText('BEST ' + best, FIELD.width / 2, 556);
    }
    if (Math.floor(state.elapsed * 2) % 2 === 0) {
      context.fillStyle = PALETTE.text;
      context.font = '700 26px ' + FONT;
      context.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 640);
    }
  }

  function drawPaused() {
    context.fillStyle = 'rgba(4,6,14,0.5)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 210, FIELD.height / 2 - 70, 420, 140);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = '800 44px ' + FONT;
    context.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 + 8);
    context.fillStyle = PALETTE.muted;
    context.font = '500 18px ' + FONT;
    context.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 46);
  }

  function drawGameOver(state, best) {
    context.fillStyle = 'rgba(4,6,14,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 320, 170, 640, 370);

    context.textAlign = 'center';
    context.save();
    context.shadowColor = rgba(PALETTE.hullBad, 0.8);
    context.shadowBlur = 30;
    context.fillStyle = PALETTE.hullBad;
    context.font = '900 68px ' + FONT;
    context.fillText('GAME OVER', FIELD.width / 2, 258);
    context.restore();
    context.fillStyle = PALETTE.muted;
    context.font = '600 22px ' + FONT;
    context.fillText(state.cause === 'fuel' ? 'OUT OF FUEL' : 'HULL BREACHED', FIELD.width / 2, 296);
    context.fillStyle = PALETTE.muted;
    context.font = '600 18px ' + FONT;
    context.fillText('FINAL SCORE', FIELD.width / 2, 342);
    context.fillStyle = PALETTE.text;
    context.font = '900 60px ' + FONT;
    context.fillText(String(state.score), FIELD.width / 2, 402);
    if (best > 0) {
      context.fillStyle = PALETTE.gold;
      context.font = '700 20px ' + FONT;
      context.fillText('BEST ' + best, FIELD.width / 2, 446);
    }
    context.fillStyle = PALETTE.accent;
    context.font = '700 24px ' + FONT;
    context.fillText('PRESS SPACE OR CLICK TO RESTART', FIELD.width / 2, 500);
  }

  /** Paint one frame: the world (shaken), then the HUD and any screen overlay (steady). */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.space;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.setTransform(view.scale, 0, 0, view.scale, view.x + state.shakeX * view.scale, view.y + state.shakeY * view.scale);
    drawBackground(state);
    drawPlanet(state);
    drawStation(state);
    for (let i = 0; i < state.entities.length; i += 1) {
      const e = state.entities[i];
      if (e.active) drawEntity(e, state);
    }
    drawShip(state);
    drawBeam(state);
    drawParticles(state);
    drawPopups(state);
    context.restore();

    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
    } else {
      hud.draw(state);
      if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_GAMEOVER) drawGameOver(state, best);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
