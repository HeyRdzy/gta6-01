// Staged scenes for the four screenshots. Each pose puts the camera, Rio,
// the cops and the mission into a composed frame at golden hour, then lets
// the game render a few frames before the shot is taken.

/** Pose one staged scene. `game` is the wired-up game from boot.js. */

/**
 * Pick the first camera candidate that sits in open space with a clear
 * sightline to the look point. The street grid is narrow, so a camera
 * parked against a warehouse wall would fill the frame with flat brown.
 */
function pickCamera(game, look, candidates) {
  const { world } = game;
  for (const c of candidates) {
    if (world.collides(c.pos.x, c.pos.z, 1.2)) continue;
    let blocked = false;
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      const x = c.pos.x + (look.x - c.pos.x) * t;
      const z = c.pos.z + (look.z - c.pos.z) * t;
      if (world.collides(x, z, 0.8)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return { pos: { ...c.pos }, look: { ...look }, orbit: false };
  }
  const first = candidates[0];
  return { pos: { ...first.pos }, look: { ...look }, orbit: false };
}
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
      pos: { x: -55, y: 48, z: 175 },
      look: { x: 25, y: 8, z: -10 },
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
      pos: { x: 4, y: 3.4, z: 97.5 },
      look: { x: -1, y: 1.5, z: 89 },
      orbit: false,
    };
    return;
  }

  if (name === 'chase') {
    // Rio driving through the city centre with a cruiser on his tail and
    // two wanted stars. The centre's residential towers read well from
    // every side; the dockyard's flat warehouse walls do not.
    const car = traffic.nearestCar(0, 0, 500);
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
    // Camera sits behind and to the side of the car, looking forward past
    // it, so both the stolen car and the cruiser on its tail are in the
    // frame. Candidates are tried in order until one sits in open space
    // with a clear sightline — a camera parked against a warehouse wall
    // would fill the frame with flat brown.
    const fx = Math.sin(hero.car.heading);
    const fz = Math.cos(hero.car.heading);
    const rx = Math.cos(hero.car.heading);
    const rz = -Math.sin(hero.car.heading);
    const look = { x: hero.x + fx * 8, y: 1.5, z: hero.z + fz * 8 };
    game.shotCamera = pickCamera(game, look, [
      { pos: { x: hero.x - fx * 12 + rx * 3, y: 7.5, z: hero.z - fz * 12 + rz * 3 } },
      { pos: { x: hero.x - fx * 12 - rx * 3, y: 7.5, z: hero.z - fz * 12 - rz * 3 } },
      { pos: { x: hero.x - fx * 9 + rx * 3, y: 7.5, z: hero.z - fz * 9 + rz * 3 } },
      { pos: { x: hero.x - fx * 9 - rx * 3, y: 7.5, z: hero.z - fz * 9 - rz * 3 } },
      { pos: { x: hero.x - fx * 7, y: 7.5, z: hero.z - fz * 7 } },
    ]);
    display.say(story.objectiveLabel());
    return;
  }

  if (name === 'mission') {
    // Dockyard Standoff, shot from a high three-quarter angle south-east
    // of the yard: the camera looks over the container row at Rio and the
    // rival line, with the gold beacon, the yard and the warehouses all
    // in the frame.
    state.missionsDone = 3;
    state.missions = [true, true, true, false, false];
    if (hero.driving) hero.exitCar();
    // Rio stands in the near foreground, just south of the container row
    // with his back to the camera, facing the yard — big in the frame,
    // with the beacon and the rival line beyond him.
    hero.teleport(134, 154, -1.85);
    state.clearWanted();
    combat.clearRivals();
    story.startNext(display);
    // Rivals hold a line across the yard, all in view.
    const spots = [
      [126, 144],
      [114, 146],
      [128, 154],
      [116, 156],
    ];
    combat.rivals.forEach((r, i) => {
      const s = spots[i % spots.length];
      r.x = s[0];
      r.z = s[1];
      r.mesh.position.set(s[0], 0, s[1]);
    });
    game.shotCamera = pickCamera(game, { x: 118, y: 1.5, z: 153 }, [
      { pos: { x: 146, y: 12, z: 156 } },
      { pos: { x: 158, y: 18, z: 158 } },
      { pos: { x: 140, y: 14, z: 168 } },
    ]);
    return;
  }

  throw new Error(`unknown shot: ${name}`);
}
