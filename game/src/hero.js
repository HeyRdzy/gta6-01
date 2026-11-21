// Solmar Heat — the player, on foot and behind the wheel. Written fresh for round 4.
// Arcade driving: accelerate, brake, steer, drift, ramps, wrecks. Cars are
// shared objects with traffic and cops; the driven one is flagged isPlayer.
import { CFG } from './config.js';
import { clamp, circleVsAABB, dist } from './util.js';
import { S, addCash } from './state.js';

// Draw one car (traffic, cop, taxi or the player's) in world space.
export function drawCar(G, car) {
  const { ctx, scale } = G;
  const p = { x: (car.x - S.camera.x) * scale + G.vw / 2, y: (car.z - S.camera.z) * scale + G.vh / 2 };
  ctx.save();
  ctx.translate(p.x, p.y);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(1.5 * scale * 0.4, 2 * scale * 0.4, 6 * scale * 0.5, 3.4 * scale * 0.5, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = (car.len || 11) * scale * 0.5;
  const W = 5.6 * scale * 0.5;
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L, -W, L * 2, W * 2, 1.6 * scale * 0.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(1, 0.5 * scale * 0.5);
  ctx.stroke();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -L * 0.45, -W * 0.72, L * 0.9, W * 1.44, 1.2 * scale * 0.5);
  ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(L * 0.42, -W * 0.72, L * 0.22, W * 1.44);
  ctx.fillRect(-L * 0.62, -W * 0.72, L * 0.2, W * 1.44);
  // Headlights (front = +x) and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L * 0.92, -W * 0.62, L * 0.1, W * 0.3);
  ctx.fillRect(L * 0.92, W * 0.32, L * 0.1, W * 0.3);
  ctx.fillStyle = '#ff2e2e';
  ctx.fillRect(-L * 1.0, -W * 0.62, L * 0.1, W * 0.3);
  ctx.fillRect(-L * 1.0, W * 0.32, L * 0.1, W * 0.3);
  if (car.type === 'cop') {
    // Flashing light bar.
    const on = Math.floor(S.time * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-L * 0.2, -W * 0.85, L * 0.4, W * 0.34);
    ctx.fillStyle = on ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-L * 0.2, W * 0.51, L * 0.4, W * 0.34);
    ctx.fillStyle = '#0e1116';
    ctx.font = `bold ${Math.max(7, 1.5 * scale * 0.5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 0.5 * scale * 0.5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#ffd319';
    ctx.fillRect(-L * 0.15, -W * 0.5, L * 0.3, W);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.max(7, 1.4 * scale * 0.5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 0.5 * scale * 0.5);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createHero(G) {
  return { airTime: 0, wasAir: false };
}

function collideCircle(G, x, z, r) {
  let px = x;
  let pz = z;
  for (const b of G.world.colliders) {
    if (Math.abs(px - b.x) > b.w / 2 + r + 2 || Math.abs(pz - b.z) > b.d / 2 + r + 2) continue;
    const out = circleVsAABB(px, pz, r, b);
    if (out) {
      px = out.x;
      pz = out.z;
    }
  }
  return { x: px, z: pz };
}

function clampBounds(p) {
  p.x = clamp(p.x, -CFG.WORLD_HALF + 4, CFG.WORLD_HALF - 4);
  p.z = clamp(p.z, -CFG.WORLD_HALF + 4, CFG.WORLD_HALF - 4);
}

export function updateHero(G, dt) {
  const input = G.input;
  const P = S.player;
  const car = P.car;

  if (P.onFoot) {
    const mv = input.moveVector();
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = running ? CFG.RUN_SPEED : CFG.WALK_SPEED;
    P.moving = mv.x !== 0 || mv.z !== 0;
    P.speed = P.moving ? speed : 0;
    if (P.moving) {
      P.angle = Math.atan2(mv.z, mv.x);
      const nx = P.x + mv.x * speed * dt;
      const nz = P.z + mv.z * speed * dt;
      const out = collideCircle(G, nx, nz, 2.2);
      P.x = out.x;
      P.z = out.z;
      clampBounds(P);
    }
    // Jump (a hop: purely visual, no physics).
    if (input.pressed('Space')) P.jump = 1;
    if (P.jump > 0) P.jump = Math.max(0, P.jump - dt * 1.8);
    // Aim follows the mouse.
    P.aimX = input.mouse.wx;
    P.aimZ = input.mouse.wz;
    // Enter a car.
    if (input.pressed('KeyE')) tryEnterCar(G);
  } else if (car) {
    // --- Driving ---
    const throttle = input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0;
    const brake = input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0;
    const steer = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? -1 : 0)
      + (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
    const handbrake = input.keys.has('Space');
    const wrecked = car.hp <= 0;

    if (!wrecked && throttle) car.speed += CFG.CAR_ACCEL * dt;
    if (brake) {
      if (car.speed > 0.5) car.speed -= CFG.CAR_BRAKE * dt;
      else car.speed -= CFG.CAR_ACCEL * 0.55 * dt;
    }
    car.speed -= car.speed * 0.55 * dt; // drag
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    car.speed = clamp(car.speed, -CFG.CAR_REVERSE_MAX, CFG.CAR_MAX_SPEED);

    const spd = Math.abs(car.speed);
    const steerAuthority = clamp(spd / 28, 0, 1);
    if (steer !== 0 && spd > 0.5) {
      car.angle += steer * CFG.CAR_STEER * steerAuthority * dt * Math.sign(car.speed);
    }
    // Drift: hard steering at speed slides the car sideways and smokes.
    let slideX = 0;
    let slideZ = 0;
    if (steer !== 0 && spd > 52) {
      const lat = steer * spd * 0.22;
      slideX = -Math.sin(car.angle) * lat * dt;
      slideZ = Math.cos(car.angle) * lat * dt;
      if (Math.random() < 0.5) {
        G.effects.push({
          x: car.x - Math.cos(car.angle) * 4, z: car.z - Math.sin(car.angle) * 4,
          vx: -Math.cos(car.angle) * 4, vz: -Math.sin(car.angle) * 4,
          life: 0.7, maxLife: 0.7, color: 'rgba(200,200,200,0.5)', size: 2.5,
        });
      }
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt + slideX;
    const nz = car.z + Math.sin(car.angle) * car.speed * dt + slideZ;

    // Collide (front and centre circles).
    const speedBefore = car.speed;
    let hit = false;
    for (const [ox, oz] of [[0, 0], [4.5, 0]]) {
      const cx = nx + Math.cos(car.angle) * ox;
      const cz = nz + Math.sin(car.angle) * ox;
      for (const b of G.world.colliders) {
        if (Math.abs(cx - b.x) > b.w / 2 + 6 || Math.abs(cz - b.z) > b.d / 2 + 6) continue;
        const out = circleVsAABB(cx, cz, 4.6, b);
        if (out) {
          hit = true;
          // Push the car centre back out along the same offset.
          car.x = out.x - Math.cos(car.angle) * ox;
          car.z = out.z - Math.sin(car.angle) * ox;
        }
      }
    }
    if (!hit) {
      car.x = nx;
      car.z = nz;
    } else if (Math.abs(speedBefore) > 26) {
      const dmg = Math.round((Math.abs(speedBefore) - 26) * 0.9);
      car.hp -= dmg;
      car.speed *= 0.35;
      G.sound.thud();
      G.display.flashDamage(0.35);
      if (car.hp <= 0) G.display.toast('The car is wrecked!');
    }
    clampBounds(car);
    P.x = car.x;
    P.z = car.z;
    P.angle = car.angle;
    P.speed = car.speed;
    P.moving = Math.abs(car.speed) > 1;

    // Stunt ramps: airborne over a ramp at speed pays $50 on landing.
    const ramp = G.world.ramps.find((r) => dist(car.x, car.z, r.x, r.z) < 8);
    if (ramp && Math.abs(car.speed) > 40 && !G.hero.wasAir) {
      G.hero.airTime = 0.01;
    }
    if (G.hero.airTime > 0) {
      G.hero.airTime += dt;
      if (G.hero.airTime > 0.8) {
        addCash(CFG.STUNT_PAY);
        S.stats.stunts += 1;
        G.display.toast(`Stunt jump! +$${CFG.STUNT_PAY}`);
        G.display.floater(car.x, car.z, `+$${CFG.STUNT_PAY}`, '#ffd319');
        G.sound.chime();
        G.hero.airTime = 0;
      }
    }
    G.hero.wasAir = !!ramp;

    // Taxi fare arrival.
    if (S.fare && car.type === 'taxi') {
      if (dist(car.x, car.z, S.fare.destX, S.fare.destZ) < 10) {
        addCash(S.fare.amount);
        S.stats.fares += 1;
        G.display.toast(`Fare complete! +$${S.fare.amount}`);
        G.display.floater(car.x, car.z, `+$${S.fare.amount}`, '#7cff4f');
        G.sound.chime();
        S.fare = null;
      }
    }

    // Smoke when badly damaged.
    if (car.hp < 40 && Math.random() < 0.35) {
      G.effects.push({
        x: car.x, z: car.z - 2, vx: rand(-2, 2), vz: rand(-4, -1),
        life: 0.9, maxLife: 0.9, color: 'rgba(60,60,60,0.6)', size: 3,
      });
    }
    // Engine sound.
    G.sound.engine(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, throttle);
    // Exit the car.
    if (input.pressed('KeyE')) exitCar(G);
  }

  // Camera follows the player.
  const cam = S.camera;
  cam.x += (P.x - cam.x) * Math.min(1, dt * 5);
  cam.z += (P.z - cam.z) * Math.min(1, dt * 5);
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function tryEnterCar(G) {
  const P = S.player;
  let best = null;
  let bestD = 14;
  const all = [];
  if (G.traffic) all.push(...G.traffic.cars);
  if (G.cops) all.push(...G.cops.units);
  for (const car of all) {
    if (car.isPlayer) continue;
    const d = dist(P.x, P.z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  best.isPlayer = true;
  P.car = best;
  P.onFoot = false;
  P.speed = 0;
  G.display.toast(best.type === 'taxi' ? 'Taxi — look for a waving fare!' : 'In the car. W/S drive, A/D steer.');
  G.sound.thud();
}

function exitCar(G) {
  const P = S.player;
  const car = P.car;
  if (!car) return;
  // Step out to the side that is not inside a building.
  const side = Math.random() < 0.5 ? 1 : -1;
  const px = car.x - Math.sin(car.angle) * 7 * side;
  const pz = car.z + Math.cos(car.angle) * 7 * side;
  const out = collideCircle(G, px, pz, 2.2);
  P.x = out.x;
  P.z = out.z;
  P.angle = car.angle;
  P.speed = 0;
  car.isPlayer = false;
  car.speed = 0;
  P.car = null;
  P.onFoot = true;
  G.sound.engine(0, 0);
}

// Draw the player on foot (and the driven car is drawn by drawCar in boot).
export function drawHero(G) {
  const { ctx, scale } = G;
  const P = S.player;
  if (!P.onFoot) return;
  const p = { x: (P.x - S.camera.x) * scale + G.vw / 2, y: (P.z - S.camera.z) * scale + G.vh / 2 };
  const hop = Math.sin(P.jump * Math.PI) * 4 * scale * 0.5;
  // Soft ring so the player reads against the asphalt.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7 * scale * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(1, 0.5 * scale * 0.5);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7 * scale * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 1.5 * scale * 0.5, 2.6 * scale * 0.5, 1.6 * scale * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (Rio: teal jacket, dark jeans).
  ctx.fillStyle = '#1f9d8a';
  ctx.beginPath();
  ctx.arc(p.x, p.y - hop, 2.6 * scale * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(P.angle) * 1.2 * scale * 0.5, p.y - hop + Math.sin(P.angle) * 1.2 * scale * 0.5, 1.5 * scale * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Gun direction when aiming with the mouse held.
  if (G.input.mouse.down) {
    ctx.strokeStyle = 'rgba(30,30,30,0.9)';
    ctx.lineWidth = Math.max(1, 0.7 * scale * 0.5);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hop);
    ctx.lineTo(p.x + Math.cos(P.angle) * 5 * scale * 0.5, p.y - hop + Math.sin(P.angle) * 5 * scale * 0.5);
    ctx.stroke();
  }
}
