// Solmar Bay v3: the city, rebuilt for the camera. Facade textures with
// windows that glow at dusk, rooftop clutter, neon signs, marked roads and
// sidewalks, traffic lights, real palms, a pier and an animated sea. One
// shared material set keeps the draw calls low; the sun is the only shadow
// caster in the scene.

import * as THREE from 'three';
import { makeStream, span, whole, choose, flatDist } from './util.js';
import {
  makeSky, makeLightRig, facadeTexture, roadTexture, sidewalkTexture,
  sandTexture, frondTexture, neonTexture, glowTexture, stdMat, sharedGeo,
} from './visuals.js';

export const BAY_SEED = 77;
export const BAY_HALF = 150;
export const BEACH_X = 118;
export const SEA_X = 138;

const BLOCK = 42;
const ROAD = 10;

function crosswalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#26242a';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(240,240,235,0.9)';
  for (let x = 6; x < 128; x += 20) g.fillRect(x, 6, 10, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function awningTexture(colorA, colorB) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = (x / 16) % 2 === 0 ? colorA : colorB;
    g.fillRect(x, 0, 16, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBay(scene) {
  const rng = makeStream(BAY_SEED);
  const colliders = [];
  const parkedSpots = [];
  const group = new THREE.Group();
  group.name = 'solmar-bay';
  scene.add(group);

  const sky = makeSky(scene);
  const rig = makeLightRig(scene);
  scene.fog = new THREE.Fog(0xe08a5a, 150, 560);

  const glowTex = glowTexture();
  const crossTex = crosswalkTexture();

  // --- ground: asphalt, sand, animated sea ------------------------------
  const ground = new THREE.Mesh(
    sharedGeo('ground', () => new THREE.PlaneGeometry(BAY_HALF * 2 + 160, BAY_HALF * 2)),
    stdMat(0x35322e, 0.95),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 40;
  ground.receiveShadow = true;
  group.add(ground);

  const sandTex = sandTexture();
  sandTex.repeat.set(3, 14);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(34, BAY_HALF * 2),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X + 8, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const seaGeo = new THREE.PlaneGeometry(120, BAY_HALF * 2 + 40, 20, 36);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshStandardMaterial({ color: 0x166a8c, roughness: 0.22, metalness: 0.25, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X + 70, 0.01, 0);
  group.add(sea);

  // --- streets: marked asphalt, sidewalks, crosswalks --------------------
  const roadTex = roadTexture();
  const walkTex = sidewalkTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 });
  for (let i = -3; i <= 3; i++) {
    const c = i * BLOCK;
    const vTex = roadTex.clone();
    vTex.needsUpdate = true;
    vTex.repeat.set(1, 14);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, BAY_HALF * 2), new THREE.MeshStandardMaterial({ map: vTex, roughness: 0.95 }));
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.04, 0); v.receiveShadow = true; group.add(v);
    const hTex = roadTex.clone();
    hTex.needsUpdate = true;
    hTex.repeat.set(14, 1);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BAY_HALF * 2 - 30, ROAD), new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.95 }));
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.04, c); h.receiveShadow = true; group.add(h);
    // Sidewalk strips flanking both roads.
    for (const s of [-1, 1]) {
      const sv = new THREE.Mesh(new THREE.PlaneGeometry(3.4, BAY_HALF * 2), walkMat);
      sv.rotation.x = -Math.PI / 2; sv.position.set(c + s * (ROAD / 2 + 1.7), 0.06, 0); group.add(sv);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(BAY_HALF * 2 - 30, 3.4), walkMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.06, c + s * (ROAD / 2 + 1.7)); group.add(sh);
    }
    // Crosswalks where the grid crosses.
    for (let j = -3; j <= 3; j++) {
      const cw = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD, 7),
        new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.9 }),
      );
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(c, 0.07, j * BLOCK + 7);
      group.add(cw);
    }
  }

  // --- downtown towers: textured facades, glowing windows, rooftops ------
  const towerTexA = facadeTexture(rng, '#3a3f4d', 0.55);
  const towerTexB = facadeTexture(rng, '#4d3a3a', 0.5);
  const towerTexC = facadeTexture(rng, '#2f3a4a', 0.6);
  const towerMats = [towerTexA, towerTexB, towerTexC].map((tex) => new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.9,
  }));
  const roofMat = stdMat(0x4a3a30, 1);
  const acMat = stdMat(0x9aa0a8, 0.7, 0.4);
  const antennaMat = stdMat(0x222226, 0.6, 0.6);
  for (let i = 0; i < 9; i++) {
    const bx = -105 + (i % 3) * BLOCK, bz = -105 + Math.floor(i / 3) * BLOCK;
    const h = span(rng, 34, 72);
    const t = new THREE.Mesh(new THREE.BoxGeometry(26, h, 26), towerMats[i % 3]);
    t.position.set(bx, h / 2, bz);
    t.castShadow = true;
    t.receiveShadow = true;
    group.add(t);
    colliders.push({ x0: bx - 14, z0: bz - 14, x1: bx + 14, z1: bz + 14 });
    // Rooftop clutter: AC boxes, a water tower on some, an antenna.
    const ac = new THREE.Mesh(sharedGeo('ac', () => new THREE.BoxGeometry(3, 1.6, 2.4)), acMat);
    ac.position.set(bx - 6, h + 0.8, bz + 4);
    ac.castShadow = true;
    group.add(ac);
    const ac2 = ac.clone();
    ac2.position.set(bx + 7, h + 0.8, bz - 5);
    group.add(ac2);
    if (i % 3 === 0) {
      const tank = new THREE.Mesh(sharedGeo('tank', () => new THREE.CylinderGeometry(2.2, 2.2, 4, 10)), stdMat(0x7a5a38, 0.9));
      tank.position.set(bx + 6, h + 3.4, bz + 6);
      tank.castShadow = true;
      group.add(tank);
      const cone = new THREE.Mesh(sharedGeo('tankCone', () => new THREE.ConeGeometry(2.4, 2, 10)), stdMat(0x5a4028, 0.9));
      cone.position.set(bx + 6, h + 6.4, bz + 6);
      group.add(cone);
    }
    const mast = new THREE.Mesh(sharedGeo('mast', () => new THREE.CylinderGeometry(0.14, 0.22, 9, 6)), antennaMat);
    mast.position.set(bx - 8, h + 4.5, bz - 7);
    group.add(mast);
    const tip = new THREE.Mesh(sharedGeo('tip', () => new THREE.SphereGeometry(0.5, 8, 6)), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tip.position.set(bx - 8, h + 9.2, bz - 7);
    group.add(tip);
  }

  // --- mid-rise blocks and houses -----------------------------------------
  const houseColors = [0xd8a06a, 0xc9b18a, 0x9db8a4, 0xb98a8a, 0x8aa0b8, 0xd0c0a0];
  const houseTex = facadeTexture(rng, '#5a5148', 0.35);
  const landmarkSpots = [[-21, -21], [21, 63], [105, -63], [-63, 105]];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx < 0 && gz < 0) continue;
      const bx = gx * BLOCK + 21 + span(rng, -6, 6), bz = gz * BLOCK + 21 + span(rng, -6, 6);
      if (bx > BEACH_X - 24) continue;
      if (landmarkSpots.some(([lx, lz]) => flatDist(bx, bz, lx, lz) < 26)) continue;
      const w = span(rng, 14, 22), d = span(rng, 14, 22), h = span(rng, 7, 18);
      const mat = new THREE.MeshStandardMaterial({
        map: houseTex, color: choose(rng, houseColors), emissiveMap: houseTex,
        emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.95,
      });
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      house.position.set(bx, h / 2, bz);
      house.castShadow = true;
      house.receiveShadow = true;
      group.add(house);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), roofMat);
      roof.position.set(bx, h + 0.6, bz);
      group.add(roof);
      if (rng() < 0.45) {
        const awn = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.7, 2.2),
          new THREE.MeshStandardMaterial({ map: awningTexture('#d96a5f', '#fdf6e3'), roughness: 0.9, side: THREE.DoubleSide }),
        );
        awn.position.set(bx, 3.4, bz + d / 2 + 0.9);
        awn.rotation.x = -0.35;
        group.add(awn);
      }
      colliders.push({ x0: bx - w / 2 - 1, z0: bz - d / 2 - 1, x1: bx + w / 2 + 1, z1: bz + d / 2 + 1 });
    }
  }

  // --- landmarks with neon signs -------------------------------------------
  const neonMats = [];
  function neonSign(text, color, w, sub) {
    const tex = neonTexture(text, color, sub);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    neonMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.3125), mat);
    return m;
  }
  function landmark(x, z, w, d, h, color, label, neonColor) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(color, 0.9));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    colliders.push({ x0: x - w / 2 - 1, z0: z - d / 2 - 1, x1: x + w / 2 + 1, z1: z + d / 2 + 1 });
    const sign = neonSign(label, neonColor, Math.min(w * 0.9, 26));
    sign.position.set(x, h + 2.6, z + d / 2 + 0.5);
    group.add(sign);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(neonColor), transparent: true, opacity: 0.35, depthWrite: false }));
    glow.scale.set(w * 1.4, 9, 1);
    glow.position.set(x, h + 2.6, z + d / 2 + 1.2);
    group.add(glow);
    neonMats.push(glow.material);
    return { x, z, label };
  }
  const bank = landmark(-21, -21, 30, 22, 16, 0xe8e2d2, 'SOLMAR TRUST', '#ffc23b');
  const diner = landmark(21, 63, 20, 14, 8, 0xd96a5f, "ROSA'S", '#ff7a5a');
  const marina = landmark(105, -63, 18, 14, 9, 0x5f8aa8, 'MARINA', '#5ad8ff');
  const pd = landmark(-63, 105, 26, 18, 12, 0x5a6a8a, 'SOLMAR PD', '#5a8aff');
  // A couple of tower-top hotel signs for the skyline.
  const hotel = neonSign('PALMS HOTEL', '#ff5a9a', 24);
  hotel.position.set(-105, 74, -105);
  hotel.rotation.y = Math.PI / 4;
  group.add(hotel);
  const cinema = neonSign('BAY CINEMA', '#7affc9', 22);
  cinema.position.set(-63, 52, -63);
  cinema.rotation.y = -Math.PI / 4;
  group.add(cinema);

  // --- park (south-west): grass, pond, trees, benches -----------------------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 76),
    new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(-105, 0.05, 105);
  grass.receiveShadow = true;
  group.add(grass);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a6a8c, roughness: 0.15, metalness: 0.3 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-105, 0.06, 105);
  group.add(pond);
  const benchMat = stdMat(0x6a4a2a, 0.9);
  for (const [bx, bz, ry] of [[-92, 92, 0.4], [-118, 118, -0.7], [-88, 120, 1.2]]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(sharedGeo('benchSeat', () => new THREE.BoxGeometry(4, 0.3, 1.2)), benchMat);
    seat.position.y = 0.9;
    bench.add(seat);
    const back = new THREE.Mesh(sharedGeo('benchBack', () => new THREE.BoxGeometry(4, 1, 0.25)), benchMat);
    back.position.set(0, 1.5, -0.5);
    bench.add(back);
    bench.position.set(bx, 0, bz);
    bench.rotation.y = ry;
    group.add(bench);
  }

  // --- palms and park trees --------------------------------------------------
  const trunkMat = stdMat(0x7a5a38, 1);
  const frondTex = frondTexture();
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
  const leafMat = stdMat(0x2f7a3a, 1);
  function palm(x, z) {
    const g = new THREE.Group();
    let px = 0;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(sharedGeo('palmSeg', () => new THREE.CylinderGeometry(0.42, 0.62, 3.2, 7)), trunkMat);
      seg.position.set(px, 1.6 + i * 3, 0);
      seg.rotation.z = 0.1 * (i + 1);
      px += 0.32 * (i + 1);
      g.add(seg);
    }
    for (let i = 0; i < 2; i++) {
      const frond = new THREE.Mesh(sharedGeo('frond', () => new THREE.PlaneGeometry(7, 7)), frondMat);
      frond.position.set(px, 9.6, 0);
      frond.rotation.x = -Math.PI / 2 + 0.5;
      frond.rotation.z = (i / 2) * Math.PI;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    g.castShadow = true;
    group.add(g);
    colliders.push({ x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 });
  }
  function shadeTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(sharedGeo('treeTrunk', () => new THREE.CylinderGeometry(0.4, 0.6, 4, 7)), trunkMat);
    trunk.position.y = 2;
    g.add(trunk);
    const c1 = new THREE.Mesh(sharedGeo('canopy', () => new THREE.SphereGeometry(3.4, 10, 8)), leafMat);
    c1.position.y = 5.6;
    c1.castShadow = true;
    g.add(c1);
    const c2 = new THREE.Mesh(sharedGeo('canopy', () => new THREE.SphereGeometry(2.2, 10, 8)), stdMat(0x3a8a4a, 1));
    c2.position.set(1.8, 7, 0.6);
    c2.castShadow = true;
    g.add(c2);
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 });
  }
  for (let z = -130; z <= 130; z += 26) palm(BEACH_X - 4, z + span(rng, -6, 6));
  for (let i = 0; i < 8; i++) palm(-126 + rng() * 44, 84 + rng() * 44);
  for (let i = 0; i < 7; i++) shadeTree(-126 + rng() * 48, 84 + rng() * 48);

  // --- street lamps with pools of light + traffic lights ---------------------
  const lampPoleMat = stdMat(0x30343a, 0.6, 0.5);
  const lampBulbs = [];
  const lampGlows = [];
  for (let gx = -3; gx <= 2; gx++) {
    for (let gz = -3; gz <= 3; gz += 2) {
      const x = gx * BLOCK + 7, z = gz * BLOCK + 7;
      const pole = new THREE.Mesh(sharedGeo('lampPole', () => new THREE.CylinderGeometry(0.22, 0.32, 7, 6)), lampPoleMat);
      pole.position.set(x, 3.5, z);
      pole.castShadow = true;
      group.add(pole);
      const arm = new THREE.Mesh(sharedGeo('lampArm', () => new THREE.BoxGeometry(2.2, 0.22, 0.22)), lampPoleMat);
      arm.position.set(x + 1, 6.9, z);
      group.add(arm);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const bulb = new THREE.Mesh(sharedGeo('lampBulb', () => new THREE.SphereGeometry(0.55, 8, 6)), bulbMat);
      bulb.position.set(x + 2, 6.8, z);
      group.add(bulb);
      lampBulbs.push(bulbMat);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false }));
      glow.scale.set(7, 7, 1);
      glow.position.copy(bulb.position);
      group.add(glow);
      lampGlows.push(glow.material);
    }
  }
  // Traffic lights at four crossings.
  const lightMats = { red: [], amber: [], green: [] };
  for (const [lx, lz] of [[-42, -42], [42, 42], [-42, 42], [42, -42]]) {
    const pole = new THREE.Mesh(sharedGeo('tlPole', () => new THREE.CylinderGeometry(0.25, 0.3, 6.5, 6)), lampPoleMat);
    pole.position.set(lx + 6, 3.25, lz + 6);
    group.add(pole);
    const boxM = new THREE.Mesh(sharedGeo('tlBox', () => new THREE.BoxGeometry(1, 2.6, 1)), stdMat(0x1a1a1a, 0.6, 0.4));
    boxM.position.set(lx + 6, 6.8, lz + 6);
    group.add(boxM);
    const cols = [0xff2a2a, 0xffc23b, 0x2ee66a];
    const keys = ['red', 'amber', 'green'];
    cols.forEach((col, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const lamp = new THREE.Mesh(sharedGeo('tlLamp', () => new THREE.SphereGeometry(0.32, 8, 6)), mat);
      lamp.position.set(lx + 6, 7.7 - i * 0.85, lz + 6.6);
      group.add(lamp);
      lightMats[keys[i]].push(mat);
    });
  }

  // --- fire hydrants ---------------------------------------------------------
  const hydMat = stdMat(0xc23b2e, 0.6, 0.2);
  for (let i = 0; i < 10; i++) {
    const x = -126 + i * 26 + span(rng, -4, 4), z = (i % 2 === 0 ? -126 : 126) + span(rng, -4, 4);
    const h = new THREE.Mesh(sharedGeo('hydrant', () => new THREE.CylinderGeometry(0.4, 0.5, 1.1, 8)), hydMat);
    h.position.set(x, 0.55, z);
    group.add(h);
  }

  // --- pier over the sea -----------------------------------------------------
  const pierMat = stdMat(0x8a6a44, 0.95);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 46), pierMat);
  pier.position.set(SEA_X + 6, 0.9, -40);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  colliders.push({ x0: SEA_X + 1, z0: -64, x1: SEA_X + 11, z1: -16 });
  const postMat = stdMat(0x5a4028, 1);
  for (const pz of [-60, -48, -36, -24]) {
    for (const px of [SEA_X + 2.5, SEA_X + 9.5]) {
      const post = new THREE.Mesh(sharedGeo('pierPost', () => new THREE.CylinderGeometry(0.35, 0.35, 3.4, 6)), postMat);
      post.position.set(px, -0.6, pz);
      group.add(post);
    }
  }
  const pierSign = neonSign('PIER 9', '#5ad8ff', 12);
  pierSign.position.set(SEA_X + 6, 5.2, -62);
  group.add(pierSign);

  // --- parked-car spots ------------------------------------------------------
  for (let i = 0; i < 8; i++) {
    parkedSpots.push({
      x: -84 + (i % 4) * BLOCK, z: 21 + Math.floor(i / 4) * 84,
      heading: (i % 2 === 0 ? 0 : Math.PI / 2),
    });
  }

  // --- dusk cycle ------------------------------------------------------------
  const skyStops = [
    { t: 0.0, top: 0x274a7d, mid: 0xff9a4d, bot: 0x4a2430, sun: 0xffc07a, fog: 0xe08a5a, sunI: 2.6, hemiI: 0.85, lamp: 0.25, win: 0.35 },
    { t: 0.12, top: 0x2a3a6a, mid: 0xff7a4d, bot: 0x3a1a2a, sun: 0xff8a4d, fog: 0xd06a55, sunI: 2.1, hemiI: 0.7, lamp: 0.5, win: 0.6 },
    { t: 0.35, top: 0x1a2448, mid: 0xc95a6a, bot: 0x241426, sun: 0xff6a5a, fog: 0x9a5560, sunI: 1.2, hemiI: 0.5, lamp: 0.85, win: 0.9 },
    { t: 0.6, top: 0x0e1430, mid: 0x2a2a55, bot: 0x120e22, sun: 0x6a7ab0, fog: 0x23233e, sunI: 0.55, hemiI: 0.32, lamp: 1.0, win: 1.0 },
    { t: 0.85, top: 0x141c3c, mid: 0x3a3a5e, bot: 0x181228, sun: 0x8a8ac0, fog: 0x2c2c48, sunI: 0.8, hemiI: 0.42, lamp: 0.9, win: 0.85 },
    { t: 1.0, top: 0x274a7d, mid: 0xff9a4d, bot: 0x4a2430, sun: 0xffc07a, fog: 0xe08a5a, sunI: 2.6, hemiI: 0.85, lamp: 0.25, win: 0.35 },
  ];
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function updateSky(dayT) {
    let a = skyStops[0], b = skyStops[skyStops.length - 1];
    for (let i = 0; i < skyStops.length - 1; i++) {
      if (dayT >= skyStops[i].t && dayT <= skyStops[i + 1].t) { a = skyStops[i]; b = skyStops[i + 1]; break; }
    }
    const f = (dayT - a.t) / Math.max(0.001, b.t - a.t);
    const u = sky.uniforms;
    u.topColor.value.setHex(a.top).lerp(tmpB.setHex(b.top), f);
    u.midColor.value.setHex(a.mid).lerp(tmpB.setHex(b.mid), f);
    u.botColor.value.setHex(a.bot).lerp(tmpB.setHex(b.bot), f);
    u.sunColor.value.setHex(a.sun).lerp(tmpB.setHex(b.sun), f);
    // Low golden-hour sun, sweeping across the bay through the cycle.
    const az = -1.1 + dayT * 2.2;
    const el = 0.42 - Math.abs(dayT - 0.18) * 0.9;
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(Math.max(0.12, el)), Math.cos(az) * Math.cos(el)).normalize();
    u.sunDir.value.copy(sd);
    rig.sun.position.copy(sd).multiplyScalar(260);
    rig.sun.position.y = Math.max(45, rig.sun.position.y);
    rig.sun.color.setHex(a.sun).lerp(tmpB.setHex(b.sun), f);
    rig.sun.intensity = a.sunI + (b.sunI - a.sunI) * f;
    rig.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * f;
    scene.fog.color.setHex(a.fog).lerp(tmpB.setHex(b.fog), f);
    const lampI = a.lamp + (b.lamp - a.lamp) * f;
    lampBulbs.forEach((m) => { m.color.setHex(0xffe9a8); });
    lampGlows.forEach((m) => { m.opacity = lampI * 0.55; });
    const winI = a.win + (b.win - a.win) * f;
    towerMats.forEach((m) => { m.emissiveIntensity = winI; });
    return { lampGlow: lampI, night: f > 0.5 && dayT > 0.45 && dayT < 0.9 };
  }

  function animate(dt, now) {
    // Rolling sea.
    const pos = seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = seaBase[i * 3], by = seaBase[i * 3 + 1];
      pos.setZ(i, Math.sin(bx * 0.09 + now * 0.9) * 0.5 + Math.cos(by * 0.06 + now * 0.6) * 0.4);
    }
    pos.needsUpdate = true;
    seaGeo.computeVertexNormals();
    sky.drift(dt);
    // Traffic lights cycle slowly.
    const phase = Math.floor(now / 4) % 2;
    lightMats.red.forEach((m) => m.color.setHex(phase === 0 ? 0xff2a2a : 0x551111));
    lightMats.green.forEach((m) => m.color.setHex(phase === 0 ? 0x115522 : 0x2ee66a));
  }

  return {
    colliders, parkedSpots, bank, diner, marina, pd,
    playerSpawn: { x: 0, z: 96 },
    docks: { x: 105, z: -84 },
    updateSky, animate, sky,
  };
}
