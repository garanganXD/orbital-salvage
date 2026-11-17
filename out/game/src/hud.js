// The in-game HUD: score, sector, hold, hull and fuel. It reads the world's state and paints onto
// the renderer's context in field coordinates, so it sits at a fixed place on the playfield and
// never shakes. Numbers are rebuilt only when they change.

import { FIELD, FONT, FUEL, HOLD, HULL, PALETTE } from './config.js';

const BAR_W = 320;
const BAR_H = 18;
const MARGIN = 26;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function barColor(ratio, good, mid, bad) {
  if (ratio > 0.5) return good;
  if (ratio > 0.25) return mid;
  return bad;
}

export function createHud(context) {
  const scoreLabel = cachedLabel('SCORE ');
  const sectorLabel = cachedLabel('SECTOR ');
  const holdLabel = cachedLabel('HOLD ');

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = weight + ':' + size;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'top';
    context.fillText(value, x, y);
  }

  function drawBar(x, y, w, h, ratio, color) {
    context.fillStyle = 'rgba(6,10,24,0.6)';
    context.fillRect(x - 2, y - 2, w + 4, h + 4);
    context.fillStyle = color;
    context.fillRect(x, y, w * ratio, h);
    context.strokeStyle = 'rgba(160,190,235,0.35)';
    context.lineWidth = 1;
    context.strokeRect(x - 2, y - 2, w + 4, h + 4);
  }

  function draw(state) {
    const ship = state.ship;

    // Top-left: score.
    text('SCORE', MARGIN, 16, 13, PALETTE.muted, 'left', '600');
    text(scoreLabel(state.score), MARGIN, 30, 30, PALETTE.text, 'left', '700');

    // Top-centre: sector / difficulty.
    text(sectorLabel(state.level), FIELD.width / 2, 24, 20, PALETTE.muted, 'center', '600');

    // Top-right: hold capacity, as a count and pips.
    const holdFull = ship.hold >= HOLD.capacity;
    text(holdLabel(ship.hold + '/' + HOLD.capacity), FIELD.width - MARGIN, 20, 20, holdFull ? PALETTE.gold : PALETTE.text, 'right', '700');
    const pipCount = HOLD.capacity;
    const pipW = 7;
    const pipGap = 3;
    const pipsW = pipCount * pipW + (pipCount - 1) * pipGap;
    let pipX = FIELD.width - MARGIN - pipsW;
    for (let i = 0; i < pipCount; i += 1) {
      context.fillStyle = i < ship.hold ? PALETTE.accent : 'rgba(120,150,200,0.22)';
      context.fillRect(pipX, 44, pipW, 8);
      pipX += pipW + pipGap;
    }

    // Bottom-left: hull.
    text('HULL', MARGIN, FIELD.height - 60, 13, PALETTE.muted, 'left', '600');
    const hullRatio = ship.hull / HULL.max;
    drawBar(MARGIN, FIELD.height - 42, BAR_W, BAR_H, hullRatio, barColor(hullRatio, PALETTE.hullGood, PALETTE.hullMid, PALETTE.hullBad));

    // Bottom-right: fuel.
    text('FUEL', FIELD.width - MARGIN - BAR_W, FIELD.height - 60, 13, PALETTE.muted, 'left', '600');
    const fuelRatio = ship.fuel / FUEL.max;
    drawBar(FIELD.width - MARGIN - BAR_W, FIELD.height - 42, BAR_W, BAR_H, fuelRatio, barColor(fuelRatio, PALETTE.fuel, PALETTE.fuel, PALETTE.fuelLow));

    // A centred nudge when the player needs the station.
    if (ship.fuel < 30) text('REFUEL AT THE STATION', FIELD.width / 2, FIELD.height - 44, 16, PALETTE.gold, 'center', '700');
    else if (holdFull) text('HOLD FULL — DOCK TO OFFLOAD', FIELD.width / 2, FIELD.height - 44, 16, PALETTE.gold, 'center', '700');
  }

  return { draw };
}
