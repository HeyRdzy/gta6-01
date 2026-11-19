// Keyboard and mouse input: held keys, edge-triggered presses, and camera drag.
// Clicking the canvas grabs the pointer for mouse-look; dragging also works without it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;

/** Track keys and mouse on `canvas`; the game polls isDown() and takeActions() each frame. */
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;
  let mouseDown = false;
  let shootQueued = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function keyName(event) {
    return event.code;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(keyName(event));
    pressed.add(keyName(event));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(keyName(event));
  }

  function onMouseMove(event) {
    if (document.pointerLockElement === canvas) {
      mouseDeltaX += event.movementX || 0;
      mouseDeltaY += event.movementY || 0;
    } else if (dragging) {
      mouseDeltaX += event.clientX - lastX;
      mouseDeltaY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      shootQueued = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      if (document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Pointer lock is a nicety; drag-look still works without it.
        }
      }
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) {
      mouseDown = false;
      dragging = false;
    }
  }

  function onBlur() {
    held.clear();
    mouseDown = false;
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** True while the named physical key (event.code) is held. */
    isDown(code) {
      return held.has(code);
    },
    /** True only on the frame the key went down; clears after one read. */
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    /** Mouse movement since the last call, in pixels. */
    takeMouseDelta() {
      const delta = { x: mouseDeltaX, y: mouseDeltaY };
      mouseDeltaX = 0;
      mouseDeltaY = 0;
      return delta;
    },
    /** True while the left mouse button is held (for automatic fire). */
    isMouseDown() {
      return mouseDown;
    },
    /** True once per click; clears after one read. */
    takeShoot() {
      if (shootQueued) {
        shootQueued = false;
        return true;
      }
      return false;
    },
    /** WASD / arrows as a -1..1 pair, relative to the camera. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) y += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y -= 1;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      return { x, y };
    },
    /** Edge-triggered menu/interact actions, as a bit mask. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('Escape') || pressed.has('KeyP')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE')) actions |= ACTION_INTERACT;
      if (pressed.has('KeyR') || pressed.has('KeyF')) actions |= ACTION_RELOAD;
      pressed.clear();
      return actions;
    },
    /** Release all listeners (used only by tests). */
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
