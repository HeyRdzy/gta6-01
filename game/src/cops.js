// Solmar PD: cruisers that chase the wanted player, flash their light bars
// and, at three stars and up, throw up striped roadblocks ahead of the escape.

import * as THREE from 'three';
import { makeCarBody } from './traffic.js';
import { basicMat, stdMat, unitBox, unitCylinder } from './visuals.js';
import { angleLerp, clamp, dist2d } from './util.js';

export function createCops(scene, world, hero, state, display) {
  const cruisers = [];
  const roadblocks = [];
  let spawnTimer = 0;

  const barrierMat = stdMat('barrier', () => new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.7 }));
  const stripeMat = stdMat('barstripe', () => new THREE.MeshStandardMaterial({ color: 0xc22a1e, roughness: 0.7 }));

  function makeCruiser() {
    const parts = makeCarBody(0x1a1a22, { police: true });
    parts.group.position.set(hero.x + 40, 0, hero.z + 40);
    scene.add(parts.group);
    return {
      mesh: parts.group,
      parts,
      heading: 0,
      speed: 0,
      stuck: 0,
      lastX: parts.group.position.x,
      lastZ: parts.group.position.z,
    };
  }

  function makeRoadblock(x, z, heading) {
    const g = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(unitBox(), i % 2 ? stripeMat : barrierMat);
      bar.scale.set(2.4, 0.5, 0.3);
      bar.position.set(i * 2.5, 0.9, 0);
      bar.castShadow = true;
      g.add(bar);
    }
    for (const s of [-3.6, 3.6]) {
      const leg = new THREE.Mesh(unitBox(), barrierMat);
      leg.scale.set(0.3, 0.9, 0.3);
      leg.position.set(s, 0.45, 0);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    return { group: g, x, z };
  }

  function desiredCount() {
    if (state.wanted <= 0) return 0;
    if (state.wanted < 3) return 1 + Math.floor(state.wanted / 2);
    return 3;
  }

  return {
    cruisers,
    roadblocks,
    update(dt, timeSec) {
      // Spawn and despawn cruisers to match the wanted level.
      const want = desiredCount();
      spawnTimer -= dt;
      if (cruisers.length < want && spawnTimer <= 0) {
        spawnTimer = 1.2;
        const c = makeCruiser();
        const a = Math.random() * Math.PI * 2;
        c.mesh.position.set(hero.x + Math.sin(a) * 42, 0, hero.z + Math.cos(a) * 42);
        cruisers.push(c);
      }
      if (cruisers.length > want) {
        const c = cruisers.pop();
        scene.remove(c.mesh);
      }
      // Roadblocks only at three stars and up.
      if (state.wanted >= 3 && roadblocks.length < 2) {
        const a = hero.heading;
        const bx = Math.round((hero.x + Math.sin(a) * 34) / 30) * 30;
        const bz = Math.round((hero.z + Math.cos(a) * 34) / 30) * 30;
        if (dist2d(bx, bz, hero.x, hero.z) > 18) roadblocks.push(makeRoadblock(bx, bz, a));
      }
      if (state.wanted < 3) {
        for (const rb of roadblocks) scene.remove(rb.group);
        roadblocks.length = 0;
      }

      const flash = Math.floor(timeSec * 5) % 2 === 0;
      for (const c of cruisers) {
        // Steer toward the hero, with a capped turn rate.
        const dx = hero.x - c.mesh.position.x;
        const dz = hero.z - c.mesh.position.z;
        const d = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        c.heading = angleLerp(c.heading, wantHeading, 1 - Math.exp(-1.6 * dt));
        const targetSpeed = clamp(9 + state.wanted * 3.2, 12, 24);
        c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.2);
        c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
        c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
        c.mesh.rotation.y = c.heading;
        const spin = (c.speed * dt) / 0.36;
        for (const w of c.parts.wheels) w.wheel.rotation.x += spin;
        // Flashing light bar.
        c.parts.bar.redLens.material.emissiveIntensity = flash ? 3.2 : 0.15;
        c.parts.bar.blueLens.material.emissiveIntensity = flash ? 0.15 : 3.2;
        c.parts.bar.halo.material.color.setHex(flash ? 0xff3040 : 0x3050ff);
        c.parts.bar.halo.material.opacity = 0.55;
        // Ram the player on contact.
        if (d < 3.4) {
          if (hero.driving) {
            hero.damage(4, 'ram');
            hero.speed *= 0.55;
            c.speed *= 0.5;
          } else {
            hero.damage(6, 'ram');
          }
          c.mesh.position.x -= Math.sin(c.heading) * 1.2;
          c.mesh.position.z -= Math.cos(c.heading) * 1.2;
        }
        // Stuck cruisers teleport back into the chase.
        const moved = dist2d(c.mesh.position.x, c.mesh.position.z, c.lastX, c.lastZ);
        if (moved < 0.2) c.stuck += dt;
        else c.stuck = 0;
        c.lastX = c.mesh.position.x;
        c.lastZ = c.mesh.position.z;
        if (c.stuck > 4) {
          const a = Math.random() * Math.PI * 2;
          c.mesh.position.set(hero.x + Math.sin(a) * 38, 0, hero.z + Math.cos(a) * 38);
          c.stuck = 0;
        }
      }

      // Roadblocks stop the car cold.
      for (const rb of roadblocks) {
        if (hero.driving && dist2d(hero.x, hero.z, rb.x, rb.z) < 3) {
          hero.damage(10, 'roadblock');
          hero.speed *= -0.3;
          display.toast('Roadblock! Find another way around');
        }
      }
    },
  };
}
