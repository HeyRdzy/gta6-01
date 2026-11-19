// Street life for Solmar Bay v2: parked cars, looping traffic and
// pedestrians. Traffic follows the street grid; pedestrians stroll the
// sidewalks and run from danger (a speeding car, gunfire, a police chase).

import * as THREE from 'three';
import { makeStream, span, whole, choose, clampNum, flatDist, pushOut, insideBox } from './util.js';

const PAINT = [0xc23b2e, 0x2e6fc2, 0xe0a030, 0x3a9a5a, 0x7a4a9a, 0xd0d0d0, 0x222226, 0x3fa8a0];
const PED_SHIRTS = [0xe05a5a, 0x5a8ae0, 0x5ae08a, 0xe0c05a, 0x9a5ae0, 0xe0e0e0];

/** Build one car mesh group. Returns { group, body } — callers add motion. */
export function buildCar(color, x, z, heading) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.75, 4.4),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 0.65;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2028 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  });
  const lampGeo = new THREE.BoxGeometry(0.4, 0.25, 0.1);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  [-0.7, 0.7].forEach((lx) => {
    const l = new THREE.Mesh(lampGeo, lampMat);
    l.position.set(lx, 0.7, -2.22);
    g.add(l);
  });
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  return { group: g, body };
}

export class StreetLife {
  constructor(scene, colliders, parkedSpots) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = makeStream(9917);
    this.cars = []; // traffic + parked, each { mesh, heading, speed, kind, damage, wrecked }
    this.peds = []; // { mesh, heading, speed, flee }
    this.danger = { x: 0, z: 0, t: -99 };

    parkedSpots.forEach((s, i) => {
      const { group } = buildCar(PAINT[i % PAINT.length], s.x, s.z, s.heading);
      scene.add(group);
      this.cars.push({ mesh: group, heading: s.heading, speed: 0, kind: 'parked', damage: 0, wrecked: false, route: null });
    });

    // Traffic cars cruise the grid, one axis at a time.
    for (let i = 0; i < 10; i++) {
      const alongX = i % 2 === 0;
      const lane = (Math.floor(i / 2) - 2) * 42;
      const x = alongX ? span(this.rng, -120, 110) : lane;
      const z = alongX ? lane : span(this.rng, -120, 120);
      const heading = alongX ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const { group } = buildCar(choose(this.rng, PAINT), x, z, heading);
      scene.add(group);
      this.cars.push({
        mesh: group, heading, speed: span(this.rng, 7, 12), kind: 'traffic',
        damage: 0, wrecked: false, route: { alongX, lane, dir: heading },
      });
    }

    // Pedestrians on the sidewalks.
    for (let i = 0; i < 16; i++) {
      const shirt = choose(this.rng, PED_SHIRTS);
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 1.5, 8),
        new THREE.MeshLambertMaterial({ color: shirt }),
      );
      body.position.y = 1.15; g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xd8a070 }),
      );
      head.position.y = 2.2; g.add(head);
      const x = span(this.rng, -120, 110), z = span(this.rng, -120, 120);
      g.position.set(x, 0, z);
      scene.add(g);
      this.peds.push({ mesh: g, heading: this.rng() * Math.PI * 2, speed: span(this.rng, 1.2, 2.2), flee: 0 });
    }
  }

  /** Mark a scare at (x, z): peds nearby will run. */
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
    // Traffic: drive along its lane, turn at the city edge, slow near the player.
    for (const c of this.cars) {
      if (c.kind !== 'traffic') continue;
      const p = c.mesh.position;
      const nearPlayer = flatDist(p.x, p.z, playerX, playerZ) < 14;
      const target = nearPlayer ? 3 : 10;
      c.speed += clampNum(target - c.speed, -8 * dt, 6 * dt);
      const dx = Math.sin(c.heading), dz = Math.cos(c.heading);
      p.x += dx * c.speed * dt;
      p.z += dz * c.speed * dt;
      if (p.x > 128 || p.x < -140 || p.z > 140 || p.z < -140) {
        c.heading += Math.PI / 2; // turn at the edge and keep looping
        p.x = clampNum(p.x, -138, 126); p.z = clampNum(p.z, -138, 138);
      }
      c.mesh.rotation.y = c.heading;
      for (const b of this.colliders) {
        const out = pushOut(p.x, p.z, 2.2, b);
        if (out) { p.x = out.x; p.z = out.z; c.heading += Math.PI / 2; }
      }
    }

    // Pedestrians: stroll, flee danger, never walk through buildings.
    const scareFresh = now - this.danger.t < 4;
    for (const ped of this.peds) {
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
      // Simple walk bob.
      ped.mesh.position.y = Math.abs(Math.sin(now * 6 + p.x)) * 0.08;
    }
  }
}
