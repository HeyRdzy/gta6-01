// Boot for Solmar Heat v3: builds the renderer, the bay and every system,
// runs the frame loop, and wires the menus. The camera is damped and
// never clips through buildings; speed kicks the FOV, crashes shake the
// frame, and the title screen slowly orbits the bay at golden hour.
// The game object is exposed as window.__solmar so a headless playtest
// can drive it; in ?shot= mode window.__shotReady flips true once the
// staged scene has actually rendered.

import * as THREE from 'three';
import { BayState, BUSTED_FINE, WASTED_FINE } from './state.js';
import { buildBay } from './world.js';
import { Hero } from './hero.js';
import { StreetLife } from './traffic.js';
import { Cops } from './cops.js';
import { Story } from './story.js';
import { Combat } from './combat.js';
import { Display } from './display.js';
import { BaySound } from './sound.js';
import { Pad } from './controls.js';
import { stageShot } from './stage.js';
import { flatDist, clampNum, lerpNum } from './util.js';
import { makeRenderer, glowTexture } from './visuals.js';

const canvas = document.getElementById('game');
const renderer = makeRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);

const state = new BayState();
const bay = buildBay(scene);
const hero = new Hero(scene, bay.colliders, state);
const street = new StreetLife(scene, bay.colliders, bay.parkedSpots);
const cops = new Cops(scene, state, bay);
const combat = new Combat(scene, state);
const story = new Story(scene, bay, state, combat);
const display = new Display(document);
const sound = new BaySound();
const pad = new Pad(canvas);
pad.attach();

const events = {
  say: (t) => display.say(t, 6),
  toast: (t) => display.toast(t),
};

let mode = 'title'; // title | play | pause | dead
let fixedPose = null;
let saveT = 0;
let trauma = 0;
let fov = 62;
let shotFrames = 0;
const camPos = new THREE.Vector3(-52, 26, 148);
const camLook = new THREE.Vector3(42, 8, -52);
const exhaustTex = glowTexture('rgba(120,120,120,0.7)', 'rgba(120,120,120,0)');
const exhaustPool = [];

// Gold "M" marker over the next job's starting point.
const jobMark = new THREE.Mesh(
  new THREE.CylinderGeometry(1.8, 1.8, 18, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffc23b, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
);
jobMark.visible = false;
scene.add(jobMark);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function startPlay(fromSave) {
  if (fromSave) state.load();
  else state.reset();
  hero.teleport(bay.playerSpawn.x, bay.playerSpawn.z, Math.PI);
  cops.clear();
  combat.clearRivals();
  story.jobIndex = state.missionsDone;
  story.active = null;
  mode = 'play';
  display.showPlay();
  sound.unlock();
  pad.lockPointer();
  display.say('Mara Voss: Rio. Five jobs, one city. Find the gold M.', 7);
}

function toTitle() {
  state.save();
  mode = 'title';
  display.showTitle(state.hasSave());
  pad.unlockPointer();
  sound.engineOff();
  sound.sirenOff();
}

function busted() {
  state.addCash(-BUSTED_FINE);
  state.heat = 0;
  story.active = null;
  cops.clear();
  combat.clearRivals();
  if (hero.driving) hero.leaveCar(true);
  hero.teleport(bay.pd.x + 30, bay.pd.z + 6, Math.PI / 2);
  display.toast(`BUSTED — Solmar PD took $${BUSTED_FINE}`);
  display.say('Officer: Walk it off, Calder. Next time it is a cell.', 6);
  sound.thud();
}

function wasted() {
  state.addCash(-WASTED_FINE);
  state.heat = 0;
  state.health = 100;
  cops.clear();
  combat.clearRivals();
  story.active = null;
  if (hero.driving) hero.leaveCar(true);
  hero.teleport(bay.playerSpawn.x, bay.playerSpawn.z, Math.PI);
  mode = 'dead';
  display.showDead();
  pad.unlockPointer();
  sound.engineOff();
  sound.sirenOff();
}

display.el['btn-start'].addEventListener('click', () => startPlay(false));
display.el['btn-continue'].addEventListener('click', () => startPlay(true));
display.el['btn-resume'].addEventListener('click', () => {
  mode = 'play';
  display.hidePause();
  pad.lockPointer();
});
display.el['btn-quit'].addEventListener('click', toTitle);
display.el['btn-mute'].addEventListener('click', () => {
  state.muted = !state.muted;
  sound.setMuted(state.muted);
  display.el['btn-mute'].textContent = state.muted ? 'Sound: Off' : 'Sound: On';
});
display.el['btn-respawn'].addEventListener('click', () => {
  mode = 'play';
  display.showPlay();
  pad.lockPointer();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && mode === 'play') {
    mode = 'pause';
    state.save();
    display.showPause(state.muted);
    pad.unlockPointer();
    sound.engineOff();
    sound.sirenOff();
  } else if (e.code === 'Escape' && mode === 'pause') {
    mode = 'play';
    display.hidePause();
    pad.lockPointer();
  }
  if (e.code === 'KeyM') {
    state.muted = !state.muted;
    sound.setMuted(state.muted);
  }
});

// --- screenshot mode ---------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const game = { hero, street, cops, story, combat, state, display, sound, bay, mode: () => mode };
if (shotName) {
  mode = 'play';
  sound.setMuted(true);
  fixedPose = stageShot(shotName, game);
  window.__shot = shotName;
}

// --- frame loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

function exhaustPuff(dt) {
  if (!hero.driving || Math.abs(hero.speed) < 6) return;
  const car = hero.driving;
  let puff = exhaustPool.find((p) => !p.visible);
  if (!puff) {
    if (exhaustPool.length >= 10) return;
    puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: exhaustTex, transparent: true, opacity: 0.5, depthWrite: false }));
    scene.add(puff);
    exhaustPool.push(puff);
  }
  puff.visible = true;
  puff.material.opacity = 0.5;
  puff.scale.set(1.2, 1.2, 1);
  const bx = car.mesh.position.x - Math.sin(car.heading) * 2.4;
  const bz = car.mesh.position.z - Math.cos(car.heading) * 2.4;
  puff.position.set(bx, 0.7, bz);
  puff.userData.life = 0.7;
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  elapsed += dt;
  trauma = Math.max(0, trauma - dt * 1.6);
  pad.smooth(dt);

  if (mode === 'play') {
    state.tickClock(dt);
    const skyInfo = bay.updateSky(state.dayT);
    street.night = skyInfo.night;
    bay.animate(dt, now);

    if (pad.hit('KeyE')) {
      if (hero.driving) {
        hero.leaveCar();
        sound.engineOff();
      } else {
        const car = street.nearestCar(hero.x, hero.z, 4.5);
        if (car) {
          hero.takeCar(car);
          state.addHeat(25);
          display.toast('Car stolen — the PD noticed (+heat)');
          street.scare(hero.x, hero.z);
          sound.engine(true, 0);
        } else if (!story.active) {
          const job = story.currentJob();
          if (job) {
            const s0 = job.steps[0];
            const near = s0.x !== undefined && flatDist(hero.x, hero.z, s0.x, s0.z) < 30;
            if (near || story.jobIndex === 0) {
              story.startNext(events);
              sound.jingle();
            } else {
              display.toast('Find the gold M to start the next job');
            }
          }
        }
      }
    }

    const clicks = pad.takeShots();
    if (clicks > 0 && !hero.driving) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position.clone();
      if (combat.shoot(origin, dir, {
        onShot: () => sound.shot(),
        onKill: () => { display.toast('Rival down'); sound.blip(660); },
      })) {
        street.scare(hero.x, hero.z);
      }
    }
    if (pad.hit('KeyR') || pad.hit('KeyF')) combat.reload();

    hero.update(dt, pad, (impact) => {
      sound.thud();
      trauma = Math.min(1, trauma + 0.45);
      if (impact > 20) { state.hurt(4); street.scare(hero.x, hero.z); }
    });

    if (hero.driving && Math.abs(hero.speed) > 5) {
      for (const ped of street.peds) {
        if (ped.down) continue;
        if (flatDist(ped.mesh.position.x, ped.mesh.position.z, hero.x, hero.z) < 1.7) {
          ped.down = true;
          ped.mesh.rotation.x = Math.PI / 2;
          state.addHeat(12);
          street.scare(hero.x, hero.z);
          display.toast('You hit a pedestrian — the city saw that');
        }
      }
    }

    exhaustPuff(dt);
    for (const puff of exhaustPool) {
      if (!puff.visible) continue;
      puff.userData.life -= dt;
      puff.position.y += dt * 1.4;
      puff.material.opacity = Math.max(0, puff.userData.life * 0.7);
      const s = puff.scale.x + dt * 1.8;
      puff.scale.set(s, s, 1);
      if (puff.userData.life <= 0) puff.visible = false;
    }

    street.update(dt, now, hero.x, hero.z, hero.speed);
    const nearestCop = cops.cars.length > 0
      ? Math.min(...cops.cars.map((c) => flatDist(c.mesh.position.x, c.mesh.position.z, hero.x, hero.z)))
      : 999;
    cops.update(dt, hero, now, {
      onRam: () => { sound.thud(); trauma = Math.min(1, trauma + 0.5); },
      onTouch: () => {},
      onBusted: busted,
    });
    state.coolHeat(dt, nearestCop > 30 && !hero.driving);
    combat.update(dt, hero, { onHurt: () => { trauma = Math.min(1, trauma + 0.25); } });
    story.update(dt, hero, now, events);

    if (!story.active) {
      const job = story.currentJob();
      if (job && job.steps[0].x !== undefined) {
        jobMark.visible = true;
        jobMark.position.set(job.steps[0].x, 9, job.steps[0].z);
      } else {
        jobMark.visible = false;
      }
    } else {
      jobMark.visible = false;
    }

    sound.engine(!!hero.driving, hero.speed);
    sound.siren(state.stars() > 0);
    sound.sirenTick(dt);

    if (state.health <= 0) wasted();

    saveT += dt;
    if (saveT > 20) { saveT = 0; state.save(); }

    display.update(dt, state, hero, story, cops, combat);
  } else if (mode === 'title') {
    bay.updateSky(0.06);
    bay.animate(dt, now);
  }

  // --- camera: fixed pose for screenshots, damped chase cam otherwise -----
  const damp = 1 - Math.exp(-dt * 7);
  if (fixedPose) {
    camera.position.copy(fixedPose.position);
    camera.lookAt(fixedPose.lookAt);
  } else if (mode === 'title') {
    const a = elapsed * 0.045;
    const want = new THREE.Vector3(-52 + Math.sin(a) * 26, 26 + Math.sin(a * 0.7) * 4, 148 - Math.cos(a) * 10);
    camPos.lerp(want, damp);
    camLook.lerp(new THREE.Vector3(42, 8, -52), damp);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  } else if (hero.driving) {
    const car = hero.driving;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const want = new THREE.Vector3(
      car.mesh.position.x - fx * 11 + Math.cos(car.heading) * hero.drift * 2,
      5.4, car.mesh.position.z - fz * 11 - Math.sin(car.heading) * hero.drift * 2,
    );
    camPos.lerp(want, damp);
    camLook.lerp(new THREE.Vector3(car.mesh.position.x + fx * 9, 1.6, car.mesh.position.z + fz * 9), damp);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const targetFov = 62 + clampNum(Math.abs(hero.speed) / 38, 0, 1) * 9;
    fov = lerpNum(fov, targetFov, Math.min(1, dt * 3));
  } else {
    const yaw = pad.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const want = new THREE.Vector3(
      hero.pos.x - fx * 7.5, 4.2 + pad.pitch * 2, hero.pos.z - fz * 7.5,
    );
    camPos.lerp(want, damp);
    camLook.lerp(new THREE.Vector3(hero.pos.x + fx * 5, 1.7, hero.pos.z + fz * 5), damp);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    fov = lerpNum(fov, 62, Math.min(1, dt * 3));
  }
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if (trauma > 0) {
    const s = trauma * trauma * 0.9;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.03;
  }

  pad.endFrame();
  renderer.render(scene, camera);

  if (shotName) {
    // Shot mode uses a fixed camera pose, so the scene is settled from the
    // first frame — a handful of rendered frames is enough to call it ready.
    shotFrames++;
    if (shotFrames >= 6 && !window.__shotReady) window.__shotReady = true;
  }
  window.__frameCount = (window.__frameCount || 0) + 1;
}

window.__solmar = game;
window.__ready = true;
try {
  if (!shotName) display.showTitle(state.hasSave());
  frame();
} catch (err) {
  window.__shotError = String(err && err.message || err);
  throw err;
}
