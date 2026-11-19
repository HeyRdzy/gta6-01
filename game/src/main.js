// Solmar Heat — boot and the one loop. The world advances in fixed 1/60 s steps, the
// camera chases the player or their car, and the HUD, missions, police and traffic all
// step from the same game object. ?shot=start|play|chase|mission (with &seed=N) stages
// a scene instead of running the loop, renders it, and sets window.__shotReady.

import * as THREE from 'three';
import { STEP, SAVE_KEY, WANTED, WEAPON, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createSoundBank } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { buildCity } from './city.js';
import { createTrafficManager, createParkedCars } from './vehicles.js';
import { createPedestrianManager } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createWantedSystem, createPoliceManager } from './police.js';
import { createMissionManager } from './missions.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function buildGame() {
  const random = createRandom(seed);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  const game = {
    scene,
    camera,
    renderer,
    random,
    cash: 250,
    clockMinutes: 0,
    now: 0,
    screen: 'title',
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    lastMouseMoveAt: -99,
  };
  game.audio = createSoundBank();
  game.city = buildCity(scene, random);
  game.input = createInput(canvas);
  game.hud = createHud();
  game.wanted = createWantedSystem(game);
  game.police = createPoliceManager(game, game.wanted);
  game.traffic = createTrafficManager(game);
  game.parkedCars = createParkedCars(game);
  game.peds = createPedestrianManager(game);
  game.player = createPlayer(game, game.input, game.audio);
  game.missions = createMissionManager(game);
  game.missions.setMarkerVisible(true);

  // Tracer line for gunfire: reused, faded out over a few frames.
  const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeometry, tracerMaterial);
  tracer.frustumCulled = false;
  scene.add(tracer);
  let tracerTimer = 0;
  game.showTracer = (from, to) => {
    const positions = tracerGeometry.attributes.position;
    positions.setXYZ(0, from.x, from.y, from.z);
    positions.setXYZ(1, to.x, to.y, to.z);
    positions.needsUpdate = true;
    tracerMaterial.opacity = 0.95;
    tracerTimer = 0.09;
  };
  game.fadeTracer = (dt) => {
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) tracerMaterial.opacity = 0;
    }
  };

  game.onPlayerDown = () => {
    game.screen = 'dead';
    game.hud.showDead();
    game.audio.setSiren(false);
    game.audio.stopEngine();
  };

  game.onMissionComplete = () => {
    saveGame(game);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return game;
}

/** Put the third-person camera behind the player (or their car) and look ahead. */
function updateCamera(game, dt) {
  const input = game.input;
  const delta = input.takeMouseDelta();
  if (delta.x !== 0 || delta.y !== 0) {
    game.cameraYaw -= delta.x * 0.0032;
    game.cameraPitch = Math.max(-0.05, Math.min(0.85, game.cameraPitch + delta.y * 0.0022));
    game.lastMouseMoveAt = game.now;
  }
  const player = game.player;
  const driving = player.isDriving();
  const target = driving ? player.state.driving.mesh.position : player.state.position;
  if (driving && game.now - game.lastMouseMoveAt > 2.5) {
    const wantYaw = player.state.driving.heading + Math.PI;
    let diff = wantYaw - game.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    game.cameraYaw += diff * Math.min(1, dt * 1.6);
  }
  const distance = driving ? 11.5 : 8;
  const height = driving ? 2.6 : 2.1;
  const forward = new THREE.Vector3(-Math.sin(game.cameraYaw), 0, -Math.cos(game.cameraYaw));
  const cameraPos = new THREE.Vector3(target.x, height, target.z)
    .addScaledVector(forward, -distance * Math.cos(game.cameraPitch));
  cameraPos.y += Math.sin(game.cameraPitch) * distance;
  game.camera.position.copy(cameraPos);
  const lookAt = new THREE.Vector3(target.x, height - 0.4, target.z).addScaledVector(forward, 5);
  game.camera.lookAt(lookAt);
}

/** Fire the pistol at the centre of the screen. */
function fireWeapon(game) {
  const player = game.player;
  if (player.state.driving || player.state.ammo <= 0 && player.state.reloading <= 0) {
    if (player.state.ammo <= 0) player.reload();
    return;
  }
  const direction = new THREE.Vector3();
  game.camera.getWorldDirection(direction);
  const targetPoint = game.camera.position.clone().addScaledVector(direction, 60);
  const hit = player.shoot(targetPoint, {
    enemies: game.missions.enemies,
    peds: game.peds.peds,
    cars: game.traffic.cars,
  });
  const origin = player.state.position.clone();
  origin.y = 1.5;
  const end = hit ? hitPointOf(hit) : targetPoint;
  game.showTracer(origin, end);
  if (!hit) return;
  if (hit.kind === 'enemy') {
    game.missions.damageEnemy(hit.ref, WEAPON.damage);
  } else if (hit.kind === 'ped') {
    game.peds.knockDownAt(hit.ref.mesh.position.x, hit.ref.mesh.position.z, 2);
    game.wanted.addHeat(WANTED.shootPed, game.now);
    game.hud.toast('You shot a pedestrian! The cops are coming.');
  } else if (hit.kind === 'car') {
    game.wanted.addHeat(WANTED.hitTraffic, game.now);
  }
}

function hitPointOf(hit) {
  return new THREE.Vector3(hit.ref.mesh.position.x, hit.ref.mesh.position.y + 1.2, hit.ref.mesh.position.z);
}

/** One fixed world step: traffic, peds, police, missions, wanted, collisions. */
function stepWorld(game, dt) {
  const player = game.player;
  game.traffic.update(dt);
  game.peds.update(dt, player.state.position);
  game.missions.update(dt);
  const nearestPolice = game.police.nearestDistance(player.state.position);
  game.wanted.update(dt, game.now, nearestPolice);
  game.police.update(dt, player, game.now, {
    onBusted: () => bustPlayer(game),
    onRam: () => {
      if (game.now - (game.lastCrashAt || -99) > 1) {
        game.lastCrashAt = game.now;
        game.audio.crash();
      }
    },
  });
  checkCarCollisions(game);
  game.clockMinutes += dt * 0.5;
  game.fadeTracer(dt);
}

/** The player's car shoving traffic and running peds over. */
function checkCarCollisions(game) {
  const player = game.player;
  if (!player.isDriving()) return;
  const car = player.state.driving;
  const pos = car.mesh.position;
  for (const other of game.traffic.cars) {
    const dx = other.mesh.position.x - pos.x;
    const dz = other.mesh.position.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.6 && dist > 0.01) {
      car.speed *= 0.7;
      other.mesh.position.x += (dx / dist) * 1.2;
      other.mesh.position.z += (dz / dist) * 1.2;
      if (game.now - (game.lastTrafficHitAt || -99) > 1.5) {
        game.lastTrafficHitAt = game.now;
        game.wanted.addHeat(WANTED.hitTraffic, game.now);
        game.audio.crash();
        game.hud.toast('You hit a car!');
      }
    }
  }
  const hitPed = game.peds.knockDownAt(pos.x, pos.z, 2.6);
  if (hitPed) {
    game.wanted.addHeat(WANTED.hitPed, game.now);
    game.audio.crash();
    game.hud.toast('You ran over a pedestrian!');
  }
}

/** Caught on foot: lose a cut of the cash, cool the heat, wake up at Solmar PD. */
function bustPlayer(game) {
  const fine = Math.floor(game.cash * 0.2);
  game.cash -= fine;
  game.wanted.clear();
  game.police.clearAll();
  game.missions.abort('you got busted.');
  game.player.state.health = 50;
  game.player.teleport(0, 120, Math.PI);
  game.audio.busted();
  game.audio.setSiren(false);
  game.hud.toast(`Busted! You paid a $${fine} fine.`);
  game.hud.showSubtitle('Solmar PD: Walk it off. Next time, don\u2019t get caught.', 6);
}

/** Write the save to localStorage. */
function saveGame(game) {
  try {
    const player = game.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      health: player.state.health,
      completed: game.missions.completed,
      x: player.state.position.x,
      z: player.state.position.z,
      heading: player.state.heading,
      clockMinutes: game.clockMinutes,
    }));
  } catch {
    // Storage can be off: the game still plays, it just does not persist.
  }
}

/** Read the save, if one exists. */
function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applySave(game, save) {
  game.cash = save.cash || 250;
  game.player.state.health = save.health || 100;
  game.missions.completed = Math.min(save.completed || 0, MISSIONS.length);
  game.clockMinutes = save.clockMinutes || 0;
  if (save.x !== undefined) game.player.teleport(save.x, save.z, save.heading || 0);
  game.missions.setMarkerVisible(true);
}

function announce(message) {
  if (status) status.textContent = message;
}

/** The interactive game: screens, input, stepping, rendering. */
function runGame(game) {
  const input = game.input;
  const hud = game.hud;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  const save = loadSave();
  hud.showTitle(!!save);
  announce('Solmar Heat. Press Enter or click Start to play.');

  document.getElementById('btn-start').addEventListener('click', () => startPlaying(false));
  document.getElementById('btn-continue').addEventListener('click', () => startPlaying(true));
  document.getElementById('btn-resume').addEventListener('click', () => resumeGame());
  document.getElementById('btn-quit').addEventListener('click', () => quitToTitle());
  document.getElementById('btn-respawn').addEventListener('click', () => respawn(game));
  document.getElementById('btn-mute').addEventListener('click', () => {
    const muted = game.audio.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? 'Sound: Off' : 'Sound: On';
  });

  function startPlaying(continueSave) {
    game.audio.ensure();
    game.audio.click();
    if (continueSave && save) applySave(game, save);
    else {
      game.cash = 250;
      game.missions.completed = 0;
    }
    game.screen = 'play';
    hud.showPlay();
    hud.showSubtitle('Mara Voss: New in town? Come find me at Rosa\u2019s Diner — gold M on the map.', 7);
    announce('Playing. Follow the gold M to start your first mission.');
  }

  function resumeGame() {
    game.screen = 'play';
    hud.showPlay();
    announce('Playing.');
  }

  function quitToTitle() {
    saveGame(game);
    game.screen = 'title';
    game.audio.setSiren(false);
    game.audio.stopEngine();
    hud.showTitle(!!loadSave());
    announce('Solmar Heat. Press Enter or click Start to play.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'title') {
      // The title screen orbits the city slowly behind the menu.
      game.cameraYaw += frameDt * 0.03;
      const target = new THREE.Vector3(0, 6, 0);
      game.camera.position.set(Math.sin(game.cameraYaw) * 150, 55, Math.cos(game.cameraYaw) * 150);
      game.camera.lookAt(target);
      game.traffic.update(frameDt);
      game.peds.update(frameDt, null);
      game.renderer.render(game.scene, game.camera);
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) startPlaying(false);
      return;
    }
    if (game.screen === 'dead') {
      game.renderer.render(game.scene, game.camera);
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) respawn(game);
      return;
    }
    if (game.screen === 'pause') {
      game.renderer.render(game.scene, game.camera);
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) resumeGame();
      return;
    }
    // Playing. Note: takeActions() clears the pressed set, so pause is read with
    // wasPressed() here — otherwise it would eat the Space press the jump uses.
    if (input.wasPressed('KeyR') || input.wasPressed('KeyF')) game.player.reload();
    if (input.wasPressed('KeyM')) game.audio.toggleMute();
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      game.screen = 'pause';
      hud.showPause();
      saveGame(game);
      announce('Paused.');
      return;
    }
    if (input.takeShoot() || input.isMouseDown()) {
      if (game.now - (game.lastShotAt || -99) >= WEAPON.fireInterval) {
        game.lastShotAt = game.now;
        fireWeapon(game);
      }
    }
    accumulator += frameDt;
    while (accumulator >= STEP) {
      game.now += STEP;
      const event = game.player.update(STEP, game.cameraYaw, [...game.parkedCars, ...game.traffic.cars], {
        onEnterCar: (car) => {
          if (!car.takenBefore) {
            car.takenBefore = true;
            game.wanted.addHeat(WANTED.stealCar, game.now);
            hud.toast('Car stolen! The cops are on their way.');
            game.peds.scareNear(car.mesh.position.x, car.mesh.position.z, 20);
          }
        },
        onInteractEmpty: () => {
          const markerPos = { x: -100, z: -66 };
          const dx = game.player.state.position.x - markerPos.x;
          const dz = game.player.state.position.z - markerPos.z;
          if (dx * dx + dz * dz < 49 && !game.missions.active) {
            game.missions.startNextMission();
          }
        },
        onCrash: () => {
          game.audio.crash();
        },
      });
      if (event === 'enterCar' || event === 'exitCar') {
        // Keep the camera behind the new state.
      }
      stepWorld(game, STEP);
      accumulator -= STEP;
      if (game.player.state.health <= 0 && game.screen === 'play') {
        game.onPlayerDown();
        break;
      }
    }
    saveTimer += frameDt;
    if (saveTimer > 10) {
      saveTimer = 0;
      saveGame(game);
    }
    updateCamera(game, frameDt);
    hud.update(game, frameDt);
    game.renderer.render(game.scene, game.camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'pause';
      hud.showPause();
      saveGame(game);
    }
  });

  requestAnimationFrame(frame);
}

/** Waking up after being taken down: health back, a smaller wallet, back on the street. */
function respawn(game) {
  const fine = 100;
  game.cash = Math.max(0, game.cash - fine);
  game.missions.abort('you were taken down.');
  game.player.state.health = 100;
  game.player.teleport(0, 120, Math.PI);
  game.wanted.clear();
  game.police.clearAll();
  game.screen = 'play';
  game.hud.showPlay();
  game.hud.toast(`You woke up at Solmar General — $${fine} hospital bill.`);
}

/** Screenshot mode: stage the scene, run the world a few seconds, render, signal ready. */
function runShot(game, name) {
  try {
    const pose = stageShot(name, game);
    game.camera.position.copy(pose.position);
    game.camera.lookAt(pose.lookAt);
    // Let traffic, peds and police move so the frame is alive, not frozen at spawn.
    for (let i = 0; i < 180; i += 1) {
      game.now += STEP;
      game.traffic.update(STEP);
      game.peds.update(STEP, game.player.state.position);
      if (name === 'chase') {
        // The player's car stays framed; only the police close in on it.
        game.police.update(STEP, game.player, game.now, {});
      }
      if (name === 'mission' || name === 'play') game.missions.update(STEP);
      game.fadeTracer(STEP);
    }
    game.camera.position.copy(pose.position);
    game.camera.lookAt(pose.lookAt);
    game.hud.update(game, 0.016);
    let painted = 0;
    function paint() {
      game.renderer.render(game.scene, game.camera);
      painted += 1;
      if (painted < 4) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
  } catch (error) {
    window.__shotError = String(error && error.message ? error.message : error);
  }
}

let game;
try {
  game = buildGame();
  if (shot) runShot(game, shot);
  else runGame(game);
} catch (error) {
  window.__shotError = String(error && error.message ? error.message : error);
  if (status) status.textContent = `Solmar Heat failed to start: ${window.__shotError}`;
}
