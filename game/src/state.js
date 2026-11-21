// Solmar Heat — shared game state. Written fresh for round 4.
// Every module reads the player and the run through this object; the
// managers (traffic, cops, story) own their own entity lists on G.
import { CFG } from './config.js';

export const S = {
  mode: 'title', // title | playing | paused | wasted | busted
  time: 0, // seconds since the run started
  tod: CFG.START_TOD, // time of day, 0..1 (0.25 dawn, 0.5 noon, 0.75 dusk)
  cash: 0,
  health: 100,
  wanted: 0,
  ammo: CFG.MAG_SIZE,
  reloading: 0,
  muted: false,
  // The player. angle faces the direction of travel / aim (radians, 0 = east,
  // positive clockwise when looking down at the map: x right, z down).
  player: {
    x: -30,
    z: 150,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null, // the car object the player drives, or null
    moving: false,
    jump: 0, // jump animation 0..1
    aimX: 0,
    aimZ: 0,
  },
  camera: { x: -30, z: 150 },
  missionIndex: 0,
  missionStep: 0,
  missionTimer: 0,
  missionActive: false,
  lastCrimeAt: -999,
  lastCopNearAt: -999,
  stats: { fares: 0, stunts: 0, kills: 0, shots: 0, missionsDone: 0 },
  // Set by stage.js when a staged screenshot scene is ready to capture.
  shotReady: false,
};

export function resetRun() {
  S.mode = 'playing';
  S.time = 0;
  S.tod = CFG.START_TOD;
  S.cash = 0;
  S.health = 100;
  S.wanted = 0;
  S.ammo = CFG.MAG_SIZE;
  S.reloading = 0;
  S.player.x = -30;
  S.player.z = 150;
  S.player.angle = -Math.PI / 2;
  S.player.speed = 0;
  S.player.onFoot = true;
  S.player.car = null;
  S.player.moving = false;
  S.player.jump = 0;
  S.camera.x = -30;
  S.camera.z = 150;
  S.missionIndex = 0;
  S.missionStep = 0;
  S.missionTimer = 0;
  S.missionActive = false;
  S.lastCrimeAt = -999;
  S.lastCopNearAt = -999;
  S.stats = { fares: 0, stunts: 0, kills: 0, shots: 0, missionsDone: 0 };
  S.shotReady = false;
}

export function addCash(n) {
  S.cash = Math.max(0, S.cash + n);
}

export function addWanted(n) {
  const before = S.wanted;
  S.wanted = Math.max(0, Math.min(CFG.WANTED_MAX, S.wanted + n));
  if (S.wanted > before) S.lastCrimeAt = S.time;
}

export function saveGame() {
  try {
    localStorage.setItem(
      'solmar-heat-save',
      JSON.stringify({ cash: S.cash, missionsDone: S.stats.missionsDone, tod: S.tod }),
    );
  } catch (e) {
    /* storage unavailable — the run simply is not saved */
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem('solmar-heat-save');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
