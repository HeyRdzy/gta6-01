// Street life for Solmar Heat v3: detailed procedural cars and people.
// Cars get sculpted bodies, glass cabins, chrome, spinning hubcap wheels,
// headlight cones and brake lights; people get articulated limbs and a real
// walk cycle. Shared geometries and materials keep the draw calls in check.

import * as THREE from 'three';
import { makeStream, span, whole, choose, clampNum, flatDist, pushOut } from './util.js';
import { stdMat, sharedGeo, glowTexture } from './visuals.js';

const PAINT = [0xc23b2e, 0x2e6fc2, 0xe0a030, 0x3a9a5a, 0x7a4a9a, 0xd0d0d0, 0x222226, 0x3fa8a0];
const PED_SHIRTS = [0xe05a5a, 0x5a8ae0, 0x5ae08a, 0xe0c05a, 0x9a5ae0, 0xe0e0e0];
const PED_PANTS = [0x2a3440, 0x3a3a44, 0x5a4632, 0x22303a];
const PED_SKIN = [0xd8a070, 0xb08a68, 0x8a6248, 0xe8b890];

const glassMat = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.12, metalness: 0.85 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.85 });
const coneMat = new THREE.MeshBasicMaterial({
  color: 0xffe9a8, transparent: true, opacity: 0.13,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});

/** Build a detailed car. Returns the group plus the parts animators need. */
export function buildCar(color, x, z, heading) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.65 });
  // Two-tone roof: a darker shade of the paint, like a factory option.
  const roofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.3, metalness: 0.6,
  });
  // Sculpted body: low slab, hood and trunk shoulders, glass cabin.
  const slab = new THREE.Mesh(sharedGeo('carSlab', () => new THREE.BoxGeometry(2.05, 0.55, 4.5)), paint);
  slab.position.y = 0.62;
  slab.castShadow = true;
  g.add(slab);
  const hood = new THREE.Mesh(sharedGeo('carHood', () => new THREE.BoxGeometry(1.9, 0.34, 1.15)), paint);
  hood.position.set(0, 0.95, 1.55);
  hood.castShadow = true;
  g.add(hood);
  const trunk = new THREE.Mesh(sharedGeo('carTrunk', () => new THREE.BoxGeometry(1.9, 0.3, 0.9)), paint);
  trunk.position.set(0, 0.92, -1.7);
  g.add(trunk);
  const cabin = new THREE.Mesh(sharedGeo('carCabin', () => new THREE.BoxGeometry(1.75, 0.62, 2.1)), glassMat);
  cabin.position.set(0, 1.28, -0.15);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(sharedGeo('carRoof', () => new THREE.BoxGeometry(1.7, 0.1, 1.9)), roofMat);
  roof.position.set(0, 1.62, -0.15);
  g.add(roof);
  // Chrome grille, bumpers and side trim.
  const grille = new THREE.Mesh(sharedGeo('carGrille', () => new THREE.BoxGeometry(1.5, 0.22, 0.08)), chromeMat);
  grille.position.set(0, 0.62, 2.28);
  g.add(grille);
  for (const bz of [-2.24, 2.24]) {
    const bumper = new THREE.Mesh(sharedGeo('carBumper', () => new THREE.BoxGeometry(2.05, 0.18, 0.12)), chromeMat);
    bumper.position.set(0, 0.42, bz);
    g.add(bumper);
  }
  // Wheels with hubcaps; they spin with speed.
  const wheels = [];
  const wheelGeo = sharedGeo('wheel', () => new THREE.CylinderGeometry(0.44, 0.44, 0.36, 14));
  const hubGeo = sharedGeo('hub', () => new THREE.CylinderGeometry(0.22, 0.22, 0.38, 10));
  [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(([wx, wz]) => {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(w);
    pivot.add(hub);
    pivot.position.set(wx, 0.44, wz);
    g.add(pivot);
    wheels.push(pivot);
  });
  // Headlights: emissive lenses + additive cones (lit at dusk/night).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.9, roughness: 0.3 });
  const headL = new THREE.Mesh(sharedGeo('headLens', () => new THREE.BoxGeometry(0.42, 0.22, 0.08)), headMat);
  headL.position.set(-0.68, 0.72, 2.26);
  g.add(headL);
  const headR = headL.clone();
  headR.position.x = 0.68;
  g.add(headR);
  const cones = [];
  for (const lx of [-0.68, 0.68]) {
    const cone = new THREE.Mesh(sharedGeo('beam', () => new THREE.ConeGeometry(1.15, 7, 10, 1, true)), coneMat);
    cone.rotation.x = -Math.PI / 2 - 0.1;
    cone.position.set(lx, 0.6, 5.6);
    cone.visible = false;
    g.add(cone);
    cones.push(cone);
  }
  // Taillights: red emissive, flare on braking.
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff1a1a, emissiveIntensity: 0.7, roughness: 0.4 });
  const tailL = new THREE.Mesh(sharedGeo('tailLens', () => new THREE.BoxGeometry(0.46, 0.2, 0.08)), tailMat);
  tailL.position.set(-0.68, 0.72, -2.26);
  g.add(tailL);
  const tailR = tailL.clone();
  tailR.position.x = 0.68;
  g.add(tailR);
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  return { group: g, body: slab, wheels, headMat, tailMat, cones, paint };
}

/** Articulated low-poly person: torso, head, swinging arms and legs. */
export function buildPerson(shirt, pants, skin) {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const torso = new THREE.Mesh(
    sharedGeo('torso', () => new THREE.CylinderGeometry(0.4, 0.48, 1.25, 10)),
    stdMat(shirt, 0.9),
  );
  torso.position.y = 1.2;
  torso.castShadow = true;
  rig.add(torso);
  const head = new THREE.Mesh(sharedGeo('head', () => new THREE.SphereGeometry(0.38, 12, 10)), stdMat(skin, 0.75));
  head.position.y = 2.12;
  head.castShadow = true;
  rig.add(head);
  const hair = new THREE.Mesh(sharedGeo('hair', () => new THREE.SphereGeometry(0.39, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), stdMat(0x2a2018, 0.9));
  hair.position.y = 2.18;
  rig.add(hair);
  const limbs = { armL: null, armR: null, legL: null, legR: null };
  const armGeo = sharedGeo('arm', () => new THREE.BoxGeometry(0.24, 1.05, 0.24));
  const legGeo = sharedGeo('leg', () => new THREE.BoxGeometry(0.3, 1.0, 0.3));
  const armMat = stdMat(shirt, 0.9);
  const legMat = stdMat(pants, 0.95);
  const shoeMat = stdMat(0x1a1a1a, 0.9);
  for (const [key, sx, mat, geo, y] of [
    ['armL', -0.55, armMat, armGeo, 1.72],
    ['armR', 0.55, armMat, armGeo, 1.72],
    ['legL', -0.22, legMat, legGeo, 0.62],
    ['legR', 0.22, legMat, legGeo, 0.62],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, y, 0);
    const limb = new THREE.Mesh(geo, mat);
    limb.position.y = -0.48;
    limb.castShadow = true;
    pivot.add(limb);
    if (key.startsWith('leg')) {
      const shoe = new THREE.Mesh(sharedGeo('shoe', () => new THREE.BoxGeometry(0.32, 0.16, 0.55)), shoeMat);
      shoe.position.set(0, -0.98, 0.08);
      pivot.add(shoe);
    }
    rig.add(pivot);
    limbs[key] = pivot;
  }
  return { group: g, rig, limbs, phase: Math.random() * Math.PI * 2 };
}

/** Drive a walk cycle: legs and arms swing against each other. */
export function walkCycle(person, dt, speed) {
  person.phase += dt * speed * 2.1;
  const s = Math.sin(person.phase);
  const amp = speed > 0.1 ? Math.min(0.75, 0.3 + speed * 0.05) : 0;
  person.limbs.legL.rotation.x = s * amp;
  person.limbs.legR.rotation.x = -s * amp;
  person.limbs.armL.rotation.x = -s * amp * 0.8;
  person.limbs.armR.rotation.x = s * amp * 0.8;
  person.rig.position.y = Math.abs(Math.cos(person.phase)) * 0.07 * (amp > 0 ? 1 : 0);
}

export class StreetLife {
  constructor(scene, colliders, parkedSpots) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = makeStream(9917);
    this.cars = [];
    this.peds = [];
    this.danger = { x: 0, z: 0, t: -99 };
    this.night = false;

    parkedSpots.forEach((s, i) => {
      const built = buildCar(PAINT[i % PAINT.length], s.x, s.z, s.heading);
      scene.add(built.group);
      this.cars.push({
        mesh: built.group, heading: s.heading, speed: 0, kind: 'parked',
        damage: 0, wrecked: false, route: null, parts: built, braking: false,
      });
    });

    for (let i = 0; i < 10; i++) {
      const alongX = i % 2 === 0;
      const lane = (Math.floor(i / 2) - 2) * 42;
      const x = alongX ? span(this.rng, -120, 110) : lane;
      const z = alongX ? lane : span(this.rng, -120, 120);
      const heading = alongX ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const built = buildCar(choose(this.rng, PAINT), x, z, heading);
      scene.add(built.group);
      this.cars.push({
        mesh: built.group, heading, speed: span(this.rng, 7, 12), kind: 'traffic',
        damage: 0, wrecked: false, route: { alongX, lane, dir: heading }, parts: built, braking: false,
      });
    }

    for (let i = 0; i < 16; i++) {
      const person = buildPerson(
        choose(this.rng, PED_SHIRTS), choose(this.rng, PED_PANTS), choose(this.rng, PED_SKIN),
      );
      const x = span(this.rng, -120, 110), z = span(this.rng, -120, 120);
      person.group.position.set(x, 0, z);
      // Height variety so the crowd stops looking cloned.
      person.group.scale.setScalar(span(this.rng, 0.92, 1.08));
      scene.add(person.group);
      this.peds.push({
        mesh: person.group, person, heading: this.rng() * Math.PI * 2,
        speed: span(this.rng, 1.2, 2.2), flee: 0, down: false,
      });
    }
  }

  scare(x, z) { this.danger = { x, z, t: performance.now() / 1000 }; }

  nearestCar(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const c of this.cars) {
      if (c.kind === 'traffic') continue;
      const d = flatDist(x, z, c.mesh.position.x, c.mesh.position.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  update(dt, now, playerX, playerZ, playerSpeed) {
    for (const c of this.cars) {
      // Headlight cones only read after golden hour.
      for (const cone of c.parts.cones) cone.visible = this.night;
      c.parts.tailMat.emissiveIntensity = c.braking ? 2.6 : (this.night ? 1.1 : 0.7);
      if (c.kind === 'traffic') {
        const p = c.mesh.position;
        const nearPlayer = flatDist(p.x, p.z, playerX, playerZ) < 14;
        const target = nearPlayer ? 3 : 10;
        c.speed += clampNum(target - c.speed, -8 * dt, 6 * dt);
        p.x += Math.sin(c.heading) * c.speed * dt;
        p.z += Math.cos(c.heading) * c.speed * dt;
        if (p.x > 128 || p.x < -140 || p.z > 140 || p.z < -140) {
          c.heading += Math.PI / 2;
          p.x = clampNum(p.x, -138, 126); p.z = clampNum(p.z, -138, 138);
        }
        c.mesh.rotation.y = c.heading;
        for (const b of this.colliders) {
          const out = pushOut(p.x, p.z, 2.2, b);
          if (out) { p.x = out.x; p.z = out.z; c.heading += Math.PI / 2; }
        }
      }
      // Wheels roll with speed.
      const spin = (c.kind === 'traffic' ? c.speed : 0) * dt / 0.44;
      for (const w of c.parts.wheels) w.rotation.x += spin;
    }

    const scareFresh = now - this.danger.t < 4;
    for (const ped of this.peds) {
      if (ped.down) continue;
      const p = ped.mesh.position;
      const dDanger = flatDist(p.x, p.z, this.danger.x, this.danger.z);
      if (scareFresh && dDanger < 26) ped.flee = 2.5;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.heading = Math.atan2(p.x - this.danger.x, p.z - this.danger.z);
        ped.speed = 5.2;
      } else if (this.rng() < dt * 0.12) {
        ped.heading = this.rng() * Math.PI * 2;
        ped.speed = span(this.rng, 1.2, 2.2);
      }
      p.x += Math.sin(ped.heading) * ped.speed * dt;
      p.z += Math.cos(ped.heading) * ped.speed * dt;
      if (p.x > 130 || p.x < -140 || p.z > 140 || p.z < -140) ped.heading += Math.PI;
      for (const b of this.colliders) {
        const out = pushOut(p.x, p.z, 0.7, b);
        if (out) { p.x = out.x; p.z = out.z; }
      }
      ped.mesh.rotation.y = ped.heading;
      walkCycle(ped.person, dt, ped.speed);
    }
  }
}
