// The game's persistent state: money, health, wanted level, time of day and
// story progress, plus save/load through localStorage. Nothing here touches
// the 3D scene; the scene modules read and write this object.

export const SAVE_KEY = 'solmar-heat-save-v1';

export function createGameState() {
  const state = {
    cash: 250,
    health: 100,
    maxHealth: 100,
    wanted: 0,
    wantedHeat: 0,
    // Day fraction: 0 dawn, 0.25 noon, 0.5 afternoon, 0.72 golden hour,
    // 0.85 dusk, 0.95 night. The game opens at golden hour.
    dayT: 0.74,
    daySpeed: 1 / 480, // one full day every 8 minutes of play
    missionsDone: 0,
    missions: [false, false, false, false, false],
    kills: 0,
    carsStolen: 0,
    fares: 0,
    muted: false,
    paused: false,
    started: false,
    dead: false,
    playSeconds: 0,
  };

  state.save = function save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          cash: state.cash,
          health: state.health,
          dayT: state.dayT,
          missionsDone: state.missionsDone,
          missions: state.missions,
          kills: state.kills,
          carsStolen: state.carsStolen,
          fares: state.fares,
          muted: state.muted,
          playSeconds: state.playSeconds,
        })
      );
    } catch (err) {
      // Storage can be unavailable (private mode); the game keeps running.
    }
  };

  state.load = function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') state.cash = data.cash;
      if (typeof data.health === 'number') state.health = clampHealth(data.health);
      if (typeof data.dayT === 'number') state.dayT = data.dayT % 1;
      if (typeof data.missionsDone === 'number') state.missionsDone = data.missionsDone;
      if (Array.isArray(data.missions)) state.missions = data.missions.slice(0, 5);
      if (typeof data.kills === 'number') state.kills = data.kills;
      if (typeof data.carsStolen === 'number') state.carsStolen = data.carsStolen;
      if (typeof data.fares === 'number') state.fares = data.fares;
      if (typeof data.muted === 'boolean') state.muted = data.muted;
      if (typeof data.playSeconds === 'number') state.playSeconds = data.playSeconds;
      return true;
    } catch (err) {
      return false;
    }
  };

  function clampHealth(v) {
    return Math.max(0, Math.min(state.maxHealth, v));
  }

  state.addCash = function addCash(amount) {
    state.cash = Math.max(0, state.cash + amount);
  };

  state.hurt = function hurt(amount) {
    state.health = Math.max(0, state.health - amount);
    if (state.health <= 0) state.dead = true;
  };

  state.heal = function heal(amount) {
    state.health = Math.min(state.maxHealth, state.health + amount);
  };

  state.addWanted = function addWanted(stars) {
    state.wanted = Math.min(5, state.wanted + stars);
    state.wantedHeat = 1;
  };

  state.clearWanted = function clearWanted() {
    state.wanted = 0;
    state.wantedHeat = 0;
  };

  return state;
}
