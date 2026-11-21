// Solmar Heat — traffic cars and pedestrians. Written fresh for round 4.
// Cars follow the street graph node to node (right-hand lane); pedestrians
// walk the sidewalks, flee gunfire, and hail a taxi when the player drives one.
import { CFG } from './config.js';
import { rand, randInt, choice, clamp, dist, angleDiff } from './util.js';
import { S } from './state.js';
import { nearestNode } from './world.js';
import { drawCar } from './hero.js';

const CAR_COLORS = ['#b8442c', '#2c6eb8', '#c9c9c9', '#3f8f4f', '#e8e8e8', '#222831', '#c97b2c'];
const PED_COLORS = ['#d94f70', '#4f7dd9', '#e8a13a', '#7a4a8a', '#3a9e7a', '#c9c9c9'];

function makeCar(G, x, z) {
  const type = Math.random() < 0.14 ? 'taxi' : Math.random() < 0.1 ? 'truck' : 'sedan';
  return {
    x, z,
    angle: rand(0, Math.PI * 2),
    speed: 0,
    targetSpeed: rand(CFG.TRAFFIC_SPEED_MIN, CFG.TRAFFIC_SPEED_MAX),
    color: type === 'taxi' ? '#ffd319' : choice(CAR_COLORS),
    type,
    len: type === 'truck' ? 14 : 11,
    hp: 100,
    maxHp: 100,
    isPlayer: false,
    node: null,
    tx: x,
    tz: z,
  };
}

function makePed(G, x, z) {
  return {
    x, z,
    angle: rand(0, Math.PI * 2),
    speed: rand(CFG.PED_SPEED_MIN, CFG.PED_SPEED_MAX),
    color: choice(PED_COLORS),
    state: 'walk', // walk | hail | flee | riding | dead
    node: null,
    tx: x,
    tz: z,
    bob: rand(0, Math.PI * 2),
    deadAt: 0,
  };
}

function randomNodeNear(G, x, z, minD, maxD) {
  const nodes = G.world.nodes;
  for (let i = 0; i < 12; i++) {
    const n = choice(nodes);
    const d = dist(x, z, n.x, n.z);
    if (d >= minD && d <= maxD) return n;
  }
  return choice(nodes);
}

function adjacentNode(G, node, from) {
  const opts = [];
  for (const n of G.world.nodes) {
    const sameX = n.x === node.x && Math.abs(n.z - node.z) === 60;
    const sameZ = n.z === node.z && Math.abs(n.x - node.x) === 60;
    if (sameX || sameZ) {
      if (from && n.x === from.x && n.z === from.z) continue;
      opts.push(n);
    }
  }
  return opts.length ? choice(opts) : choice(G.world.nodes);
}

export function createTraffic(G) {
  const T = { cars: [], peds: [], hailTimer: 0 };
  for (let i = 0; i < 14; i++) {
    const n = choice(G.world.nodes);
    const car = makeCar(G, n.x + rand(-6, 6), n.z + rand(-6, 6));
    car.node = adjacentNode(G, n, null);
    T.cars.push(car);
  }
  for (let i = 0; i < 24; i++) {
    const n = choice(G.world.nodes);
    const ped = makePed(G, n.x + rand(-12, 12), n.z + rand(-12, 12));
    ped.node = adjacentNode(G, n, null);
    T.peds.push(ped);
  }
  return T;
}

function carTarget(car) {
  // Right-hand lane: offset the node by +3.5 perpendicular-right of travel.
  const dx = car.node.x - car.x;
  const dz = car.node.z - car.z;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len;
  const rz = dx / len;
  return { x: car.node.x + rx * 3.5, z: car.node.z + rz * 3.5 };
}

export function updateTraffic(G, dt) {
  const T = G.traffic;
  const P = S.player;

  // --- Cars ---
  for (const car of T.cars) {
    if (car.isPlayer) continue;
    if (car.hp <= 0) continue; // wrecked cars stay put and smoke
    const tgt = carTarget(car);
    const dx = tgt.x - car.x;
    const dz = tgt.z - car.z;
    const dNode = Math.hypot(car.node.x - car.x, car.node.z - car.z);
    if (dNode < 5) {
      car.node = adjacentNode(G, car.node, null);
      continue;
    }
    const want = Math.atan2(dz, dx);
    const turn = clamp(angleDiff(want, car.angle), -2.4 * dt, 2.4 * dt);
    car.angle += turn;
    // Slow down for anything ahead.
    let targetSpeed = car.targetSpeed;
    const aheadX = car.x + Math.cos(car.angle) * 10;
    const aheadZ = car.z + Math.sin(car.angle) * 10;
    for (const other of T.cars) {
      if (other === car || other.isPlayer) continue;
      if (dist(aheadX, aheadZ, other.x, other.z) < 7) {
        targetSpeed = 0;
        break;
      }
    }
    if (P.car && dist(aheadX, aheadZ, P.car.x, P.car.z) < 8) targetSpeed = 0;
    car.speed += clamp(targetSpeed - car.speed, -30 * dt, 14 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z += Math.sin(car.angle) * car.speed * dt;
    // Bump into the player's car.
    if (P.car && dist(car.x, car.z, P.car.x, P.car.z) < 8) {
      const push = 8 - dist(car.x, car.z, P.car.x, P.car.z);
      const a = Math.atan2(car.z - P.car.z, car.x - P.car.x);
      car.x += Math.cos(a) * push * 0.5;
      car.z += Math.sin(a) * push * 0.5;
      car.speed *= 0.6;
      P.car.speed *= 0.85;
    }
    // Keep cars near the player: respawn far ones close by.
    if (dist(car.x, car.z, P.x, P.z) > 340) {
      const n = randomNodeNear(G, P.x, P.z, 120, 220);
      car.x = n.x;
      car.z = n.z;
      car.node = adjacentNode(G, n, null);
    }
  }

  // --- Pedestrians ---
  for (const ped of T.peds) {
    if (ped.state === 'dead') {
      if (S.time - ped.deadAt > 20) {
        const n = randomNodeNear(G, P.x, P.z, 100, 200);
        ped.x = n.x;
        ped.z = n.z;
        ped.state = 'walk';
        ped.node = adjacentNode(G, n, null);
      }
      continue;
    }
    if (ped.state === 'riding') continue;
    if (ped.state === 'hail') {
      // Wave for the taxi; the fare is picked up by traffic (E) below.
      ped.bob += dt * 6;
      continue;
    }
    const dNode = Math.hypot(ped.node.x - ped.x, ped.node.z - ped.z);
    if (dNode < 4) {
      ped.node = adjacentNode(G, ped.node, null);
      // Walk on the sidewalk: offset the target off the road centre.
      ped.tx = ped.node.x + (Math.random() < 0.5 ? -1 : 1) * 10;
      ped.tz = ped.node.z + (Math.random() < 0.5 ? -1 : 1) * 10;
    }
    const want = Math.atan2(ped.tz - ped.z, ped.tx - ped.x);
    ped.angle += clamp(angleDiff(want, ped.angle), -3 * dt, 3 * dt);
    const spd = ped.state === 'flee' ? ped.speed * 2.2 : ped.speed;
    ped.x += Math.cos(ped.angle) * spd * dt;
    ped.z += Math.sin(ped.angle) * spd * dt;
    ped.bob += dt * spd * 0.9;
    if (ped.state === 'flee' && dist(ped.x, ped.z, P.x, P.z) > 90) ped.state = 'walk';
    if (dist(ped.x, ped.z, P.x, P.z) > 320) {
      const n = randomNodeNear(G, P.x, P.z, 100, 200);
      ped.x = n.x;
      ped.z = n.z;
      ped.node = adjacentNode(G, n, null);
    }
  }

  // --- Taxi hails: when the player drives a taxi, a nearby ped may hail ---
  T.hailTimer -= dt;
  if (P.car && P.car.type === 'taxi' && !S.fare && T.hailTimer <= 0) {
    T.hailTimer = 2;
    const near = T.peds.filter((p) => p.state === 'walk' && dist(p.x, p.z, P.x, P.z) < 80);
    if (near.length && Math.random() < 0.6) {
      choice(near).state = 'hail';
    }
  }

  // --- Fare pickup (E) — checked here so it consumes the key before hero's exit ---
  if (P.car && P.car.type === 'taxi' && !S.fare && G.input.pressed('KeyE')) {
    let best = null;
    let bestD = 11;
    for (const ped of T.peds) {
      if (ped.state !== 'hail') continue;
      const d = dist(ped.x, ped.z, P.x, P.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (best) {
      best.state = 'riding';
      const dest = randomNodeNear(G, P.x, P.z, 90, 260);
      S.fare = { destX: dest.x, destZ: dest.z, amount: randInt(CFG.FARE_MIN, CFG.FARE_MAX), ped: best };
      G.display.toast(`Fare! Take them to the gold marker — $${S.fare.amount}`);
      G.sound.chime();
    } else {
      // No fare to take: give the keypress back by re-adding it, so hero can exit.
      G.input.keys.add('KeyE');
    }
  }
}

// Make nearby pedestrians flee from a gunshot at (x, z).
export function scarePeds(G, x, z) {
  for (const ped of G.traffic.peds) {
    if (ped.state === 'dead' || ped.state === 'riding') continue;
    if (dist(ped.x, ped.z, x, z) < 55) {
      ped.state = 'flee';
      ped.tx = ped.x + (ped.x - x) * 2;
      ped.tz = ped.z + (ped.z - z) * 2;
    }
  }
}

export function drawTraffic(G) {
  const { ctx, scale } = G;
  for (const car of G.traffic.cars) {
    if (car.hp <= 0) {
      // Wreck: darkened body, smoke handled by particles.
      drawCar(G, { ...car, color: '#3a3a3a' });
      continue;
    }
    drawCar(G, car);
  }
  for (const ped of G.traffic.peds) {
    if (ped.state === 'riding') continue;
    const p = { x: (ped.x - S.camera.x) * scale + G.vw / 2, y: (ped.z - S.camera.z) * scale + G.vh / 2 };
    if (p.x < -20 || p.x > G.vw + 20 || p.y < -20 || p.y > G.vh + 20) continue;
    const bob = ped.state === 'walk' || ped.state === 'flee' ? Math.sin(ped.bob) * 0.8 * scale * 0.5 : 0;
    if (ped.state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3 * scale * 0.5, 1.6 * scale * 0.5, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1.2 * scale * 0.5, 2 * scale * 0.5, 1.2 * scale * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.3, 2 * scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ped.angle) * scale * 0.5, p.y + bob * 0.3 + Math.sin(ped.angle) * scale * 0.5, 1.2 * scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'hail') {
      ctx.fillStyle = '#ffd319';
      ctx.font = `bold ${Math.max(12, 4 * scale * 0.5)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 6 * scale * 0.5 + Math.sin(ped.bob) * 2);
    }
  }
}
