// Central game state for Solmar Heat v3: money, health, wanted heat, the
// clock, mission progress, the save file, and the visual quality knobs
// the renderer reads. One object owns the numbers so the HUD, the cops
// and the missions never drift apart.

import { clampNum } from './util.js';

export const SAVE_KEY = 'solmar-heat-v2-save';
export const START_CASH = 250;
export const START_HEALTH = 100;
export const BUSTED_FINE = 150;
export const WASTED_FINE = 100;

/** Heat 0..100 maps to wanted stars: 1 at 12, then every 20 after that. */
export function heatToStars(heat) {
  if (heat < 12) return 0;
  return Math.min(5, 1 + Math.floor((heat - 12) / 20));
}

/** Sun height for a dayT: low and golden at the ends, gone at night. */
export function sunElevation(dayT) {
  return 0.42 - Math.abs(dayT - 0.18) * 0.9;
}

export class BayState {
  constructor() {
    this.reset();
  }

  reset() {
    this.cash = START_CASH;
    this.health = START_HEALTH;
    this.heat = 0;
    this.clockMin = 17 * 60 + 5; // 17:05, golden hour over the bay
    this.dayT = 0.06; // start at golden hour, the money look
    this.missionsDone = 0;
    this.taxiEarned = 0;
    this.stuntsDone = 0;
    this.muted = false;
    this.startedAt = Date.now();
    // Visual quality: capped pixel ratio and shadows keep 60 fps in reach.
    this.pixelCap = 1.75;
    this.shadows = true;
  }

  stars() { return heatToStars(this.heat); }

  addCash(n) { this.cash = Math.max(0, this.cash + n); return this.cash; }

  hurt(n) {
    this.health = clampNum(this.health - n, 0, START_HEALTH);
    return this.health;
  }

  heal(n) { this.health = clampNum(this.health + n, 0, START_HEALTH); }

  addHeat(n) { this.heat = clampNum(this.heat + n, 0, 100); }

  /** Heat bleeds off while the player stays out of sight. */
  coolHeat(dt, hidden) {
    const rate = hidden ? 3.2 : 0.9;
    this.heat = Math.max(0, this.heat - rate * dt);
  }

  /** Advance the clock and the day/dusk cycle. */
  tickClock(dt) {
    this.clockMin = (this.clockMin + dt * 0.9) % (24 * 60);
    this.dayT = (this.dayT + dt / 240) % 1; // full dusk loop every 4 minutes
  }

  clockText() {
    const h = Math.floor(this.clockMin / 60);
    const m = Math.floor(this.clockMin % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash, health: this.health, heat: this.heat,
        clockMin: this.clockMin, missionsDone: this.missionsDone,
        taxiEarned: this.taxiEarned, stuntsDone: this.stuntsDone,
      }));
      return true;
    } catch (e) { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (typeof d.cash !== 'number') return false;
      this.cash = d.cash; this.health = d.health; this.heat = 0;
      this.clockMin = d.clockMin || this.clockMin;
      this.missionsDone = d.missionsDone || 0;
      this.taxiEarned = d.taxiEarned || 0;
      this.stuntsDone = d.stuntsDone || 0;
      return true;
    } catch (e) { return false; }
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
}
