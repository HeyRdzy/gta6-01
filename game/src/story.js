// Mara Voss's five jobs, the gold beacon that marks them, taxi fares and
// stunt ramps. Missions run in order; each step is a goto, a fight or an
// escape, and finishing one pays out and unlocks the next.

import * as THREE from 'three';
import { glowTexture, stdMat, unitBox, unitCylinder } from './visuals.js';
import { clamp, dist2d, range } from './util.js';

export const MISSION_DEFS = [
  {
    name: 'Sunset Courier',
    payout: 300,
    intro: 'Mara: take this package to the marina. No detours, no questions.',
    start: { x: 30, z: 60 },
    steps: [{ type: 'goto', x: 150, z: 30, r: 6, label: 'Deliver the package to the marina' }],
  },
  {
    name: 'Getaway Driver',
    payout: 500,
    intro: 'Mara: the crew is hot. Shake the cops and reach the north garage.',
    start: { x: -30, z: 30 },
    steps: [{ type: 'goto', x: -120, z: -120, r: 6, label: 'Lose the cops, reach the north garage' }],
    wanted: 2,
  },
  {
    name: 'Package Run',
    payout: 400,
    intro: 'Mara: two drops tonight. Dockyard gate first, then back to me.',
    start: { x: 60, z: -60 },
    steps: [
      { type: 'goto', x: 120, z: 120, r: 6, label: 'Drop the package at the dockyard gate' },
      { type: 'goto', x: 60, z: -60, r: 6, label: 'Get back to Mara' },
    ],
  },
  {
    name: 'Dockyard Standoff',
    payout: 700,
    intro: 'Mara: the dock crew took our crate. Take it back, all of it.',
    start: { x: 120, z: 120 },
    steps: [
      { type: 'kill', count: 4, x: 120, z: 150, label: 'Clear the dockyard crew (4 left)' },
      { type: 'goto', x: 120, z: 90, r: 6, label: 'Grab the crate and leave the yard' },
    ],
  },
  {
    name: 'The Solmar Heist',
    payout: 1500,
    intro: 'Mara: tonight we take the vault. Get in, hold it, get out to the pier.',
    start: { x: -60, z: -60 },
    steps: [
      { type: 'goto', x: 135, z: 150, r: 6, label: 'Reach the dockyard vault' },
      { type: 'kill', count: 3, x: 135, z: 150, label: 'Hold the vault (3 left)' },
      { type: 'goto', x: 165, z: 0, r: 7, label: 'Escape to Pier 9' },
    ],
  },
];

export function createStory(scene, hero, combat, state, display, sound) {
  // Slim gold beacon: a short column, a ground ring and a halo sprite.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(unitCylinder(16), beaconMat);
  beacon.scale.set(1.05, 26, 1.05);
  beacon.position.set(30, 13, 60);
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(30, 0.06, 60);
  scene.add(ring);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc21a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  halo.scale.set(6, 6, 1);
  halo.position.set(30, 2, 60);
  scene.add(halo);

  // Taxi fare marker.
  const fareHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0x51ff7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  fareHalo.scale.set(5, 5, 1);
  scene.add(fareHalo);
  let fare = null;
  let fareCooldown = 0;

  // Stunt ramps: chevron wedges that pay for air.
  const ramps = [];
  const rampMat = stdMat('ramp', () => new THREE.MeshStandardMaterial({ color: 0xd8a23a, roughness: 0.7 }));
  const chevMat = stdMat('chev', () => new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
  for (const [rx, rz, ry] of [[-45, 0, 0], [45, -120, Math.PI / 2], [105, 30, -Math.PI / 2]]) {
    const ramp = new THREE.Group();
    const wedge = new THREE.Mesh(unitBox(), rampMat);
    wedge.scale.set(6, 1.2, 4);
    wedge.position.y = 0.6;
    wedge.rotation.z = 0.28;
    wedge.castShadow = true;
    ramp.add(wedge);
    const chev = new THREE.Mesh(unitBox(), chevMat);
    chev.scale.set(0.5, 0.5, 4.1);
    chev.position.set(-2.2, 1.35, 0);
    chev.rotation.z = 0.28;
    ramp.add(chev);
    ramp.position.set(rx, 0, rz);
    ramp.rotation.y = ry;
    scene.add(ramp);
    ramps.push({ x: rx, z: rz, cooldown: 0 });
  }

  const story = {
    active: null,
    beacon,
    ring,
    halo,

    nextDef() {
      return MISSION_DEFS[state.missionsDone] ?? null;
    },

    startNext(displayApi) {
      const def = story.nextDef();
      if (!def) {
        displayApi.toast('All jobs done — Solmar Bay is yours, free roam');
        return false;
      }
      story.active = { def, stepIdx: 0, killsAtStart: state.kills };
      displayApi.say(def.intro);
      displayApi.toast(`Job started: ${def.name} — $${def.payout}`);
      sound.chime();
      if (def.wanted) state.addWanted(def.wanted);
      story.placeBeacon();
      const step = def.steps[0];
      if (step.type === 'kill') combat.spawnRivals(step.x, step.z, step.count);
      return true;
    },

    placeBeacon() {
      const target = story.objectivePoint();
      if (!target) {
        beacon.visible = false;
        ring.visible = false;
        halo.visible = false;
        return;
      }
      const step = story.active ? story.active.def.steps[story.active.stepIdx] : null;
      const isKill = step && step.type === 'kill';
      beacon.visible = !isKill;
      ring.visible = true;
      halo.visible = true;
      beacon.position.set(target.x, 13, target.z);
      ring.position.set(target.x, 0.06, target.z);
      halo.position.set(target.x, 2, target.z);
    },

    objectivePoint() {
      if (story.active) {
        const step = story.active.def.steps[story.active.stepIdx];
        return { x: step.x, z: step.z };
      }
      const def = story.nextDef();
      return def ? { x: def.start.x, z: def.start.z } : null;
    },

    objectiveLabel() {
      if (story.active) {
        const step = story.active.def.steps[story.active.stepIdx];
        if (step.type === 'kill') {
          const left = step.count - (state.kills - story.active.killsAtStart);
          return `${step.label.split('(')[0].trim()} (${Math.max(0, left)} left)`;
        }
        return step.label;
      }
      const def = story.nextDef();
      return def ? `Next job: ${def.name} — $${def.payout} (walk to the gold beacon)` : 'All jobs done — free roam';
    },

    update(dt) {
      // Beacon idle motion.
      const t = performance.now() / 1000;
      ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
      halo.material.opacity = 0.45 + Math.sin(t * 2.4) * 0.18;

      if (story.active) {
        const step = story.active.def.steps[story.active.stepIdx];
        let done = false;
        if (step.type === 'goto') {
          done = dist2d(hero.x, hero.z, step.x, step.z) < step.r;
        } else if (step.type === 'kill') {
          done = state.kills - story.active.killsAtStart >= step.count;
        }
        if (done) {
          story.active.stepIdx++;
          if (story.active.stepIdx >= story.active.def.steps.length) {
            const def = story.active.def;
            state.addCash(def.payout);
            state.missions[def === MISSION_DEFS[0] ? 0 : MISSION_DEFS.indexOf(def)] = true;
            state.missionsDone++;
            state.save();
            display.toast(`Job complete: ${def.name} — +$${def.payout}`);
            sound.chime();
            combat.clearRivals();
            story.active = null;
            story.placeBeacon();
          } else {
            const next = story.active.def.steps[story.active.stepIdx];
            display.say(next.label);
            if (next.type === 'kill') {
              story.active.killsAtStart = state.kills;
              combat.spawnRivals(next.x, next.z, next.count);
            }
            story.placeBeacon();
          }
        }
      }

      // Taxi fares.
      fareCooldown -= dt;
      if (hero.driving && hero.car && hero.car.taxi) {
        if (!fare && fareCooldown <= 0) {
          const a = Math.random() * Math.PI * 2;
          const d = 45 + Math.random() * 40;
          fare = {
            x: clamp(hero.x + Math.sin(a) * d, -170, 170),
            z: clamp(hero.z + Math.cos(a) * d, -170, 170),
          };
          fareHalo.position.set(fare.x, 2, fare.z);
          fareHalo.material.opacity = 0.8;
          display.toast('New fare — drop them at the green marker');
        }
        if (fare && dist2d(hero.x, hero.z, fare.x, fare.z) < 6) {
          const pay = 20 + Math.floor(Math.random() * 21);
          state.addCash(pay);
          state.fares++;
          display.toast(`Fare paid +$${pay}`);
          sound.chime();
          fare = null;
          fareCooldown = 4;
          fareHalo.material.opacity = 0;
        }
      } else if (fare) {
        fare = null;
        fareHalo.material.opacity = 0;
      }

      // Stunt ramps.
      for (const r of ramps) {
        r.cooldown -= dt;
        if (hero.driving && r.cooldown <= 0 && dist2d(hero.x, hero.z, r.x, r.z) < 4.5 && Math.abs(hero.speed) > 15) {
          r.cooldown = 8;
          state.addCash(50);
          display.toast('STUNT +$50');
          sound.chime();
        }
      }
    },
  };

  story.placeBeacon();
  return story;
}
