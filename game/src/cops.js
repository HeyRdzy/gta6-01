// Solmar Heat — Solmar PD: pursuit, ramming, roadblocks, busts. Written fresh for round 4.
import { CFG } from './config.js';
import { clamp, dist, angleDiff, circleVsAABB, rand } from './util.js';
import { S, addWanted } from './state.js';
import { drawCar } from './hero.js';

function makeCop(G, x, z, blocker = false) {
  return {
    x, z,
    angle: rand(0, Math.PI * 2),
    speed: 0,
    color: '#1d2733',
    type: 'cop',
    len: 11,
    hp: CFG.COP_CAR_HP,
    maxHp: CFG.COP_CAR_HP,
    isPlayer: false,
    blocker,
    hitCd: 0,
    bustT: 0,
  };
}

export function createCops(G) {
  return { units: [], spawnTimer: 0, decayTimer: 0, roadblockAt: null };
}

// Spawn one cruiser at a position (used by staged screenshots).
export function spawnCop(G, x, z) {
  const u = makeCop(G, x, z);
  G.cops.units.push(u);
  return u;
}

export function updateCops(G, dt) {
  const C = G.cops;
  const P = S.player;
  const want = Math.min(S.wanted, 4);
  const chasers = C.units.filter((u) => !u.blocker && u.hp > 0);

  // Spawn chasers up to the wanted level.
  if (chasers.length < want) {
    C.spawnTimer -= dt;
    if (C.spawnTimer <= 0) {
      C.spawnTimer = 2.5;
      const nodes = G.world.nodes.filter((n) => {
        const d = dist(n.x, n.z, P.x, P.z);
        return d > 90 && d < 170;
      });
      if (nodes.length) {
        const n = nodes[Math.floor(Math.random() * nodes.length)];
        C.units.push(makeCop(G, n.x, n.z));
      }
    }
  }

  // Roadblock at 3+ stars: two parked cruisers across the street ahead.
  if (S.wanted >= 3 && !C.roadblockAt) {
    const aheadX = P.x + Math.cos(P.angle) * 70;
    const aheadZ = P.z + Math.sin(P.angle) * 70;
    let best = null;
    let bestD = Infinity;
    for (const n of G.world.nodes) {
      const d = dist(n.x, n.z, aheadX, aheadZ);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (best) {
      const a = makeCop(G, best.x - 6, best.z, true);
      const b = makeCop(G, best.x + 6, best.z, true);
      a.angle = Math.PI / 2;
      b.angle = Math.PI / 2;
      C.units.push(a, b);
      C.roadblockAt = { x: best.x, z: best.z };
    }
  }
  if (S.wanted < 3 && C.roadblockAt) {
    C.units = C.units.filter((u) => !u.blocker);
    C.roadblockAt = null;
  }

  // Update each unit.
  let nearestCop = Infinity;
  for (const u of C.units) {
    if (u.hp <= 0) continue;
    u.hitCd -= dt;
    const dPlayer = dist(u.x, u.z, P.x, P.z);
    if (dPlayer < nearestCop) nearestCop = dPlayer;

    if (u.blocker) continue; // parked across the road

    if (S.wanted === 0) {
      // Giving up: drive away from the player, despawn when far.
      const away = Math.atan2(u.z - P.z, u.x - P.x);
      u.angle += clamp(angleDiff(away, u.angle), -2 * dt, 2 * dt);
      u.speed = Math.min(u.speed + 20 * dt, 40);
      u.x += Math.cos(u.angle) * u.speed * dt;
      u.z += Math.sin(u.angle) * u.speed * dt;
      continue;
    }

    // Pursuit: steer at the player, ram on contact.
    const wantAngle = Math.atan2(P.z - u.z, P.x - u.x);
    u.angle += clamp(angleDiff(wantAngle, u.angle), -2.8 * dt, 2.8 * dt);
    const targetSpeed = dPlayer > 26 ? CFG.COP_SPEED : CFG.COP_SPEED * 0.75;
    u.speed += clamp(targetSpeed - u.speed, -40 * dt, 30 * dt);
    const nx = u.x + Math.cos(u.angle) * u.speed * dt;
    const nz = u.z + Math.sin(u.angle) * u.speed * dt;
    let hitWall = false;
    for (const b of G.world.colliders) {
      if (Math.abs(nx - b.x) > b.w / 2 + 7 || Math.abs(nz - b.z) > b.d / 2 + 7) continue;
      const out = circleVsAABB(nx, nz, 4.6, b);
      if (out) {
        hitWall = true;
        u.x = out.x;
        u.z = out.z;
      }
    }
    if (!hitWall) {
      u.x = nx;
      u.z = nz;
    } else {
      u.speed *= 0.5;
    }

    // Ram the player's car, or bust the player on foot.
    if (P.car && dPlayer < 9 && u.hitCd <= 0) {
      u.hitCd = 1;
      P.car.hp -= 9;
      P.car.speed *= 0.7;
      G.sound.thud();
      G.display.flashDamage(0.3);
      if (P.car.hp <= 0) G.display.toast('Your car is wrecked!');
    }
    if (P.onFoot && dPlayer < 4.5) {
      u.bustT += dt;
      if (u.bustT > 1.5) {
        G.story.busted();
        u.bustT = 0;
      }
    } else {
      u.bustT = Math.max(0, u.bustT - dt * 2);
    }
  }

  // Despawn far units when the heat is off.
  if (S.wanted === 0) {
    C.units = C.units.filter((u) => dist(u.x, u.z, P.x, P.z) < 220);
  }

  // Wanted decay: no crime and no cop near for a while.
  if (nearestCop < CFG.COP_NEAR_DIST) S.lastCopNearAt = S.time;
  if (
    S.wanted > 0
    && S.time - S.lastCrimeAt > CFG.WANTED_DECAY_IDLE
    && S.time - S.lastCopNearAt > 6
  ) {
    C.decayTimer += dt;
    if (C.decayTimer >= CFG.WANTED_DECAY_EVERY) {
      C.decayTimer = 0;
      S.wanted -= 1;
      G.display.toast('The heat is cooling off…');
    }
  } else {
    C.decayTimer = 0;
  }

  // Siren: on while any chaser is active.
  const sirenLevel = chasers.length
    ? clamp(1 - nearestCop / 160, 0.15, 1)
    : 0;
  G.sound.siren(chasers.length > 0, sirenLevel, S.time);
}

export function drawCops(G) {
  for (const u of G.cops.units) {
    drawCar(G, u.hp <= 0 ? { ...u, color: '#3a3a3a' } : u);
  }
}
