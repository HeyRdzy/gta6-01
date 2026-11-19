// Shooting for Solmar Heat v3: hitscan fire with a glowing tracer, a
// muzzle-flash light that pops the frame, impact sparks, a 12-round
// magazine, R to reload, and Kestrel rivals who shoot back. Firing in the
// open raises the heat — the PD hears it too.

import * as THREE from 'three';
import { clampNum, flatDist } from './util.js';
import { buildPerson, walkCycle } from './traffic.js';
import { glowTexture, sharedGeo } from './visuals.js';

const MAG = 12;
const RIVAL_HP = 100;
const SHOT_DAMAGE = 34;

function rivalPerson(x, z) {
  const person = buildPerson(0x3a3a44, 0x222226, 0xb08a68);
  const g = person.group;
  const gun = new THREE.Mesh(
    sharedGeo('rivalGun', () => new THREE.BoxGeometry(0.14, 0.14, 0.95)),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.7 }),
  );
  gun.position.set(0.42, 1.45, 0.4);
  person.rig.add(gun);
  // Kestrel red bandana.
  const band = new THREE.Mesh(
    sharedGeo('bandana', () => new THREE.CylinderGeometry(0.4, 0.4, 0.16, 12)),
    new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.9 }),
  );
  band.position.y = 2.3;
  person.rig.add(band);
  // Health bar above the head: dark backing + a red bar that shrinks
  // left-aligned as the rival takes hits. Sprites always face the camera,
  // so the bar reads from any angle in the fight.
  const bgMat = new THREE.SpriteMaterial({ color: 0x1a1a1a, depthWrite: false });
  const barBg = new THREE.Sprite(bgMat);
  barBg.scale.set(1.42, 0.22, 1);
  barBg.position.set(0, 2.78, 0);
  g.add(barBg);
  const fgMat = new THREE.SpriteMaterial({ color: 0xff3b2e, depthWrite: false });
  const barFg = new THREE.Sprite(fgMat);
  barFg.center.set(0, 0.5);
  barFg.scale.set(1.3, 0.14, 1);
  barFg.position.set(-0.65, 2.78, 0);
  g.add(barFg);
  g.position.set(x, 0, z);
  return { person, barFg };
}

export class Combat {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.ammo = MAG;
    this.reloading = 0;
    this.rivals = [];
    this.tracers = [];
    this.sparks = [];
    this.ray = new THREE.Raycaster();
    // One reusable muzzle light + flash sprite: moved, never re-created.
    this.flashLight = new THREE.PointLight(0xffc06a, 0, 22, 1.8);
    this.scene.add(this.flashLight);
    this.flashLightT = 0;
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,210,130,1)', 'rgba(255,120,40,0)'),
      transparent: true, opacity: 0, depthWrite: false,
    }));
    this.flashSprite.scale.set(3.2, 3.2, 1);
    this.scene.add(this.flashSprite);
    this._sparkGeo = sharedGeo('spark', () => new THREE.SphereGeometry(0.09, 6, 4));
    this._sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  }

  clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }

  spawnRivals(spots) {
    this.clearRivals();
    for (const [x, z] of spots) {
      const { person, barFg } = rivalPerson(x, z);
      this.scene.add(person.group);
      this.rivals.push({ mesh: person.group, person, barFg, hp: RIVAL_HP, shootT: 1 + Math.random() });
    }
  }

  rivalsLeft() { return this.rivals.length; }

  _burst(point, n = 6) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this._sparkGeo, this._sparkMat);
      s.position.copy(point);
      s.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 7, Math.random() * 5 + 1, (Math.random() - 0.5) * 7,
      );
      s.userData.life = 0.4;
      this.scene.add(s);
      this.sparks.push(s);
    }
  }

  _flashAt(point) {
    this.flashLight.position.copy(point);
    this.flashLight.intensity = 26;
    this.flashLightT = 0.06;
    this.flashSprite.position.copy(point);
    this.flashSprite.material.opacity = 0.95;
  }

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
    this._flashAt(origin.clone().add(dir.clone().multiplyScalar(1.6)));
    if (hitRival) {
      hitRival.hp -= SHOT_DAMAGE;
      this._burst(hitPoint, 8);
      if (hitRival.hp <= 0) {
        this.scene.remove(hitRival.mesh);
        this.rivals = this.rivals.filter((r) => r !== hitRival);
        if (hooks.onKill) hooks.onKill();
      }
    } else {
      this._burst(hitPoint, 3);
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
    if (this.flashLightT > 0) {
      this.flashLightT -= dt;
      if (this.flashLightT <= 0) {
        this.flashLight.intensity = 0;
        this.flashSprite.material.opacity = 0;
      }
    }
    for (const t of this.tracers) t.t -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.t <= 0) { this.scene.remove(t.line); return false; }
      t.line.material.opacity = t.t / 0.09;
      return true;
    });
    this.sparks = this.sparks.filter((s) => {
      s.userData.life -= dt;
      if (s.userData.life <= 0) { this.scene.remove(s); return false; }
      s.userData.v.y -= 14 * dt;
      s.position.addScaledVector(s.userData.v, dt);
      return true;
    });
    for (const r of this.rivals) {
      r.shootT -= dt;
      // Health bar tracks the damage: full width at spawn, empty at death.
      r.barFg.scale.x = 1.3 * clampNum(r.hp / RIVAL_HP, 0, 1);
      const d = flatDist(r.mesh.position.x, r.mesh.position.z, hero.x, hero.z);
      r.mesh.lookAt(hero.x, 0, hero.z);
      walkCycle(r.person, dt, 0); // rivals hold their ground, guns raised
      if (r.shootT <= 0 && d < 42 && !hero.driving) {
        r.shootT = 1.3 + Math.random() * 0.7;
        const from = r.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this._flashAt(from);
        if (Math.random() < 0.55) {
          this.state.hurt(7);
          if (hooks.onHurt) hooks.onHurt();
        }
        const to = new THREE.Vector3(hero.x, 1.2, hero.z);
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.9 }));
        this.scene.add(line);
        this.tracers.push({ line, t: 0.09 });
      }
    }
  }
}
