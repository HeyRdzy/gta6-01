// The player: on foot with WASD, run and jump, and behind the wheel with arcade
// driving. Entering and leaving cars, and the pistol, live here too.

import * as THREE from 'three';
import { PLAYER, CAR, WEAPON } from './config.js';
import { resolveBuildingCollision } from './city.js';
import { makePedMesh } from './pedestrians.js';
import { driveCar } from './vehicles.js';

/** The hero: a sun-yellow jacket so they read clearly in every screenshot. */
export function makePlayerMesh() {
  const mesh = makePedMesh(0xffc23b, 0xe8b88a);
  mesh.scale.setScalar(1.08);
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.2, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffc23b }),
  );
  jacket.position.y = 1.35;
  mesh.add(jacket);
  return mesh;
}

/**
 * Drive the player. `game` carries the scene, colliders, parked cars, traffic and
 * the wanted system; `input` is the keyboard/mouse state; `audio` is the synth bank.
 */
export function createPlayer(game, input, audio) {
  const { scene, city } = game;
  const mesh = makePlayerMesh();
  scene.add(mesh);
  const state = {
    mesh,
    position: new THREE.Vector3(0, 0, 100),
    velocityY: 0,
    onGround: true,
    heading: Math.PI,
    health: PLAYER.maxHealth,
    driving: null,
    ammo: WEAPON.magazine,
    reloading: 0,
    fireCooldown: 0,
    lastDamageAt: -99,
    speed: 0,
  };
  mesh.position.copy(state.position);

  /** Put the player at a place, on foot, facing a heading. */
  function teleport(x, z, heading) {
    state.position.set(x, 0, z);
    state.heading = heading === undefined ? state.heading : heading;
    state.velocityY = 0;
    state.onGround = true;
    state.driving = null;
    mesh.position.copy(state.position);
    mesh.rotation.y = state.heading;
    mesh.visible = true;
  }

  /** The nearest stealable car within reach, or null. */
  function nearestCar(cars, maxDistance) {
    let best = null;
    let bestDist = maxDistance;
    for (const car of cars) {
      const dx = car.mesh.position.x - state.position.x;
      const dz = car.mesh.position.z - state.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        best = car;
        bestDist = dist;
      }
    }
    return best;
  }

  /** Step on foot: camera-relative WASD, Shift to run, Space to jump. */
  function stepOnFoot(dt, cameraYaw) {
    const move = input.moveVector();
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const forwardX = -sin;
    const forwardZ = -cos;
    const rightX = cos;
    const rightZ = -sin;
    let dx = (forwardX * move.y + rightX * move.x) * speed * dt;
    let dz = (forwardZ * move.y + rightZ * move.x) * speed * dt;
    if (dx !== 0 || dz !== 0) {
      state.heading = Math.atan2(dx, dz);
      state.speed = speed;
    } else {
      state.speed = 0;
    }
    state.position.x += dx;
    state.position.z += dz;
    state.position.x = Math.max(-195, Math.min(150, state.position.x));
    state.position.z = Math.max(-150, Math.min(150, state.position.z));
    resolveBuildingCollision(state.position, PLAYER.radius, city.colliders);
    if (input.wasPressed('Space') && state.onGround) {
      state.velocityY = PLAYER.jumpSpeed;
      state.onGround = false;
    }
    if (!state.onGround) {
      state.velocityY -= PLAYER.gravity * dt;
      state.position.y += state.velocityY * dt;
      if (state.position.y <= 0) {
        state.position.y = 0;
        state.velocityY = 0;
        state.onGround = true;
      }
    }
    mesh.position.copy(state.position);
    mesh.rotation.y = state.heading;
    const walkPhase = performance.now() / 90;
    const legL = mesh.getObjectByName('legL');
    const legR = mesh.getObjectByName('legR');
    const swing = state.speed > 0 ? Math.sin(walkPhase) * 0.5 : 0;
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }

  return {
    state,
    mesh,
    teleport,
    nearestCar,

    /** True while the player is behind a wheel. */
    isDriving() {
      return state.driving !== null;
    },

    /** Step the player one frame; returns an event string ('enterCar', 'exitCar') or ''. */
    update(dt, cameraYaw, cars, callbacks) {
      state.fireCooldown = Math.max(0, state.fireCooldown - dt);
      if (state.reloading > 0) {
        state.reloading -= dt;
        if (state.reloading <= 0) {
          state.ammo = WEAPON.magazine;
          state.reloading = 0;
        }
      }
      if (state.driving) {
        const car = state.driving;
        const move = input.moveVector();
        const hit = driveCar(car, move, dt, city.colliders, callbacks.onCrash);
        state.position.copy(car.mesh.position);
        state.speed = Math.abs(car.speed);
        audio.setEngineSpeed(Math.abs(car.speed) / CAR.maxSpeed, true);
        if (input.wasPressed('KeyE')) {
          const exitX = car.mesh.position.x + Math.sin(car.heading + Math.PI / 2) * 3;
          const exitZ = car.mesh.position.z + Math.cos(car.heading + Math.PI / 2) * 3;
          state.driving = null;
          state.position.set(exitX, 0, exitZ);
          mesh.position.copy(state.position);
          mesh.visible = true;
          audio.setEngineSpeed(0, false);
          return 'exitCar';
        }
        return '';
      }
      stepOnFoot(dt, cameraYaw);
      if (input.wasPressed('KeyE')) {
        const car = nearestCar(cars, 4.5);
        if (car) {
          state.driving = car;
          car.taken = true;
          mesh.visible = false;
          audio.startEngine();
          if (callbacks.onEnterCar) callbacks.onEnterCar(car);
          return 'enterCar';
        }
        if (callbacks.onInteractEmpty) callbacks.onInteractEmpty();
      }
      return '';
    },

    /** Fire the pistol toward `targetPoint`; returns the hit (enemy/ped/car) or null. */
    shoot(targetPoint, targets) {
      if (state.driving || state.fireCooldown > 0 || state.reloading > 0 || state.ammo <= 0) return null;
      state.fireCooldown = WEAPON.fireInterval;
      state.ammo -= 1;
      if (state.ammo === 0) {
        state.reloading = WEAPON.reloadSeconds;
      }
      audio.gunshot();
      const origin = state.position.clone();
      origin.y = 1.5;
      const direction = targetPoint.clone().sub(origin).normalize();
      let best = null;
      let bestDist = WEAPON.range;
      function testPoint(x, y, z, ref) {
        const dx = x - origin.x;
        const dy = y - origin.y;
        const dz = z - origin.z;
        const along = dx * direction.x + dy * direction.y + dz * direction.z;
        if (along < 0 || along > bestDist) return;
        const px = origin.x + direction.x * along;
        const py = origin.y + direction.y * along;
        const pz = origin.z + direction.z * along;
        const miss = Math.hypot(x - px, y - py, z - pz);
        if (miss < 1.4) {
          best = ref;
          bestDist = along;
        }
      }
      for (const enemy of targets.enemies || []) {
        if (enemy.health > 0) testPoint(enemy.mesh.position.x, enemy.mesh.position.y + 1.2, enemy.mesh.position.z, { kind: 'enemy', ref: enemy });
      }
      for (const ped of targets.peds || []) {
        if (ped.state !== 'down') testPoint(ped.mesh.position.x, ped.mesh.position.y + 1.1, ped.mesh.position.z, { kind: 'ped', ref: ped });
      }
      for (const car of targets.cars || []) {
        testPoint(car.mesh.position.x, car.mesh.position.y + 0.8, car.mesh.position.z, { kind: 'car', ref: car });
      }
      return best;
    },

    reload() {
      if (state.ammo < WEAPON.magazine && state.reloading <= 0) {
        state.reloading = WEAPON.reloadSeconds;
        audio.click();
      }
    },

    /** Hurt the player; returns true when health reaches zero. */
    damage(amount, now) {
      if (now - state.lastDamageAt < 0.4) return false;
      state.lastDamageAt = now;
      state.health = Math.max(0, state.health - amount);
      return state.health <= 0;
    },

    heal(amount) {
      state.health = Math.min(PLAYER.maxHealth, state.health + amount);
    },
  };
}
