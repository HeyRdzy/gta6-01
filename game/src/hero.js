// Rio Calder on foot and behind the wheel, v3. Rio is an articulated
// figure with a real walk cycle; driving gets an acceleration curve, a
// touch of drift at speed, and brake lights that flare. A wrecked car
// smokes in thick puffs until Rio is forced out.

import * as THREE from 'three';
import { clampNum, clamp01, pushOut, turnToward, lerpNum } from './util.js';
import { buildPerson, walkCycle } from './traffic.js';
import { glowTexture } from './visuals.js';

const WALK = 6, RUN = 10.5, JUMP_V = 8.5, GRAV = 22;
const ACCEL = 26, TOP = 38, REVERSE_TOP = 11, STEER_RATE = 2.15;

export class Hero {
  constructor(scene, colliders, state) {
    this.scene = scene;
    this.colliders = colliders;
    this.state = state;
    // Rio: orange jacket, dark jeans, cap — built from the shared person rig.
    this.person = buildPerson(0xd96a2e, 0x2a3440, 0xc98a5e);
    this.mesh = this.person.group;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.13, 12),
      new THREE.MeshStandardMaterial({ color: 0x22303a, roughness: 0.8 }),
    );
    cap.position.y = 2.42;
    this.person.rig.add(cap);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 96);
    this.heading = Math.PI;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    // On-foot velocity: Rio accelerates into a run and eases out of it
    // instead of snapping to top speed the frame a key goes down.
    this.vx = 0;
    this.vz = 0;
    this.driving = null;
    this.drift = 0; // lateral slide, -1..1, builds in hard fast turns
    this.smokePuffs = [];
    this.smokeT = 0;
    this._smokeTex = glowTexture('rgba(90,90,90,0.85)', 'rgba(90,90,90,0)');
  }

  teleport(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.vy = 0;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.drift = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    if (this.driving) this.leaveCar(true);
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  takeCar(car) {
    if (!car || car.wrecked) return null;
    this.driving = car;
    car.kind = 'driven';
    this.mesh.visible = false;
    this.speed = 0;
    this.drift = 0;
    return car;
  }

  leaveCar(silent) {
    if (!this.driving) return;
    const car = this.driving;
    car.kind = 'parked';
    car.braking = false;
    this.driving = null;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.drift = 0;
    this.pos.set(car.mesh.position.x + 3, 0, car.mesh.position.z + 3);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    return car;
  }

  dentCar(amount) {
    const car = this.driving;
    if (!car) return false;
    car.damage = clampNum(car.damage + amount, 0, 100);
    if (car.damage >= 100 && !car.wrecked) {
      car.wrecked = true;
      this.leaveCar(true);
      return true;
    }
    return false;
  }

  _collide(px, pz, r) {
    for (const b of this.colliders) {
      const out = pushOut(px, pz, r, b);
      if (out) { px = out.x; pz = out.z; }
    }
    px = clampNum(px, -148, 132);
    pz = clampNum(pz, -148, 148);
    return { x: px, z: pz };
  }

  _smoke(dt) {
    const car = this.driving;
    const active = car && car.damage >= 60 && !car.wrecked;
    this.smokeT -= dt;
    if (active && this.smokeT <= 0) {
      this.smokeT = 0.09;
      let puff = this.smokePuffs.find((p) => !p.visible);
      if (!puff) {
        if (this.smokePuffs.length >= 10) return;
        puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._smokeTex, transparent: true, opacity: 0.75, depthWrite: false }));
        this.scene.add(puff);
        this.smokePuffs.push(puff);
      }
      puff.visible = true;
      puff.material.opacity = 0.75;
      // Puffs grow with the damage, capped so a wrecked car does not
      // throw a smoke ball bigger than the car itself.
      const s = 2 + clamp01((car.damage - 60) / 40) * 2.5;
      puff.scale.set(s, s, 1);
      puff.position.set(car.mesh.position.x, 2.4, car.mesh.position.z);
      puff.userData.life = 0.9;
    }
    for (const puff of this.smokePuffs) {
      if (!puff.visible) continue;
      puff.userData.life -= dt;
      puff.position.y += dt * 2.2;
      puff.material.opacity = Math.max(0, puff.userData.life * 0.8);
      const s = puff.scale.x + dt * 2.4;
      puff.scale.set(s, s, 1);
      if (puff.userData.life <= 0) puff.visible = false;
    }
  }

  update(dt, pad, onBump) {
    if (this.driving) {
      const car = this.driving;
      const fwd = pad.down('KeyW') ? 1 : pad.down('KeyS') ? -1 : 0;
      const steer = (pad.down('KeyA') ? 1 : 0) - (pad.down('KeyD') ? 1 : 0);
      const braking = pad.down('Space');
      car.braking = braking;
      const worn = 1 - (car.damage / 100) * 0.55;
      // Acceleration curve: punchy off the line, easing toward the top.
      const speedRatio = clampNum(Math.abs(this.speed) / TOP, 0, 1);
      const pull = (1 - speedRatio * 0.62) * worn;
      if (fwd > 0) this.speed = Math.min(this.speed + ACCEL * pull * dt, TOP * worn);
      else if (fwd < 0) this.speed = Math.max(this.speed - ACCEL * 0.7 * dt, -REVERSE_TOP);
      else this.speed *= Math.max(0, 1 - 1.6 * dt);
      if (braking) this.speed *= Math.max(0, 1 - 4.5 * dt);
      // Drift: hard steering at speed slides the tail and scrubs speed.
      const wantDrift = steer !== 0 && Math.abs(this.speed) > 20 ? steer * 0.55 : 0;
      this.drift = lerpNum(this.drift, wantDrift, Math.min(1, dt * 4));
      if (Math.abs(this.speed) > 0.4) {
        car.heading += steer * STEER_RATE * dt * clampNum(Math.abs(this.speed) / 14, 0.25, 1) * Math.sign(this.speed);
        if (Math.abs(this.drift) > 0.3) this.speed *= Math.max(0, 1 - 0.25 * dt);
      }
      const slideX = Math.cos(car.heading) * this.drift * 0.35;
      const slideZ = -Math.sin(car.heading) * this.drift * 0.35;
      const nx = car.mesh.position.x + (Math.sin(car.heading) + slideX) * this.speed * dt;
      const nz = car.mesh.position.z + (Math.cos(car.heading) + slideZ) * this.speed * dt;
      let hit = false;
      for (const b of this.colliders) {
        if (nx > b.x0 - 1.4 && nx < b.x1 + 1.4 && nz > b.z0 - 1.4 && nz < b.z1 + 1.4) { hit = true; break; }
      }
      if (hit) {
        const hard = Math.abs(this.speed) > 12;
        this.speed *= -0.25;
        this.drift = 0;
        if (hard && onBump) onBump(Math.abs(this.speed));
        this.dentCar(hard ? 14 : 5);
      } else {
        car.mesh.position.x = clampNum(nx, -148, 132);
        car.mesh.position.z = clampNum(nz, -148, 148);
      }
      car.mesh.rotation.y = car.heading;
      // Body roll: the car leans into a drift so the slide reads on screen.
      car.mesh.rotation.z = -this.drift * 0.1;
      // Wheels roll; the front pair steers visually.
      const spin = this.speed * dt / 0.44;
      car.parts.wheels.forEach((w, i) => {
        w.rotation.x += spin;
        if (i < 2) w.rotation.y = steer * 0.28;
      });
      this.pos.copy(car.mesh.position);
      this.heading = car.heading;
      this._smoke(dt);
      return;
    }

    // On foot: smooth acceleration, run, jump, walk cycle.
    const run = pad.down('ShiftLeft') || pad.down('ShiftRight');
    const top = run ? RUN : WALK;
    let ix = 0, iz = 0;
    if (pad.down('KeyW')) iz -= 1;
    if (pad.down('KeyS')) iz += 1;
    if (pad.down('KeyA')) ix -= 1;
    if (pad.down('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    const moving = len > 0;
    if (moving) {
      const yaw = pad.yaw;
      const sx = ix / len, sz = iz / len;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = -fz, rz = fx;
      const mx = fx * -sz + rx * sx, mz = fz * -sz + rz * sx;
      // Ease the velocity toward the target instead of teleporting to
      // full speed: snappy to start, gentle to stop.
      const rate = 14;
      this.vx = lerpNum(this.vx, mx * top, Math.min(1, dt * rate));
      this.vz = lerpNum(this.vz, mz * top, Math.min(1, dt * rate));
      const solved = this._collide(this.pos.x + this.vx * dt, this.pos.z + this.vz * dt, 0.8);
      this.pos.x = solved.x; this.pos.z = solved.z;
      this.heading = turnToward(this.heading, Math.atan2(this.vx, this.vz), 10 * dt);
      walkCycle(this.person, dt, Math.hypot(this.vx, this.vz));
    } else {
      // No input: bleed speed off instead of stopping dead.
      this.vx = lerpNum(this.vx, 0, Math.min(1, dt * 11));
      this.vz = lerpNum(this.vz, 0, Math.min(1, dt * 11));
      const solved = this._collide(this.pos.x + this.vx * dt, this.pos.z + this.vz * dt, 0.8);
      this.pos.x = solved.x; this.pos.z = solved.z;
      walkCycle(this.person, dt, 0);
    }
    if (pad.hit('Space') && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= GRAV * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
    }
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }
}
