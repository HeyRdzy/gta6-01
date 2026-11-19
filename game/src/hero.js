// Rio Calder on foot and behind the wheel. On foot: WASD + mouse camera,
// Shift to run, Space to jump. Driving: arcade handling with steering that
// bites harder at speed, Space to brake, and — new in v2 — car damage: hard
// hits dent the car, past 60 it smokes, at 100 it is wrecked and Rio is out.

import * as THREE from 'three';
import { clampNum, pushOut, turnToward } from './util.js';

const WALK = 6, RUN = 10.5, JUMP_V = 8.5, GRAV = 22;
const ACCEL = 24, TOP = 36, REVERSE_TOP = 11, STEER_RATE = 1.9;

function rioMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.35, 10),
    new THREE.MeshLambertMaterial({ color: 0xd96a2e }),
  );
  jacket.position.y = 1.15; g.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xc98a5e }),
  );
  head.position.y = 2.15; g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12),
    new THREE.MeshLambertMaterial({ color: 0x22303a }),
  );
  cap.position.y = 2.45; g.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.8, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a3440 }),
  );
  legs.position.y = 0.4; g.add(legs);
  return g;
}

export class Hero {
  constructor(scene, colliders, state) {
    this.scene = scene;
    this.colliders = colliders;
    this.state = state;
    this.mesh = rioMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 96);
    this.heading = Math.PI;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0; // driving speed, signed
    this.driving = null; // car object from StreetLife, or null
    this.smoke = null; // smoke sprite above a damaged car
    this.smokeT = 0;
  }

  teleport(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.vy = 0;
    this.speed = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    if (this.driving) this.leaveCar(true);
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  /** Step into the nearest stealable car. Returns the car or null. */
  takeCar(car) {
    if (!car || car.wrecked) return null;
    this.driving = car;
    car.kind = 'driven';
    this.mesh.visible = false;
    this.speed = 0;
    return car;
  }

  leaveCar(silent) {
    if (!this.driving) return;
    const car = this.driving;
    car.kind = 'parked';
    this.driving = null;
    this.speed = 0;
    this.pos.set(car.mesh.position.x + 3, 0, car.mesh.position.z + 3);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    return car;
  }

  /** Damage the driven car; returns true when it just got wrecked. */
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

  _smokePuff(dt) {
    const car = this.driving;
    if (!car || car.damage < 60 || car.wrecked) {
      if (this.smoke) { this.scene.remove(this.smoke); this.smoke = null; }
      return;
    }
    this.smokeT -= dt;
    if (!this.smoke) {
      const mat = new THREE.SpriteMaterial({ color: 0x666666, transparent: true, opacity: 0.7 });
      this.smoke = new THREE.Sprite(mat);
      this.smoke.scale.set(3, 3, 1);
      this.scene.add(this.smoke);
    }
    if (this.smokeT <= 0) {
      this.smokeT = 0.12;
      this.smoke.position.set(
        car.mesh.position.x, 2.2 + Math.random() * 0.6, car.mesh.position.z,
      );
      const s = 2 + (car.damage - 60) / 40 * 2.5;
      this.smoke.scale.set(s, s, 1);
    }
  }

  update(dt, pad, onBump) {
    if (this.driving) {
      const car = this.driving;
      const fwd = pad.down('KeyW') ? 1 : pad.down('KeyS') ? -1 : 0;
      const steer = (pad.down('KeyA') ? 1 : 0) - (pad.down('KeyD') ? 1 : 0);
      const braking = pad.down('Space');
      const worn = 1 - (car.damage / 100) * 0.55; // wrecked cars barely move
      if (fwd > 0) this.speed = Math.min(this.speed + ACCEL * worn * dt, TOP * worn);
      else if (fwd < 0) this.speed = Math.max(this.speed - ACCEL * 0.7 * dt, -REVERSE_TOP);
      else this.speed *= Math.max(0, 1 - 1.6 * dt);
      if (braking) this.speed *= Math.max(0, 1 - 4.5 * dt);
      if (Math.abs(this.speed) > 0.4) {
        car.heading += steer * STEER_RATE * dt * clampNum(Math.abs(this.speed) / 14, 0.25, 1) * Math.sign(this.speed);
      }
      const nx = car.mesh.position.x + Math.sin(car.heading) * this.speed * dt;
      const nz = car.mesh.position.z + Math.cos(car.heading) * this.speed * dt;
      let hit = false;
      for (const b of this.colliders) {
        if (nx > b.x0 - 1.4 && nx < b.x1 + 1.4 && nz > b.z0 - 1.4 && nz < b.z1 + 1.4) { hit = true; break; }
      }
      if (hit) {
        const hard = Math.abs(this.speed) > 12;
        this.speed *= -0.25;
        if (hard && onBump) onBump(Math.abs(this.speed));
        this.dentCar(hard ? 14 : 5);
      } else {
        car.mesh.position.x = clampNum(nx, -148, 132);
        car.mesh.position.z = clampNum(nz, -148, 148);
      }
      car.mesh.rotation.y = car.heading;
      this.pos.copy(car.mesh.position);
      this.heading = car.heading;
      this._smokePuff(dt);
      return;
    }

    // On foot.
    const run = pad.down('ShiftLeft') || pad.down('ShiftRight');
    const top = run ? RUN : WALK;
    let ix = 0, iz = 0;
    if (pad.down('KeyW')) iz -= 1;
    if (pad.down('KeyS')) iz += 1;
    if (pad.down('KeyA')) ix -= 1;
    if (pad.down('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      const yaw = pad.yaw;
      const sx = ix / len, sz = iz / len;
      // Camera-relative movement: forward is where the camera looks.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = -fz, rz = fx;
      const mx = fx * -sz + rx * sx, mz = fz * -sz + rz * sx;
      const solved = this._collide(this.pos.x + mx * top * dt, this.pos.z + mz * top * dt, 0.8);
      this.pos.x = solved.x; this.pos.z = solved.z;
      this.heading = turnToward(this.heading, Math.atan2(mx, mz), 10 * dt);
      this.mesh.position.y = Math.abs(Math.sin(performance.now() / 130)) * 0.06;
    } else {
      this.mesh.position.y = 0;
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
