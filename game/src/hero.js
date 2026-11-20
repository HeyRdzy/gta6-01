// Rio Calder: on-foot movement with smoothed acceleration, and driving with
// steering, drift, damage and smoke. One object owns both modes so the camera
// and the HUD never have to care which one is active.

import * as THREE from 'three';
import { glowTexture, stdMat, unitBox, unitCylinder, unitSphere } from './visuals.js';
import { angleDiff, angleLerp, clamp, damp, dist2d, mulberry32, range } from './util.js';

function buildRio() {
  const group = new THREE.Group();
  const jacket = stdMat('riojacket', () => new THREE.MeshStandardMaterial({ color: 0x2a7a8a, roughness: 0.8 }));
  const pants = stdMat('riopants', () => new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.9 }));
  const skin = stdMat('rioskin', () => new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }));
  const capM = stdMat('riocap', () => new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.7 }));

  const torso = new THREE.Mesh(unitBox(), jacket);
  torso.scale.set(0.58, 0.74, 0.34);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(unitSphere(10, 8), skin);
  head.scale.setScalar(0.22);
  head.position.y = 1.76;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(unitCylinder(10), capM);
  cap.scale.set(0.24, 0.1, 0.24);
  cap.position.y = 1.93;
  group.add(cap);
  const brim = new THREE.Mesh(unitBox(), capM);
  brim.scale.set(0.3, 0.04, 0.22);
  brim.position.set(0, 1.9, 0.24);
  group.add(brim);

  const limbs = {};
  const mk = (mat, w, len, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const seg = new THREE.Mesh(unitBox(), mat);
    seg.scale.set(w, len, w);
    seg.position.y = -len / 2;
    seg.castShadow = true;
    pivot.add(seg);
    group.add(pivot);
    return pivot;
  };
  limbs.armL = mk(skin, 0.17, 0.64, -0.38, 1.52);
  limbs.armR = mk(skin, 0.17, 0.64, 0.38, 1.52);
  limbs.legL = mk(pants, 0.21, 0.74, -0.16, 0.84);
  limbs.legR = mk(pants, 0.21, 0.74, 0.16, 0.84);
  return { group, limbs };
}

export function createHero(scene, world, traffic, state, display) {
  const rio = buildRio();
  scene.add(rio.group);

  const smokeTex = glowTexture();
  const smokePool = [];
  for (let i = 0; i < 10; i++) {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: smokeTex, color: 0x555555, transparent: true, opacity: 0, depthWrite: false })
    );
    spr.scale.set(1, 1, 1);
    scene.add(spr);
    smokePool.push({ spr, life: 0, max: 1 });
  }
  let smokeIdx = 0;
  let smokeTimer = 0;

  const hero = {
    x: 0,
    z: 90,
    y: 0,
    vy: 0,
    heading: Math.PI, // facing north (-z) at spawn
    walkPhase: 0,
    moveSpeed: 0,
    driving: false,
    car: null,
    speed: 0,
    steer: 0,
    carHealth: 100,
    mesh: rio.group,
    limbs: rio.limbs,
    roll: 0,

    teleport(nx, nz, angle = 0) {
      hero.x = nx;
      hero.z = nz;
      hero.heading = angle;
      hero.y = 0;
      hero.vy = 0;
      if (hero.car) {
        hero.car.mesh.position.set(nx, 0, nz);
        hero.car.heading = angle;
        hero.car.mesh.rotation.y = angle;
      }
      rio.group.position.set(nx, 0, nz);
      rio.group.rotation.y = angle;
    },

    headPos(out) {
      if (hero.car) {
        out.set(hero.car.mesh.position.x, 1.9, hero.car.mesh.position.z);
      } else {
        out.set(hero.x, hero.y + 1.7, hero.z);
      }
      return out;
    },

    enterCar() {
      if (hero.driving) return false;
      const car = traffic.nearestCar(hero.x, hero.z, 4.5);
      if (!car) return false;
      hero.driving = true;
      hero.car = car;
      hero.carHealth = 100;
      hero.speed = 0;
      hero.car.mesh.position.y = 0;
      rio.group.visible = false;
      if (!car.taxi) {
        state.carsStolen++;
        state.addWanted(1);
        display.toast('Car stolen — the cops noticed');
      } else {
        display.toast('Taxi — drive fares to earn cash');
      }
      return true;
    },

    exitCar() {
      if (!hero.driving || !hero.car) return false;
      const c = hero.car;
      const side = c.mesh.position.x + Math.cos(c.heading) * 2.6;
      const sz = c.mesh.position.z - Math.sin(c.heading) * 2.6;
      hero.x = side;
      hero.z = sz;
      hero.y = 0;
      hero.heading = c.heading;
      hero.driving = false;
      hero.car = null;
      hero.speed = 0;
      rio.group.visible = true;
      rio.group.position.set(hero.x, 0, hero.z);
      rio.group.rotation.y = hero.heading;
      return true;
    },

    damage(amount, why) {
      if (hero.driving) {
        hero.carHealth = Math.max(0, hero.carHealth - amount);
        if (hero.carHealth <= 0) display.toast('Car wrecked — find another ride');
      } else {
        state.hurt(amount);
        if (state.dead) {
          display.toast('Rio is down — patched up at the clinic, -$50');
          state.addCash(-50);
          state.clearWanted();
          state.health = 100;
          state.dead = false;
          hero.teleport(0, 90, Math.PI);
        }
      }
      return why;
    },

    update(dt, input, camYaw) {
      if (hero.driving && hero.car) {
        updateDriving(dt, input);
      } else {
        updateOnFoot(dt, input, camYaw);
      }
      updateSmoke(dt);
    },
  };

  function moveWithCollision(nx, nz, r) {
    // Axis-separated so Rio slides along walls instead of sticking.
    const hitX = world.collides(nx, hero.z, r);
    if (!hitX) hero.x = nx;
    const hitZ = world.collides(hero.x, nz, r);
    if (!hitZ) hero.z = nz;
    return hitX || hitZ;
  }

  function updateOnFoot(dt, input, camYaw) {
    const wantX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const wantZ = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const top = input.run ? 8 : 4.6;
    let mx = 0;
    let mz = 0;
    if (wantX !== 0 || wantZ !== 0) {
      const len = Math.hypot(wantX, wantZ);
      const nx = wantX / len;
      const nz = wantZ / len;
      // Camera-relative movement: forward is where the camera looks.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      mx = nx * cos + nz * sin;
      mz = -nx * sin + nz * cos;
      const targetHeading = Math.atan2(mx, mz);
      hero.heading = angleLerp(hero.heading, targetHeading, 1 - Math.exp(-10 * dt));
    }
    const targetSpeed = (wantX !== 0 || wantZ !== 0) ? top : 0;
    hero.moveSpeed = damp(hero.moveSpeed, targetSpeed, 8, dt);
    const step = hero.moveSpeed * dt;
    if (step > 0.0001) {
      moveWithCollision(hero.x + mx * step, hero.z + mz * step, 0.55);
      hero.walkPhase += dt * hero.moveSpeed * 1.9;
      const swing = Math.sin(hero.walkPhase) * clamp(hero.moveSpeed / 8, 0.2, 1) * 0.6;
      rio.limbs.armL.rotation.x = swing;
      rio.limbs.armR.rotation.x = -swing;
      rio.limbs.legL.rotation.x = -swing;
      rio.limbs.legR.rotation.x = swing;
    } else {
      rio.limbs.armL.rotation.x = damp(rio.limbs.armL.rotation.x, 0, 8, dt);
      rio.limbs.armR.rotation.x = damp(rio.limbs.armR.rotation.x, 0, 8, dt);
      rio.limbs.legL.rotation.x = damp(rio.limbs.legL.rotation.x, 0, 8, dt);
      rio.limbs.legR.rotation.x = damp(rio.limbs.legR.rotation.x, 0, 8, dt);
    }
    // Jump and gravity.
    if (input.jump && hero.y === 0) hero.vy = 5.6;
    if (hero.y > 0 || hero.vy !== 0) {
      hero.vy -= 15 * dt;
      hero.y += hero.vy * dt;
      if (hero.y <= 0) {
        hero.y = 0;
        hero.vy = 0;
      }
    }
    rio.group.position.set(hero.x, hero.y, hero.z);
    rio.group.rotation.y = hero.heading;
    hero.speed = hero.moveSpeed;
  }

  function updateDriving(dt, input) {
    const car = hero.car;
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    const maxSpeed = hero.carHealth <= 0 ? 4 : 27;
    if (fwd) hero.speed += 15 * dt;
    if (back) hero.speed -= hero.speed > 0.5 ? 24 * dt : 10 * dt;
    if (!fwd && !back) hero.speed = damp(hero.speed, 0, 0.55, dt);
    hero.speed = clamp(hero.speed, -9, maxSpeed);

    const steerTarget = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * (hero.speed >= 0 ? 1 : -1);
    hero.steer = damp(hero.steer, steerTarget, 7, dt);
    const spd = Math.abs(hero.speed);
    const drifting = Math.abs(hero.steer) > 0.75 && spd > 14;
    const yawRate = hero.steer * spd * 0.055 * (drifting ? 1.4 : 1);
    car.heading += yawRate * dt * (hero.speed >= 0 ? 1 : -1);
    if (drifting) hero.speed *= 1 - 0.12 * dt;
    hero.roll = damp(hero.roll, drifting ? -hero.steer * 0.1 : 0, 6, dt);

    const nx = car.mesh.position.x + Math.sin(car.heading) * hero.speed * dt;
    const nz = car.mesh.position.z + Math.cos(car.heading) * hero.speed * dt;
    const hit = world.collides(nx, nz, 1.7);
    if (hit) {
      const impact = Math.abs(hero.speed);
      if (impact > 6) {
        hero.damage(impact * 1.1, 'crash');
        hero.speed *= -0.25;
        car.mesh.position.x -= Math.sin(car.heading) * 0.6;
        car.mesh.position.z -= Math.cos(car.heading) * 0.6;
      } else {
        hero.speed *= 0.4;
      }
    } else {
      car.mesh.position.x = nx;
      car.mesh.position.z = nz;
    }
    // Keep the car inside the city.
    car.mesh.position.x = clamp(car.mesh.position.x, -178, 178);
    car.mesh.position.z = clamp(car.mesh.position.z, -178, 178);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = hero.roll;
    const spin = (hero.speed * dt) / 0.36;
    for (const w of car.parts.wheels) {
      w.wheel.rotation.x += spin;
      if (w.steer) w.pivot.rotation.y = hero.steer * 0.42;
    }
    car.parts.tailMat.emissiveIntensity = back ? 2.2 : 0.5;
    // Knock pedestrians who get in the way.
    for (const p of traffic.peds) {
      if (p.down > 0) continue;
      if (dist2d(car.mesh.position.x, car.mesh.position.z, p.x, p.z) < 2.1 && spd > 3) {
        if (traffic.knockPed(p, true)) {
          state.addWanted(1);
          display.toast('Pedestrian hit — wanted level up');
        }
      }
    }
    // Push other traffic cars aside instead of passing through them.
    for (const other of traffic.cars) {
      if (other === car) continue;
      const d = dist2d(car.mesh.position.x, car.mesh.position.z, other.mesh.position.x, other.mesh.position.z);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) * 0.5;
        const px = (other.mesh.position.x - car.mesh.position.x) / d;
        const pz = (other.mesh.position.z - car.mesh.position.z) / d;
        other.mesh.position.x += px * push;
        other.mesh.position.z += pz * push;
        if (spd > 8) hero.damage(3, 'bump');
      }
    }
    hero.x = car.mesh.position.x;
    hero.z = car.mesh.position.z;
  }

  function updateSmoke(dt) {
    const damaged = hero.driving && hero.carHealth < 45;
    smokeTimer -= dt;
    if (damaged && smokeTimer <= 0) {
      smokeTimer = hero.carHealth <= 0 ? 0.08 : 0.22;
      const s = smokePool[smokeIdx++ % smokePool.length];
      const c = hero.car.mesh.position;
      s.spr.position.set(c.x + (Math.random() - 0.5), 1.2, c.z + (Math.random() - 0.5) - Math.cos(hero.car.heading));
      s.life = 1;
      s.max = 1.4;
      s.spr.material.opacity = 0.55;
      s.spr.scale.set(1.2, 1.2, 1);
    }
    for (const s of smokePool) {
      if (s.life <= 0) continue;
      s.life -= dt / s.max;
      s.spr.position.y += dt * 1.6;
      const sc = 1.2 + (1 - s.life) * 2.2;
      s.spr.scale.set(sc, sc, 1);
      s.spr.material.opacity = Math.max(0, s.life * 0.55);
    }
  }

  return hero;
}
