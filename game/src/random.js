// A small seeded random generator (mulberry32) so a seed always builds the same city,
// the same traffic and the same screenshot scenes.

/** Make a generator from an integer seed; every call returns a number in [0, 1). */
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max] from a generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one item from an array with a generator. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** Shuffle a copy of an array with a generator. */
export function shuffle(random, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}
