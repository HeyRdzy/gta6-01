// Keyboard and mouse input: WASD + arrows, Shift run, Space jump, E
// interact (enter/exit car, start a job at the beacon), R reload, M mute,
// Esc pause. Mouse look uses pointer lock with a drag fallback, and a click
// fires Rio's pistol.

import { clamp } from './util.js';

export function createControls(game) {
  const { canvas, hero, combat, story, state, display, sound, camera } = game;
  const input = { forward: false, back: false, left: false, right: false, run: false, jump: false };
  let camYaw = 0;
  let camPitch = 0.32;
  let pointerLocked = false;
  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  let lastY = 0;

  function interact() {
    if (!state.started || state.paused) return;
    if (hero.driving) {
      hero.exitCar();
      return;
    }
    // Start the next job when Rio stands at the gold beacon.
    if (!story.active) {
      const wp = story.objectivePoint();
      if (wp && Math.hypot(hero.x - wp.x, hero.z - wp.z) < 5) {
        story.startNext(display);
        return;
      }
    }
    hero.enterCar();
  }

  function togglePause() {
    if (!state.started) return;
    state.paused = !state.paused;
    if (state.paused) {
      display.showPause();
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      display.hidePause();
    }
  }

  function toggleMute() {
    sound.ensure();
    sound.setMuted(!state.muted);
    display.toast(state.muted ? 'Sound muted' : 'Sound on');
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.back = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        input.run = true;
        break;
      case 'Space':
        input.jump = true;
        e.preventDefault();
        break;
      case 'KeyE':
        interact();
        break;
      case 'KeyR':
        combat.reload();
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'Escape':
        togglePause();
        break;
      default:
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.back = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        input.run = false;
        break;
      case 'Space':
        input.jump = false;
        break;
      default:
        break;
    }
  });

  canvas.addEventListener('click', () => {
    if (!state.started || state.paused) return;
    if (!pointerLocked) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (err) {
        // Pointer lock is unavailable (headless); drag look still works.
      }
    }
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    if (!pointerLocked && state.started && !state.paused) {
      // Esc in pointer lock exits the lock: treat it as a pause request.
      togglePause();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      camYaw -= e.movementX * 0.0028;
      camPitch = clamp(camPitch + e.movementY * 0.0022, 0.06, 0.85);
    } else if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      camYaw -= dx * 0.004;
      camPitch = clamp(camPitch + dy * 0.003, 0.06, 0.85);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!state.started || state.paused) return;
    if (pointerLocked) {
      combat.shoot(camera);
      return;
    }
    dragging = true;
    dragMoved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    if (dragging && dragMoved < 6 && state.started && !state.paused) {
      // A short click without a drag is a shot.
      combat.shoot(camera);
    }
    dragging = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    input,
    get camYaw() {
      return camYaw;
    },
    get camPitch() {
      return camPitch;
    },
    setCamYaw(v) {
      camYaw = v;
    },
    togglePause,
    toggleMute,
  };
}
