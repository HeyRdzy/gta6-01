// Screenshot staging for Solmar Heat v3 (?shot=start|play|chase|mission).
// Every scene is a real moment of the live game at golden hour — the same
// seed, the same frame — with Rio, the cars, the cops and a job placed so
// the camera reads the game at a glance. The mission shot is framed tight
// this time: Rio in the open, rivals ahead, beacon overhead, no palm in
// the way.

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
  state.dayT = 0.06; // golden hour for every shot
  state.clockMin = 17 * 60 + 32;
  combat.ammo = 12;
  combat.reloading = 0;

  if (name === 'play') {
    hero.teleport(2, 84, Math.PI * 0.95);
    const car = street.cars[0];
    if (car) {
      // Parked off to the side so the car never hides Rio from the camera.
      car.mesh.position.set(13, 0, 96);
      car.mesh.rotation.y = Math.PI / 2;
      car.heading = Math.PI / 2;
    }
    const car2 = street.cars[1];
    if (car2) {
      car2.mesh.position.set(-7, 0, 76);
      car2.mesh.rotation.y = Math.PI;
      car2.heading = Math.PI;
    }
    story.startNext(events);
    display.showPlay();
    display.say('Mara Voss: Pick up the parcel at Rosa\u2019s Diner — and don\u2019t be late.', 8);
    // Closer and lower than v3: Rio fills the frame, the diner sign and
    // the crosswalk traffic sit behind him instead of swallowing him.
    return pose(6, 6.2, 99, 0, 1.5, 80);
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
    // A traffic car ahead gives the chase depth instead of an empty road.
    const ahead = street.cars[2];
    if (ahead && ahead !== car) {
      ahead.mesh.position.set(3, 0, 44);
      ahead.mesh.rotation.y = Math.PI;
      ahead.heading = Math.PI;
      ahead.speed = 9;
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
    return pose(-7, 6.5, 104, 0, 1.5, 60);
  }

  if (name === 'mission') {
    story.jobIndex = 3;
    story.startNext(events);
    story.stepIndex = 1;
    story._enterStep(events);
    // Restaged for v3.1: the fight stays on the open dock road, but the
    // camera now comes in from the beach side, low and to the east, so
    // the marina office and the dock houses can never sit between it and
    // the action — open sand and sea behind the lens, rivals in a loose
    // line ahead of Rio, beacon hidden for the kill step.
    combat.clearRivals();
    combat.spawnRivals([[100, -88], [108, -80], [102, -96], [116, -90]]);
    hero.teleport(124, -84, -Math.PI / 2);
    state.cash = 3120;
    state.clockMin = 17 * 60 + 55;
    state.dayT = 0.1;
    display.showPlay();
    display.say('Mara Voss: The Kestrel crew is waiting at the docks. Clear them out.', 8);
    // Closer and lower than v3: Rio and the rivals fill the frame, the
    // beach sand drops out of the bottom third.
    return pose(140, 5.0, -70, 106, 1.5, -87);
  }

  // start: title screen over a golden-hour vista — downtown towers left,
  // the sea and pier right, sun low over the bay.
  hero.teleport(-8, 108, Math.PI * 0.8);
  const car = street.cars[2] || street.cars[0];
  if (car) {
    car.mesh.position.set(-2, 0, 112);
    car.mesh.rotation.y = Math.PI * 0.6;
    car.heading = Math.PI * 0.6;
  }
  display.showTitle(false);
  return pose(-52, 26, 148, 42, 8, -52);
}
