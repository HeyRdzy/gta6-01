// Solmar Bay itself: the sun-soaked 3D city — street grid, towers downtown, beach and
// sea on the west edge, palms, lamps and parked cars. Builds the whole scene from a
// seeded generator, and hands back the building colliders the physics uses.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { randomInt, randomPick } from './random.js';

/** A canvas texture of lit windows for one building face, tinted to the building. */
function makeWindowTexture(random, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random() < 0.45;
      ctx.fillStyle = lit ? '#ffd98a' : '#2c3542';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Push a circle (x, z, radius) out of every building box it overlaps; returns true on a hit. */
export function resolveBuildingCollision(position, radius, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const box = colliders[i];
    const nearestX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));
    const dx = position.x - nearestX;
    const dz = position.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        position.x = nearestX + (dx / dist) * radius;
        position.z = nearestZ + (dz / dist) * radius;
      } else {
        position.x = box.maxX + radius;
      }
    }
  }
  return hit;
}

/** True when the point is inside any building box. */
export function pointInBuilding(x, z, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const box = colliders[i];
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true;
  }
  return false;
}

/** A free street point: on a street line, clear of buildings, for spawning cars and peds. */
export function randomStreetPoint(random, colliders) {
  for (let tries = 0; tries < 40; tries += 1) {
    const street = randomPick(random, CITY.streets);
    const along = -130 + random() * 260;
    const onXStreet = random() < 0.5;
    const x = onXStreet ? along : street + (random() < 0.5 ? -3.5 : 3.5);
    const z = onXStreet ? street + (random() < 0.5 ? -3.5 : 3.5) : along;
    if (!pointInBuilding(x, z, colliders)) return { x, z };
  }
  return { x: 0, z: 40 };
}

/**
 * Build the city into `scene` and return its colliders, landmark positions and a
 * list of street parking spots. Landmarks are the named places missions use.
 */
export function buildCity(scene, random) {
  const colliders = [];
  const landmarks = {
    diner: { x: -100, z: -60, name: 'Rosa\u2019s Diner' },
    marina: { x: 100, z: 100, name: 'Marina Gate' },
    cannery: { x: -100, z: 100, name: 'Old Cannery' },
    bank: { x: 20, z: -20, name: 'Solmar Trust Bank' },
    docks: { x: 120, z: -100, name: 'Dockyard' },
    beachBoat: { x: -168, z: 60, name: 'Beach Boat' },
    policeStation: { x: 0, z: 120, name: 'Solmar PD' },
  };
  const parkingSpots = [];

  // Sunset sky, warm fog and a low sun over the sea.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-140, 90, -60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x4a3f35, 1.1));
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-260, 55, -40);
  scene.add(sunDisc);

  // Ground: grass-grey city slab, sand strip, and animated-looking sea plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x5d6b52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-20, -0.05, 0);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-178, 0.0, 0);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-300, 0.05, 0);
  scene.add(sea);

  // Roads: dark strips along every street, with pale centre dashes and sidewalks.
  const roadMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d2b8 });
  const sidewalkMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const street of CITY.streets) {
    for (const horizontal of [true, false]) {
      const length = CITY.halfSize * 2 + 24;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : CITY.streetWidth, horizontal ? CITY.streetWidth : length), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : street, 0.01, horizontal ? street : 0);
      scene.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : CITY.streetWidth + 6, horizontal ? CITY.streetWidth + 6 : length), sidewalkMaterial);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : street, 0.005, horizontal ? street : 0);
      scene.add(walk);
      for (let d = -140; d <= 140; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 6 : 0.6, horizontal ? 0.6 : 6), dashMaterial);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? d : street, 0.02, horizontal ? street : d);
        scene.add(dash);
      }
    }
  }

  // Buildings: one or two per block, taller downtown, with lit-window textures.
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  for (const bx of CITY.blockCentres) {
    for (const bz of CITY.blockCentres) {
      const downtown = Math.abs(bx) <= 20 && Math.abs(bz) <= 20;
      const isPark = random() < 0.12;
      if (isPark) {
        const park = new THREE.Mesh(
          new THREE.CircleGeometry(13, 20),
          new THREE.MeshLambertMaterial({ color: 0x4f7a44 }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(bx, 0.03, bz);
        scene.add(park);
        const tree = makePalmTree(random);
        tree.position.set(bx + 5, 0, bz - 4);
        scene.add(tree);
        continue;
      }
      const width = 16 + random() * 8;
      const depth = 16 + random() * 8;
      const height = downtown ? 26 + random() * 30 : 9 + random() * 16;
      const color = randomPick(random, downtown ? PALETTE.tower : PALETTE.building);
      const material = new THREE.MeshLambertMaterial({
        map: makeWindowTexture(random, color),
        emissive: 0x332211,
        emissiveIntensity: 0.35,
      });
      const building = new THREE.Mesh(boxGeometry, material);
      building.scale.set(width, height, depth);
      building.position.set(bx, height / 2, bz);
      scene.add(building);
      colliders.push({ minX: bx - width / 2 - 0.4, maxX: bx + width / 2 + 0.4, minZ: bz - depth / 2 - 0.4, maxZ: bz + depth / 2 + 0.4 });
      if (random() < 0.5) {
        const annex = new THREE.Mesh(boxGeometry, new THREE.MeshLambertMaterial({ color: randomPick(random, PALETTE.building) }));
        annex.scale.set(8, 5 + random() * 4, 8);
        annex.position.set(bx + (random() < 0.5 ? -14 : 14), annex.scale.y / 2, bz + (random() < 0.5 ? -12 : 12));
        scene.add(annex);
      }
    }
  }

  // Landmark signs: coloured beacon pillars so mission places read at a glance.
  const landmarkColors = { diner: 0xff7b54, marina: 0x54c7ff, cannery: 0xc9a227, bank: 0x7dd87d, docks: 0xff5252, beachBoat: 0x54e0c7, policeStation: 0x5a7bff };
  for (const [key, place] of Object.entries(landmarks)) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.2, 9, 8),
      new THREE.MeshLambertMaterial({ color: landmarkColors[key] || 0xffffff, emissive: landmarkColors[key] || 0xffffff, emissiveIntensity: 0.5 }),
    );
    pillar.position.set(place.x, 4.5, place.z);
    scene.add(pillar);
  }

  // Palm trees along the beach and the marina road.
  for (let i = 0; i < 26; i += 1) {
    const tree = makePalmTree(random);
    const onBeach = i % 2 === 0;
    tree.position.set(onBeach ? -168 + random() * 8 : -140 + random() * 280, 0, onBeach ? -150 + random() * 300 : 126 + random() * 6);
    scene.add(tree);
  }

  // Street lamps at intersections.
  const lampPole = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      if ((sx + sz) % 80 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampPole);
      pole.position.set(sx + 7, 3.5, sz + 7);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampGlow);
      bulb.position.set(sx + 7, 7.1, sz + 7);
      scene.add(bulb);
    }
  }

  // Parking spots along the streets where stealable cars wait.
  for (let i = 0; i < 14; i += 1) {
    const street = randomPick(random, CITY.streets);
    const along = -130 + random() * 260;
    const horizontal = random() < 0.5;
    parkingSpots.push({
      x: horizontal ? along : street + 8.5,
      z: horizontal ? street + 8.5 : along,
      heading: horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
    });
  }

  return { colliders, landmarks, parkingSpots };
}

/** One palm: a leaning trunk and a crown of flat fronds. */
function makePalmTree(random) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.45, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5a38 }),
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = (random() - 0.5) * 0.25;
  group.add(trunk);
  const frondMaterial = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), frondMaterial);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.6, 7, Math.sin(angle) * 1.6);
    frond.rotation.set(0.5, -angle, 0);
    frond.rotation.order = 'YXZ';
    group.add(frond);
  }
  return group;
}

/** The golden waypoint beacon: a pulsing column and a floating diamond over a target. */
export function makeWaypointBeacon(color) {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: color || 0xffc23b, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 15;
  group.add(column);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: color || 0xffc23b }),
  );
  diamond.position.y = 6;
  diamond.name = 'beaconDiamond';
  group.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color: color || 0xffc23b, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  return group;
}

/** A small glowing pickup parcel. */
export function makePackageMesh() {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.8, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xffc23b, emissive: 0xc06644 }),
  );
  box.position.y = 1.2;
  group.add(box);
  return group;
}
