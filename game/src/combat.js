// Solmar Heat — shooting, enemies and hit detection. Written fresh for round 4.
// Hitscan from the player toward the mouse: buildings block, peds and cops
// take damage, and the dock crew in mission 4 shoot back.
import { CFG } from './config.js';
import { clamp, dist, pointInAABB, rand } from './util.js';
import { S, addWanted } from './state.js';
import { scarePeds } from './traffic.js';

// Ray (origin + dir, maxDist) against an AABB. Returns distance or Infinity.
function rayAABB(ox, oz, dx, dz, box, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const minX = box.x - box.w / 2;
  const maxX = box.x + box.w / 2;
  const minZ = box.z - box.d / 2;
  const maxZ = box.z + box.d / 2;
  for (const [o, d, lo, hi] of [[ox, dx, minX, maxX], [oz, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Is the line from (ax, az) to (bx, bz) blocked by a building?
function losBlocked(G, ax, az, bx, bz) {
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const b of G.world.colliders) {
      if (pointInAABB(x, z, b)) return true;
    }
  }
  return false;
}

export function createCombat(G) {
  return { fireCd: 0, muzzle: 0, enemies: [] };
}

export function spawnEnemy(G, x, z) {
  G.combat.enemies.push({ x, z, hp: 68, shootCd: rand(0.5, 1.5), angle: 0, dead: false });
}

function shoot(G) {
  const P = S.player;
  if (S.ammo <= 0 || S.reloading > 0) return;
  if (G.combat.fireCd > 0) return;
  G.combat.fireCd = 0.14;
  S.ammo -= 1;
  S.stats.shots += 1;
  G.combat.muzzle = 0.07;
  G.sound.shot();
  scarePeds(G, P.x, P.z);

  const dx = P.aimX - P.x;
  const dz = P.aimZ - P.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const spread = P.onFoot ? 0.02 : 0.06;
  const ang = Math.atan2(uz, ux) + rand(-spread, spread);
  const dirx = Math.cos(ang);
  const dirz = Math.sin(ang);
  const maxD = CFG.BULLET_RANGE;

  // Nearest blocking building.
  let wallD = Infinity;
  for (const b of G.world.colliders) {
    const d = rayAABB(P.x, P.z, dirx, dirz, b, maxD);
    if (d < wallD) wallD = d;
  }

  // Nearest hittable entity.
  let best = null;
  let bestD = Math.min(wallD, maxD);
  const consider = (x, z, r, ref) => {
    const ex = x - P.x;
    const ez = z - P.z;
    const along = ex * dirx + ez * dirz;
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(-ex * dirz + ez * dirx);
    if (perp < r + 1.5) {
      bestD = along;
      best = ref;
    }
  };
  for (const ped of G.traffic.peds) {
    if (ped.state === 'dead' || ped.state === 'riding') continue;
    consider(ped.x, ped.z, 2.5, { kind: 'ped', ref: ped });
  }
  for (const u of G.cops.units) {
    if (u.hp <= 0) continue;
    consider(u.x, u.z, 5, { kind: 'cop', ref: u });
  }
  for (const car of G.traffic.cars) {
    if (car.isPlayer || car.hp <= 0) continue;
    consider(car.x, car.z, 5, { kind: 'car', ref: car });
  }
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    consider(e.x, e.z, 2.5, { kind: 'enemy', ref: e });
  }

  const hitX = P.x + dirx * bestD;
  const hitZ = P.z + dirz * bestD;
  G.tracers.push({ x1: P.x, z1: P.z, x2: hitX, z2: hitZ, life: 0.09, maxLife: 0.09 });
  for (let i = 0; i < 4; i++) {
    G.effects.push({
      x: hitX, z: hitZ, vx: rand(-14, 14), vz: rand(-14, 14),
      life: 0.35, maxLife: 0.35, color: '#ffd319', size: 1.4,
    });
  }

  if (!best) return;
  if (best.kind === 'ped') {
    best.ref.state = 'dead';
    best.ref.deadAt = S.time;
    S.stats.kills += 1;
    addWanted(1);
    G.display.floater(best.ref.x, best.ref.z, 'WANTED +1', '#ff5a4e');
  } else if (best.kind === 'cop' || best.kind === 'car') {
    best.ref.hp -= CFG.GUN_DAMAGE;
    if (best.ref.hp <= 0 && best.kind === 'cop') {
      S.stats.kills += 1;
      addWanted(1);
      G.display.toast('Cop car disabled!');
    }
  } else if (best.kind === 'enemy') {
    best.ref.hp -= CFG.GUN_DAMAGE;
    if (best.ref.hp <= 0) {
      best.ref.dead = true;
      S.stats.kills += 1;
      G.display.floater(best.ref.x, best.ref.z, 'DOWN', '#7cff4f');
    }
  }
}

export function updateCombat(G, dt) {
  const C = G.combat;
  const P = S.player;
  C.fireCd -= dt;
  C.muzzle = Math.max(0, C.muzzle - dt);

  // Reload.
  if (S.reloading > 0) {
    S.reloading -= dt;
    if (S.reloading <= 0) {
      S.ammo = CFG.MAG_SIZE;
      S.reloading = 0;
    }
  } else if (S.ammo <= 0) {
    S.reloading = CFG.RELOAD_TIME;
  }
  if (G.input.pressed('KeyR') && S.ammo < CFG.MAG_SIZE && S.reloading <= 0) {
    S.reloading = CFG.RELOAD_TIME;
  }

  // Trigger: hold the mouse to fire (on foot or from the car).
  if (S.mode === 'playing' && G.input.mouse.down) shoot(G);

  // Enemies shoot back when they can see the player.
  for (const e of C.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.z, P.x, P.z);
    e.angle = Math.atan2(P.z - e.z, P.x - e.x);
    e.shootCd -= dt;
    if (d < 70 && !losBlocked(G, e.x, e.z, P.x, P.z) && e.shootCd <= 0) {
      e.shootCd = 1.4;
      G.tracers.push({ x1: e.x, z1: e.z, x2: P.x, z2: P.z, life: 0.09, maxLife: 0.09 });
      G.sound.shot();
      if (Math.random() < 0.35) {
        S.health -= 8;
        G.display.flashDamage(0.4);
        if (S.health <= 0) G.story.wasted();
      }
    }
  }
  C.enemies = C.enemies.filter((e) => !e.dead || S.time - (e.deadAt || 0) < 5);
  for (const e of C.enemies) if (e.dead && !e.deadAt) e.deadAt = S.time;
}

export function drawCombat(G) {
  const { ctx, scale } = G;
  // Muzzle flash.
  if (G.combat.muzzle > 0) {
    const P = S.player;
    const p = { x: (P.x - S.camera.x) * scale + G.vw / 2, y: (P.z - S.camera.z) * scale + G.vh / 2 };
    const mx = p.x + Math.cos(P.angle) * 7 * scale * 0.5;
    const my = p.y + Math.sin(P.angle) * 7 * scale * 0.5;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(mx, my, 3.2 * scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enemies (dock crew): dark figures with guns.
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const p = { x: (e.x - S.camera.x) * scale + G.vw / 2, y: (e.z - S.camera.z) * scale + G.vh / 2 };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1.2 * scale * 0.5, 2 * scale * 0.5, 1.2 * scale * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4 * scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = Math.max(1, 0.8 * scale * 0.5);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(e.angle) * 5 * scale * 0.5, p.y + Math.sin(e.angle) * 5 * scale * 0.5);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 4 * scale * 0.5, p.y - 5 * scale * 0.5, 8 * scale * 0.5, 1.2 * scale * 0.5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(p.x - 4 * scale * 0.5, p.y - 5 * scale * 0.5, 8 * scale * 0.5 * clamp(e.hp / 68, 0, 1), 1.2 * scale * 0.5);
  }
}
