// Solmar Heat — staged scenes for the four screenshots (?shot=...).
// Written fresh for round 4. Each shot sets up a moment of the game, then
// the loop runs normally so traffic, cops and the beacon stay alive.
import { S } from './state.js';
import { spawnEnemy } from './combat.js';
import { spawnCop } from './cops.js';

export function applyShot(G, name) {
  G.shotName = name;
  S.mode = 'playing';
  S.missionActive = true;
  G.display.hideTitle();
  G.sound.ensure();

  const P = S.player;
  if (name === 'start') {
    // Wide golden-hour vista: downtown towers, the marina and the pier.
    G.shotZoom = 0.75;
    P.x = 60;
    P.z = 0;
    P.angle = Math.PI;
    P.onFoot = true;
    P.car = null;
    S.camera.x = 20;
    S.camera.z = -10;
    S.tod = 0.7;
    S.missionIndex = 0;
    S.missionStep = 0;
    G.display.setObjective('Solmar Heat — an open-world crime game');
  } else if (name === 'play') {
    // Rio on foot at a downtown crosswalk, traffic and neon behind him.
    G.shotZoom = 1;
    P.x = -30;
    P.z = -30;
    P.angle = -Math.PI / 2;
    P.onFoot = true;
    P.car = null;
    S.camera.x = -30;
    S.camera.z = -30;
    S.tod = 0.78;
    S.missionIndex = 0;
    S.missionStep = 0;
    G.display.setObjective('Sunset Courier — deliver the package to the pier');
  } else if (name === 'chase') {
    // Two wanted stars: cruisers riding Rio's bumper down the boulevard.
    G.shotZoom = 1;
    S.wanted = 2;
    S.lastCrimeAt = S.time;
    const car = G.traffic.cars.find((c) => !c.isPlayer && c.type === 'sedan');
    if (car) {
      car.x = -90;
      car.z = 30;
      car.angle = 0;
      car.speed = 40;
      car.isPlayer = true;
      P.car = car;
      P.onFoot = false;
      P.x = car.x;
      P.z = car.z;
      P.angle = 0;
    }
    const c1 = spawnCop(G, -122, 30);
    const c2 = spawnCop(G, -108, 40);
    c1.angle = 0;
    c1.speed = 55;
    c2.angle = 0;
    c2.speed = 50;
    // Rio keeps his foot down so the chase stays a chase.
    G.input.keys.add('KeyW');
    S.camera.x = -90;
    S.camera.z = 30;
    S.tod = 0.7;
    S.missionIndex = 1;
    S.missionStep = 1;
    G.display.setObjective('Getaway Driver — reach the safehouse');
  } else if (name === 'mission') {
    // Dockyard Standoff: Rio holds the yard, the gold beacon on the crate.
    G.shotZoom = 1;
    P.x = 108;
    P.z = 96;
    P.angle = Math.PI / 4;
    P.onFoot = true;
    P.car = null;
    S.camera.x = 108;
    S.camera.z = 96;
    S.tod = 0.7;
    S.missionIndex = 3;
    S.missionStep = 1;
    const c = G.world.landmarks.dockyard;
    G.combat.enemies = [];
    spawnEnemy(G, c.x - 14, c.z - 10);
    spawnEnemy(G, c.x + 12, c.z - 14);
    spawnEnemy(G, c.x + 16, c.z + 10);
    spawnEnemy(G, c.x - 8, c.z + 16);
    G.display.setObjective('Dockyard Standoff — defeat the dock crew (0/4)');
  }
}
