// Street life: AI cars looping the blocks and pedestrians on the sidewalks.
// The car body builder here is shared by the hero and the police, so every
// car on the road looks like it belongs to the same city.

import * as THREE from 'three';
import { basicMat, glowTexture, stdMat, unitBox, unitCone, unitCylinder, unitSphere } from './visuals.js';
import { angleLerp, clamp, dist2d, hash2, mulberry32, pick, range } from './util.js';

const CAR_PAINTS = [0xc23b2e, 0x2e5fc2, 0x3a9a4a, 0xd8c23a, 0x8a8f94, 0x22242a, 0xe8e4da, 0x7a4a9a, 0x2a8a8a];

const glassMat = stdMat('carglass', () => new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 }));
const chromeMat = stdMat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 }));
const tyreMat = stdMat('tyre', () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
const hubMat = stdMat('hub', () => new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.35, metalness: 0.8 }));

/** Build one car. Forward is local +Z. Returns the parts the game drives. */
export function makeCarBody(color, opts = {}) {
  const group = new THREE.Group();
  const paint = stdMat(`paint${color.toString(16)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 }));
  const body = new THREE.Mesh(unitBox(), paint);
  body.scale.set(1.9, 0.55, 4.3);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(unitBox(), glassMat);
  cabin.scale.set(1.65, 0.5, 2.1);
  cabin.position.set(0, 1.12, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const grille = new THREE.Mesh(unitBox(), chromeMat);
  grille.scale.set(1.2, 0.16, 0.1);
  grille.position.set(0, 0.55, 2.16);
  group.add(grille);

  for (const s of [-1, 1]) {
    const bumper = new THREE.Mesh(unitBox(), chromeMat);
    bumper.scale.set(1.9, 0.14, 0.12);
    bumper.position.set(0, 0.38, s * 2.16);
    group.add(bumper);
  }

  const wheels = [];
  for (const [wx, wz, steer] of [[-0.85, 1.35, true], [0.85, 1.35, true], [-0.85, -1.35, false], [0.85, -1.35, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const wheel = new THREE.Mesh(unitCylinder(12), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.scale.set(0.36, 0.26, 0.36);
    wheel.castShadow = true;
    pivot.add(wheel);
    const hub = new THREE.Mesh(unitCylinder(8), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.scale.set(0.18, 0.28, 0.18);
    pivot.add(hub);
    group.add(pivot);
    wheels.push({ pivot, wheel, steer });
  }

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb0, emissiveIntensity: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0f0f, emissive: 0xff1a1a, emissiveIntensity: 0.5 });
  const beams = [];
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(unitBox(), headMat);
    lamp.scale.set(0.42, 0.16, 0.08);
    lamp.position.set(s * 0.62, 0.72, 2.16);
    group.add(lamp);
    const beam = new THREE.Mesh(
      unitCone(10),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    beam.rotation.x = Math.PI / 2;
    beam.scale.set(1.1, 5.5, 1.1);
    beam.position.set(s * 0.62, 0.55, 4.6);
    group.add(beam);
    beams.push(beam);
    const tail = new THREE.Mesh(unitBox(), tailMat);
    tail.scale.set(0.42, 0.14, 0.08);
    tail.position.set(s * 0.62, 0.72, -2.16);
    group.add(tail);
  }

  if (opts.police) {
    // White doors and hood over the paint, plus the light bar.
    const white = stdMat('policewhite', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.4 }));
    const doors = new THREE.Mesh(unitBox(), white);
    doors.scale.set(1.92, 0.4, 2.2);
    doors.position.set(0, 0.62, 0.1);
    group.add(doors);
    const bar = new THREE.Group();
    const barBase = new THREE.Mesh(unitBox(), stdMat('barbase', () => new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5 })));
    barBase.scale.set(1.1, 0.12, 0.4);
    bar.add(barBase);
    const redLens = new THREE.Mesh(unitBox(), new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 1 }));
    redLens.scale.set(0.5, 0.16, 0.42);
    redLens.position.x = -0.28;
    bar.add(redLens);
    const blueLens = new THREE.Mesh(unitBox(), new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2040ff, emissiveIntensity: 1 }));
    blueLens.scale.set(0.5, 0.16, 0.42);
    blueLens.position.x = 0.28;
    bar.add(blueLens);
    bar.position.set(0, 1.44, -0.25);
    group.add(bar);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6080ff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.scale.set(4, 2.4, 1);
    halo.position.set(0, 1.7, -0.25);
    group.add(halo);
    const pushBar = new THREE.Mesh(unitBox(), chromeMat);
    pushBar.scale.set(1.7, 0.35, 0.14);
    pushBar.position.set(0, 0.5, 2.2);
    group.add(pushBar);
    return { group, wheels, headMat, tailMat, beams, bar: { redLens, blueLens, halo } };
  }

  if (opts.taxi) {
    const sign = new THREE.Mesh(unitBox(), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe14a, emissiveIntensity: 0.9 }));
    sign.scale.set(0.7, 0.22, 0.34);
    sign.position.set(0, 1.5, -0.25);
    group.add(sign);
    const beacon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0x51ff7a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    beacon.scale.set(2.4, 2.4, 1);
    beacon.position.set(0, 2.1, -0.25);
    group.add(beacon);
    return { group, wheels, headMat, tailMat, beams, taxiBeacon: beacon };
  }

  return { group, wheels, headMat, tailMat, beams };
}

const PED_SHIRTS = [0xc23b2e, 0x2e5fc2, 0x3a9a4a, 0xd8c23a, 0xe8e4da, 0x7a4a9a, 0x2a8a8a, 0xe07a3a];
const PED_SKINS = [0xe8b88a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0];

/** One pedestrian: torso, head, and limbs that swing on pivots. */
function makePed(rng) {
  const group = new THREE.Group();
  const shirt = stdMat(`shirt${pick(rng, PED_SHIRTS).toString(16)}`, () => new THREE.MeshStandardMaterial({ color: pick(rng, PED_SHIRTS), roughness: 0.9 }));
  const skin = stdMat(`skin${pick(rng, PED_SKINS).toString(16)}`, () => new THREE.MeshStandardMaterial({ color: pick(rng, PED_SKINS), roughness: 0.8 }));
  const pants = stdMat('pants', () => new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.95 }));

  const torso = new THREE.Mesh(unitBox(), shirt);
  torso.scale.set(0.55, 0.72, 0.32);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(unitSphere(10, 8), skin);
  head.scale.setScalar(0.21);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(unitCylinder(8), stdMat('cap', () => new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.8 })));
  cap.scale.set(0.22, 0.1, 0.22);
  cap.position.y = 1.88;
  group.add(cap);

  const limbs = { armL: null, armR: null, legL: null, legR: null };
  const mkLimb = (mat, w, len, px, py) => {
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
  limbs.armL = mkLimb(skin, 0.16, 0.62, -0.36, 1.5);
  limbs.armR = mkLimb(skin, 0.16, 0.62, 0.36, 1.5);
  limbs.legL = mkLimb(pants, 0.2, 0.72, -0.15, 0.82);
  limbs.legR = mkLimb(pants, 0.2, 0.72, 0.15, 0.82);
  return { group, limbs };
}

export function createTraffic(scene, world) {
  const rng = mulberry32(777);
  const cars = [];
  const peds = [];

  // Rectangle loops around blocks: each car circles one block on its streets.
  function blockLoop(bx, bz) {
    const cx = bx * 30 + 15;
    const cz = bz * 30 + 15;
    const o = 4.6; // lane offset from the street centre line
    return [
      { x: cx - 15 - o, z: cz - 15 - o },
      { x: cx + 15 + o, z: cz - 15 - o },
      { x: cx + 15 + o, z: cz + 15 + o },
      { x: cx - 15 - o, z: cz + 15 + o },
    ];
  }

  const usedBlocks = new Set();
  for (let i = 0; i < 12; i++) {
    let bx = Math.floor(range(rng, -5, 5));
    let bz = Math.floor(range(rng, -5, 5));
    let guard = 0;
    while ((usedBlocks.has(`${bx},${bz}`) || bx * 30 + 15 > 140 || bz * 30 + 15 > 140) && guard++ < 20) {
      bx = Math.floor(range(rng, -5, 5));
      bz = Math.floor(range(rng, -5, 5));
    }
    usedBlocks.add(`${bx},${bz}`);
    const loop = blockLoop(bx, bz);
    const taxi = i < 2;
    const color = taxi ? 0xe8c23a : CAR_PAINTS[i % CAR_PAINTS.length];
    const parts = makeCarBody(color, taxi ? { taxi: true } : {});
    const start = loop[Math.floor(rng() * loop.length)];
    parts.group.position.set(start.x, 0, start.z);
    scene.add(parts.group);
    cars.push({
      mesh: parts.group,
      parts,
      loop,
      wp: 1,
      heading: 0,
      speed: 0,
      cruise: 6 + rng() * 4,
      taxi,
      kind: taxi ? 'taxi' : 'traffic',
    });
  }

  for (let i = 0; i < 12; i++) {
    const ped = makePed(rng);
    const x = range(rng, -165, 165);
    const z = range(rng, -165, 165);
    ped.group.position.set(x, 0, z);
    scene.add(ped.group);
    peds.push({
      mesh: ped.group,
      limbs: ped.limbs,
      x,
      z,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.8,
      phase: rng() * Math.PI * 2,
      tx: x,
      tz: z,
      down: 0,
      scale: 0.92 + rng() * 0.16,
    });
    ped.group.scale.setScalar(peds[i].scale);
  }

  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of cars) {
      const d = dist2d(x, z, c.mesh.position.x, c.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  return {
    cars,
    peds,
    nearestCar,
    update(dt, timeSec, night) {
      for (const c of cars) {
        const target = c.loop[c.wp];
        const dx = target.x - c.mesh.position.x;
        const dz = target.z - c.mesh.position.z;
        const d = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        const turn = angleLerp(c.heading, wantHeading, 1 - Math.exp(-2.2 * dt));
        const headingErr = Math.abs(((wantHeading - c.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const targetSpeed = clamp(c.cruise * (1 - headingErr * 0.55), 2.5, c.cruise);
        c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.5);
        c.heading = turn;
        c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
        c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
        c.mesh.rotation.y = c.heading;
        const spin = (c.speed * dt) / 0.36;
        for (const w of c.parts.wheels) {
          w.wheel.rotation.x += spin;
          if (w.steer) w.pivot.rotation.y = clamp(angleLerp(0, wantHeading - c.heading, 1), -0.4, 0.4) * 0.5;
        }
        c.parts.headMat.emissiveIntensity = night ? 1.6 : 0.4;
        for (const b of c.parts.beams) b.material.opacity = night ? 0.22 : 0;
        if (d < 2.5) c.wp = (c.wp + 1) % c.loop.length;
      }
      for (const p of peds) {
        if (p.down > 0) {
          p.down -= dt;
          if (p.down <= 0) {
            p.mesh.rotation.z = 0;
            p.mesh.position.set(range(rng, -160, 160), 0, range(rng, -160, 160));
            p.tx = p.mesh.position.x;
            p.tz = p.mesh.position.z;
          }
          continue;
        }
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) {
          p.tx = clamp(p.x + range(rng, -50, 50), -168, 168);
          p.tz = clamp(p.z + range(rng, -50, 50), -168, 168);
        } else {
          const want = Math.atan2(dx, dz);
          p.heading = angleLerp(p.heading, want, 1 - Math.exp(-4 * dt));
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;
          p.phase += dt * p.speed * 4.4;
          const swing = Math.sin(p.phase) * 0.55;
          p.limbs.armL.rotation.x = swing;
          p.limbs.armR.rotation.x = -swing;
          p.limbs.legL.rotation.x = -swing * 0.9;
          p.limbs.legR.rotation.x = swing * 0.9;
          p.mesh.position.set(p.x, 0, p.z);
          p.mesh.rotation.y = p.heading;
        }
      }
    },
    knockPed(p, byCar) {
      if (p.down > 0) return false;
      p.down = 6;
      p.mesh.rotation.z = Math.PI / 2;
      return true;
    },
  };
}
