// Solmar PD v3: black-and-white cruisers with flashing light bars, glow
// halos at night, and striped roadblocks at 3+ stars. Cruisers chase and
// ram; get caught on foot and it is a bust — fine, and a wake-up at the
// station.

import * as THREE from 'three';
import { clampNum, flatDist, turnToward } from './util.js';
import { buildCar } from './traffic.js';
import { heatToStars } from './state.js';
import { glowTexture, stdMat, sharedGeo } from './visuals.js';

function cruiserMesh(x, z, heading) {
  const built = buildCar(0x14181f, x, z, heading);
  const g = built.group;
  // White doors and hood: the classic black-and-white.
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.4 });
  for (const sx of [-1.03, 1.03]) {
    const door = new THREE.Mesh(sharedGeo('pdDoor', () => new THREE.BoxGeometry(0.06, 0.62, 1.9)), doorMat);
    door.position.set(sx, 0.78, -0.1);
    g.add(door);
  }
  const hoodW = new THREE.Mesh(sharedGeo('pdHood', () => new THREE.BoxGeometry(1.7, 0.06, 0.9)), doorMat);
  hoodW.position.set(0, 1.14, 1.55);
  g.add(hoodW);
  // Light bar: red and blue lenses plus a halo sprite that flashes.
  const barBase = new THREE.Mesh(sharedGeo('barBase', () => new THREE.BoxGeometry(1.5, 0.14, 0.5)), stdMat(0x111111, 0.5, 0.5));
  barBase.position.set(0, 1.68, -0.15);
  g.add(barBase);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff1a1a, emissiveIntensity: 1.4, roughness: 0.4 });
  const bar = new THREE.Mesh(sharedGeo('barLens', () => new THREE.BoxGeometry(0.62, 0.24, 0.42)), barMat);
  bar.position.set(-0.38, 1.82, -0.15);
  g.add(bar);
  const bar2Mat = new THREE.MeshStandardMaterial({ color: 0x112288, emissive: 0x2a6aff, emissiveIntensity: 1.4, roughness: 0.4 });
  const bar2 = new THREE.Mesh(sharedGeo('barLens', () => new THREE.BoxGeometry(0.62, 0.24, 0.42)), bar2Mat);
  bar2.position.set(0.38, 1.82, -0.15);
  g.add(bar2);
  const haloTex = glowTexture('rgba(255,60,60,0.9)', 'rgba(255,60,60,0)');
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.7, depthWrite: false }));
  halo.scale.set(4.5, 4.5, 1);
  halo.position.set(0, 2.1, -0.15);
  g.add(halo);
  return { group: g, bar, bar2, halo, parts: built };
}

export class Cops {
  constructor(scene, state, bay) {
    this.scene = scene;
    this.state = state;
    this.bay = bay;
    this.cars = [];
    this.blocks = [];
    this.bustT = 0;
    this.flashT = 0;
  }

  wanted() { return heatToStars(this.state.heat); }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.cars = [];
    this.blocks = [];
    this.bustT = 0;
  }

  _spawnCruiser(x, z) {
    const built = cruiserMesh(x, z, 0);
    this.scene.add(built.group);
    const c = { mesh: built.group, heading: 0, speed: 0, bar: built.bar, bar2: built.bar2, halo: built.halo, parts: built.parts };
    this.cars.push(c);
    return c;
  }

  /** Roadblocks: two cruisers nose-to-nose plus a striped barrier. */
  _placeBlocks(px, pz, heading) {
    if (this.blocks.length > 0) return;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const ax = 16 * fx, az = 16 * fz;
    [[-4, 0], [4, 0]].forEach(([off]) => {
      const built = cruiserMesh(px + ax - fz * off, pz + az + fx * off, heading + Math.PI / 2);
      this.scene.add(built.group);
      this.blocks.push({ mesh: built.group, bar: built.bar, bar2: built.bar2, halo: built.halo });
    });
    const stripe = new THREE.Mesh(
      sharedGeo('barrier', () => new THREE.BoxGeometry(9, 1, 0.4)),
      new THREE.MeshStandardMaterial({ color: 0xffc23b, roughness: 0.7 }),
    );
    stripe.position.set(px + ax, 1, pz + az);
    stripe.rotation.y = heading + Math.PI / 2;
    this.scene.add(stripe);
    this.blocks.push({ mesh: stripe, bar: null, bar2: null, halo: null });
  }

  _clearBlocks() {
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.blocks = [];
  }

  update(dt, hero, now, hooks) {
    const stars = this.wanted();
    const want = stars;
    while (this.cars.length < want) {
      const a = (this.cars.length / Math.max(1, want)) * Math.PI * 2;
      this._spawnCruiser(hero.x + Math.sin(a) * 55, hero.z + Math.cos(a) * 55);
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    if (stars >= 3) this._placeBlocks(hero.x, hero.z, hero.heading);
    else this._clearBlocks();

    // Flash the light bars: red and blue alternate, halos pulse with them.
    this.flashT += dt;
    const red = Math.floor(this.flashT * 6) % 2 === 0;
    for (const c of [...this.cars, ...this.blocks]) {
      if (!c.bar) continue;
      c.bar.material.emissiveIntensity = red ? 2.6 : 0.25;
      c.bar2.material.emissiveIntensity = red ? 0.25 : 2.6;
      if (c.halo) {
        c.halo.material.opacity = red ? 0.75 : 0.4;
        c.halo.material.color.setHex(red ? 0xff2a2a : 0x2a6aff);
      }
    }

    const chaseSpeed = 15 + stars * 3.2;
    for (const c of this.cars) {
      const p = c.mesh.position;
      const target = Math.atan2(hero.x - p.x, hero.z - p.z);
      c.heading = turnToward(c.heading, target, 2.4 * dt);
      c.speed = Math.min(c.speed + 14 * dt, chaseSpeed);
      p.x += Math.sin(c.heading) * c.speed * dt;
      p.z += Math.cos(c.heading) * c.speed * dt;
      p.x = clampNum(p.x, -148, 132);
      p.z = clampNum(p.z, -148, 148);
      c.mesh.rotation.y = c.heading;
      const spin = c.speed * dt / 0.44;
      for (const w of c.parts.wheels) w.rotation.x += spin;
      const d = flatDist(p.x, p.z, hero.x, hero.z);
      if (d < 3.4) {
        if (hero.driving) {
          hero.dentCar(9);
          hero.speed *= 0.55;
          if (hooks.onRam) hooks.onRam();
        } else if (hooks.onTouch) {
          hooks.onTouch(dt);
        }
      }
    }

    if (stars > 0 && !hero.driving) {
      let close = false;
      for (const c of this.cars) {
        if (flatDist(c.mesh.position.x, c.mesh.position.z, hero.x, hero.z) < 3.2) { close = true; break; }
      }
      this.bustT = close ? this.bustT + dt : 0;
      if (this.bustT > 1.4 && hooks.onBusted) {
        this.bustT = 0;
        hooks.onBusted();
      }
    } else {
      this.bustT = 0;
    }
  }
}
