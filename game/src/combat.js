// Combat: Rio's pistol, muzzle flash, tracers, impact sparks and the rival
// crews that missions spawn. Rivals carry health bars and shoot back badly.

import * as THREE from 'three';
import { glowTexture, stdMat, unitBox, unitSphere } from './visuals.js';
import { clamp, dist2d, mulberry32, range } from './util.js';

function buildRival() {
  const group = new THREE.Group();
  const jacket = stdMat('rivaljacket', () => new THREE.MeshStandardMaterial({ color: 0x3a2a2a, roughness: 0.9 }));
  const pants = stdMat('rivalpants', () => new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.95 }));
  const skin = stdMat('rivalskin', () => new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 }));
  const band = stdMat('bandana', () => new THREE.MeshStandardMaterial({ color: 0xc22a1e, roughness: 0.8 }));

  const torso = new THREE.Mesh(unitBox(), jacket);
  torso.scale.set(0.58, 0.74, 0.34);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(unitSphere(10, 8), skin);
  head.scale.setScalar(0.22);
  head.position.y = 1.76;
  head.castShadow = true;
  group.add(head);
  const bandana = new THREE.Mesh(unitBox(), band);
  bandana.scale.set(0.46, 0.12, 0.46);
  bandana.position.y = 1.9;
  group.add(bandana);

  const limbs = {};
  const mk = (mat, w, len, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const seg = new THREE.Mesh(unitBox(), mat);
    seg.scale.set(w, len, w);
    seg.position.y = -len / 2;
    seg.castShadow = true;
    pivot.add(seg);
    group.add(pivot);
    return pivot;
  };
  limbs.armL = mk(skin, 0.17, 0.64, -0.38, 1.52);
  limbs.armR = mk(skin, 0.17, 0.64, 0.38, 1.52);
  limbs.legL = mk(pants, 0.21, 0.74, -0.16, 0.84);
  limbs.legR = mk(pants, 0.21, 0.74, 0.16, 0.84);

  // Health bar: a dark back sprite and a red front sprite that shrinks.
  const barBg = new THREE.Sprite(
    new THREE.SpriteMaterial({ color: 0x1a1a1a, depthWrite: false })
  );
  barBg.scale.set(1.3, 0.16, 1);
  barBg.position.y = 2.25;
  group.add(barBg);
  const barFg = new THREE.Sprite(
    new THREE.SpriteMaterial({ color: 0xff2a2a, depthWrite: false })
  );
  barFg.scale.set(1.24, 0.1, 1);
  barFg.position.y = 2.25;
  group.add(barFg);
  return { group, limbs, barBg, barFg };
}

export function createCombat(scene, world, hero, traffic, cops, state, display, sound) {
  const flashLight = new THREE.PointLight(0xffc06a, 0, 14, 1.6);
  scene.add(flashLight);
  const flashSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  flashSprite.scale.set(1.6, 1.6, 1);
  scene.add(flashSprite);
  let flashTime = 0;

  const tracers = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(
      unitBox(),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    scene.add(t);
    tracers.push({ mesh: t, life: 0 });
  }
  let tracerIdx = 0;

  const sparks = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb35c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    scene.add(s);
    sparks.push({ spr: s, life: 0, vx: 0, vy: 0, vz: 0 });
  }

  const combat = {
    ammo: 12,
    maxAmmo: 12,
    reloading: false,
    reloadTimer: 0,
    rivals: [],

    spawnRivals(x, z, count) {
      const rng = mulberry32((Math.random() * 1e9) | 0);
      for (let i = 0; i < count; i++) {
        const r = buildRival();
        const px = x + range(rng, -9, 9);
        const pz = z + range(rng, -9, 9);
        r.group.position.set(px, 0, pz);
        scene.add(r.group);
        combat.rivals.push({
          mesh: r.group,
          limbs: r.limbs,
          barBg: r.barBg,
          barFg: r.barFg,
          x: px,
          z: pz,
          health: 3,
          maxHealth: 3,
          phase: rng() * Math.PI * 2,
          shootTimer: 1 + rng() * 1.5,
          dead: false,
        });
      }
    },

    clearRivals() {
      for (const r of combat.rivals) scene.remove(r.mesh);
      combat.rivals.length = 0;
    },

    reload() {
      if (combat.reloading || combat.ammo === combat.maxAmmo) return;
      combat.reloading = true;
      combat.reloadTimer = 1.1;
      display.toast('Reloading…');
    },

    shoot(camera) {
      if (combat.reloading || combat.ammo <= 0) {
        if (combat.ammo <= 0) combat.reload();
        return false;
      }
      combat.ammo--;
      sound.gunshot();
      state.addWanted(0); // firing alone draws attention only when it lands
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = new THREE.Vector3();
      camera.getWorldPosition(origin);
      // Muzzle flash at Rio's gun hand.
      const muzzle = new THREE.Vector3(hero.x, hero.y + 1.35, hero.z);
      if (hero.driving && hero.car) {
        muzzle.set(hero.car.mesh.position.x, 1.4, hero.car.mesh.position.z);
      }
      flashLight.position.copy(muzzle);
      flashLight.intensity = 26;
      flashSprite.position.copy(muzzle);
      flashSprite.material.opacity = 0.9;
      flashTime = 0.06;

      // Nearest rival inside a narrow cone of the camera ray.
      let hitRival = null;
      let hitDist = 70;
      for (const r of combat.rivals) {
        if (r.dead) continue;
        const to = new THREE.Vector3(r.x - origin.x, 1.3 - origin.y, r.z - origin.z);
        const d = to.length();
        if (d > hitDist) continue;
        to.normalize();
        const angle = Math.acos(clamp(to.dot(dir), -1, 1));
        if (angle < 0.09) {
          hitRival = r;
          hitDist = d;
        }
      }
      const end = origin.clone().add(dir.clone().multiplyScalar(hitRival ? hitDist : 46));
      const t = tracers[tracerIdx++ % tracers.length];
      const mid = muzzle.clone().add(end).multiplyScalar(0.5);
      t.mesh.position.copy(mid);
      t.mesh.lookAt(end);
      t.mesh.scale.set(0.06, 0.06, muzzle.distanceTo(end));
      t.mesh.material.opacity = 0.9;
      t.life = 0.09;
      if (hitRival) {
        hitRival.health--;
        hitRival.barFg.scale.x = 1.24 * Math.max(0, hitRival.health / hitRival.maxHealth);
        burstSparks(end.x, end.y, end.z);
        state.addWanted(1);
        if (hitRival.health <= 0) {
          hitRival.dead = true;
          hitRival.mesh.rotation.z = Math.PI / 2;
          hitRival.barBg.visible = false;
          hitRival.barFg.visible = false;
          state.kills++;
          display.toast('Rival down');
        }
      } else {
        // Stray shots can hit a car or a pedestrian and raise the heat.
        for (const c of traffic.cars) {
          const to = new THREE.Vector3(c.mesh.position.x - origin.x, 0.8 - origin.y, c.mesh.position.z - origin.z);
          const d = to.length();
          if (d < 46) {
            to.normalize();
            if (Math.acos(clamp(to.dot(dir), -1, 1)) < 0.07) {
              state.addWanted(1);
              burstSparks(end.x, 0.8, end.z);
              break;
            }
          }
        }
      }
      return true;
    },

    update(dt, camera) {
      if (combat.reloading) {
        combat.reloadTimer -= dt;
        if (combat.reloadTimer <= 0) {
          combat.ammo = combat.maxAmmo;
          combat.reloading = false;
        }
      }
      if (flashTime > 0) {
        flashTime -= dt;
        if (flashTime <= 0) {
          flashLight.intensity = 0;
          flashSprite.material.opacity = 0;
        }
      }
      for (const t of tracers) {
        if (t.life > 0) {
          t.life -= dt;
          if (t.life <= 0) t.mesh.material.opacity = 0;
        }
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.spr.position.x += s.vx * dt;
        s.spr.position.y += s.vy * dt;
        s.spr.position.z += s.vz * dt;
        s.vy -= 6 * dt;
        s.spr.material.opacity = Math.max(0, s.life * 2.4);
      }
      // Rivals face Rio, shuffle and shoot back.
      for (const r of combat.rivals) {
        if (r.dead) continue;
        const dx = hero.x - r.x;
        const dz = hero.z - r.z;
        const d = Math.hypot(dx, dz);
        r.mesh.rotation.y = Math.atan2(dx, dz);
        r.phase += dt * 2.2;
        const sway = Math.sin(r.phase) * 0.5;
        r.limbs.armL.rotation.x = sway;
        r.limbs.armR.rotation.x = -sway;
        if (d < 30) {
          r.shootTimer -= dt;
          if (r.shootTimer <= 0) {
            r.shootTimer = 1.6 + Math.random() * 1.2;
            if (Math.random() < 0.38) {
              hero.damage(5 + Math.random() * 5, 'rival shot');
              sound.rivalShot();
              burstSparks(hero.x, hero.y + 1.3, hero.z);
            }
          }
        }
        if (d > 34) {
          // Close in slowly so the fight stays in the yard.
          const step = 2.2 * dt;
          r.x += (dx / d) * step;
          r.z += (dz / d) * step;
          r.mesh.position.set(r.x, 0, r.z);
        }
      }
    },
  };

  function burstSparks(x, y, z) {
    for (let i = 0; i < 3; i++) {
      const s = sparks.find((sp) => sp.life <= 0);
      if (!s) return;
      s.spr.position.set(x, y, z);
      s.vx = (Math.random() - 0.5) * 6;
      s.vy = Math.random() * 4;
      s.vz = (Math.random() - 0.5) * 6;
      s.life = 0.35;
      s.spr.material.opacity = 0.9;
    }
  }

  return combat;
}
