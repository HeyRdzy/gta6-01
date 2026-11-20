// Solmar Heat — boot: builds the scene, wires every system together and
// runs the frame loop. Staged shots (?shot=start|play|chase|mission) pose
// a scene and set window.__shotReady once it has rendered.
// Round 3 note: boot is the only module that touches the DOM directly; the rest work on the scene.

import * as THREE from 'three';
import { createGameState } from './state.js';
import { createRenderer, createSky, createLightRig } from './visuals.js';
import { buildCity } from './world.js';
import { createTraffic } from './traffic.js';
import { createHero } from './hero.js';
import { createCops } from './cops.js';
import { createCombat } from './combat.js';
import { createStory } from './story.js';
import { createDisplay } from './display.js';
import { createSound } from './sound.js';
import { createControls } from './controls.js';
import { applyShot } from './stage.js';
import { clamp, damp } from './util.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const canvas = document.getElementById('game');
const isShot = Boolean(shotName);

const state = createGameState();
if (!isShot) state.load(); // staged shots always start from a clean state
if (isShot) state.started = true;

const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8a06a, 90, 460);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2500);
camera.position.set(0, 5, 104);

const sky = createSky(scene);
const lights = createLightRig(scene);
const world = buildCity(scene);
const traffic = createTraffic(scene, world);

// The display is built last (it needs hero/story/cops/combat), but hero,
// cops, combat and story call display.toast during play, so they share a
// proxy that the real display is copied onto once it exists.
const displayProxy = {};
const sound = createSound(state);
const hero = createHero(scene, world, traffic, state, displayProxy);
const cops = createCops(scene, world, hero, state, displayProxy);
const combat = createCombat(scene, world, hero, traffic, cops, state, displayProxy, sound);
const story = createStory(scene, hero, combat, state, displayProxy, sound);
story.landmarks = world.landmarks;
const display = createDisplay(state, hero, story, cops, combat);
Object.assign(displayProxy, display);

const game = {
  canvas,
  hero,
  state,
  story,
  combat,
  cops,
  display,
  traffic,
  world,
  camera,
  shotCamera: null,
};
const controls = createControls({ ...game, sound });
game.controls = controls;

window.__solmar = { hero, street: traffic, combat, story, cops, state, world };
window.__debug = { scene, renderer, lights, sky, state, camera, THREE };
window.__ready = false;
window.__shotReady = false;
window.__shotError = null;
window.__frameCount = 0;

// Title screen buttons.
document.getElementById('btn-start').addEventListener('click', () => {
  sound.ensure();
  state.started = true;
  state.paused = false;
  display.showHud();
  display.say(story.objectiveLabel());
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (err) {
    // Headless or unsupported: drag look still works.
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  state.paused = false;
  display.hidePause();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  state.save();
  location.reload();
});
document.getElementById('btn-mute').addEventListener('click', () => controls.toggleMute());
document.getElementById('btn-continue').addEventListener('click', () => {
  sound.ensure();
  state.started = true;
  state.paused = false;
  display.showHud();
  display.say(story.objectiveLabel());
});

// Wanted decay: heat fades when the player stays far from every cruiser.
let wantedTimer = 0;
function updateWanted(dt) {
  if (state.wanted <= 0) return;
  wantedTimer += dt;
  if (wantedTimer < 1) return;
  wantedTimer = 0;
  let nearest = Infinity;
  for (const c of cops.cruisers) {
    const d = Math.hypot(c.mesh.position.x - hero.x, c.mesh.position.z - hero.z);
    if (d < nearest) nearest = d;
  }
  if (cops.cruisers.length === 0 || nearest > 55) {
    state.wantedHeat -= 0.09;
    if (state.wantedHeat <= 0) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.wantedHeat = state.wanted > 0 ? 1 : 0;
      if (state.wanted === 0) display.toast('You lost the cops');
    }
  } else {
    state.wantedHeat = Math.min(1, state.wantedHeat + 0.05);
  }
}

// Camera: damped follow that shortens before it can clip a building.
const _focus = new THREE.Vector3();
const _dir = new THREE.Vector3();
let camDist = 7;
let fov = 62;
let shake = 0;
let lastCarHealth = 100;

function updateCamera(dt) {
  if (game.shotCamera) {
    const sc = game.shotCamera;
    if (sc.orbit) {
      const a = performance.now() / 1000 / 60;
      camera.position.set(sc.pos.x + Math.sin(a) * 10, sc.pos.y, sc.pos.z + Math.cos(a) * 6);
    } else {
      camera.position.set(sc.pos.x, sc.pos.y, sc.pos.z);
    }
    camera.lookAt(sc.look.x, sc.look.y, sc.look.z);
    if (Math.abs(camera.fov - 58) > 0.05) {
      camera.fov = 58;
      camera.updateProjectionMatrix();
    }
    return;
  }
  hero.headPos(_focus);
  const dist = hero.driving ? 10.5 : 7;
  camDist = damp(camDist, dist, 4, dt);
  const cp = controls.camPitch;
  const cy = controls.camYaw;
  _dir.set(Math.sin(cy) * Math.cos(cp), Math.sin(cp), Math.cos(cy) * Math.cos(cp));
  let d = camDist;
  for (let t = 1.5; t <= camDist; t += 1.2) {
    if (world.collides(_focus.x + _dir.x * t, _focus.z + _dir.z * t, 0.6)) {
      d = Math.max(2.4, t - 1);
      break;
    }
  }
  const tx = _focus.x + _dir.x * d;
  const ty = _focus.y + _dir.y * d;
  const tz = _focus.z + _dir.z * d;
  camera.position.x = damp(camera.position.x, tx, 9, dt);
  camera.position.y = damp(camera.position.y, ty, 9, dt);
  camera.position.z = damp(camera.position.z, tz, 9, dt);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    camera.position.z += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.8);
  }
  camera.lookAt(_focus.x, _focus.y + 0.3, _focus.z);
  const targetFov = hero.driving ? 62 + Math.min(10, Math.abs(hero.speed) * 0.35) : 62;
  fov = damp(fov, targetFov, 4, dt);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

// Frame-time auto-tune: drop the pixel ratio if the machine struggles.
const pixelSteps = [1.75, 1.25, 1.0];
let pixelStep = 0;
let frameEma = 16;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let saveTimer = 0;
let shotFrames = 0;
const clock = new THREE.Clock();
let timeSec = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  timeSec += dt;
  frameEma = frameEma * 0.95 + dt * 1000 * 0.05;
  if (frameEma > 42 && pixelStep < pixelSteps.length - 1) {
    pixelStep++;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelSteps[pixelStep]));
    frameEma = 22;
  }

  const running = state.started && !state.paused;
  if (running) {
    state.dayT = (state.dayT + state.daySpeed * dt) % 1;
    state.playSeconds += dt;
    hero.update(dt, controls.input, controls.camYaw);
    controls.input.jump = false;
    combat.update(dt, camera);
    cops.update(dt, timeSec);
    story.update(dt);
    updateWanted(dt);
    sound.update(Math.abs(hero.speed), state.wanted);
    if (hero.driving && lastCarHealth - hero.carHealth > 6) shake = 0.6;
    lastCarHealth = hero.carHealth;
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      state.save();
    }
  }

  const skyInfo = sky.update(state.dayT, dt, timeSec);
  lights.update(skyInfo, hero);
  world.update(dt, timeSec, state.dayT, skyInfo.windowGlow);
  traffic.update(dt, timeSec, skyInfo.windowGlow > 0.6);
  updateCamera(dt);
  if (state.started) display.update(dt, timeSec);
  renderer.render(scene, camera);

  window.__frameCount++;
  if (!window.__ready) window.__ready = true;
  if (isShot) {
    shotFrames++;
    if (shotFrames >= 6 && !window.__shotReady) window.__shotReady = true;
  }
}

// Stage the shot before the first frame, then start the loop.
if (isShot) {
  try {
    applyShot(game, shotName);
  } catch (err) {
    window.__shotError = String(err && err.message ? err.message : err);
  }
} else {
  display.showTitle();
  const hasSave = state.cash !== 250 || state.missionsDone > 0 || state.kills > 0;
  document.getElementById('btn-continue').style.display = hasSave ? 'inline-block' : 'none';
  display.say(story.objectiveLabel());
}
if (isShot) {
  // Keep the HUD visible for the shot; the title overlay is only for start.
  if (shotName !== 'start') display.showHud();
}
frame();
