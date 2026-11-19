// Story for Solmar Heat v3: five jobs from fixer Mara Voss, plus two ways
// to earn on the side — taxi fares and beach stunt jumps. Each job is a
// chain of steps (go somewhere, hold a spot, survive, clear the rivals);
// the waypoint beacon always points at the next one. Markers glow now:
// the beacon pulses gold, packages shine, ramps wear chevrons.

import * as THREE from 'three';
import { flatDist } from './util.js';
import { glowTexture } from './visuals.js';

const JOBS = [
  {
    name: 'Sunset Courier', pay: 300,
    brief: 'Mara Voss: Rosa needs a parcel at the marina before dark. Fast feet, faster car.',
    steps: [
      { kind: 'goto', label: 'Pick up the parcel at Rosa\u2019s Diner', x: 21, z: 63 },
      { kind: 'goto', label: 'Deliver it to the Marina Office', x: 105, z: -63, time: 80 },
    ],
  },
  {
    name: 'Getaway Driver', pay: 500,
    brief: 'Mara Voss: I torched a deal and the PD is coming. Get in a car and stay gone for 40 seconds.',
    steps: [
      { kind: 'survive', label: 'Lose the cops — survive 40 seconds', time: 40, heat: 55 },
    ],
  },
  {
    name: 'Package Run', pay: 400,
    brief: 'Mara Voss: Five packages, five corners of the bay. No questions, no stops.',
    steps: [
      { kind: 'collect', label: 'Collect the packages (0/5)', count: 5 },
    ],
  },
  {
    name: 'Dockyard Standoff', pay: 700,
    brief: 'Mara Voss: The Kestrel crew is waiting at the docks. Clear them out.',
    steps: [
      { kind: 'goto', label: 'Reach the docks', x: 105, z: -84 },
      { kind: 'kill', label: 'Clear the Kestrel crew', spots: [[98, -92], [112, -76], [104, -98], [118, -88]] },
    ],
  },
  {
    name: 'The Solmar Heist', pay: 1500,
    brief: 'Mara Voss: One last job. Crack the Solmar Trust vault, then run for the pier.',
    steps: [
      { kind: 'goto', label: 'Reach the Solmar Trust Bank', x: -21, z: -21 },
      { kind: 'hold', label: 'Crack the vault — stay inside 12 seconds', x: -21, z: -21, time: 12, heat: 70 },
      { kind: 'goto', label: 'Escape to the pier', x: 144, z: -40 },
    ],
  },
];

const PACKAGE_SPOTS = [[-84, -84], [42, -84], [-42, 42], [84, 84], [0, -126]];
const TAXI_DROPS = [[-21, -21], [21, 63], [105, -63], [-63, 105], [0, 96]];

function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a5a2a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffc23b';
  for (let y = 8; y < 128; y += 32) {
    g.beginPath();
    g.moveTo(24, y); g.lineTo(64, y + 16); g.lineTo(104, y);
    g.lineTo(104, y + 10); g.lineTo(64, y + 26); g.lineTo(24, y + 10);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Story {
  constructor(scene, bay, state, combat) {
    this.scene = scene;
    this.bay = bay;
    this.state = state;
    this.combat = combat;
    this.jobIndex = 0;
    this.stepIndex = 0;
    this.active = null;
    this.packages = [];
    this.taxi = { state: 'idle', pickup: null, drop: null, fare: 0, wait: 6 };
    this.stuntCooldown = 0;
    this._glowTex = glowTexture('rgba(255,194,59,0.9)', 'rgba(255,194,59,0)');

    // Gold waypoint beacon: a pulsing column with a halo at its foot.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc23b, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTex, transparent: true, opacity: 0.6, depthWrite: false,
    }));
    this.beaconHalo.scale.set(12, 12, 1);
    this.beaconHalo.visible = false;
    scene.add(this.beaconHalo);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.3, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc23b }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);

    // Package crates: gold, emissive, with a halo so they read at dusk.
    for (const [x, z] of PACKAGE_SPOTS) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xffc23b, emissive: 0xa87800, emissiveIntensity: 0.55, roughness: 0.5 }),
      );
      m.position.set(x, 0.9, z);
      m.visible = false;
      m.castShadow = true;
      scene.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._glowTex, transparent: true, opacity: 0.5, depthWrite: false,
      }));
      halo.scale.set(5, 5, 1);
      halo.position.set(x, 1.4, z);
      halo.visible = false;
      scene.add(halo);
      this.packages.push({ mesh: m, halo, x, z, taken: false });
    }

    // Stunt ramps on the beach, chevron-striped.
    this.ramps = [];
    const rampTex = chevronTexture();
    for (const z of [-60, 0, 60]) {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(6, 1, 10),
        new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.85 }),
      );
      ramp.position.set(112, 0.8, z);
      ramp.rotation.z = -0.35;
      ramp.castShadow = true;
      scene.add(ramp);
      this.ramps.push({ x: 112, z, usedAt: -99 });
    }

    // Taxi fare marker.
    this.fareMark = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 14, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2ee6a8, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.fareMark.visible = false;
    scene.add(this.fareMark);
    this.fareHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(46,230,168,0.9)', 'rgba(46,230,168,0)'), transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.fareHalo.scale.set(10, 10, 1);
    this.fareHalo.visible = false;
    scene.add(this.fareHalo);
  }

  currentJob() { return JOBS[this.jobIndex] || null; }

  title() {
    if (!this.active) {
      const j = this.currentJob();
      return j ? 'Next job: ' + j.name + ' — press E near the gold M' : 'All jobs done — Solmar Bay is yours';
    }
    return this.active.def.name;
  }

  objective() {
    if (!this.active) return 'Follow the gold M to start your next job';
    const step = this.active.def.steps[this.stepIndex];
    if (!step) return '';
    if (step.kind === 'collect') return `Collect the packages (${this.active.collected}/5)`;
    if (step.kind === 'survive') return `Lose the cops — ${Math.ceil(this.active.timer)}s left`;
    if (step.kind === 'hold') return `Crack the vault — ${Math.ceil(this.active.timer)}s left`;
    return step.label;
  }

  waypoint() {
    if (!this.active) return null;
    const step = this.active.def.steps[this.stepIndex];
    if (!step) return null;
    if (step.kind === 'collect') {
      const next = this.packages.find((p) => !p.taken);
      return next ? { x: next.x, z: next.z } : null;
    }
    if (step.kind === 'survive' || step.kind === 'kill') return null;
    return { x: step.x, z: step.z };
  }

  startNext(events) {
    const job = this.currentJob();
    if (!job) return false;
    this.active = { def: job, timer: 0, collected: 0 };
    this.stepIndex = 0;
    this._enterStep(events);
    return true;
  }

  _enterStep(events) {
    const step = this.active.def.steps[this.stepIndex];
    if (!step) return;
    if (step.kind === 'survive' || step.kind === 'hold') this.active.timer = step.time;
    if (step.kind === 'hold' && step.heat) this.state.addHeat(step.heat);
    if (step.kind === 'survive' && step.heat) this.state.addHeat(step.heat);
    if (step.kind === 'collect') {
      for (const p of this.packages) { p.taken = false; p.mesh.visible = true; p.halo.visible = true; }
      this.active.collected = 0;
    }
    if (step.kind === 'kill') this.combat.spawnRivals(step.spots);
    if (events) events.say(this.active.def.brief);
  }

  _advance(events) {
    this.stepIndex++;
    const job = this.active.def;
    if (this.stepIndex >= job.steps.length) {
      this.state.addCash(job.pay);
      this.state.missionsDone++;
      if (events) {
        events.toast(`Job complete: ${job.name} — +$${job.pay}`);
        events.say(`Mara Voss: ${job.name} done. $${job.pay} is yours.`);
      }
      this.jobIndex++;
      this.active = null;
      this.beacon.visible = false;
      this.beaconHalo.visible = false;
      this.ring.visible = false;
      this.combat.clearRivals();
      return;
    }
    this._enterStep(events);
  }

  update(dt, hero, now, events) {
    // Waypoint beacon follows the current step, pulsing as it goes.
    const wp = this.waypoint();
    const pulse = 0.3 + Math.sin(now * 3) * 0.12;
    if (wp) {
      this.beacon.visible = true;
      this.beaconHalo.visible = true;
      this.ring.visible = true;
      this.beacon.material.opacity = pulse;
      this.beacon.position.set(wp.x, 13, wp.z);
      this.beaconHalo.position.set(wp.x, 2, wp.z);
      this.ring.position.set(wp.x, 0.3 + Math.sin(now * 2) * 0.2, wp.z);
      const rs = 1 + Math.sin(now * 2) * 0.12;
      this.ring.scale.set(rs, rs, 1);
    } else {
      this.beacon.visible = !!this.active;
      this.beaconHalo.visible = !!this.active;
      this.ring.visible = false;
      if (this.active) {
        this.beacon.material.opacity = pulse;
        this.beacon.position.set(hero.x, 13, hero.z);
        this.beaconHalo.position.set(hero.x, 2, hero.z);
      }
    }

    if (this.active) {
      const step = this.active.def.steps[this.stepIndex];
      if (step.kind === 'goto') {
        if (flatDist(hero.x, hero.z, step.x, step.z) < 5) {
          if (step.time && this.active.timer <= 0) this.active.timer = step.time;
          this._advance(events);
        } else if (step.time) {
          this.active.timer -= dt;
          if (this.active.timer <= 0) {
            if (events) events.toast('Too slow — the job fell through');
            this.active = null;
            this.beacon.visible = false;
            this.beaconHalo.visible = false;
          }
        }
      } else if (step.kind === 'collect') {
        for (const p of this.packages) {
          if (!p.taken && flatDist(hero.x, hero.z, p.x, p.z) < 3.5) {
            p.taken = true; p.mesh.visible = false; p.halo.visible = false;
            this.active.collected++;
            this.state.addCash(40);
            if (events) events.toast(`Package ${this.active.collected}/5 — +$40`);
          }
        }
        if (this.active.collected >= step.count) this._advance(events);
      } else if (step.kind === 'survive') {
        this.active.timer -= dt;
        if (this.active.timer <= 0) this._advance(events);
      } else if (step.kind === 'kill') {
        if (this.combat.rivalsLeft() === 0) this._advance(events);
      } else if (step.kind === 'hold') {
        if (flatDist(hero.x, hero.z, step.x, step.z) < 7) {
          this.active.timer -= dt;
          if (this.active.timer <= 0) this._advance(events);
        }
      }
    }

    // --- Taxi fares and stunt jumps -----------------------------------------
    this.stuntCooldown -= dt;
    if (hero.driving) {
      const speed = Math.abs(hero.speed);
      for (const r of this.ramps) {
        if (speed > 24 && flatDist(hero.x, hero.z, r.x, r.z) < 6 && now - r.usedAt > 30) {
          r.usedAt = now;
          this.state.addCash(80);
          this.state.stuntsDone++;
          if (events) events.toast('Stunt jump! +$80');
        }
      }
    }
    if (this.taxi.state === 'idle') {
      this.taxi.wait -= dt;
      if (this.taxi.wait <= 0 && hero.driving) {
        const px = -84 + Math.floor(Math.random() * 5) * 42;
        const pz = -84 + Math.floor(Math.random() * 5) * 42;
        this.taxi = { state: 'pickup', pickup: { x: px, z: pz }, drop: null, fare: 60 + Math.floor(Math.random() * 7) * 10, wait: 0 };
        this.fareMark.visible = true;
        this.fareHalo.visible = true;
        this.fareMark.position.set(px, 7, pz);
        this.fareHalo.position.set(px, 1.5, pz);
        if (events) events.toast('Taxi fare waiting — green beacon');
      }
    } else if (this.taxi.state === 'pickup') {
      if (flatDist(hero.x, hero.z, this.taxi.pickup.x, this.taxi.pickup.z) < 5) {
        const drop = TAXI_DROPS[Math.floor(Math.random() * TAXI_DROPS.length)];
        this.taxi.state = 'drop';
        this.taxi.drop = { x: drop[0], z: drop[1] };
        this.fareMark.position.set(this.taxi.drop.x, 7, this.taxi.drop.z);
        this.fareHalo.position.set(this.taxi.drop.x, 1.5, this.taxi.drop.z);
        if (events) events.say('Passenger: Take me across town, and step on it.');
      }
    } else if (this.taxi.state === 'drop') {
      if (flatDist(hero.x, hero.z, this.taxi.drop.x, this.taxi.drop.z) < 5) {
        this.state.addCash(this.taxi.fare);
        this.state.taxiEarned += this.taxi.fare;
        if (events) events.toast(`Fare complete — +$${this.taxi.fare}`);
        this.taxi = { state: 'idle', pickup: null, drop: null, fare: 0, wait: 8 };
        this.fareMark.visible = false;
        this.fareHalo.visible = false;
      }
    }
  }
}
