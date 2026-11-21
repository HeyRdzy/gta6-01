// Solmar Heat — small math and geometry helpers. Written fresh for round 4.
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function rand(a = 1, b) {
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Shortest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(b, a) * t;
}

// Push a circle (x, z, r) out of an axis-aligned box {x, z, w, d} (x/z are
// the box centre). Returns {x, z} corrected, or null when there is no overlap.
export function circleVsAABB(x, z, r, box) {
  const hx = box.w / 2;
  const hz = box.d / 2;
  const cx = clamp(x, box.x - hx, box.x + hx);
  const cz = clamp(z, box.z - hz, box.z + hz);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
  }
  // Centre is inside the box: push out along the smallest penetration axis.
  const px = hx + r - Math.abs(x - box.x);
  const pz = hz + r - Math.abs(z - box.z);
  if (px < pz) return { x: box.x + (x >= box.x ? hx + r : -hx - r), z };
  return { x, z: box.z + (z >= box.z ? hz + r : -hz - r) };
}

export function pointInAABB(x, z, box) {
  return Math.abs(x - box.x) <= box.w / 2 && Math.abs(z - box.z) <= box.d / 2;
}

// Distance from point (x, z) to segment (ax, az)-(bx, bz).
export function pointSegDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((x - ax) * dx + (z - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const px = ax + dx * t;
  const pz = az + dz * t;
  return Math.hypot(x - px, z - pz);
}
