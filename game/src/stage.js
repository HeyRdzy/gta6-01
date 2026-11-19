// Screenshot staging for Solmar Heat v2 (?shot=start|play|chase|mission).
// Each scene stages a real moment of the live game — same seed, same frame —
// by placing Rio, the cars, the cops and a job, then the boot loop keeps
// the world running for a few seconds before the frame is taken.

import * as THREE from 'three';

function pose(x, y, z, lx, ly, lz) {
  return {
    position: new THREE.Vector3(x, y, z),
    lookAt: new THREE.Vector3(lx, ly, lz),
  };
}

export function stageShot(name, game) {
  const { hero, street, cops, story, combat, state, display } = game;
  const events = {
    say: (t) => display.say(t, 8),
    toast: (t) => display.toast(t),
  };
  cops.clear();
  combat.clearRivals();
  story.active = null;
  story.jobIndex = 0;
  state.cash = 2450;
  state.health = 100;
  state.heat = 0;
  state.clockMin = 17 * 60 + 32;
  combat.ammo = 12;
  combat.reloading = 0;

  if (name === 'play') {
    hero.teleport(2, 84, Math.PI * 0.95);
    const car = street.cars[0];
    if (car) {
      car.mesh.position.set(8, 0, 92);
      car.mesh.rotation.y = Math.PI / 2;
      car.heading = Math.PI / 2;
    }
    story.startNext(events);
    display.showPlay();
    display.say('Mara Voss: Pick up the parcel at Rosa\u2019s Diner — and don\u2019t be late.', 8);
    return pose(2, 14, 120, 2, 1, 80);
  }

  if (name === 'chase') {
    const car = street.cars[1] || street.cars[0];
    hero.teleport(0, 84, Math.PI);
    if (car) {
      car.mesh.position.set(0, 0, 84);
      car.mesh.rotation.y = Math.PI;
      car.heading = Math.PI;
      hero.takeCar(car);
      hero.speed = 26;
    }
    state.addHeat(50);
    cops.update(0.016, hero, performance.now() / 1000, {});
    const spots = [[-4, 100], [4, 106], [0, 112]];
    cops.cars.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.mesh.position.set(s[0], 0, s[1]);
      cop.speed = 26;
      cop.heading = Math.PI;
    });
    display.showPlay();
    display.say('WANTED — lose the cops!', 6);
    return pose(-8, 8, 104, 0, 1.5, 60);
  }

  if (name === 'mission') {
    story.jobIndex = 3;
    story.startNext(events);
    story.stepIndex = 1;
    story._enterStep(events);
    hero.teleport(112, -82, Math.PI * 0.8);
    state.cash = 3120;
    state.clockMin = 17 * 60 + 55;
    display.showPlay();
    display.say('Mara Voss: The Kestrel crew is waiting at the docks. Clear them out.', 8);
    return pose(122, 7, -64, 103, 2, -88);
  }

  // start: the title screen over a sunset vista of downtown and the sea.
  hero.teleport(-8, 108, Math.PI * 0.8);
  const car = street.cars[2] || street.cars[0];
  if (car) {
    car.mesh.position.set(-2, 0, 112);
    car.mesh.rotation.y = Math.PI * 0.6;
    car.heading = Math.PI * 0.6;
  }
  display.showTitle(false);
  return pose(-44, 28, 152, 40, 10, -40);
}
