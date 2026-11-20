// Staged scenes for the four screenshots. Each pose puts the camera, Rio,
// the cops and the mission into a composed frame at golden hour, then lets
// the game render a few frames before the shot is taken.

import { clamp } from './util.js';

/** Pose one staged scene. `game` is the wired-up game from boot.js. */
export function applyShot(game, name) {
  const { hero, state, story, combat, cops, display, traffic } = game;
  state.dayT = 0.74; // golden hour for every shot
  state.started = true;
  state.paused = false;
  display.showHud();

  if (name === 'start') {
    // Title vista: Rio on the boulevard with downtown towers behind him.
    hero.teleport(0, 90, Math.PI);
    state.clearWanted();
    combat.clearRivals();
    display.showTitle();
    game.shotCamera = {
      pos: { x: -26, y: 26, z: 128 },
      look: { x: 10, y: 10, z: 40 },
      orbit: true,
    };
    return;
  }

  if (name === 'play') {
    // Rio on foot at a crosswalk, glass HUD and minimap visible.
    hero.teleport(0, 90, Math.PI);
    if (hero.driving) hero.exitCar();
    state.clearWanted();
    combat.clearRivals();
    game.shotCamera = {
      pos: { x: 6, y: 5.2, z: 104 },
      look: { x: -2, y: 1.6, z: 88 },
      orbit: false,
    };
    return;
  }

  if (name === 'chase') {
    // Rio driving north with a cruiser on his tail and two wanted stars.
    const car = traffic.nearestCar(0, 60, 500);
    hero.teleport(car.mesh.position.x, car.mesh.position.z, 0);
    if (!hero.driving) hero.enterCar();
    hero.speed = 17;
    state.wanted = 2;
    state.wantedHeat = 1;
    // Let the chase spawn, then pull one cruiser in close behind.
    cops.update(2.5, 10);
    if (cops.cruisers.length > 0) {
      const c = cops.cruisers[0];
      const hx = hero.car.mesh.position.x;
      const hz = hero.car.mesh.position.z;
      c.mesh.position.set(hx - Math.sin(hero.car.heading) * 9, 0, hz - Math.cos(hero.car.heading) * 9);
      c.heading = hero.car.heading;
      c.speed = 17;
    }
    game.shotCamera = {
      pos: { x: hero.x - 9, y: 6.5, z: hero.z + 13 },
      look: { x: hero.x, y: 1.6, z: hero.z - 8 },
      orbit: false,
    };
    return;
  }

  if (name === 'mission') {
    // Dockyard Standoff, shot from the beach side: open yard, Rio at the
    // beacon, rivals in a line ahead, no wall in the frame.
    state.missionsDone = 3;
    state.missions = [true, true, true, false, false];
    if (hero.driving) hero.exitCar();
    hero.teleport(118, 148, Math.PI * 0.78);
    state.clearWanted();
    combat.clearRivals();
    story.startNext(display);
    // Rivals hold a line across the yard, all in view.
    const spots = [
      [132, 138],
      [140, 144],
      [136, 150],
      [144, 138],
    ];
    combat.rivals.forEach((r, i) => {
      const s = spots[i % spots.length];
      r.x = s[0];
      r.z = s[1];
      r.mesh.position.set(s[0], 0, s[1]);
    });
    game.shotCamera = {
      pos: { x: 162, y: 9, z: 122 },
      look: { x: 128, y: 1.6, z: 142 },
      orbit: false,
    };
    return;
  }

  throw new Error(`unknown shot: ${name}`);
}
