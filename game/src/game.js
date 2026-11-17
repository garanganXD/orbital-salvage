// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens — title, playing, paused and game over — and reacts to the world's
// event flags with sound. ?shot=title|play|over&seed=N stages that scene deterministically
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURN, EVENT_CAPTURE, EVENT_DAMAGE, EVENT_DOCK, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_GAMEOVER, SCREEN_PAUSED, SCREEN_PLAYING, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAYING;
    audio.play('start');
    announce('Playing. Salvage pods, dock at the station to refuel.');
  }

  function endGame() {
    screen = SCREEN_GAMEOVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.play('over');
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_GAMEOVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAYING) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAYING;
      announce('Playing.');
    }
  }

  function controls() {
    const aim = renderer.toField(input.mouseX(), input.mouseY());
    return {
      thrust: input.thrust(),
      turn: input.turn(),
      beam: input.beam(),
      aimX: aim.x,
      aimY: aim.y,
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { thrust: false, turn: 0, beam: false, aimX: 640, aimY: 200 }, true);
      return;
    }
    const events = world.step(STEP, controls(), false);
    if (events & EVENT_OVER) {
      endGame();
      return;
    }
    if (events & EVENT_CAPTURE) audio.play('capture');
    if (events & EVENT_DAMAGE) audio.play('impact');
    if (events & EVENT_DOCK) audio.play('dock');
    if (events & EVENT_BURN) audio.play('burn');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAYING) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAYING)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setThrust(screen === SCREEN_PLAYING && input.thrust());
    audio.setBeam(screen === SCREEN_PLAYING && input.beam());
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the field run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAYING) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('ORBITAL SALVAGE. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
