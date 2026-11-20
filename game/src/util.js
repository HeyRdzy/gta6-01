// Small math and random helpers shared by every Solmar Heat module.
// No game logic lives here, only pure functions so the modules stay testable.
// Round 3 note: every helper here is deterministic, which is why the city seed reproduces exactly.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing: damp(current, target, rate, dt). */
export function damp(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function smoothstepNum(a, b, x) {
  return smoothstep(a, b, x);
}

/** Shortest signed difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp01(t);
}

/** Deterministic PRNG (mulberry32) so the city layout is stable for a seed. */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 hash of two integers, for per-block variation without state. */
export function hash2(x, z, seed) {
  let h = (seed ^ Math.imul(x + 374761393, 668265263) ^ Math.imul(z + 2246822519, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0; // keep unsigned: a signed XOR can go negative
  return h / 4294967296;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rangeInt(rng, lo, hi) {
  return Math.floor(range(rng, lo, hi + 1));
}

/** Make a canvas, run a painter on its 2d context, return the canvas. */
export function makeCanvas(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  return c;
}

/** Distance on the ground plane between two points. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
