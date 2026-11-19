// Keyboard + mouse for Solmar Heat v2. Pointer-lock mouse look, a key set,
// and edge-triggered presses (E, R, F, Space-as-action) the game consumes
// once per press instead of every frame the key is held.

export class Pad {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.locked = false;
    this.shots = 0; // mouse clicks waiting to fire
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouse = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0026;
      this.pitch += e.movementY * 0.0022;
      if (this.pitch < -0.5) this.pitch = -0.5;
      if (this.pitch > 1.1) this.pitch = 1.1;
    };
    this._onClick = () => { this.shots++; };
    this._onLock = () => { this.locked = document.pointerLockElement === this.canvas; };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    this.canvas.addEventListener('mousedown', this._onClick);
    document.addEventListener('pointerlockchange', this._onLock);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouse);
    this.canvas.removeEventListener('mousedown', this._onClick);
    document.removeEventListener('pointerlockchange', this._onLock);
  }

  down(code) { return this.keys.has(code); }

  /** True once for the frame the key went down; call after reading. */
  hit(code) { return this.pressed.has(code); }

  /** Clear edge presses at the end of each frame. */
  endFrame() { this.pressed.clear(); }

  takeShots() { const n = this.shots; this.shots = 0; return n; }

  lockPointer() {
    try { this.canvas.requestPointerLock(); } catch (e) { /* mouse look is optional */ }
  }

  unlockPointer() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* noop */ }
  }
}
