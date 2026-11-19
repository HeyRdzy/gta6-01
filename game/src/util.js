// Small helpers shared by every Solmar Heat module: a seedable random
// stream, number helpers, easing and damping for the camera and the HUD,
// and 2D geometry. Nothing here touches the DOM.

/** Deterministic random stream (mulberry32) so a seed replays the same bay. */
export function makeStream(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random number in [lo, hi) from a stream. */
export function span(rng, lo, hi) { return lo + rng() * (hi - lo); }

/** Random integer in [lo, hi] from a stream. */
export function whole(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

/** Pick one entry from an array with a stream. */
export function choose(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/** Clamp v into [lo, hi]. */
export function clampNum(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Linear interpolation between a and b. */
export function lerpNum(a, b, t) { return a + (b - a) * t; }

/** Ease-out cubic: fast start, gentle landing — for camera and UI moves. */
export function easeOutCubic(t) { return 1 - Math.pow(1 - clampNum(t, 0, 1), 3); }

/** Frame-rate independent damping factor for a rate (per second). */
export function dampFactor(rate, dt) { return 1 - Math.exp(-rate * dt); }

/** Move v toward target by at most rate*dt, without overshoot. */
export function dampNum(v, target, rate, dt) {
  const d = target - v;
  const step = d * dampFactor(rate, dt);
  return Math.abs(step) >= Math.abs(d) ? target : v + step;
}

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Turn towards target angle by at most maxStep radians. */
export function turnToward(a, target, maxStep) {
  const d = wrapAngle(target - a);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

/** Flat distance between two {x, z} points. */
export function flatDist(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

/** True when point (x, z) sits inside axis-aligned box b. */
export function insideBox(x, z, b) {
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

/** Push point out of box b (circle radius r); returns true when it hit. */
export function pushOut(x, z, r, b) {
  const cx = clampNum(x, b.x0, b.x1), cz = clampNum(z, b.z0, b.z1);
  const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2), push = (r - d) / d;
    return { x: x + dx * push, z: z + dz * push };
  }
  // Dead centre: shove out along the nearer edge.
  const left = x - b.x0, right = b.x1 - x, top = z - b.z0, bot = b.z1 - z;
  const m = Math.min(left, right, top, bot);
  if (m === left) return { x: b.x0 - r, z };
  if (m === right) return { x: b.x1 + r, z };
  if (m === top) return { x, z: b.z0 - r };
  return { x, z: b.z1 + r };
}
