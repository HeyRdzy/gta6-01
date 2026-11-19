// Cars: the mesh factory, street traffic with simple lane AI, and parked cars the
// player can steal. Traffic drives the grid, slows for the car ahead, and turns
// around at the city edge instead of driving into the sea.

import * as THREE from 'three';
import { CITY, CAR, TRAFFIC, PALETTE } from './config.js';
import { randomPick, randomInt } from './random.js';
import { randomStreetPoint } from './city.js';

/** Build a low-poly car: body, cabin, wheels and headlights. Police cars get a light bar. */
export function makeCarMesh(color, options) {
  const opts = options || {};
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMaterial);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const lx of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMaterial);
    light.position.set(lx, 0.6, 2.22);
    group.add(light);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.55, -0.2);
    bar.name = 'lightBar';
    group.add(bar);
    const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barRed.position.set(-0.6, 1.55, -0.2);
    group.add(barRed);
    const text = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    text.position.set(0, 0.75, 2.21);
    group.add(text);
  }
  group.userData.wheels = wheels;
  return group;
}

/** Arcade car state shared by the player's car, traffic and police. */
export function createCarState(mesh, color) {
  return {
    mesh,
    color,
    speed: 0,
    heading: 0,
    steering: 0,
    taken: false,
    driver: null,
  };
}

/**
 * Traffic manager: cars cruise the street lanes, brake for the car ahead, and
 * U-turn at the city edge. `onPedHit` is called when a traffic car runs a ped over.
 */
export function createTrafficManager(game) {
  const cars = [];
  const { scene, random, city } = game;

  function spawnTrafficCar() {
    const point = randomStreetPoint(random, city.colliders);
    const horizontal = random() < 0.5;
    const dir = random() < 0.5 ? 1 : -1;
    const street = horizontal
      ? CITY.streets.reduce((best, s) => (Math.abs(s - point.z) < Math.abs(best - point.z) ? s : best), CITY.streets[0])
      : CITY.streets.reduce((best, s) => (Math.abs(s - point.x) < Math.abs(best - point.x) ? s : best), CITY.streets[0]);
    const lane = (random() < 0.5 ? -3.5 : 3.5) * dir;
    const mesh = makeCarMesh(randomPick(random, PALETTE.car));
    const x = horizontal ? point.x : street + lane;
    const z = horizontal ? street + lane : point.z;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    scene.add(mesh);
    const car = createCarState(mesh, 0);
    car.horizontal = horizontal;
    car.dir = dir;
    car.street = street;
    car.lane = lane;
    car.speed = TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin);
    car.cruise = car.speed;
    cars.push(car);
    return car;
  }

  for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();

  function carAhead(car) {
    let nearest = null;
    let nearestDist = 14;
    for (const other of cars) {
      if (other === car || other.horizontal !== car.horizontal) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const along = car.horizontal ? dx * car.dir : dz * car.dir;
      const side = car.horizontal ? Math.abs(dz) : Math.abs(dx);
      if (along > 0 && along < nearestDist && side < 3) {
        nearest = other;
        nearestDist = along;
      }
    }
    return nearest;
  }

  return {
    cars,
    /** Step every traffic car one frame. */
    update(dt) {
      for (const car of cars) {
        // A stolen car belongs to its new driver now, not to the traffic flow.
        if (car.taken) continue;
        const ahead = carAhead(car);
        car.speed = ahead ? Math.max(0, Math.min(car.cruise, ahead.speed * 0.7)) : car.cruise;
        const step = car.speed * car.dir * dt;
        if (car.horizontal) car.mesh.position.x += step;
        else car.mesh.position.z += step;
        const pos = car.mesh.position;
        if (pos.x > 142 || pos.x < -142 || pos.z > 142 || pos.z < -142) {
          car.dir *= -1;
          car.mesh.rotation.y += Math.PI;
          if (car.horizontal) car.mesh.position.x = Math.max(-140, Math.min(140, pos.x));
          else car.mesh.position.z = Math.max(-140, Math.min(140, pos.z));
        }
        for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
      }
    },
  };
}

/** Parked cars along the kerb. Stealing one (E) is a crime; driving it is free. */
export function createParkedCars(game) {
  const parked = [];
  const { scene, random, city } = game;
  for (const spot of city.parkingSpots) {
    const color = randomPick(random, PALETTE.car);
    const mesh = makeCarMesh(color);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    const car = createCarState(mesh, color);
    car.heading = spot.heading;
    car.parked = true;
    parked.push(car);
  }
  return parked;
}

/** Drive a car one step: arcade acceleration, steering and building collision. */
export function driveCar(car, move, dt, colliders, onCrash) {
  const forward = move.y;
  const steer = move.x;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed = car.speed > 0.5 ? car.speed - CAR.brake * dt : car.speed - CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.drag * 6 * dt;
    if (Math.abs(car.speed) < 0.4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.5) {
    car.heading += steer * CAR.steerRate * dt * Math.sign(car.speed) * (car.speed > 0 ? 1 : -1) * -1;
  }
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.x += dx;
  car.mesh.position.z += dz;
  car.mesh.rotation.y = car.heading;
  car.mesh.position.x = Math.max(-196, Math.min(150, car.mesh.position.x));
  car.mesh.position.z = Math.max(-150, Math.min(150, car.mesh.position.z));
  const beforeX = car.mesh.position.x - dx;
  const beforeZ = car.mesh.position.z - dz;
  car.mesh.position.x = beforeX + dx;
  car.mesh.position.z = beforeZ + dz;
  const hit = resolveCarCollision(car, colliders);
  if (hit && Math.abs(car.speed) > 8 && onCrash) onCrash(Math.abs(car.speed));
  if (hit) car.speed *= 0.45;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
  return hit;
}

function resolveCarCollision(car, colliders) {
  const pos = car.mesh.position;
  const before = { x: pos.x, z: pos.z };
  const hit = (() => {
    let collided = false;
    for (let i = 0; i < colliders.length; i += 1) {
      const box = colliders[i];
      const nearestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const nearestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - nearestX;
      const dz = pos.z - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < CAR.radius * CAR.radius) {
        collided = true;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          pos.x = nearestX + (dx / dist) * CAR.radius;
          pos.z = nearestZ + (dz / dist) * CAR.radius;
        } else {
          pos.x = box.maxX + CAR.radius;
        }
      }
    }
    return collided;
  })();
  return hit;
}

/** Random car colour index helper for the HUD speedometer. */
export function randomCarColor(random) {
  return randomPick(random, PALETTE.car);
}
