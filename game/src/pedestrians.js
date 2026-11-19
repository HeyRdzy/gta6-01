// Pedestrians: Solmar Bay locals strolling the sidewalks. They wander the street grid,
// scatter when a car comes at them or a gun goes off, and go down (then get back up)
// when hit. Hitting one is a crime, so they matter to the wanted system.

import * as THREE from 'three';
import { CITY, PEDS, PALETTE } from './config.js';
import { randomPick } from './random.js';
import { randomStreetPoint } from './city.js';

/** A simple person: capsule body, head, and legs that swing while walking. */
export function makePedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 10),
    new THREE.MeshLambertMaterial({ color: skinColor }),
  );
  head.position.y = 1.78;
  group.add(head);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2b3440 });
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), legMaterial);
  leftLeg.position.set(-0.14, 0.3, 0);
  leftLeg.name = 'legL';
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), legMaterial);
  rightLeg.position.set(0.14, 0.3, 0);
  rightLeg.name = 'legR';
  group.add(rightLeg);
  return group;
}

/** Manage the crowd: spawn, wander, flee, fall down and get back up. */
export function createPedestrianManager(game) {
  const peds = [];
  const { scene, random, city } = game;
  const skins = [0xe8b88a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];

  function spawnPed() {
    const point = randomStreetPoint(random, city.colliders);
    const horizontal = random() < 0.5;
    const mesh = makePedMesh(randomPick(random, PALETTE.pedShirt), randomPick(random, skins));
    mesh.position.set(point.x, 0, point.z);
    scene.add(mesh);
    const ped = {
      mesh,
      horizontal,
      dir: random() < 0.5 ? 1 : -1,
      speed: PEDS.speedMin + random() * (PEDS.speedMax - PEDS.speedMin),
      state: 'walk',
      downTimer: 0,
      walkPhase: random() * Math.PI * 2,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < PEDS.count; i += 1) spawnPed();

  return {
    peds,

    /** Knock a ped down at a position; returns the ped hit, if any. */
    knockDownAt(x, z, radius) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const dx = ped.mesh.position.x - x;
        const dz = ped.mesh.position.z - z;
        if (dx * dx + dz * dz < radius * radius) {
          ped.state = 'down';
          ped.downTimer = 2.5;
          ped.mesh.rotation.x = Math.PI / 2;
          ped.mesh.position.y = 0.35;
          return ped;
        }
      }
      return null;
    },

    /** Make every ped near (x, z) run away from it. */
    scareNear(x, z, radius) {
      for (const ped of peds) {
        if (ped.state !== 'walk') continue;
        const dx = ped.mesh.position.x - x;
        const dz = ped.mesh.position.z - z;
        if (dx * dx + dz * dz < radius * radius) {
          ped.state = 'flee';
          ped.fleeX = x;
          ped.fleeZ = z;
          ped.fleeTimer = 3;
        }
      }
    },

    /** Step the crowd: walk the sidewalks, flee danger, recover from falls. */
    update(dt, playerPos) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.state = 'walk';
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
          }
          continue;
        }
        let speed = ped.speed;
        let headingX = 0;
        let headingZ = 0;
        if (ped.state === 'flee') {
          ped.fleeTimer -= dt;
          const dx = ped.mesh.position.x - ped.fleeX;
          const dz = ped.mesh.position.z - ped.fleeZ;
          const dist = Math.max(0.1, Math.hypot(dx, dz));
          headingX = dx / dist;
          headingZ = dz / dist;
          speed = 5;
          if (ped.fleeTimer <= 0) ped.state = 'walk';
        } else {
          if (ped.horizontal) headingX = ped.dir;
          else headingZ = ped.dir;
          // A car bearing down on the sidewalk makes peds step aside.
          if (playerPos) {
            const dx = ped.mesh.position.x - playerPos.x;
            const dz = ped.mesh.position.z - playerPos.z;
            if (dx * dx + dz * dz < 9) {
              ped.state = 'flee';
              ped.fleeX = playerPos.x;
              ped.fleeZ = playerPos.z;
              ped.fleeTimer = 2;
            }
          }
        }
        ped.mesh.position.x += headingX * speed * dt;
        ped.mesh.position.z += headingZ * speed * dt;
        if (Math.abs(ped.mesh.position.x) > 145 || Math.abs(ped.mesh.position.z) > 145) {
          ped.dir *= -1;
          ped.mesh.position.x = Math.max(-144, Math.min(144, ped.mesh.position.x));
          ped.mesh.position.z = Math.max(-144, Math.min(144, ped.mesh.position.z));
        }
        if (headingX !== 0 || headingZ !== 0) {
          ped.mesh.rotation.y = Math.atan2(headingX, headingZ);
        }
        ped.walkPhase += dt * speed * 3;
        const swing = Math.sin(ped.walkPhase) * 0.45;
        const legL = ped.mesh.getObjectByName('legL');
        const legR = ped.mesh.getObjectByName('legR');
        if (legL) legL.rotation.x = swing;
        if (legR) legR.rotation.x = -swing;
      }
    },
  };
}
