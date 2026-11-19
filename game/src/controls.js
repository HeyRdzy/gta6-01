// Keyboard + mouse for Solmar Heat v3. Pointer-lock mouse look with a
// damped feel (the camera eases toward the target yaw instead of snapping),
// a key set, and edge-triggered presses (E, R, F, Space-as-action) the
// game consumes once per press instead of every frame the key is held.

import { dampNum } from './util.js';

export class Pad {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this._targetYaw = Math.PI;
    this._targetPitch = 0.32;
    this.locked = false;
    this.shots = 0; // mouse clicks waiting to fire
    // Drag-to-look fallback: when the browser refuses pointer lock (some
    // embedded or headless views), a held mouse drag still steers the
    // camera instead of leaving the player stuck.
    this._dragging = false;
    this._dragX = 0;
    this._dragY = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouse = (e) => {
      if (!this.locked) return;
      this._targetYaw -= e.movementX * 0.0026;
      this._targetPitch += e.movementY * 0.0022;
      if (this._targetPitch < -0.5) this._targetPitch = -0.5;
      if (this._targetPitch > 1.1) this._targetPitch = 1.1;
    };
    this._onDragStart = (e) => {
      if (this.locked) return;
      this._dragging = true;
      this._dragMoved = 0;
      this._dragX = e.clientX;
      this._dragY = e.clientY;
    };
    this._onDrag = (e) => {
      if (!this._dragging || this.locked) return;
      const dx = e.clientX - this._dragX, dy = e.clientY - this._dragY;
      this._dragMoved += Math.abs(dx) + Math.abs(dy);
      this._targetYaw -= dx * 0.0026;
      this._targetPitch += dy * 0.0022;
      if (this._targetPitch < -0.5) this._targetPitch = -0.5;
      if (this._targetPitch > 1.1) this._targetPitch = 1.1;
      this._dragX = e.clientX;
      this._dragY = e.clientY;
    };
    // A press only counts as a weapon click if it barely moved — a
    // drag-to-look must never fire the gun.
    this._onDragEnd = () => {
      if (this._dragging && this._dragMoved < 6 && !this.locked) this.shots++;
      this._dragging = false;
    };
    this._onClick = () => { if (this.locked) this.shots++; };
    this._onLock = () => { this.locked = document.pointerLockElement === this.canvas; };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    this.canvas.addEventListener('mousedown', this._onClick);
    this.canvas.addEventListener('mousedown', this._onDragStart);
    window.addEventListener('mousemove', this._onDrag);
    window.addEventListener('mouseup', this._onDragEnd);
    document.addEventListener('pointerlockchange', this._onLock);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouse);
    this.canvas.removeEventListener('mousedown', this._onClick);
    this.canvas.removeEventListener('mousedown', this._onDragStart);
    window.removeEventListener('mousemove', this._onDrag);
    window.removeEventListener('mouseup', this._onDragEnd);
    document.removeEventListener('pointerlockchange', this._onLock);
  }

  down(code) { return this.keys.has(code); }

  /** True once for the frame the key went down; call after reading. */
  hit(code) { return this.pressed.has(code); }

  /** Clear edge presses at the end of each frame. */
  endFrame() { this.pressed.clear(); }

  takeShots() { const n = this.shots; this.shots = 0; return n; }

  /** Ease yaw/pitch toward the mouse targets; call once per frame. */
  smooth(dt) {
    this.yaw = dampNum(this.yaw, this._targetYaw, 18, dt);
    this.pitch = dampNum(this.pitch, this._targetPitch, 18, dt);
  }

  lockPointer() {
    try { this.canvas.requestPointerLock(); } catch (e) { /* mouse look is optional */ }
  }

  unlockPointer() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* noop */ }
  }
}
