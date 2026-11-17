// Keyboard and mouse input. Held keys give the tug's thrust and turn; the mouse gives the beam's
// aim (client pixels, converted to field coordinates by the renderer) and its left button gives
// the beam's on/off. One-shot presses (start, restart, pause) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const THRUST = new Set(['ArrowUp', 'KeyW', 'Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let left = false;
  let right = false;
  let thrust = false;
  let beam = false;
  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (THRUST.has(event.code)) thrust = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (THRUST.has(event.code)) thrust = false;
  });

  // A key held while the tab hides never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    thrust = false;
    beam = false;
  });

  target.addEventListener('pointermove', (event) => {
    mx = event.clientX;
    my = event.clientY;
  });

  target.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      beam = true;
      actions |= ACTION_CONFIRM;
    }
  });

  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) beam = false;
  });

  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1 to turn left, 1 to turn right, 0 for neither or both. */
    turn() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    thrust() {
      return thrust;
    },
    beam() {
      return beam;
    },
    mouseX() {
      return mx;
    },
    mouseY() {
      return my;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
