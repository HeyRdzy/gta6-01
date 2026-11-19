// The wanted system and the Solmar PD. Crime raises heat; heat becomes stars; stars
// bring police cars that chase and ram. Stay out of sight and the heat cools off —
// or get caught on foot and it is a night in the cells.

import * as THREE from 'three';
import { POLICE, WANTED, CAR } from './config.js';
import { makeCarMesh, createCarState } from './vehicles.js';
import { randomStreetPoint } from './city.js';

/** Wanted heat: addHeat on crime, stars() for the HUD, update() cools it off. */
export function createWantedSystem(game) {
  const wanted = {
    heat: 0,
    lastCrimeAt: -999,
    quietTimer: 0,
  };
  return {
    get heat() {
      return wanted.heat;
    },
    stars() {
      if (wanted.heat <= 0) return 0;
      return Math.min(5, Math.ceil(wanted.heat / 20));
    },
    addHeat(amount, now) {
      wanted.heat = Math.min(100, wanted.heat + amount);
      wanted.lastCrimeAt = now;
      return wanted.heat;
    },
    clear() {
      wanted.heat = 0;
      wanted.lastCrimeAt = -999;
    },
    /** Cool the heat when the player has been quiet and no cop is close. */
    update(dt, now, nearestPoliceDistance) {
      if (wanted.heat <= 0) return;
      if (now - wanted.lastCrimeAt > WANTED.quietSeconds && nearestPoliceDistance > 50) {
        wanted.heat = Math.max(0, wanted.heat - WANTED.decayPerSecond * dt);
      }
    },
  };
}

/**
 * Police cars: spawned at the street edge, they steer at the player, ram the player's
 * car, and bust the player on foot. `callbacks.onBusted` fires when the bust lands.
 */
export function createPoliceManager(game, wanted) {
  const cars = [];
  const { scene, random, city } = game;
  let bustTimer = 0;
  let sirenOn = false;

  function spawnPoliceCar(playerPos) {
    const point = randomStreetPoint(random, city.colliders);
    const mesh = makeCarMesh(0x1c2733, { police: true });
    // White doors read as a police car even at a distance.
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    door.position.set(0, 0.55, 0);
    mesh.add(door);
    mesh.position.set(point.x, 0, point.z);
    scene.add(mesh);
    const car = createCarState(mesh, 0x1c2733);
    car.police = true;
    car.speed = 0;
    cars.push(car);
    return car;
  }

  function removePoliceCar(car) {
    scene.remove(car.mesh);
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
  }

  return {
    cars,

    /** How many police cars the current stars demand. */
    wantedCount() {
      const stars = wanted.stars();
      return stars === 0 ? 0 : Math.min(POLICE.maxCars, stars);
    },

    nearestDistance(playerPos) {
      let best = Infinity;
      for (const car of cars) {
        const dist = Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z);
        if (dist < best) best = dist;
      }
      return best;
    },

    /** Step the chase: spawn, steer, ram, and the on-foot bust timer. */
    update(dt, player, now, callbacks) {
      const want = this.wantedCount();
      while (cars.length < want) spawnPoliceCar(player.state.position);
      while (cars.length > want) removePoliceCar(cars[cars.length - 1]);
      const shouldSiren = cars.length > 0;
      if (shouldSiren !== sirenOn) {
        sirenOn = shouldSiren;
        game.audio.setSiren(sirenOn);
      }
      const playerPos = player.state.position;
      let busted = false;
      for (const car of cars) {
        const dx = playerPos.x - car.mesh.position.x;
        const dz = playerPos.z - car.mesh.position.z;
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        car.speed = Math.min(POLICE.chaseSpeed, car.speed + 14 * dt);
        car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
        car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
        car.mesh.rotation.y = car.heading;
        const bar = car.mesh.getObjectByName('lightBar');
        if (bar) bar.material.color.setHex(Math.floor(now * 4) % 2 === 0 ? 0xff2222 : 0x2244ff);
        for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
        // Ram: shove the player's car and slow it.
        if (player.isDriving() && dist < POLICE.ramDistance) {
          const playerCar = player.state.driving;
          playerCar.mesh.position.x += (dx / dist) * 6 * dt * 10 * 0.3;
          playerCar.mesh.position.z += (dz / dist) * 6 * dt * 10 * 0.3;
          playerCar.speed *= 0.985;
          if (callbacks.onRam) callbacks.onRam();
        }
        // Bust: a cop standing next to the player on foot, for long enough.
        if (!player.isDriving() && dist < POLICE.bustDistance) {
          bustTimer += dt;
          if (bustTimer >= POLICE.bustSeconds) {
            busted = true;
            bustTimer = 0;
          }
        }
      }
      if (cars.length === 0 || this.nearestDistance(playerPos) > POLICE.bustDistance) bustTimer = 0;
      if (busted && callbacks.onBusted) callbacks.onBusted();
      return busted;
    },

    /** Clear every police car (after a bust, a mission reset, or a load). */
    clearAll() {
      while (cars.length > 0) removePoliceCar(cars[cars.length - 1]);
      bustTimer = 0;
    },
  };
}
