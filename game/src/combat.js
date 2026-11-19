// Shooting for Solmar Heat v2: hitscan fire with a tracer, a 12-round
// magazine, R to reload, and rivals who shoot back. Firing in the open
// raises the heat — the PD hears it too.

import * as THREE from 'three';
import { clampNum, flatDist } from './util.js';

const MAG = 12;
const RIVAL_HP = 100;
const SHOT_DAMAGE = 34;

function rivalMesh(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 1.5, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a3a44 }),
  );
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xb08a68 }),
  );
  head.position.y = 2.2; g.add(head);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.4, 1.5, -0.5); g.add(gun);
  g.position.set(x, 0, z);
  return g;
}

export class Combat {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.ammo = MAG;
    this.reloading = 0;
    this.rivals = []; // { mesh, hp, shootT }
    this.tracers = [];
    this.ray = new THREE.Raycaster();
  }

  clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }

  spawnRivals(spots) {
    this.clearRivals();
    for (const [x, z] of spots) {
      const mesh = rivalMesh(x, z);
      this.scene.add(mesh);
      this.rivals.push({ mesh, hp: RIVAL_HP, shootT: 1 + Math.random() });
    }
  }

  rivalsLeft() { return this.rivals.length; }

  /** Fire one hitscan shot from the camera through the crosshair. */
  shoot(origin, dir, hooks) {
    if (this.reloading > 0 || this.ammo <= 0) return false;
    this.ammo--;
    this.state.addHeat(6);
    this.ray.set(origin, dir);
    this.ray.far = 90;
    let hitPoint = null;
    let hitRival = null;
    if (this.rivals.length > 0) {
      const hits = this.ray.intersectObjects(this.rivals.map((r) => r.mesh), true);
      if (hits.length > 0) {
        hitPoint = hits[0].point;
        let o = hits[0].object;
        while (o && o.parent !== this.scene) o = o.parent;
        hitRival = this.rivals.find((r) => r.mesh === o) || null;
      }
    }
    if (!hitPoint) hitPoint = origin.clone().add(dir.clone().multiplyScalar(60));
    if (hitRival) {
      hitRival.hp -= SHOT_DAMAGE;
      if (hitRival.hp <= 0) {
        this.scene.remove(hitRival.mesh);
        this.rivals = this.rivals.filter((r) => r !== hitRival);
        if (hooks.onKill) hooks.onKill();
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints([origin, hitPoint]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, t: 0.09 });
    if (hooks.onShot) hooks.onShot();
    return true;
  }

  reload() {
    if (this.reloading > 0 || this.ammo === MAG) return;
    this.reloading = 1.1;
  }

  update(dt, hero, hooks) {
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.ammo = MAG; this.reloading = 0; }
    }
    for (const t of this.tracers) t.t -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.t <= 0) { this.scene.remove(t.line); return false; }
      t.line.material.opacity = t.t / 0.09;
      return true;
    });
    // Rivals shoot back when Rio is in range and on foot.
    for (const r of this.rivals) {
      r.shootT -= dt;
      const d = flatDist(r.mesh.position.x, r.mesh.position.z, hero.x, hero.z);
      r.mesh.lookAt(hero.x, 0, hero.z);
      if (r.shootT <= 0 && d < 42 && !hero.driving) {
        r.shootT = 1.3 + Math.random() * 0.7;
        if (Math.random() < 0.55) {
          this.state.hurt(7);
          if (hooks.onHurt) hooks.onHurt();
        }
        const from = r.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const to = new THREE.Vector3(hero.x, 1.2, hero.z);
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.9 }));
        this.scene.add(line);
        this.tracers.push({ line, t: 0.09 });
      }
    }
  }
}
