// Boot for Solmar Heat v2: builds the renderer, the bay and every system,
// runs the frame loop, and wires the menus. The game object is exposed as
// window.__solmar so a headless playtest can drive it.

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
import { flatDist } from './util.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

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

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  elapsed += dt;

  if (mode === 'play') {
    state.tickClock(dt);
    bay.updateSky(state.dayT);

    // E: enter/exit a car, or start the next job at the gold M.
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

    // Shooting (on foot only).
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
      if (impact > 20) { state.hurt(4); street.scare(hero.x, hero.z); }
    });

    // Running a pedestrian over.
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

    street.update(dt, now, hero.x, hero.z, hero.speed);
    const nearestCop = cops.cars.length > 0
      ? Math.min(...cops.cars.map((c) => flatDist(c.mesh.position.x, c.mesh.position.z, hero.x, hero.z)))
      : 999;
    cops.update(dt, hero, now, {
      onRam: () => { sound.thud(); },
      onTouch: () => {},
      onBusted: busted,
    });
    state.coolHeat(dt, nearestCop > 30 && !hero.driving);
    combat.update(dt, hero, { onHurt: () => {} });
    story.update(dt, hero, now, events);

    // Job marker: gold M over the next job's first step while idle.
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

    // Audio: engine while driving, siren while wanted.
    sound.engine(!!hero.driving, hero.speed);
    sound.siren(state.stars() > 0);
    sound.sirenTick(dt);

    if (state.health <= 0) wasted();

    // Autosave now and then.
    saveT += dt;
    if (saveT > 20) { saveT = 0; state.save(); }

    display.update(dt, state, hero, story, cops);
  }

  // Camera: fixed pose for screenshots, chase cam otherwise.
  if (fixedPose) {
    camera.position.copy(fixedPose.position);
    camera.lookAt(fixedPose.lookAt);
  } else if (hero.driving) {
    const car = hero.driving;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    camera.position.set(
      car.mesh.position.x - fx * 11, 5.2, car.mesh.position.z - fz * 11,
    );
    camera.lookAt(car.mesh.position.x + fx * 9, 1.6, car.mesh.position.z + fz * 9);
  } else {
    const yaw = pad.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    camera.position.set(
      hero.pos.x - fx * 7.5, 4.2 + pad.pitch * 2, hero.pos.z - fz * 7.5,
    );
    camera.lookAt(hero.pos.x + fx * 5, 1.7, hero.pos.z + fz * 5);
  }

  pad.endFrame();
  renderer.render(scene, camera);
}

window.__solmar = game;
window.__ready = true;
if (!shotName) display.showTitle(state.hasSave());
frame();
