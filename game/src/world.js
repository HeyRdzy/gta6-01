// Solmar Bay: the city. Streets on a 30-unit grid, downtown towers in the
// north-west, a park in the south-west, the beach and pier in the east and the
// dockyard in the south-east. Everything is built from shared boxes, cylinders
// and canvas textures, and every building registers a collision box.

import * as THREE from 'three';
import {
  basicMat,
  facadeTexture,
  glowTexture,
  neonTexture,
  roadTexture,
  sandTexture,
  sidewalkTexture,
  stdMat,
  unitBox,
  unitCone,
  unitCylinder,
  unitPlane,
  unitSphere,
} from './visuals.js';
import { clamp, hash2, mulberry32, range } from './util.js';

export const CITY_HALF = 180;
export const STREET_STEP = 30;
export const ROAD_HALF = 3;
export const BEACH_X = 150;
export const SEA_X = 182;

const STREETS = [];
for (let v = -CITY_HALF; v <= CITY_HALF; v += STREET_STEP) STREETS.push(v);

function blockZone(cx, cz) {
  if (cx > BEACH_X) return 'sea';
  if (cx >= 60 && cz >= 90) return 'dock';
  if (cx < -30 && cz > 30) return 'park';
  if (cx >= 138) return 'beach';
  if (cx < -30 && cz < -30) return 'downtown';
  return 'homes';
}

export function buildCity(scene) {
  const rng = mulberry32(77);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = [];
  const landmarks = [];
  const facadeMats = [];
  const neonMats = [];
  const lampGlows = [];

  const addCollider = (x, z, hw, hd) => {
    colliders.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
  };

  const collides = (x, z, r) => {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return c;
    }
    return null;
  };

  // ---------------------------------------------------------- ground + roads
  const ground = new THREE.Mesh(
    unitPlane(),
    stdMat('ground', () => new THREE.MeshStandardMaterial({ color: 0x46503f, roughness: 1 }))
  );
  ground.rotation.x = -Math.PI / 2;
  ground.scale.set(CITY_HALF * 2 + 40, CITY_HALF * 2 + 40, 1);
  ground.position.set(0, -0.08, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const roadTex = roadTexture();
  const roadMat = stdMat('road', () => new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }));
  const walkTex = sidewalkTexture();
  const walkMat = stdMat('walk', () => new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 }));

  for (const v of STREETS) {
    for (const along of [true, false]) {
      const road = new THREE.Mesh(unitPlane(), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (along) {
        road.rotation.z = Math.PI / 2;
        road.position.set(v, 0, 0);
        road.scale.set(CITY_HALF * 2, ROAD_HALF * 2, 1);
      } else {
        road.position.set(0, 0, v);
        road.scale.set(CITY_HALF * 2, ROAD_HALF * 2, 1);
      }
      road.receiveShadow = true;
      group.add(road);
      // Sidewalk strips on both edges of the street.
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(unitPlane(), walkMat);
        walk.rotation.x = -Math.PI / 2;
        const off = ROAD_HALF + 1.4;
        if (along) {
          walk.rotation.z = Math.PI / 2;
          walk.position.set(v + side * off, 0.02, 0);
          walk.scale.set(CITY_HALF * 2, 2.8, 1);
        } else {
          walk.position.set(0, 0.02, v + side * off);
          walk.scale.set(CITY_HALF * 2, 2.8, 1);
        }
        walk.receiveShadow = true;
        group.add(walk);
      }
    }
  }

  // Crosswalk stripes at the four intersections around the spawn.
  const crossMat = stdMat('cross', () => new THREE.MeshBasicMaterial({ color: 0xd8d8d0 }));
  for (const [ix, iz] of [[0, 90], [0, 60], [30, 90], [-30, 90]]) {
    for (let s = 0; s < 5; s++) {
      const stripe = new THREE.Mesh(unitPlane(), crossMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(ix - 2.4 + s * 1.2, 0.04, iz - 4.6);
      stripe.scale.set(0.7, 2.4, 1);
      group.add(stripe);
    }
  }

  // ---------------------------------------------------------- facades
  const facadeVariants = [];
  for (let v = 0; v < 6; v++) {
    const tex = facadeTexture(mulberry32(1000 + v * 77), v);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffc06a),
      emissiveIntensity: 0.25,
      roughness: 0.85,
    });
    facadeVariants.push(mat);
    facadeMats.push(mat);
  }
  const roofMat = stdMat('roof', () => new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 1 }));
  const dockMat = stdMat('dockwall', () => new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.9 }));
  const dockRoof = stdMat('dockroof', () => new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }));

  const NEON_SIGNS = [
    { text: 'SOLMAR TRUST', fg: '#59d8ff', bg: '#0a2030', x: -75, z: -75, h: 30 },
    { text: "ROSA'S", fg: '#ff5c8a', bg: '#2a0a18', x: 45, z: -45, h: 10 },
    { text: 'MARINA', fg: '#7dffce', bg: '#0a2418', x: 165, z: -15, h: 8 },
    { text: 'SOLMAR PD', fg: '#6fa8ff', bg: '#0a1430', x: -105, z: -15, h: 12 },
    { text: 'PALMS HOTEL', fg: '#ffd75e', bg: '#241a08', x: 135, z: 15, h: 22 },
    { text: 'BAY CINEMA', fg: '#ff9a5c', bg: '#241008', x: 75, z: 45, h: 12 },
    { text: 'PIER 9', fg: '#8affff', bg: '#082024', x: 165, z: 45, h: 8 },
  ];

  function neonSign(def) {
    const tex = neonTexture(def.text, def.fg, def.bg);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    neonMats.push(mat);
    const board = new THREE.Mesh(unitBox(), mat);
    board.scale.set(13, 2.4, 0.25);
    board.position.set(def.x, def.h, def.z);
    board.castShadow = false;
    group.add(board);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: new THREE.Color(def.fg),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    glow.scale.set(15, 4, 1);
    glow.position.copy(board.position);
    group.add(glow);
    lampGlows.push(glow);
    landmarks.push({ x: def.x, z: def.z, name: def.text, color: def.fg });
  }

  // ---------------------------------------------------------- buildings
  const roofProps = [
    { w: 2.2, h: 1.1, d: 2.2, color: 0x8a8f94 },
    { w: 1.2, h: 2.6, d: 1.2, color: 0x6a6f75 },
    { w: 3.0, h: 0.9, d: 1.6, color: 0x7d8288 },
  ];
  const propMat = stdMat('roofprop', () => new THREE.MeshStandardMaterial({ color: 0x7d8288, roughness: 1 }));
  const antennaMat = stdMat('antenna', () => new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.6, metalness: 0.4 }));
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

  function rooftop(x, z, w, d, topY) {
    const r = rng();
    if (r < 0.45) {
      const p = roofProps[Math.floor(rng() * roofProps.length)];
      const box = new THREE.Mesh(unitBox(), propMat);
      box.scale.set(p.w, p.h, p.d);
      box.position.set(x + range(rng, -w / 5, w / 5), topY + p.h / 2, z + range(rng, -d / 5, d / 5));
      box.castShadow = true;
      group.add(box);
    }
    if (r > 0.55) {
      const ant = new THREE.Mesh(unitCylinder(6), antennaMat);
      ant.scale.set(0.12, 5, 0.12);
      ant.position.set(x + w / 3, topY + 2.5, z - d / 3);
      group.add(ant);
      const tip = new THREE.Mesh(unitSphere(6, 5), tipMat);
      tip.scale.setScalar(0.28);
      tip.position.set(x + w / 3, topY + 5.1, z - d / 3);
      group.add(tip);
    }
  }

  function tower(cx, cz, w, h, d, variant) {
    const side = facadeVariants[variant % facadeVariants.length];
    const mesh = new THREE.Mesh(unitBox(), [side, side, roofMat, roofMat, side, side]);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    addCollider(cx, cz, w / 2 + 0.3, d / 2 + 0.3);
    rooftop(cx, cz, w, d, h);
  }

  let signIndex = 0;
  for (let bx = -5; bx <= 5; bx++) {
    for (let bz = -5; bz <= 5; bz++) {
      const cx = bx * STREET_STEP + STREET_STEP / 2;
      const cz = bz * STREET_STEP + STREET_STEP / 2;
      const zone = blockZone(cx, cz);
      if (zone === 'sea' || zone === 'park' || zone === 'beach') continue;
      const v = hash2(bx, bz, 77);
      if (zone === 'dock') {
        // Warehouses: wide, low, flat-roofed.
        if (v < 0.25) continue;
        const w = 20 + v * 8;
        const d = 14 + hash2(bx, bz, 5) * 6;
        const h = 8 + hash2(bx, bz, 9) * 4;
        const mesh = new THREE.Mesh(unitBox(), [dockMat, dockMat, dockRoof, dockRoof, dockMat, dockMat]);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        addCollider(cx, cz, w / 2 + 0.3, d / 2 + 0.3);
        continue;
      }
      if (v < 0.18) continue; // empty lot / plaza
      const tall = zone === 'downtown';
      const w = tall ? 14 + v * 8 : 10 + v * 8;
      const d = tall ? 14 + hash2(bx, bz, 3) * 8 : 10 + hash2(bx, bz, 4) * 8;
      const h = tall ? 26 + hash2(bx, bz, 7) * 38 : 8 + hash2(bx, bz, 8) * 10;
      const variant = Math.floor(hash2(bx, bz, 11) * 6);
      tower(cx, cz, w, h, d, variant);
      if (signIndex < NEON_SIGNS.length && hash2(bx, bz, 13) > 0.55) {
        const s = NEON_SIGNS[signIndex++];
        neonSign({ ...s, x: cx, z: cz - d / 2 - 0.4, h: Math.min(h * 0.55, 26) });
      }
    }
  }
  // Any signs not placed on towers go on their own posts.
  for (; signIndex < NEON_SIGNS.length; signIndex++) {
    neonSign(NEON_SIGNS[signIndex]);
  }

  // ---------------------------------------------------------- lamps + lights
  const poleMat = stdMat('pole', () => new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.6, metalness: 0.5 }));
  const lampHeadMat = stdMat('lamphead', () => new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.4 }));
  const warmGlow = glowTexture();
  let lampCount = 0;
  for (const v of STREETS) {
    for (let u = -150; u <= 150; u += 60) {
      if (lampCount >= 26) break;
      const along = lampCount % 2 === 0;
      const x = along ? v : u;
      const z = along ? u : v;
      if (x > BEACH_X - 6 || blockZone(x, z) === 'sea') continue;
      const pole = new THREE.Mesh(unitCylinder(8), poleMat);
      pole.scale.set(0.14, 6.5, 0.14);
      pole.position.set(x + 3.6, 3.25, z + 3.6);
      pole.castShadow = true;
      group.add(pole);
      const head = new THREE.Mesh(unitBox(), lampHeadMat);
      head.scale.set(0.9, 0.28, 0.4);
      head.position.set(x + 3.4, 6.6, z + 3.6);
      group.add(head);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: warmGlow,
          color: 0xffd9a0,
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glow.scale.set(7, 7, 1);
      glow.position.set(x + 3.4, 6.4, z + 3.6);
      group.add(glow);
      lampGlows.push(glow);
      lampCount++;
    }
  }

  // Traffic lights at six downtown intersections, cycling together.
  const bulbMats = {
    red: new THREE.MeshBasicMaterial({ color: 0x881111 }),
    yellow: new THREE.MeshBasicMaterial({ color: 0x886611 }),
    green: new THREE.MeshBasicMaterial({ color: 0x118833 }),
  };
  const lightHeads = [];
  for (const [lx, lz] of [[-30, -30], [0, -30], [30, -30], [-30, 0], [0, 0], [30, 0]]) {
    const pole = new THREE.Mesh(unitCylinder(8), poleMat);
    pole.scale.set(0.14, 5.4, 0.14);
    pole.position.set(lx + 3.4, 2.7, lz + 3.4);
    group.add(pole);
    const head = new THREE.Mesh(unitBox(), lampHeadMat);
    head.scale.set(0.5, 1.5, 0.5);
    head.position.set(lx + 3.4, 5.6, lz + 3.4);
    group.add(head);
    const bulbs = [];
    for (let b = 0; b < 3; b++) {
      const bulb = new THREE.Mesh(unitSphere(8, 6), b === 0 ? bulbMats.red : b === 1 ? bulbMats.yellow : bulbMats.green);
      bulb.scale.setScalar(0.2);
      bulb.position.set(lx + 3.4, 6.05 - b * 0.42, lz + 3.4 + 0.28);
      group.add(bulb);
      bulbs.push(bulb);
    }
    lightHeads.push(bulbs);
  }

  // ---------------------------------------------------------- park
  const pond = new THREE.Mesh(
    unitCylinder(24),
    stdMat('pond', () => new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.25, metalness: 0.2 }))
  );
  pond.scale.set(11, 0.3, 8);
  pond.position.set(-120, 0.15, 105);
  group.add(pond);
  landmarks.push({ x: -120, z: 105, name: 'PARK POND', color: '#7fd4ff' });

  const benchMat = stdMat('bench', () => new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 1 }));
  for (const [bx, bz, ry] of [[-105, 90, 0.4], [-135, 120, -0.3], [-90, 135, 1.2], [-150, 75, 0.9]]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(unitBox(), benchMat);
    seat.scale.set(2.2, 0.16, 0.7);
    seat.position.y = 0.5;
    bench.add(seat);
    const back = new THREE.Mesh(unitBox(), benchMat);
    back.scale.set(2.2, 0.7, 0.14);
    back.position.set(0, 0.95, -0.32);
    bench.add(back);
    for (const s of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(unitBox(), poleMat);
      leg.scale.set(0.12, 0.5, 0.6);
      leg.position.set(s, 0.25, 0);
      bench.add(leg);
    }
    bench.position.set(bx, 0, bz);
    bench.rotation.y = ry;
    bench.castShadow = true;
    group.add(bench);
  }

  const trunkMat = stdMat('trunk', () => new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 1 }));
  const leafMat = stdMat('leaf', () => new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }));
  const leafMat2 = stdMat('leaf2', () => new THREE.MeshStandardMaterial({ color: 0x54964a, roughness: 1 }));

  function tree(x, z, s) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(unitCylinder(7), trunkMat);
    trunk.scale.set(0.35 * s, 3.2 * s, 0.35 * s);
    trunk.position.y = 1.6 * s;
    trunk.castShadow = true;
    t.add(trunk);
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(unitSphere(10, 8), i % 2 ? leafMat : leafMat2);
      const a = (i / 3) * Math.PI * 2;
      puff.scale.setScalar((1.6 + (i % 2) * 0.5) * s);
      puff.position.set(Math.cos(a) * 0.8 * s, (3.4 + i * 0.55) * s, Math.sin(a) * 0.8 * s);
      puff.castShadow = true;
      t.add(puff);
    }
    t.position.set(x, 0, z);
    group.add(t);
    return t;
  }

  function palm(x, z, lean) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(unitCylinder(7), trunkMat);
    trunk.scale.set(0.28, 7, 0.28);
    trunk.position.y = 3.5;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    p.add(trunk);
    const frondMat = stdMat('frond', () => new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: 1, side: THREE.DoubleSide }));
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(unitCone(4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.scale.set(0.55, 3.4, 0.12);
      frond.position.set(Math.cos(a) * 1.5, 6.9, Math.sin(a) * 1.5);
      frond.rotation.z = Math.cos(a) * 1.15;
      frond.rotation.x = -Math.sin(a) * 1.15;
      frond.castShadow = true;
      p.add(frond);
    }
    p.position.set(x, 0, z);
    group.add(p);
    return p;
  }

  for (let i = 0; i < 14; i++) {
    tree(-165 + rng() * 120, 45 + rng() * 120, 0.8 + rng() * 0.7);
  }
  for (let i = 0; i < 10; i++) {
    palm(156 + rng() * 12, -120 + i * 26 + rng() * 8, (rng() - 0.5) * 0.25);
  }
  for (let i = 0; i < 6; i++) {
    tree(20 + rng() * 120, -160 + rng() * 40, 0.7 + rng() * 0.5);
  }

  // Hydrants.
  const hydMat = stdMat('hydrant', () => new THREE.MeshStandardMaterial({ color: 0xc22a1e, roughness: 0.6 }));
  for (const [hx, hz] of [[-27, 60], [33, -60], [93, 30], [-93, -120], [3, 150], [123, -90]]) {
    const hyd = new THREE.Mesh(unitCylinder(8), hydMat);
    hyd.scale.set(0.35, 0.9, 0.35);
    hyd.position.set(hx, 0.45, hz);
    hyd.castShadow = true;
    group.add(hyd);
    const cap = new THREE.Mesh(unitSphere(8, 6), hydMat);
    cap.scale.setScalar(0.3);
    cap.position.set(hx, 0.95, hz);
    group.add(cap);
  }

  // ---------------------------------------------------------- beach, sea, pier
  const sandTex = sandTexture();
  const sand = new THREE.Mesh(
    unitPlane(),
    stdMat('sand', () => new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }))
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((BEACH_X + SEA_X) / 2, 0.01, 0);
  sand.scale.set(SEA_X - BEACH_X + 6, CITY_HALF * 2 + 20, 1);
  sand.receiveShadow = true;
  group.add(sand);

  const seaGeo = new THREE.PlaneGeometry(230, 400, 20, 32);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = stdMat('sea', () => new THREE.MeshStandardMaterial({ color: 0x1e5f7a, roughness: 0.3, metalness: 0.25 }));
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(SEA_X + 115, -0.4, 0);
  group.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();

  const pierMat = stdMat('pier', () => new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 1 }));
  const pierDeck = new THREE.Mesh(unitBox(), pierMat);
  pierDeck.scale.set(34, 0.5, 7);
  pierDeck.position.set(SEA_X + 15, 1.4, 0);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  group.add(pierDeck);
  for (let px = SEA_X + 2; px <= SEA_X + 30; px += 7) {
    for (const pz of [-3, 3]) {
      const post = new THREE.Mesh(unitCylinder(8), poleMat);
      post.scale.set(0.35, 2.6, 0.35);
      post.position.set(px, 0.4, pz);
      group.add(post);
    }
  }
  landmarks.push({ x: SEA_X + 15, z: 0, name: 'PIER 9', color: '#8affff' });

  // ---------------------------------------------------------- dockyard props
  const containerColors = [0xb0503a, 0x3a6fb0, 0x4a9a4a, 0xb09a3a, 0x7a4a9a];
  for (let i = 0; i < 10; i++) {
    const cMat = stdMat(`cont${i % 5}`, () => new THREE.MeshStandardMaterial({ color: containerColors[i % 5], roughness: 0.85 }));
    const cont = new THREE.Mesh(unitBox(), cMat);
    const cw = 6 + (i % 3);
    cont.scale.set(cw, 2.6, 2.6);
    cont.position.set(105 + (i % 5) * 13, 1.3 + (i % 2) * 2.7, 150 - Math.floor(i / 5) * 12);
    cont.rotation.y = (i % 2) * 0.08;
    cont.castShadow = true;
    group.add(cont);
    addCollider(cont.position.x, cont.position.z, cw / 2 + 0.2, 1.6);
  }
  // Two gantry cranes over the dockyard.
  for (const [cx, cz] of [[120, 120], [150, 165]]) {
    const crane = new THREE.Group();
    for (const s of [-6, 6]) {
      const leg = new THREE.Mesh(unitBox(), poleMat);
      leg.scale.set(1, 18, 1);
      leg.position.set(s, 9, 0);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beam = new THREE.Mesh(unitBox(), stdMat('crane', () => new THREE.MeshStandardMaterial({ color: 0xc2a23a, roughness: 0.7 })));
    beam.scale.set(20, 1.4, 1.4);
    beam.position.set(0, 18.5, 0);
    beam.castShadow = true;
    crane.add(beam);
    crane.position.set(cx, 0, cz);
    group.add(crane);
    addCollider(cx, cz, 7, 2);
  }

  scene.add(group);

  return {
    group,
    colliders,
    collides,
    landmarks,
    update(dt, timeSec, dayT, windowGlow) {
      // Windows glow as the light fades.
      for (const m of facadeMats) m.emissiveIntensity = 0.08 + windowGlow * 0.85;
      for (const g of lampGlows) g.material.opacity = clamp(0.55 * windowGlow - 0.05, 0, 0.6);
      // Traffic lights cycle: green 6s, yellow 1.5s, red 6s.
      const phase = (timeSec % 13.5) / 13.5;
      const on = phase < 0.44 ? 'green' : phase < 0.56 ? 'yellow' : 'red';
      bulbMats.red.color.setHex(on === 'red' ? 0xff2a2a : 0x881111);
      bulbMats.yellow.color.setHex(on === 'yellow' ? 0xffc21a : 0x886611);
      bulbMats.green.color.setHex(on === 'green' ? 0x2aff66 : 0x118833);
      // Sea swell.
      const pos = seaGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = seaBase[i * 3];
        const bz = seaBase[i * 3 + 2];
        pos.setY(i, Math.sin(bx * 0.12 + timeSec * 0.9) * 0.35 + Math.cos(bz * 0.1 + timeSec * 0.6) * 0.3);
      }
      pos.needsUpdate = true;
      seaGeo.computeVertexNormals();
    },
  };
}
