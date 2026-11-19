// Solmar Bay v2: the city itself. A fresh layout off seed 77 — downtown in
// the north-west, a park in the south-west, the beach and a pier on the east
// edge, and a street grid the player can actually drive. Builds the meshes,
// the collision boxes and the sky rig the day/dusk cycle drives.

import * as THREE from 'three';
import { makeStream, span, whole, choose, flatDist } from './util.js';

export const BAY_SEED = 77;
export const BAY_HALF = 150; // city runs -150..150 on x and z
export const BEACH_X = 118; // sand starts here; the sea is further east
export const SEA_X = 138;

const BLOCK = 42; // street pitch
const ROAD = 10; // road width

function windowTexture(rng, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rng() < lit ? (rng() < 0.6 ? '#ffd98a' : '#9fd8ff') : '#14161d';
      g.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, color, x, y, z, mat) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat || new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export function buildBay(scene) {
  const rng = makeStream(BAY_SEED);
  const colliders = [];
  const parkedSpots = [];
  const group = new THREE.Group();
  group.name = 'solmar-bay';
  scene.add(group);

  // --- ground: asphalt city, sand strip, sea plane -----------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BAY_HALF * 2 + 160, BAY_HALF * 2),
    new THREE.MeshLambertMaterial({ color: 0x3d3a38 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 40;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(34, BAY_HALF * 2),
    new THREE.MeshLambertMaterial({ color: 0xe0c188 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X + 8, 0.02, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120, BAY_HALF * 2 + 40),
    new THREE.MeshLambertMaterial({ color: 0x1d6f8e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X + 70, 0.01, 0);
  group.add(sea);

  // Street grid lines (thin dark strips read as roads from above).
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x232120 });
  for (let i = -3; i <= 3; i++) {
    const c = i * BLOCK;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, BAY_HALF * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.04, 0); group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BAY_HALF * 2 - 30, ROAD), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.04, c); group.add(h);
  }

  // --- downtown towers (north-west) --------------------------------------
  const towerTex = windowTexture(rng, 0.55);
  const towerMat = new THREE.MeshLambertMaterial({ map: towerTex });
  const towerTops = [];
  for (let i = 0; i < 9; i++) {
    // Block centres, so the streets between them stay drivable.
    const bx = -105 + (i % 3) * BLOCK, bz = -105 + Math.floor(i / 3) * BLOCK;
    const h = span(rng, 34, 72);
    const t = box(26, h, 26, 0xffffff, bx, h / 2, bz, towerMat);
    group.add(t);
    colliders.push({ x0: bx - 14, z0: bz - 14, x1: bx + 14, z1: bz + 14 });
    if (i === 4) towerTops.push({ x: bx, z: bz, h });
  }

  // --- mid-rise blocks and houses across the grid -------------------------
  const houseColors = [0xd8a06a, 0xc9b18a, 0x9db8a4, 0xb98a8a, 0x8aa0b8, 0xd0c0a0];
  const landmarkSpots = [[-21, -21], [21, 63], [105, -63], [-63, 105]];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx < 0 && gz < 0) continue; // downtown already built there
      // Block centres keep the streets (multiples of 42) clear for driving.
      const bx = gx * BLOCK + 21 + span(rng, -6, 6), bz = gz * BLOCK + 21 + span(rng, -6, 6);
      if (bx > BEACH_X - 24) continue;
      if (landmarkSpots.some(([lx, lz]) => flatDist(bx, bz, lx, lz) < 26)) continue;
      const w = span(rng, 14, 22), d = span(rng, 14, 22), h = span(rng, 7, 18);
      const house = box(w, h, d, choose(rng, houseColors), bx, h / 2, bz);
      group.add(house);
      const roof = box(w + 1, 1.2, d + 1, 0x4a3a30, bx, h + 0.6, bz);
      group.add(roof);
      colliders.push({ x0: bx - w / 2 - 1, z0: bz - d / 2 - 1, x1: bx + w / 2 + 1, z1: bz + d / 2 + 1 });
    }
  }

  // --- landmarks: bank (heist), diner, marina office, PD station ---------
  function landmark(x, z, w, d, h, color, label) {
    const m = box(w, h, d, color, x, h / 2, z);
    group.add(m);
    colliders.push({ x0: x - w / 2 - 1, z0: z - d / 2 - 1, x1: x + w / 2 + 1, z1: z + d / 2 + 1 });
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 2.4, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffc23b }),
    );
    sign.position.set(x, h + 1.6, z + d / 2 + 0.4);
    group.add(sign);
    return { x, z, label };
  }
  const bank = landmark(-21, -21, 30, 22, 16, 0xe8e2d2, 'Solmar Trust Bank');
  const diner = landmark(21, 63, 20, 14, 8, 0xd96a5f, "Rosa's Diner");
  const marina = landmark(105, -63, 18, 14, 9, 0x5f8aa8, 'Marina Office');
  const pd = landmark(-63, 105, 26, 18, 12, 0x5a6a8a, 'Solmar PD');

  // --- park (south-west): grass, trees, pond ------------------------------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 76),
    new THREE.MeshLambertMaterial({ color: 0x4d7a3a }),
  );
  grass.rotation.x = -Math.PI / 2; grass.position.set(-105, 0.05, 105);
  group.add(grass);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(14, 20),
    new THREE.MeshLambertMaterial({ color: 0x3a7a9e }),
  );
  pond.rotation.x = -Math.PI / 2; pond.position.set(-105, 0.06, 105);
  group.add(pond);

  // --- palms along the beach and park trees --------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.y = 4.5; trunk.rotation.z = 0.12; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 4), leafMat);
      leaf.position.y = 9.2;
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = (i / 5) * Math.PI * 2;
      leaf.position.x = Math.cos((i / 5) * Math.PI * 2) * 1.6;
      leaf.position.z = Math.sin((i / 5) * Math.PI * 2) * 1.6;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 });
  }
  for (let z = -130; z <= 130; z += 26) palm(BEACH_X - 4, z + span(rng, -6, 6));
  for (let i = 0; i < 10; i++) palm(-126 + rng() * 44, 84 + rng() * 44);

  // --- street lamps ----------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampLights = [];
  for (let gx = -3; gx <= 2; gx++) {
    for (let gz = -3; gz <= 3; gz += 2) {
      const x = gx * BLOCK + 7, z = gz * BLOCK + 7;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7, 6), lampMat);
      pole.position.set(x, 3.5, z); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampGlow);
      bulb.position.set(x, 7.2, z); group.add(bulb);
      lampLights.push(bulb);
    }
  }

  // --- pier out over the sea -------------------------------------------------
  const pier = box(8, 1.5, 46, 0x8a6a44, SEA_X + 6, 0.75, -40);
  group.add(pier);
  colliders.push({ x0: SEA_X + 1, z0: -64, x1: SEA_X + 11, z1: -16 });

  // --- parked cars spots along the streets -----------------------------------
  for (let i = 0; i < 8; i++) {
    parkedSpots.push({
      x: -84 + (i % 4) * BLOCK, z: 21 + Math.floor(i / 4) * 84,
      heading: (i % 2 === 0 ? 0 : Math.PI / 2),
    });
  }

  // --- sky rig: sun + hemisphere, driven by the dusk cycle ------------------
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-80, 90, 40);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a3a, 0.7);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe08a5a, 120, 420);
  scene.background = new THREE.Color(0xe08a5a);

  const skyStops = [
    { t: 0.0, sky: 0xff9a4d, sun: 0xffb36b, fog: 0xe08a5a, i: 1.6 },
    { t: 0.35, sky: 0xc96a7a, sun: 0xff8a5a, fog: 0xb06a6a, i: 1.1 },
    { t: 0.6, sky: 0x4a3a6a, sun: 0x8a6ab0, fog: 0x4a3a5a, i: 0.7 },
    { t: 0.85, sky: 0x2a2a4a, sun: 0x5a5a8a, fog: 0x2a2a44, i: 0.45 },
    { t: 1.0, sky: 0xff9a4d, sun: 0xffb36b, fog: 0xe08a5a, i: 1.6 },
  ];
  function updateSky(dayT) {
    let a = skyStops[0], b = skyStops[skyStops.length - 1];
    for (let i = 0; i < skyStops.length - 1; i++) {
      if (dayT >= skyStops[i].t && dayT <= skyStops[i + 1].t) { a = skyStops[i]; b = skyStops[i + 1]; break; }
    }
    const f = (dayT - a.t) / Math.max(0.001, b.t - a.t);
    const ca = new THREE.Color(a.sky), cb = new THREE.Color(b.sky);
    ca.lerp(cb, f);
    scene.background = ca;
    scene.fog.color.copy(ca).lerp(new THREE.Color(b.fog), 0.5);
    sun.color.setHex(a.sun).lerp(new THREE.Color(b.sun), f);
    sun.intensity = a.i + (b.i - a.i) * f;
    sun.position.set(-80 + dayT * 160, 90 - dayT * 55, 40);
    lampLights.forEach((bulb) => {
      bulb.material = bulb.material; // glow stays; lamps read at dusk
    });
  }

  return {
    colliders, parkedSpots, bank, diner, marina, pd,
    playerSpawn: { x: 0, z: 96 },
    docks: { x: 105, z: -84 },
    updateSky,
  };
}
