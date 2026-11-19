// Solmar PD in v2: wanted stars drive how many cruisers hunt Rio, and at
// 3+ stars the PD throws roadblocks across the streets ahead of him. Cruisers
// chase and ram; get caught on foot and it is a bust — fine, and a wake-up at
// the station.

import * as THREE from 'three';
import { clampNum, flatDist, turnToward } from './util.js';
import { buildCar } from './traffic.js';
import { heatToStars } from './state.js';

function cruiserMesh(x, z, heading) {
  const { group } = buildCar(0x1d2733, x, z, heading);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), barMat);
  bar.position.set(-0.3, 1.72, -0.2);
  group.add(bar);
  const bar2 = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.22, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2a6aff }),
  );
  bar2.position.set(0.3, 1.72, -0.2);
  group.add(bar2);
  bar.userData.flash = true;
  return { group, bar, bar2 };
}

export class Cops {
  constructor(scene, state, bay) {
    this.scene = scene;
    this.state = state;
    this.bay = bay;
    this.cars = []; // { mesh, heading, speed, bar, bar2 }
    this.blocks = []; // roadblock cruisers, parked across roads
    this.bustT = 0;
    this.sirenT = 0;
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
    const { group, bar, bar2 } = cruiserMesh(x, z, 0);
    this.scene.add(group);
    const c = { mesh: group, heading: 0, speed: 0, bar, bar2 };
    this.cars.push(c);
    return c;
  }

  /** Roadblocks: two cruisers parked nose-to-nose across the road ahead. */
  _placeBlocks(px, pz, heading) {
    if (this.blocks.length > 0) return;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const ax = 16 * fx, az = 16 * fz;
    [[-4, 0], [4, 0]].forEach(([off, _]) => {
      const { group, bar, bar2 } = cruiserMesh(px + ax - fz * off, pz + az + fx * off, heading + Math.PI / 2);
      this.scene.add(group);
      this.blocks.push({ mesh: group, bar, bar2 });
    });
  }

  _clearBlocks() {
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.blocks = [];
  }

  update(dt, hero, now, hooks) {
    const stars = this.wanted();
    const want = stars; // one cruiser per star
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

    // Flash the light bars.
    this.flashT += dt;
    const red = Math.floor(this.flashT * 6) % 2 === 0;
    for (const c of [...this.cars, ...this.blocks]) {
      c.bar.material.color.setHex(red ? 0xff2a2a : 0x881111);
      c.bar2.material.color.setHex(red ? 0x112288 : 0x2a6aff);
    }

    // Chase: steer at Rio, faster than traffic, ramming when close.
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

    // Busted: a cruiser sits on top of Rio on foot for a moment.
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
