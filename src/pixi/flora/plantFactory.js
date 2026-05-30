import { Container, Graphics } from 'pixi.js';
import { mulberry32, hashSeed, mixColor } from '../constants.js';

// Procedural plants. Each returns { node, sway } where `node` is a Container
// anchored bottom-centre (rooted) or top-centre (floating), drawn in grid
// units, and `sway` is a list of { part, phase, amp, base } whose rotations
// are animated each frame for a continuous, GPU-cheap current.

const GREEN = {
  stem:  { leaf: 0x4f9a44, tip: 0x86c25a, dark: 0x2c5e2c },
  rotala:{ leaf: 0x6f9a3e, tip: 0xc08a3a, dark: 0x4a5e22 },
  crypt: { leaf: 0x8a4a30, tip: 0xb86a40, dark: 0x4a241a },
  val:   { leaf: 0x49913f, tip: 0x8fc861, dark: 0x2c5a26 },
  fern:  { leaf: 0x2f6a39, tip: 0x57924a, dark: 0x1c4226 },
  anub:  { leaf: 0x2c5a32, tip: 0x4a8a48, dark: 0x18351d },
  moss:  { leaf: 0x4a7a38, tip: 0x77a84a, dark: 0x2a4c1f },
  buce:  { leaf: 0x355e3a, tip: 0x5a8a4a, dark: 0x6a2a30 },
  float: { leaf: 0x5aa050, tip: 0x8ec86a, dark: 0x356b32 },
  rroot: { leaf: 0x7a8a3a, tip: 0xb86a40, dark: 0x4a3a1a },
};

// A pointed leaf/blade along -Y (upward), base at (0,0).
function blade(g, len, wid, color, curve = 0) {
  const tipX = curve * len;
  g.moveTo(0, 0);
  g.quadraticCurveTo(-wid / 2, -len * 0.45, tipX, -len);
  g.quadraticCurveTo(wid / 2, -len * 0.45, 0, 0);
  g.fill({ color });
}

// A small oval leaf attached at (ox,oy), pointing at `ang`.
function ovalLeaf(g, ox, oy, ang, len, wid, color) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const nx = -dy, ny = dx;
  const ex = ox + dx * len, ey = oy + dy * len;
  g.moveTo(ox, oy);
  g.quadraticCurveTo(ox + dx * len * 0.4 + nx * wid, oy + dy * len * 0.4 + ny * wid, ex, ey);
  g.quadraticCurveTo(ox + dx * len * 0.4 - nx * wid, oy + dy * len * 0.4 - ny * wid, ox, oy);
  g.fill({ color });
}

function stemContainer(x, base) {
  const c = new Container();
  c.x = x; c.y = 0;
  c.rotation = base;
  return c;
}

// ── Stem plants (rotala, generic) ───────────────────────────────
function buildStems(def, pal, seed, { leafEvery = 7, leafLen = 6 } = {}) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const count = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const sx = (-w / 2) + (w * (i + 0.5)) / count + (rnd() - 0.5) * 3;
    const sh = h * (0.7 + rnd() * 0.3);
    const base = (rnd() - 0.5) * 0.12;
    const stem = stemContainer(sx, base);
    const g = new Graphics();
    // central stalk
    g.moveTo(0, 0);
    g.lineTo(0, -sh);
    g.stroke({ width: 1.1, color: pal.dark, alpha: 0.9 });
    // paired leaves up the stalk
    for (let y = leafLen; y < sh; y += leafEvery) {
      const t = y / sh;
      const ll = leafLen * (1.1 - t * 0.4);
      const col = mixColor(pal.leaf, pal.tip, t);
      ovalLeaf(g, 0, -y, Math.PI + 0.6, ll, ll * 0.34, col);
      ovalLeaf(g, 0, -y, -0.6, ll, ll * 0.34, col);
    }
    // bright growing tip
    ovalLeaf(g, 0, -sh, -Math.PI / 2, leafLen * 0.8, leafLen * 0.3, pal.tip);
    stem.addChild(g);
    node.addChild(stem);
    sway.push({ part: stem, phase: rnd() * Math.PI * 2, amp: 0.06 + t0(sh, h) * 0.05, base });
  }
  return { node, sway };
}
function t0(sh, h) { return sh / h; }

// ── Blade plants (vallisneria) ──────────────────────────────────
function buildBlades(def, pal, seed) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const count = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const sx = (-w / 2) + (w * (i + 0.5)) / count + (rnd() - 0.5) * 2;
    const sh = h * (0.6 + rnd() * 0.4);
    const base = (rnd() - 0.5) * 0.18;
    const stem = stemContainer(sx, base);
    const g = new Graphics();
    blade(g, sh, 3.4, mixColor(pal.leaf, pal.tip, rnd() * 0.4), (rnd() - 0.5) * 0.25);
    g.moveTo(0, 0); g.lineTo((rnd() - 0.5) * sh * 0.2, -sh);
    g.stroke({ width: 0.5, color: pal.dark, alpha: 0.4 });
    stem.addChild(g);
    node.addChild(stem);
    sway.push({ part: stem, phase: rnd() * Math.PI * 2, amp: 0.10 + (sh / h) * 0.08, base });
  }
  return { node, sway };
}

// ── Broad-leaf rosette (crypt / ludwigia, buce, tiger lotus) ────
function buildRosette(def, pal, seed, { broad = 1 } = {}) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const count = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const spread = (i / (count - 1)) - 0.5;           // -0.5..0.5
    const sx = spread * w * 0.5;
    const sh = h * (0.55 + (1 - Math.abs(spread) * 1.3) * 0.45) * (0.85 + rnd() * 0.2);
    const base = spread * 0.7;
    const stem = stemContainer(sx, base);
    const g = new Graphics();
    const col = mixColor(pal.leaf, pal.tip, rnd() * 0.5);
    blade(g, sh, 5.5 * broad, col, 0);
    g.moveTo(0, 0); g.lineTo(0, -sh * 0.95);
    g.stroke({ width: 0.6, color: pal.dark, alpha: 0.4 });
    stem.addChild(g);
    node.addChild(stem);
    sway.push({ part: stem, phase: rnd() * Math.PI * 2, amp: 0.05, base });
  }
  return { node, sway };
}

// ── Fern (epiphyte, upright lobed fronds) ───────────────────────
function buildFern(def, pal, seed) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const count = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const spread = (i / (count - 1)) - 0.5;
    const sx = spread * w * 0.55;
    const sh = h * (0.6 + (1 - Math.abs(spread)) * 0.4) * (0.85 + rnd() * 0.2);
    const base = spread * 0.55;
    const stem = stemContainer(sx, base);
    const g = new Graphics();
    // midrib
    g.moveTo(0, 0); g.lineTo(0, -sh);
    g.stroke({ width: 1.3, color: pal.dark });
    // lobes
    const lobes = 4 + Math.floor(rnd() * 3);
    for (let l = 1; l <= lobes; l++) {
      const y = -(sh * l) / (lobes + 1);
      const ll = (sh / lobes) * 0.9;
      const col = mixColor(pal.leaf, pal.tip, l / lobes);
      ovalLeaf(g, 0, y, Math.PI + 0.5, ll, ll * 0.3, col);
      ovalLeaf(g, 0, y, -0.5, ll, ll * 0.3, col);
    }
    stem.addChild(g);
    node.addChild(stem);
    sway.push({ part: stem, phase: rnd() * Math.PI * 2, amp: 0.04, base });
  }
  return { node, sway };
}

// ── Anubias (low broad rounded leaves) ──────────────────────────
function buildAnubias(def, pal, seed) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const count = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const spread = (i / (count - 1)) - 0.5;
    const sx = spread * w * 0.6;
    const ang = -Math.PI / 2 + spread * 1.1;
    const len = h * (0.7 + rnd() * 0.3);
    const stem = stemContainer(sx, 0);
    const g = new Graphics();
    const col = mixColor(pal.leaf, pal.tip, rnd() * 0.4);
    // petiole
    const ex = Math.cos(ang) * len * 0.5, ey = Math.sin(ang) * len * 0.5;
    g.moveTo(0, 0); g.lineTo(ex, ey);
    g.stroke({ width: 1, color: pal.dark });
    ovalLeaf(g, ex, ey, ang, len * 0.55, len * 0.26, col);
    stem.addChild(g);
    node.addChild(stem);
    sway.push({ part: stem, phase: rnd() * Math.PI * 2, amp: 0.03, base: 0 });
  }
  return { node, sway };
}

// ── Moss (clustered low mound of tiny fronds) ───────────────────
function buildMoss(def, pal, seed) {
  const rnd = mulberry32(seed);
  const node = new Container();
  const sway = [];
  const w = def.w, h = def.h;
  const g = new Graphics();
  const tufts = 60;
  for (let i = 0; i < tufts; i++) {
    const x = (rnd() - 0.5) * w;
    const moundY = -Math.sqrt(Math.max(0, 1 - (x / (w / 2)) ** 2)) * h * 0.7;
    const len = 2 + rnd() * 4;
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
    const col = mixColor(pal.leaf, pal.tip, rnd());
    g.moveTo(x, moundY);
    g.lineTo(x + Math.cos(ang) * len, moundY + Math.sin(ang) * len);
    g.stroke({ width: 0.8, color: col, alpha: 0.9 });
  }
  node.addChild(g);
  // gentle whole-mound sway
  sway.push({ part: node, phase: rnd() * Math.PI * 2, amp: 0.015, base: 0, pivotY: 0 });
  return { node, sway };
}

// ── Floating plants (salvinia / red root) ───────────────────────
function buildFloating(def, pal, seed) {
  const rnd = mulberry32(seed);
  const node = new Container();   // anchored TOP-centre; grows downward (+y)
  const sway = [];
  const w = def.w, h = def.h;
  const leaves = new Graphics();
  const roots = new Graphics();
  const count = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const lx = (-w / 2) + (w * (i + 0.5)) / count + (rnd() - 0.5) * 3;
    const r = 3 + rnd() * 3;
    const col = mixColor(pal.leaf, pal.tip, rnd() * 0.5);
    leaves.circle(lx, h * 0.2, r);
    leaves.fill({ color: col });
    leaves.circle(lx - r * 0.3, h * 0.2 - r * 0.3, r * 0.4);
    leaves.fill({ color: mixColor(col, 0xffffff, 0.3), alpha: 0.5 });
    // dangling root
    const rootLen = h * (0.5 + rnd() * 0.5);
    roots.moveTo(lx, h * 0.3);
    roots.lineTo(lx + (rnd() - 0.5) * 4, h * 0.3 + rootLen);
    roots.stroke({ width: 0.7, color: pal.dark, alpha: 0.6 });
  }
  node.addChild(roots, leaves);
  sway.push({ part: node, phase: rnd() * Math.PI * 2, amp: 0.04, base: 0, floating: true });
  return { node, sway };
}

const PALETTE_FOR = (key) => {
  if (key.startsWith('rotala')) return GREEN.rotala;
  if (key === 'vallisneria') return GREEN.val;
  if (key === 'crypt') return GREEN.crypt;
  if (key === 'buce') return GREEN.buce;
  if (key === 'java_fern') return GREEN.fern;
  if (key === 'anubias') return GREEN.anub;
  if (key === 'moss') return GREEN.moss;
  if (key === 'floating_salvinia') return GREEN.float;
  if (key === 'floating_redroot') return GREEN.rroot;
  return GREEN.stem;
};

export function makePlant(def, asset) {
  const key = asset.key;
  const seed = hashSeed(asset.id || key);
  const pal = PALETTE_FOR(key);
  if (key === 'vallisneria') return buildBlades(def, pal, seed);
  if (key === 'crypt') return buildRosette(def, pal, seed, { broad: 1.1 });
  if (key === 'buce') return buildRosette(def, pal, seed, { broad: 1.3 });
  if (key === 'java_fern') return buildFern(def, pal, seed);
  if (key === 'anubias') return buildAnubias(def, pal, seed);
  if (key === 'moss') return buildMoss(def, pal, seed);
  if (key === 'floating_salvinia' || key === 'floating_redroot') return buildFloating(def, pal, seed);
  // rotala_* and any other stem plant
  return buildStems(def, pal, seed, { leafEvery: key === 'rotala_full' ? 6 : 7, leafLen: 6 });
}

// Animate a plant's sway parts. `t` is seconds.
export function animatePlant(sway, t) {
  for (const s of sway) {
    if (s.floating) {
      s.part.rotation = Math.sin(t * 0.6 + s.phase) * s.amp;
    } else {
      s.part.rotation = s.base + Math.sin(t * 0.85 + s.phase) * s.amp;
    }
  }
}
