// The screenshot scenes behind ?shot=start|play|chase|mission (with &seed=N).
// Each one stages a deterministic moment of the real game — same seed, same frame —
// by placing the player, cars, police and a mission, then letting the world run for
// a few seconds so traffic and pedestrians are mid-motion when the frame is taken.

import * as THREE from 'three';
import { WANTED } from './config.js';

/** A fixed camera pose for a shot: where it sits and what it looks at. */
function pose(x, y, z, lx, ly, lz) {
  return { position: new THREE.Vector3(x, y, z), lookAt: new THREE.Vector3(lx, ly, lz) };
}

/**
 * Stage the named scene on the live game and return the camera pose to shoot it from.
 * Names: start, play, chase, mission; anything else is start.
 */
export function stageShot(name, game) {
  const { player, traffic, peds, police, missions, wanted, hud } = game;
  wanted.clear();
  police.clearAll();
  missions.active = null;
  missions.stepIndex = 0;
  missions.setMarkerVisible(false);
  game.cash = 2450;
  player.state.health = 100;
  player.state.ammo = 12;
  player.state.reloading = 0;
  game.clockMinutes = 32;

  if (name === 'play') {
    player.teleport(6, 96, Math.PI * 0.95);
    const car = game.parkedCars[0];
    if (car) {
      car.mesh.position.set(10, 0, 104);
      car.mesh.rotation.y = Math.PI / 2;
      car.heading = Math.PI / 2;
    }
    missions.completed = 0;
    missions.startNextMission();
    hud.showPlay();
    hud.showSubtitle('Mara Voss: Pick up the package at Rosa\u2019s Diner — and don\u2019t be late.', 8);
    return pose(14, 7, 116, 0, 2, 90);
  }

  if (name === 'chase') {
    const car = game.parkedCars[1] || game.parkedCars[0];
    player.teleport(0, 40, Math.PI);
    if (car) {
      // Facing -z (heading PI); the camera sits behind at +z, police close in from +z.
      car.mesh.position.set(0, 0, 40);
      car.mesh.rotation.y = Math.PI;
      car.heading = Math.PI;
      car.speed = 26;
      player.state.driving = car;
      player.state.speed = 26;
      player.mesh.visible = false;
      game.audio.startEngine();
    }
    wanted.addHeat(50, game.now);
    police.update(0.016, player, game.now, {});
    const copSpots = [[-4, 58], [4, 64], [0, 70]];
    police.cars.forEach((cop, index) => {
      const spot = copSpots[index % copSpots.length];
      cop.mesh.position.set(spot[0], 0, spot[1]);
      cop.speed = 26;
      cop.heading = Math.PI;
    });
    game.clockMinutes = 48;
    hud.showPlay();
    hud.showSubtitle('WANTED — lose the cops!', 6);
    return pose(-9, 8, 68, 0, 1.5, 32);
  }

  if (name === 'mission') {
    missions.completed = 3;
    // Player already at the docks, camera over their shoulder with a clear sightline
    // to the Kestrel crew (the old pose was blocked by the (100,-100) tower).
    player.teleport(108, -88, Math.PI * 0.8);
    missions.startNextMission();
    game.cash = 3120;
    game.clockMinutes = 55;
    hud.showPlay();
    hud.showSubtitle('Mara Voss: The Kestrel crew is waiting at the docks. Clear them out.', 8);
    return pose(98, 6, -74, 120, 2, -100);
  }

  // start: the title screen over a sunset vista of downtown and the sea.
  player.teleport(-8, 108, Math.PI * 0.8);
  const car = game.parkedCars[2] || game.parkedCars[0];
  if (car) {
    car.mesh.position.set(-2, 0, 112);
    car.mesh.rotation.y = Math.PI * 0.6;
    car.heading = Math.PI * 0.6;
  }
  missions.completed = 0;
  hud.showTitle(false);
  return pose(-40, 26, 150, 40, 8, -40);
}
