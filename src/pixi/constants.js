// Shared world geometry — grid-unit coordinate space.
// The Pixi "world" container uses these grid units directly; it is scaled to
// fit the viewport. All simulation/placement/persistence logic stays in grid
// units, so nothing in shrimp.js / simulation.js / scapes.js needs to change.

export const GW = 280;          // world width  (grid units)
export const GH = 156;          // world height (grid units)

export const SUBSTRATE_Y = 128; // soil top
export const WATERLINE_Y = 15;  // water surface

// Cinematic framing (grid units)
export const BEZEL_TOP = 10;
export const BEZEL_BOTTOM = 4;
export const BEZEL_SIDE = 3;
export const LED_FIXTURE_Y = 1;

// Inner water window (inside the bezel) — useful for clamping fx effects
export const WIN_LEFT = BEZEL_SIDE;
export const WIN_RIGHT = GW - BEZEL_SIDE;
export const WIN_TOP = BEZEL_TOP;
export const WIN_BOTTOM = GH - BEZEL_BOTTOM;

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Convert an integer 0xRRGGBB or {r,g,b} into Pixi number color
export function rgb(r, g, b) { return (r << 16) | (g << 8) | b; }

// Deterministic seeded PRNG (mulberry32) — stable procedural shapes per asset.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string key to a 32-bit integer seed.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mix two channel-wise colours (0xRRGGBB) by t in [0,1].
export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
