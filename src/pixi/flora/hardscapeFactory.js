import { Container, Graphics, Sprite } from 'pixi.js';
import { mulberry32, hashSeed, mixColor } from '../constants.js';
import { radial } from '../textures.js';

// Procedural rock & driftwood silhouettes. Each factory returns a Container
// whose local origin is the asset anchor (bottom-centre), drawn in grid units
// (the asset's def.w × def.h box). Painterly look = flat silhouette + facets
// + rim light + soft contact shadow, no per-object masks (cheap, static).

const ROCK_PALETTE = {
  stone_seiryu_lg: { base: 0x59636f, light: 0x8b97a4, dark: 0x2f3640, vein: 0xc9d4dd },
  stone_seiryu_sm: { base: 0x59636f, light: 0x8b97a4, dark: 0x2f3640, vein: 0xc9d4dd },
  stone_dragon:    { base: 0x8a6a3a, light: 0xb89058, dark: 0x4f3a1e, vein: 0x3a2912 },
  stone_lava:      { base: 0x352a28, light: 0x5a443d, dark: 0x140f0e, vein: 0x6e2f22 },
  stone_frodo:     { base: 0x7d6e55, light: 0xa9967a, dark: 0x4a3f30, vein: 0xc7b894 },
  stone_pagoda:    { base: 0x6c5a42, light: 0x96815f, dark: 0x3c3021, vein: 0xb8a079 },
};

const WOOD_PALETTE = {
  wood_spider:    { base: 0x6a4f33, light: 0x97774f, dark: 0x3c2a18 },
  wood_manzanita: { base: 0x8a7152, light: 0xb89a73, dark: 0x53412c },
  wood_malaysian: { base: 0x4f3a22, light: 0x715030, dark: 0x2c1d11 },
  wood_mopani:    { base: 0x53412a, light: 0x7c6040, dark: 0x2b2013 },
  wood_redmoor:   { base: 0x6e4a2c, light: 0x9a6c42, dark: 0x3e2715 },
};

function contactShadow(w) {
  const tex = radial(128, [
    [0, 'rgba(0,0,0,0.5)'],
    [0.55, 'rgba(0,0,0,0.22)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const s = new Sprite(tex);
  s.anchor.set(0.5, 0.5);
  s.width = w * 1.25;
  s.height = w * 0.34;
  s.y = -1;
  s.alpha = 0.8;
  return s;
}

function rimStroke(g, pts, color, alpha, width) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke({ width, color, alpha });
}

function buildRock(def, key, seed) {
  const rnd = mulberry32(seed);
  const pal = ROCK_PALETTE[key] ?? ROCK_PALETTE.stone_seiryu_lg;
  const w = def.w, h = def.h;
  const hw = w / 2;
  const c = new Container();
  c.addChild(contactShadow(w));

  // Jagged outline: flat-ish base, irregular faceted top.
  const top = [];
  const N = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i <= N; i++) {
    const tx = -hw + (w * i) / N;
    const edge = i === 0 || i === N;
    const peak = Math.sin((i / N) * Math.PI);             // tallest mid-mass
    const jag = (rnd() - 0.5) * h * 0.28;
    const ty = edge ? -h * 0.06 : -(h * (0.45 + peak * 0.5) + jag);
    top.push([tx, Math.min(-1, ty)]);
  }
  const outline = [[-hw, 0], ...top, [hw, 0]];

  const body = new Graphics();
  body.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline) body.lineTo(x, y);
  body.closePath();
  body.fill({ color: pal.base });

  // Lower-right shadow facet (split through the centroid).
  const cx = 0, cyTop = top[Math.floor(top.length / 2)][1];
  const shade = new Graphics();
  shade.moveTo(cx, cyTop * 0.55);
  shade.lineTo(hw, -h * 0.05);
  shade.lineTo(hw, 0);
  shade.lineTo(0, 0);
  shade.closePath();
  shade.fill({ color: pal.dark, alpha: 0.55 });

  // Upper-left light facet.
  const lite = new Graphics();
  lite.moveTo(cx, cyTop * 0.55);
  lite.lineTo(top[1][0], top[1][1]);
  lite.lineTo(top[Math.max(0, Math.floor(top.length * 0.35))][0], top[Math.floor(top.length * 0.35)][1]);
  lite.closePath();
  lite.fill({ color: pal.light, alpha: 0.4 });

  // Strata veins (seiryu/pagoda) — a few near-horizontal cracks.
  const veins = new Graphics();
  const vcount = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < vcount; i++) {
    const vy = -h * (0.2 + rnd() * 0.55);
    const x0 = -hw * (0.4 + rnd() * 0.5);
    const x1 = hw * (0.4 + rnd() * 0.5);
    veins.moveTo(x0, vy);
    veins.bezierCurveTo(x0 * 0.3, vy - 1 + rnd() * 2, x1 * 0.3, vy - 1 + rnd() * 2, x1, vy + (rnd() - 0.5) * 2);
    veins.stroke({ width: 0.7, color: pal.vein, alpha: 0.35 });
  }

  // Rim light along the top edge.
  const rim = new Graphics();
  rimStroke(rim, top, mixColor(pal.light, 0xffffff, 0.3), 0.5, 0.9);

  c.addChild(body, shade, lite, veins, rim);
  return c;
}

// Draw a tapered, slightly curved limb as a filled polygon.
function limb(g, x0, y0, angle, len, w0, w1, color, curve = 0) {
  const segs = 6;
  const left = [], right = [];
  let x = x0, y = y0, a = angle;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ww = (w0 + (w1 - w0) * t) / 2;
    const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    left.push([x + nx * ww, y + ny * ww]);
    right.push([x - nx * ww, y - ny * ww]);
    const step = len / segs;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    a += curve;
  }
  const pts = [...left, ...right.reverse()];
  g.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts) g.lineTo(px, py);
  g.closePath();
  g.fill({ color });
  return { x, y, a }; // tip transform
}

function buildWood(def, key, seed) {
  const rnd = mulberry32(seed);
  const pal = WOOD_PALETTE[key] ?? WOOD_PALETTE.wood_spider;
  const w = def.w, h = def.h;
  const c = new Container();
  c.addChild(contactShadow(w));

  const dark = new Graphics();   // shaded underside
  const body = new Graphics();   // main wood
  const lite = new Graphics();   // top highlight

  // Main trunk rising from base centre, leaning slightly.
  const lean = (rnd() - 0.5) * 0.5;
  const trunkLen = h * (0.7 + rnd() * 0.2);
  const baseW = Math.max(4, h * 0.16);
  const tip = limb(body, 0, 0, -Math.PI / 2 + lean, trunkLen, baseW, baseW * 0.4, pal.base, lean * 0.04);
  limb(dark, 1.2, 0, -Math.PI / 2 + lean, trunkLen * 0.96, baseW * 0.8, baseW * 0.3, pal.dark, lean * 0.04);

  // Branches fanning out from along the trunk.
  const branches = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < branches; i++) {
    const t = 0.25 + (i / branches) * 0.7;
    const bx = Math.cos(-Math.PI / 2 + lean) * trunkLen * t;
    const by = Math.sin(-Math.PI / 2 + lean) * trunkLen * t;
    const dir = (rnd() < 0.5 ? -1 : 1);
    const ang = -Math.PI / 2 + dir * (0.5 + rnd() * 0.7);
    const blen = (h * 0.3) * (0.6 + rnd() * 0.7) * (key === 'wood_redmoor' || key === 'wood_spider' ? 1.3 : 1);
    const bw = baseW * (0.35 + rnd() * 0.25);
    const t2 = limb(body, bx, by, ang, blen, bw, bw * 0.25, pal.base, dir * (rnd() * 0.06));
    // occasional twig off the branch
    if (rnd() < 0.6) {
      limb(body, t2.x, t2.y, t2.a + (rnd() - 0.5) * 0.8, blen * 0.5, bw * 0.3, 1, pal.base, 0);
    }
  }

  // Top highlight streak along the trunk's lit side.
  limb(lite, -0.8, 0, -Math.PI / 2 + lean, trunkLen * 0.85, baseW * 0.3, 0.6, mixColor(pal.light, 0xffffff, 0.2), lean * 0.04);
  lite.alpha = 0.5;

  c.addChild(dark, body, lite);
  return c;
}

export function buildHardscape(def, key, seed) {
  if (key.startsWith('wood_')) return buildWood(def, key, seed);
  return buildRock(def, key, seed);
}

export function makeHardscape(def, asset) {
  const seed = hashSeed(asset.id || asset.key);
  return buildHardscape(def, asset.key, seed);
}
