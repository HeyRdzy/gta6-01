// The story: five missions across Solmar Bay, from a courier run to the bank heist.
// A gold "M" marker starts the next mission; each step has a waypoint beacon, a
// subtitle line, and a cash reward at the end. Enemies only exist inside missions.

import * as THREE from 'three';
import { MISSIONS, WANTED } from './config.js';
import { makeWaypointBeacon, makePackageMesh } from './city.js';
import { makePedMesh } from './pedestrians.js';

/** Build the mission manager. `game` carries scene, player, wanted, audio and HUD hooks. */
export function createMissionManager(game) {
  const { scene, audio } = game;
  const manager = {
    completed: 0,
    active: null,
    stepIndex: 0,
    stepTimer: 0,
    collected: 0,
    killed: 0,
    enemies: [],
    packages: [],
    beacon: null,
    marker: null,
    subtitle: '',
    subtitleTimer: 0,
  };

  // The gold M marker where the next mission starts (outside Rosa's Diner).
  const marker = makeWaypointBeacon(0xffc23b);
  marker.position.set(-100, 0, -66);
  marker.visible = true;
  scene.add(marker);
  manager.marker = marker;

  function setBeacon(x, z, color) {
    if (manager.beacon) {
      scene.remove(manager.beacon);
      manager.beacon = null;
    }
    if (x === null || x === undefined) return;
    const beacon = makeWaypointBeacon(color || 0xffc23b);
    beacon.position.set(x, 0, z);
    scene.add(beacon);
    manager.beacon = beacon;
  }

  function say(line, seconds) {
    manager.subtitle = line;
    manager.subtitleTimer = seconds || 5;
    if (game.hud) game.hud.showSubtitle(line, seconds || 5);
  }

  function clearEnemies() {
    for (const enemy of manager.enemies) scene.remove(enemy.mesh);
    manager.enemies = [];
  }

  function clearPackages() {
    for (const pack of manager.packages) scene.remove(pack.mesh);
    manager.packages = [];
  }

  function spawnEnemies(x, z, count) {
    clearEnemies();
    for (let i = 0; i < count; i += 1) {
      const mesh = makePedMesh(0x8a2f2f, 0xc98d5f);
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(x + Math.cos(angle) * 6, 0, z + Math.sin(angle) * 6);
      scene.add(mesh);
      manager.enemies.push({
        mesh,
        health: 100,
        shootTimer: 1 + i * 0.7,
        walkPhase: 0,
      });
    }
  }

  function spawnPackages(spots) {
    clearPackages();
    for (const [x, z] of spots) {
      const mesh = makePackageMesh();
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      manager.packages.push({ mesh, x, z, taken: false });
    }
  }

  function currentStep() {
    if (!manager.active) return null;
    return manager.active.steps[manager.stepIndex] || null;
  }

  function beginStep() {
    const step = currentStep();
    if (!step) {
      completeMission();
      return;
    }
    manager.stepTimer = step.time || 0;
    manager.collected = 0;
    manager.killed = 0;
    if (step.heatOnStart) game.wanted.addHeat(step.heatOnStart, game.now);
    if (step.kind === 'collect') spawnPackages(step.spots);
    else clearPackages();
    if (step.kind === 'fight') spawnEnemies(step.x, step.z, step.enemies || 3);
    else if (step.kind !== 'collect') clearEnemies();
    if (step.kind === 'collect') setBeacon(null);
    else setBeacon(step.x, step.z);
    say(step.label, 5);
  }

  function completeMission() {
    const mission = manager.active;
    manager.active = null;
    manager.stepIndex = 0;
    setBeacon(null);
    clearEnemies();
    clearPackages();
    manager.completed += 1;
    game.cash += mission.reward;
    audio.missionComplete();
    say(`Mission complete: ${mission.title} — $${mission.reward} earned.`, 6);
    if (game.hud) game.hud.toast(`+$${mission.reward} — ${mission.title} complete`);
    if (manager.completed >= MISSIONS.length) {
      say('Story complete! You own Solmar Bay. Free roam — keep the heat down.', 8);
      if (game.hud) game.hud.toast('STORY COMPLETE — Solmar Bay is yours');
    }
    if (game.onMissionComplete) game.onMissionComplete(mission);
  }

  function failMission(reason) {
    if (!manager.active) return;
    const mission = manager.active;
    manager.active = null;
    manager.stepIndex = 0;
    setBeacon(null);
    clearEnemies();
    clearPackages();
    audio.busted();
    say(`Mission failed: ${mission.title} — ${reason} Talk to the marker to try again.`, 6);
    if (game.hud) game.hud.toast(`Mission failed — ${reason}`);
  }

  return Object.assign(manager, {
    /** The next mission in line, or null when the story is done. */
    nextMission() {
      return MISSIONS[manager.completed] || null;
    },

    /** Start the next mission from the marker. */
    startNextMission() {
      const mission = MISSIONS[manager.completed];
      if (!mission || manager.active) return false;
      manager.active = mission;
      manager.stepIndex = 0;
      marker.visible = false;
      audio.missionStart();
      say(`${mission.giver}: ${mission.briefing}`, 7);
      if (game.hud) game.hud.toast(`Mission started: ${mission.title}`);
      beginStep();
      return true;
    },

    /** The active step's target position for the waypoint and minimap. */
    waypoint() {
      const step = currentStep();
      if (!step) return null;
      if (step.kind === 'collect') {
        const next = manager.packages.find((pack) => !pack.taken);
        return next ? { x: next.x, z: next.z } : null;
      }
      return { x: step.x, z: step.z };
    },

    /** Objective line for the HUD, with live counts and timers. */
    objectiveText() {
      const step = currentStep();
      if (!step) {
        const next = MISSIONS[manager.completed];
        return next ? `Next: ${next.title} — go to the gold M at Rosa's Diner` : 'Story complete — free roam Solmar Bay';
      }
      let label = step.label;
      if (step.kind === 'collect') label = `Collect the stashed packages (${manager.collected}/${step.count})`;
      if (step.kind === 'fight') label = `Clear the Kestrel crew at the docks (${manager.killed}/${step.enemies})`;
      if (step.time) label += ` — ${Math.max(0, Math.ceil(manager.stepTimer))}s left`;
      return `${manager.active.title}: ${label}`;
    },

    /** Step the active mission: waypoint arrival, timers, fights, collections. */
    update(dt) {
      if (manager.subtitleTimer > 0) manager.subtitleTimer -= dt;
      if (manager.beacon) {
        const diamond = manager.beacon.getObjectByName('beaconDiamond');
        if (diamond) {
          diamond.rotation.y += dt * 2;
          diamond.position.y = 6 + Math.sin(performance.now() / 300) * 0.5;
        }
      }
      if (manager.marker.visible) {
        const diamond = manager.marker.getObjectByName('beaconDiamond');
        if (diamond) diamond.rotation.y += dt * 1.5;
      }
      // Enemies hunt the player and shoot when close.
      for (const enemy of manager.enemies) {
        if (enemy.health <= 0) continue;
        const playerPos = game.player.state.position;
        const dx = playerPos.x - enemy.mesh.position.x;
        const dz = playerPos.z - enemy.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.5) {
          const speed = 3.2;
          enemy.mesh.position.x += (dx / dist) * speed * dt;
          enemy.mesh.position.z += (dz / dist) * speed * dt;
        }
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        enemy.shootTimer -= dt;
        if (dist < 32 && enemy.shootTimer <= 0) {
          enemy.shootTimer = 1.1 + Math.random() * 0.7;
          audio.enemyShot();
          const died = game.player.damage(7, game.now);
          if (game.hud) game.hud.flashDamage();
          if (died) {
            failMission('you were taken down.');
            game.onPlayerDown();
            return;
          }
        }
      }
      if (!manager.active) return;
      const step = currentStep();
      if (!step) return;
      const playerPos = game.player.state.position;
      if (step.time) {
        manager.stepTimer -= dt;
        if (manager.stepTimer <= 0) {
          failMission('out of time.');
          return;
        }
      }
      if (step.kind === 'collect') {
        for (const pack of manager.packages) {
          if (pack.taken) continue;
          const dx = playerPos.x - pack.x;
          const dz = playerPos.z - pack.z;
          if (dx * dx + dz * dz < 9) {
            pack.taken = true;
            scene.remove(pack.mesh);
            manager.collected += 1;
            audio.pickup();
            game.cash += 25;
            if (game.hud) game.hud.toast(`Package ${manager.collected}/${step.count} — +$25`);
            if (manager.collected >= step.count) {
              manager.stepIndex += 1;
              beginStep();
            }
            return;
          }
        }
        return;
      }
      if (step.kind === 'fight') {
        if (manager.killed >= step.enemies) {
          manager.stepIndex += 1;
          beginStep();
        }
        return;
      }
      const dx = playerPos.x - step.x;
      const dz = playerPos.z - step.z;
      const radius = step.radius || 6;
      if (dx * dx + dz * dz < radius * radius) {
        if (step.kind === 'escape' && game.wanted.stars() > 0) {
          // Reach the hideout, then wait out the heat right there.
          return;
        }
        manager.stepIndex += 1;
        if (step.kind === 'grab') {
          game.cash += 200;
          audio.pickup();
          if (game.hud) game.hud.toast('Vault cash grabbed — +$200, run!');
        }
        if (manager.stepIndex >= manager.active.steps.length) completeMission();
        else beginStep();
      }
    },

    /** Apply a shot hit on an enemy; returns true when it dies. */
    damageEnemy(enemy, damage) {
      enemy.health -= damage;
      if (enemy.health <= 0) {
        scene.remove(enemy.mesh);
        manager.killed += 1;
        audio.pickup();
        game.cash += 50;
        if (game.hud) game.hud.toast('Rival down — +$50');
        const step = currentStep();
        if (step && step.kind === 'fight' && manager.killed >= step.enemies) {
          manager.stepIndex += 1;
          beginStep();
        }
        return true;
      }
      return false;
    },

    /** Abort the active mission (player died or was busted) and show the marker again. */
    abort(reason) {
      failMission(reason);
      marker.visible = true;
    },

    /** Show or hide the start marker. */
    setMarkerVisible(visible) {
      marker.visible = visible;
    },
  });
}
