// In-browser placeholder sprite baker. Produces pixel-art canvases per manifest
// entry so the full pipeline is demonstrable before any AI atlases arrive.
// Owlboy-quality: 8-tone ramps with colour-shifted shadows/highlights, crack
// systems, bark scatter, leaf veins, detailed creature anatomy at 2× resolution.
// Real PNG atlases override via registry.js with zero code changes.

import { mulberry32, hashSeed, clamp, mixColor } from '../constants.js';
import { Pix, ramp, ramp8, darker, lighter, dither, dither8, scatter } from './pixbuf.js';

const OUTLINE = 0x10131a;

// ── Local shading helpers ─────────────────────────────────────────
function shade8(p, x, y, pal, lightT) {
  const f = clamp(lightT, 0, 1) * (pal.length - 1);
  let i = Math.floor(f);
  const frac = f - i;
  if (i < pal.length - 1 && dither8(x, y, frac)) i++;
  p.set(x, y, pal[i]);
}

// Legacy 5-tone shade (kept for particles)
function shade(p, x, y, pal, lightT) {
  const f = clamp(lightT, 0, 1) * (pal.length - 1);
  let i = Math.floor(f);
  const frac = f - i;
  if (i < pal.length - 1 && dither(x, y, frac)) i++;
  p.set(x, y, pal[i]);
}

function sample(arr, t) {
  const f = clamp(t, 0, 1) * (arr.length - 1);
  const i = Math.floor(f), frac = f - i;
  return i >= arr.length - 1 ? arr[arr.length - 1] : arr[i] + (arr[i + 1] - arr[i]) * frac;
}

// Oriented leaf blob — solid 2-tone shading (no dither8) so it reads cleanly at 6× upscale.
// Upper half of blob = pal[5], lower half = pal[3], centre = pal[4].
function leafBlob8(p, cx, cy, rx, ry, ang, pal) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  rx = Math.max(0.8, rx); ry = Math.max(0.5, ry);
  for (let u = -rx; u <= rx; u++) {
    const xr = ry * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2));
    for (let v = -xr; v <= xr; v++) {
      const x = Math.round(cx + u * ca - v * sa);
      const y = Math.round(cy + u * sa + v * ca);
      // Hard 3-step tone: lit top, mid body, shaded underside — NO dithering
      const normV = v / Math.max(0.5, xr);
      const col = normV < -0.30 ? pal[5] : normV > 0.30 ? pal[2] : pal[3];
      p.set(x, y, col);
    }
  }
}

function bladeLeaf8(p, x0, y0, ang, len, width, pal) {
  const ex = x0 + Math.cos(ang) * len;
  const ey = y0 + Math.sin(ang) * len;
  p.limb(x0, y0, ex, ey, width, Math.max(0.7, width * 0.22), pal[4], 230);
  // midrib vein — lighter line along spine
  p.line(x0, y0, ex, ey, pal[6], 80);
  p.set(Math.round(ex), Math.round(ey), pal[6], 180);
}

// ── Hardscape: rock ──────────────────────────────────────────────
function gRock(p, bk, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x1a2a3a, 0xf0f8ff);
  const w = p.w, h = p.h, baseY = h - 1;

  // Irregular silhouette: two-frequency sine + per-point noise = Owlboy jagged rock
  // Values tuned so peak ~80% of canvas height at centre, edges ~35-50%
  const N = 15 + Math.floor(rnd() * 3);
  const ctrl = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a1 = Math.sin(t * Math.PI) * 1.10;          // main arch — tall peak
    const a2 = Math.sin(t * Math.PI * 2.6 + 0.5) * 0.28;  // secondary crag
    const a3 = Math.sin(t * Math.PI * 5.8 + rnd() * 2) * 0.12; // fine jagging
    const noise = (rnd() - 0.5) * 0.26;               // per-point randomness
    ctrl.push(h * (0.14 + (a1 + a2 + a3 + noise + 1) * 0.33));
  }

  // Fill silhouette
  const topProfile = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    const t = x / Math.max(1, w - 1);
    const topY = Math.max(1, Math.round(h - sample(ctrl, t)));
    topProfile[x] = topY;
    const rockH = Math.max(1, baseY - topY);
    for (let y = topY; y <= baseY; y++) {
      const ny = (y - topY) / rockH;                  // 0=top, 1=bottom
      const facet = Math.floor(t * 6) % 2 ? 0.09 : -0.05;
      // Upper-left light source: bright top-left, dark lower-right
      const lightT = 0.88 - t * 0.28 - ny * 0.44 + facet;
      shade8(p, x, y, pal, lightT);
    }
  }

  // Strata veins
  if (bk.strata) {
    const vc = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < vc; i++) {
      const vy = Math.round(h * (0.28 + rnd() * 0.52));
      for (let x = 1; x < w - 1; x++) {
        const wob = Math.round(Math.sin(x * 0.38) * 1.5);
        if (p.getA(x, vy + wob) > 0) {
          p.set(x, vy + wob, bk.vein, 175);
          p.set(x, vy + wob - 1, mixColor(bk.vein, 0xffffff, 0.32), 80);
        }
      }
    }
  }

  // Crack system — 2-4 wandering cracks from top
  const nCracks = 2 + Math.floor(rnd() * 3);
  for (let c = 0; c < nCracks; c++) {
    let cx = Math.floor(w * (0.15 + rnd() * 0.70));
    let cy = topProfile[clamp(cx, 0, w - 1)] + 1;
    const steps = 5 + Math.floor(rnd() * 9);
    for (let s = 0; s < steps; s++) {
      const nx = clamp(cx + Math.round((rnd() - 0.5) * 3), 0, w - 1);
      const ny = cy + 1 + Math.floor(rnd() * 3);
      if (ny >= h) break;
      p.line(cx, cy, nx, ny, pal[0], 200);
      // Depth shadow offset
      if (nx + 1 < w) p.line(cx + 1, cy, nx + 1, ny, pal[5], 55);
      // Branch (50% chance, half length)
      if (rnd() < 0.45) {
        const bx = clamp(nx + Math.round((rnd() - 0.5) * 4), 0, w - 1);
        const by = ny + 1 + Math.floor(rnd() * (steps >> 1));
        if (by < h) p.line(nx, ny, bx, Math.min(by, h - 1), pal[0], 145);
      }
      cx = nx; cy = ny;
    }
  }

  // Surface texture scatter — dark + light speckles
  scatter(p, 0, 0, w - 1, h - 1, 0.038, pal[1], 170, rnd);
  scatter(p, 0, 0, w - 1, h - 1, 0.018, pal[6], 130, rnd);

  // Moss/algae patches on top 35% of surface
  const mossLimit = Math.round(h * 0.65);
  const nMoss = 3 + Math.floor(rnd() * 4);
  for (let m = 0; m < nMoss; m++) {
    const mx = Math.floor(w * (0.10 + rnd() * 0.80));
    const my = topProfile[clamp(mx, 0, w - 1)] + Math.floor(rnd() * h * 0.12);
    if (my > mossLimit) continue;
    const mr = 2.0 + rnd() * 2.8;
    p.ellipse(mx, my, mr, mr * 0.55, 0x3a6a2a, 165);
    p.ellipse(mx, my, mr * 0.52, mr * 0.32, 0x5a9a3a, 120);
    scatter(p, mx - mr, my - mr * 0.55, mx + mr, my + mr * 0.55, 0.12, 0x4a8040, 100, rnd);
  }

  // Rim highlights on top silhouette — brighter on flat tops, dimmer on steep sides
  for (let x = 1; x < w - 1; x++) {
    const ty = topProfile[x];
    if (ty <= 0 || ty >= h) continue;
    const slope = Math.abs((topProfile[Math.min(x + 1, w - 1)] - topProfile[Math.max(x - 1, 0)]) * 0.5);
    const rimA = Math.round(220 - clamp(slope * 28, 0, 150));
    p.set(x, ty, pal[7], rimA);
    // Second pixel just inside the rim for Owlboy double-rim look
    if (ty + 1 < h && p.getA(x, ty + 1) > 0) p.set(x, ty + 1, pal[6], Math.round(rimA * 0.45));
  }

  // Base shadow — darken bottom 28%, heavier at the very base
  const shadowStart = Math.round(h * 0.72);
  for (let y = shadowStart; y <= baseY; y++) {
    const t = (y - shadowStart) / Math.max(1, baseY - shadowStart);
    for (let x = 0; x < w; x++) {
      if (p.getA(x, y) > 0) p.set(x, y, pal[0], Math.round(t * 185));
    }
  }

  // Facet plane lines
  const facetLines = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < facetLines; i++) {
    const x0 = Math.floor(w * (0.10 + rnd() * 0.76));
    const y0 = Math.floor(h * (0.18 + rnd() * 0.50));
    const x1 = x0 + (rnd() - 0.5) * w * 0.30;
    const y1 = y0 + h * (0.05 + rnd() * 0.15);
    p.line(x0, y0, x1, y1, rnd() < 0.58 ? pal[1] : pal[6], 125);
  }

  // Pitting (dragon stone / lava rock)
  if (bk.pitted) {
    const pc = 28 + Math.floor(rnd() * 22);
    for (let i = 0; i < pc; i++) {
      const px = 2 + Math.floor(rnd() * (w - 4));
      const py = 2 + Math.floor(rnd() * (h - 4));
      if (p.getA(px, py) > 0) {
        p.ellipse(px, py, 2.0, 1.3, pal[0], 185);
        p.ellipse(px, py, 1.1, 0.75, pal[1], 200);
        p.set(px - 1, py - 1, pal[5], 90);
      }
    }
  }

  p.outline(OUTLINE);
}

// ── Hardscape: driftwood ─────────────────────────────────────────
function gWood(p, bk, seed) {
  const rnd = mulberry32(seed);
  // Warm highlights, cool shadows suit bleached driftwood
  const pal = ramp8(bk.base, 0x100800, 0xfff4d0);
  const w = p.w, h = p.h, baseY = h - 1, cx = w * 0.5;
  const lean = (rnd() - 0.5) * w * 0.18;
  const trunkW = Math.max(6, h * 0.095);
  const topX = cx + lean, topY = h * 0.14;

  // Three-layer trunk: dark inner, mid body, light lit-edge
  p.limb(cx, baseY, topX, topY, trunkW, trunkW * 0.45, pal[4], 255);
  // Shadow side (right for left-leaning, left for right-leaning)
  p.limb(cx + trunkW * 0.30, baseY, topX + trunkW * 0.22, topY, trunkW * 0.44, trunkW * 0.18, pal[1], 200);
  // Light side — outer rim highlight
  p.limb(cx - trunkW * 0.24, baseY, topX - trunkW * 0.18, topY + 2, trunkW * 0.32, trunkW * 0.12, pal[6], 185);

  // Branches
  const nb = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < nb; i++) {
    const t = 0.22 + (i / nb) * 0.65;
    const bx = cx + lean * t, by = baseY - (baseY - topY) * t;
    const dir = rnd() < 0.5 ? -1 : 1;
    const len = w * (0.17 + rnd() * 0.26);
    const ang = -Math.PI / 2 + dir * (0.65 + rnd() * 0.70);
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len * 1.2;
    const bw = trunkW * (0.46 + rnd() * 0.22);
    p.limb(bx, by, ex, ey, bw, bw * 0.22, pal[4]);
    p.limb(bx, by, ex, ey, bw * 0.26, bw * 0.07, rnd() < 0.5 ? pal[2] : pal[6], 130);
    // Branch attachment scar
    p.ellipse(bx, by, 2.5, 1.5, pal[1], 135);
    // Twigs
    const twigs = 1 + Math.floor(rnd() * 2);
    for (let j = 0; j < twigs; j++) {
      const ta = ang + (rnd() - 0.5) * 1.1;
      const tl = len * (0.22 + rnd() * 0.38);
      const tx = ex + Math.cos(ta) * tl, ty = ey + Math.sin(ta) * tl;
      p.limb(ex, ey, tx, ty, bw * 0.26, 0.7, pal[4], 220);
      p.set(Math.round(tx), Math.round(ty), pal[7], 200); // bleached tip
    }
  }

  // Roots
  const roots = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < roots; i++) {
    const dir = (i / Math.max(1, roots - 1) - 0.5) * 1.6;
    const len = w * (0.12 + rnd() * 0.20);
    p.limb(cx, baseY - 1, cx + Math.sin(dir) * len, baseY - 1 - Math.cos(dir) * len * 0.18,
      trunkW * 0.42, 1.2, pal[2], 235);
  }

  // Bark texture: dark + light grain scatter
  scatter(p, 0, 0, w - 1, h - 1, 0.060, pal[1], 145, rnd);
  scatter(p, 0, 0, w - 1, h - 1, 0.028, pal[6], 115, rnd);

  // Grain lines
  const grainLines = 6 + Math.floor(rnd() * 6);
  for (let i = 0; i < grainLines; i++) {
    const gx0 = cx - trunkW * 0.22 + (rnd() - 0.5) * trunkW * 0.5;
    const gy0 = baseY - h * (0.08 + rnd() * 0.68);
    p.line(gx0, gy0, gx0 + lean * 0.26 + (rnd() - 0.5) * 4,
      gy0 - h * (0.10 + rnd() * 0.24), rnd() < 0.5 ? pal[1] : pal[6], 108);
  }

  // Knot holes
  const nKnots = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < nKnots; k++) {
    const kx = cx + lean * (0.28 + rnd() * 0.50) + (rnd() - 0.5) * trunkW * 0.4;
    const ky = baseY - h * (0.22 + rnd() * 0.48);
    if (p.getA(Math.round(kx), Math.round(ky)) > 0) {
      p.ellipse(kx, ky, 3.5, 2.2, pal[2], 175);
      p.ellipse(kx, ky, 2.1, 1.4, pal[0], 205);
      p.ellipse(kx, ky, 0.9, 0.6, pal[0], 240);
    }
  }

  p.outline(OUTLINE);
}

// ── Plant generators ─────────────────────────────────────────────

function gStem(p, bk, seed) {
  // Rotala-style dense stem plant. Drawn as a filled oval-shaped column —
  // every row is fully painted to avoid transparent gaps that become trellis
  // artefacts at 6× upscale. Silhouette edges use smooth sine-noise for organic
  // irregular shape. Four hard colour zones (no dithering).
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x0a1a08, 0xf0fff0);
  const acc = ramp8(bk.accent, 0x0a0a00, 0xffffd0);
  const w = p.w, h = p.h, baseY = h - 1;

  // Unique per-instance noise phases
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28, ph4 = rnd() * 6.28;
  const cxBase = w * (0.40 + (rnd() - 0.5) * 0.12);  // slight centre wander

  for (let y = 0; y < h; y++) {
    const tH = (baseY - y) / h;                     // 0=bottom, 1=top
    // Profile: wide at 40-60% height, taper toward base and tip
    const prof = Math.sin(tH * Math.PI);             // 0..1..0
    if (prof < 0.04) continue;                       // very tips: skip
    const noiseL = Math.sin(tH * 5.2 + ph1) * 0.12 + Math.sin(tH * 11 + ph2) * 0.06;
    const noiseR = Math.sin(tH * 4.8 + ph3) * 0.12 + Math.sin(tH * 9.7 + ph4) * 0.06;
    const halfW = (prof * 0.88 + 0.10) * w * 0.47;
    const cx = cxBase + (noiseL - noiseR) * 1.2;
    const l = Math.max(1, Math.round(cx - halfW * (1 + noiseL)));
    const r = Math.min(w - 2, Math.round(cx + halfW * (1 + noiseR)));
    if (l > r) continue;

    // Hard 4-zone palette — SOLID steps, no dithering
    let col;
    if (tH > 0.82)      col = acc[5];   // accent apical tips
    else if (tH > 0.58) col = pal[4];   // upper: lighter
    else if (tH > 0.28) col = pal[3];   // mid: medium
    else                col = pal[2];   // base: dark

    p.hline(l, r, y, col);

    // Lit right edge + shaded left edge for form depth
    p.set(r, y, pal[5]);
    if (l + 1 <= r) p.set(l, y, pal[1]);
    if (l + 2 <= r) p.set(l + 1, y, pal[2]);
  }

  // Faint stem spines (suggest individual plant culms)
  const nSpines = 2 + Math.floor(rnd() * 2);
  for (let s = 0; s < nSpines; s++) {
    const sx = Math.round(w * (0.30 + (s / Math.max(1, nSpines - 1)) * 0.40));
    for (let y = baseY; y >= Math.round(h * 0.08); y--) {
      if (p.getA(sx, y) > 0 && (y % 3 !== 0)) p.set(sx, y, pal[5], 90);
    }
  }

  // Apical bud cluster — bright accent tips
  const nTips = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < nTips; i++) {
    const tx = Math.round(w * (0.18 + rnd() * 0.64));
    const ty = Math.round(h * rnd() * 0.16);
    if (p.getA(tx, ty) > 0 || p.getA(tx, ty + 2) > 0) {
      p.ellipse(tx, ty, 1.9, 1.4, acc[5], 215);
    }
  }

  p.outline(darker(bk.base, 0.50));
}

function gGrass(p, bk, seed) {
  // Filled-mass approach: overlapping blades merge into a dense hedge.
  // Individual blade identity comes from vein lines + shading, NOT from gaps.
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081408, 0xf0fff0);
  const tip = ramp8(bk.accent, 0x080800, 0xffffb0);
  const w = p.w, h = p.h, baseY = h - 1;

  // Draw 2–4 fat solid blades — each one a fully-filled tapered column.
  // Wide enough blades that partial overlaps fill canvas; no large transparent gaps at 6× upscale.
  const nBlades = 2 + Math.floor(rnd() * 3);   // 2..4 blades
  const bladeData = [];
  for (let b = 0; b < nBlades; b++) {
    const bx = w * (0.10 + (b / Math.max(1, nBlades - 1)) * 0.80) + (rnd() - 0.5) * w * 0.06;
    const bladeH = h * (0.55 + rnd() * 0.42);
    const curve = (bx - w * 0.5) * 0.020 + (rnd() - 0.5) * 0.22;
    const baseW = w * (0.26 + rnd() * 0.10);   // fat: 26-36% of canvas width per blade
    const darkIdx = 2 + (b % 2);               // alternating pal[2] / pal[3] for depth
    bladeData.push({ bx, bladeH, curve, baseW, darkIdx });
  }

  for (const bd of bladeData) {
    const { bx, bladeH, curve, baseW, darkIdx } = bd;
    const tipX = bx + curve * bladeH * 0.6;
    const tipY = baseY - bladeH;
    for (let y = baseY; y >= Math.round(tipY); y--) {
      const t = (baseY - y) / bladeH;           // 0=base, 1=tip
      const half = Math.max(0.5, baseW * 0.5 * (1 - t * 0.88));
      const cx = bx + (tipX - bx) * t;
      const l = Math.max(0, Math.round(cx - half));
      const r = Math.min(w - 1, Math.round(cx + half));
      // Two-tone: lower half darker, upper half lighter
      const col = t < 0.50 ? pal[darkIdx] : pal[darkIdx + 1];
      p.hline(l, r, y, col);
      // Shadow left edge, highlight right edge
      if (r > l + 1) {
        p.set(l, y, pal[1]);
        p.set(r, y, pal[5]);
      }
    }
    // Accent tip
    p.set(Math.round(tipX), Math.round(tipY), tip[5], 220);
    if (Math.round(tipY) + 1 < h) p.set(Math.round(tipX), Math.round(tipY) + 1, tip[4], 140);
  }

  // Midrib vein on each blade
  for (const bd of bladeData) {
    const { bx, bladeH, curve } = bd;
    const tipX = bx + curve * bladeH * 0.6;
    const tipY = baseY - bladeH;
    p.line(Math.round(bx), baseY, Math.round(tipX), Math.round(tipY), pal[6], 55);
  }
  // No outline — adds wire-trellis on fine blades at 6× upscale
}

function gFern(p, bk, seed) {
  // Filled-mass approach: fronds built from overlapping leafBlob8 ellipses so
  // there are no transparent gaps between lobes that create trellis artifacts.
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081408, 0xdcffdc);
  const w = p.w, h = p.h, cx = w * 0.5, baseY = h - 1;

  // 1. Rhizome base
  p.limb(w * 0.16, baseY - h * 0.04, w * 0.84, baseY - h * 0.02, 2.8, 2.0, pal[1], 230);

  // 2. Fronds as filled leafBlob8 chains — each frond is a sequence of overlapping
  //    ellipses tapered toward the tip, eliminating transparent gaps between lobes
  const fronds = 4 + Math.floor(rnd() * 3);
  for (let f = 0; f < fronds; f++) {
    const spread = (f / Math.max(1, fronds - 1) - 0.5) * 2;
    const rootX = cx + spread * w * 0.28 + (rnd() - 0.5) * w * 0.06;
    const ang = -Math.PI / 2 + spread * 0.72 + (rnd() - 0.5) * 0.20;
    const len = h * (0.44 + (1 - Math.abs(spread)) * 0.30) * (0.76 + rnd() * 0.38);
    const ex = rootX + Math.cos(ang) * len, ey = baseY + Math.sin(ang) * len;

    // Frond midrib spine
    p.limb(rootX, baseY - h * 0.03, Math.round(ex), Math.round(ey), 2.0, 0.6, pal[2], 235);
    p.line(Math.round(rootX), Math.round(baseY - h * 0.03), Math.round(ex), Math.round(ey), pal[6], 50);

    // Lobe mass: fill the frond outline with overlapping leafBlob8s along the spine
    const nBlobs = 8 + Math.floor(rnd() * 5);
    for (let b = 0; b < nBlobs; b++) {
      const t = 0.06 + (b / nBlobs) * 0.90 + (rnd() - 0.5) * 0.08;
      const lx = rootX + (ex - rootX) * t;
      const ly = (baseY - h * 0.03) + (ey - (baseY - h * 0.03)) * t;
      // Lobe size tapers from base to tip
      const lobeW = w * (0.14 - t * 0.06) * (0.8 + rnd() * 0.4);
      const lobeH = h * (0.048 - t * 0.018) * (0.8 + rnd() * 0.4);
      const lobeAng = ang + Math.PI / 2 + (rnd() - 0.5) * 0.30;
      leafBlob8(p, lx, ly, Math.max(0.8, lobeW), Math.max(0.5, lobeH), lobeAng, pal);
    }
  }

  // No global shade pass — leafBlob8 already shades each blob independently.
  // A uniform shade8 over the full canvas creates visible 4px Bayer bands at 6× upscale.

  p.outline(darker(bk.base, 0.50));
}

function gRosette(p, bk, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081408, 0xdcffdc);
  const w = p.w, h = p.h, cx = w * 0.5, baseY = h - 1;
  const leaves = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < leaves; i++) {
    const spread = (i / (leaves - 1) - 0.5) * 2;
    const ang = -Math.PI / 2 + spread * 0.95 + (rnd() - 0.5) * 0.18;
    const len = h * (0.24 + (1 - Math.abs(spread)) * 0.28) * (0.88 + rnd() * 0.22);
    const rootX = cx + spread * w * 0.06;
    const ex = rootX + Math.cos(ang) * len, ey = baseY + Math.sin(ang) * len;
    p.limb(rootX, baseY - 2, ex, ey, 1.4, 0.8, pal[1], 225);
    leafBlob8(p, ex, ey, w * (0.18 + rnd() * 0.06), h * (0.08 + rnd() * 0.03), ang + Math.PI / 2, pal);
    // Specular dot on each leaf
    p.set(Math.round(ex - Math.sin(ang) * 2), Math.round(ey + Math.cos(ang) * 2), pal[7], 140);
  }
  p.outline(darker(bk.base, 0.50));
}

function gCrypt(p, bk, seed) {
  // Cryptocoryne: broad rounded leaves on petioles radiating from a central crown.
  // Uses leafBlob8 (filled ellipses) to avoid transparent-gap trellis artifacts.
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x0a1008, 0xe8ffe8);
  const acc = ramp8(bk.accent, 0x120800, 0xffe8d0);
  const w = p.w, h = p.h, cx = w * 0.5, baseY = h - 1;
  const leaves = 8 + Math.floor(rnd() * 5);
  for (let i = 0; i < leaves; i++) {
    const spread = (i / Math.max(1, leaves - 1) - 0.5) * 2;
    const ang = -Math.PI / 2 + spread * 0.92 + (rnd() - 0.5) * 0.22;
    const len = h * (0.32 + (1 - Math.abs(spread)) * 0.32) * (0.80 + rnd() * 0.34);
    const rootX = cx + spread * w * 0.08;
    const ex = rootX + Math.cos(ang) * len;
    const ey = baseY + Math.sin(ang) * len;
    // Petiole (stem)
    p.limb(rootX, baseY, Math.round(ex), Math.round(ey), 1.4, 0.7, pal[1], 220);
    // Broad rounded leaf using leafBlob8
    const usePal = rnd() < 0.38 ? acc : pal;
    const leafRx = w * (0.20 + rnd() * 0.10);
    const leafRy = h * (0.072 + rnd() * 0.040);
    leafBlob8(p, ex, ey, leafRx, leafRy, ang + Math.PI / 2 + (rnd() - 0.5) * 0.25, usePal);
    // Midrib vein
    const vx1 = Math.round(ex - Math.sin(ang + Math.PI / 2) * leafRx * 0.7);
    const vy1 = Math.round(ey + Math.cos(ang + Math.PI / 2) * leafRx * 0.7);
    p.line(Math.round(ex), Math.round(ey), vx1, vy1, usePal[5], 70);
    // Specular highlight on upper leaf surface
    p.set(Math.round(ex - Math.sin(ang) * 2), Math.round(ey + Math.cos(ang) * 2), usePal[6], 150);
  }
  p.outline(darker(bk.base, 0.50));
}

function gBuce(p, bk, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081010, 0xd8ffee);
  const acc = ramp8(bk.accent, 0x081008, 0xd8ffd8);
  const w = p.w, h = p.h, cx = w * 0.5, baseY = h - 1;
  p.limb(w * 0.18, baseY - h * 0.06, w * 0.80, baseY - h * 0.09, 2.0, 1.6, pal[1], 230);
  const leaves = 9 + Math.floor(rnd() * 6);
  for (let i = 0; i < leaves; i++) {
    const t = i / Math.max(1, leaves - 1);
    const rootX = w * (0.18 + t * 0.64) + (rnd() - 0.5) * w * 0.08;
    const rootY = baseY - h * (0.05 + rnd() * 0.06);
    const ang = -Math.PI / 2 + (t - 0.5) * 1.0 + (rnd() - 0.5) * 0.35;
    const len = h * (0.18 + rnd() * 0.22);
    const ex = rootX + Math.cos(ang) * len, ey = rootY + Math.sin(ang) * len;
    p.limb(rootX, rootY, ex, ey, 1.3, 0.7, pal[1], 215);
    const leafPal = rnd() < 0.30 ? acc : pal;
    leafBlob8(p, ex, ey, w * (0.12 + rnd() * 0.046), h * (0.065 + rnd() * 0.026),
      ang + Math.PI / 2, leafPal);
    // Bullate texture — tiny bright ellipses on leaf surface
    const bc = 2 + Math.floor(rnd() * 2);
    for (let b = 0; b < bc; b++) {
      const bx = ex + (rnd() - 0.5) * 3, by = ey + (rnd() - 0.5) * 2;
      p.ellipse(bx, by, 0.9, 0.6, leafPal[7], 110);
    }
  }
  p.outline(darker(bk.base, 0.50));
}

function gLily(p, bk, seed) { return gCrypt(p, bk, seed); }

function gMoss(p, bk, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081008, 0xd0ffd0);
  const acc = ramp8(bk.accent, 0x080800, 0xd0ffc0);
  const w = p.w, h = p.h, baseY = h - 1;
  // Bottom layer: darker clumps
  const clumps = 12 + Math.floor(rnd() * 8);
  for (let c = 0; c < clumps; c++) {
    const cx = w * (0.08 + rnd() * 0.84);
    const cy = h * (0.52 + rnd() * 0.30);
    leafBlob8(p, cx, cy, w * (0.034 + rnd() * 0.044), h * (0.048 + rnd() * 0.056),
      rnd() * Math.PI, rnd() < 0.28 ? acc : pal);
  }
  // Top layer: lighter clumps
  const topClumps = 6 + Math.floor(rnd() * 6);
  for (let c = 0; c < topClumps; c++) {
    const cx = w * (0.10 + rnd() * 0.80);
    const cy = h * (0.38 + rnd() * 0.25);
    const rx = w * (0.025 + rnd() * 0.035), ry = h * (0.035 + rnd() * 0.042);
    p.ellipse(cx, cy, rx, ry, rnd() < 0.3 ? acc[5] : pal[5], 170);
  }
  // Scatter accent pixels
  for (let i = 0; i < w * h * 0.08; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(h * (0.30 + rnd() * 0.55));
    if (p.getA(x, y)) p.set(x, y, rnd() < 0.38 ? acc[4] : pal[5], 135);
  }
  // Highlight dots on clump tops
  const nHigh = 10 + Math.floor(rnd() * 8);
  for (let i = 0; i < nHigh; i++) {
    const x = Math.floor(w * (0.08 + rnd() * 0.84));
    const y = Math.floor(h * (0.32 + rnd() * 0.38));
    if (p.getA(x, y)) p.set(x, y, pal[7], 165);
  }
  p.outline(darker(bk.base, 0.50));
}

function gFloating(p, bk, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp8(bk.base, 0x081008, 0xd0ffd0);
  const acc = ramp8(bk.accent, 0x080400, 0xffe0c0);
  const w = p.w, h = p.h;
  // Hanging roots
  const roots = 8 + Math.floor(rnd() * 6);
  for (let i = 0; i < roots; i++) {
    const rx = w * (0.18 + rnd() * 0.64);
    const len = h * (0.36 + rnd() * 0.54);
    p.limb(rx, h * 0.30, rx + (rnd() - 0.5) * 5, h * 0.30 + len, 0.85, 0.28, acc[2], 185);
  }
  // Floating leaves
  const leaves = 10 + Math.floor(rnd() * 8);
  for (let i = 0; i < leaves; i++) {
    const lx = w * (0.08 + (i / Math.max(1, leaves - 1)) * 0.84) + (rnd() - 0.5) * w * 0.04;
    const ly = h * (0.11 + rnd() * 0.13);
    const r = w * (0.044 + rnd() * 0.024);
    p.ellipse(lx, ly, r, r * (0.62 + rnd() * 0.20), pal[4], 245);
    // Lighter center (catching the light)
    p.ellipse(lx - r * 0.18, ly - r * 0.22, r * 0.44, r * 0.30, pal[6], 160);
    // Midrib line
    p.line(Math.round(lx - r * 0.55), Math.round(ly), Math.round(lx + r * 0.55), Math.round(ly), pal[6], 70);
    // Specular dot
    p.set(Math.round(lx - r * 0.3), Math.round(ly - r * 0.3), pal[7], 170);
    // Root connection
    if (bk.accent && rnd() < 0.32) {
      p.line(Math.round(lx), Math.round(ly + r * 0.62), Math.round(lx + (rnd() - 0.5) * 3), Math.round(h * 0.30), acc[2], 155);
    }
  }
  p.outline(darker(bk.base, 0.50));
}

// ── Shrimp (animated, 60×26 per frame) ──────────────────────────
const SH_PROFILE = [0.22, 0.52, 0.70, 0.82, 0.88, 0.90, 0.86, 1.00, 1.05, 1.02, 0.88, 0.68, 0.46, 0.28];

function gShrimp(p, bk, row, col, cols, seed) {
  const rnd = mulberry32(seed + row * 101 + col * 17);
  const isMolt = !!bk.molt;
  const pal = ramp8(bk.base, 0x102030, 0xfff8e8);
  const baseA = isMolt ? 105 : 255;
  const w = p.w, h = p.h;            // 60 × 26

  const x0 = 8, x1 = 50;            // tail x, head/rostrum-base x
  const cyBase = h * 0.52;          // ~13.5
  const phase = (col / cols) * Math.PI * 2;
  const swim = row === 2, forage = row === 0;
  const arch = (swim ? h * 0.16 : forage ? h * 0.08 : h * 0.04);

  // ── Body fill ──
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const prof = sample(SH_PROFILE, t);
    const rad = Math.max(1.5, prof * (h * 0.22));

    // Body arch for swimming/foraging
    const curl = Math.sin(t * Math.PI) * arch * Math.sin(phase) * 0.5 - t * arch * 0.35;
    const cy = cyBase + curl;

    // Abdomen segment banding (t < 0.42)
    const isAbdomen = t < 0.42;
    const segW = Math.max(2, Math.round((x1 - x0) * 0.072));
    const segBand = isAbdomen && (Math.floor((x - x0) / segW) % 2 === 0);

    for (let dy = -rad; dy <= rad; dy++) {
      const yy = dy / rad;
      const yPos = Math.round(cy + dy);
      if (yPos < 0 || yPos >= h) continue;
      let lightT;
      if (t > 0.42) {
        // Cephalothorax — stronger highlight on hump top
        lightT = 0.70 - yy * 0.45 + (t - 0.42) * 0.08;
      } else {
        // Abdomen — alternating segment tones
        lightT = (segBand ? 0.56 : 0.44) - yy * 0.34;
      }
      shade8(p, x, yPos, pal, lightT);
    }

    // Abdomen segment lines
    if (isAbdomen && (x - x0) % Math.max(2, segW) === 0) {
      const st = Math.round(cy - rad * 0.72), sb = Math.round(cy + rad * 0.72);
      for (let sy = Math.max(0, st); sy <= Math.min(h - 1, sb); sy++) {
        p.set(x, sy, pal[1], 135);
      }
    }

    // Dorsal crest highlight
    const dorsalY = Math.round(cy - rad);
    if (dorsalY >= 0 && dorsalY < h) p.set(x, dorsalY, pal[7], isMolt ? 95 : 205);

    // Translucent organ shadow in cephalothorax
    if (t > 0.55 && t < 0.88) {
      const organY = Math.round(cy + rad * 0.14);
      if (organY >= 0 && organY < h) p.set(x, organY, pal[1], 52);
    }
  }

  // ── Tail fan (5 rays) ──
  const tailY = Math.round(cyBase + sample(SH_PROFILE, 0) * h * 0.10);
  const fanColors = [pal[2], pal[3], pal[5], pal[3], pal[2]];
  for (let k = -2; k <= 2; k++) {
    const spread = k * 3.2;
    p.line(x0, tailY, x0 - 8, Math.round(tailY + spread), fanColors[k + 2], baseA);
    p.line(x0, tailY, x0 - 6, Math.round(tailY + spread * 1.10), pal[1], Math.round(baseA * 0.40));
  }

  // ── Rostrum — positioned from actual body top at head x ──
  const hx = x1;
  const headRad = Math.max(1.5, sample(SH_PROFILE, 1.0) * h * 0.22);
  // curl at t=1: sin(π)*arch*sin(phase)*0.5 - 1*arch*0.35 = -arch*0.35
  const headCy = cyBase - arch * 0.35;
  const hy = Math.round(headCy - headRad * 0.72);
  p.limb(hx, hy, Math.min(w - 2, hx + 9), hy - 3, 1.4, 0.45, pal[6], baseA);
  for (let s = 2; s <= 7; s += 2) {
    if (hx + s < w) p.set(hx + s, hy - Math.round(s * 0.28), pal[1], 145);
  }

  // ── Eye — on body surface near rostrum base ──
  if (!isMolt) {
    const exX = hx - 3;
    const eyeT = (exX - x0) / (x1 - x0);
    const eyeRad = Math.max(1.5, sample(SH_PROFILE, eyeT) * h * 0.22);
    const eyeCy = cyBase - eyeT * arch * 0.30;
    const ey = Math.round(eyeCy - eyeRad * 0.70);
    p.ellipse(exX, ey, 2.2, 2.0, 0x080808, 255);
    p.ellipse(exX, ey, 1.4, 1.2, lighter(bk.base, 0.38), 125);
    p.set(exX - 1, ey - 1, 0xffffff, 240);
  }

  // ── Antennae (2 long + 2 antennules) ──
  const aSwing = Math.sin(phase) * 3;
  p.line(hx, hy - 1, w - 2, hy - 5 - aSwing, pal[2], isMolt ? 75 : 190);
  p.line(hx, hy + 1, w - 3, hy + 2 + aSwing * 0.6, pal[2], isMolt ? 75 : 160);
  p.line(hx - 1, hy, hx + 5, hy - 3 - aSwing * 0.4, pal[3], isMolt ? 65 : 168);
  p.line(hx - 1, hy + 1, hx + 5, hy + 2 + aSwing * 0.3, pal[3], isMolt ? 65 : 148);

  // ── Walking legs (pereiopods) — thorax ──
  const legSwing = forage ? 3.0 : 1.6;
  for (let L = 0; L < 5; L++) {
    const lx = x0 + 14 + L * 5;
    const lt = (lx - x0) / (x1 - x0);
    const legCy = Math.round(cyBase + sample(SH_PROFILE, lt) * h * 0.22 + h * 0.04);
    const swingY = Math.sin(phase + L * 0.9) * legSwing;
    p.line(lx, legCy, lx - 2, Math.min(h - 1, legCy + 5 + swingY), pal[2], isMolt ? 78 : 200);
  }

  // ── Swimmerets (pleopods) — abdomen ──
  for (let P = 0; P < 4; P++) {
    const px = x0 + 4 + P * 4;
    const plCy = Math.round(cyBase + h * 0.20);
    const swingY = Math.sin(phase * 2 + P * 1.1) * 1.4;
    p.line(px, plCy, px + 1, Math.min(h - 1, plCy + 3 + swingY), pal[3], isMolt ? 68 : 170);
  }

  // ── Berried egg cluster ──
  if (bk.berried) {
    for (let e = 0; e < 14; e++) {
      const ex = x0 + 3 + Math.floor(rnd() * 14);
      const ey = Math.round(cyBase + h * 0.08 + Math.floor(rnd() * 4));
      if (ey < h) {
        p.ellipse(ex, ey, 1.8, 1.4, 0x8fa820, 235);
        p.ellipse(ex, ey, 0.9, 0.7, 0x6a7a18, 200);
      }
    }
  }

  p.outline(isMolt ? 0x809aaa : OUTLINE, isMolt ? 115 : 255);
}

// ── Fish (neon tetra, 40×18 per frame) ──────────────────────────
function gFish(p, _bk, col, cols, _seed) {
  const w = p.w, h = p.h;
  const cy = h * 0.52;                         // ~9.4
  const bodyTop = ramp8(0x53789a, 0x0a1520, 0xe0f8ff);
  const bodyBot = ramp8(0xd7e4ee, 0x101820, 0xffffff);
  const x0 = Math.round(w * 0.15);            // ~6  (tail side)
  const x1 = Math.round(w * 0.78);            // ~31 (head side)
  const phase = (col / cols) * Math.PI * 2;

  // ── Body fill ──
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const peduncle = t > 0.80 ? 1 - (t - 0.80) / 0.20 * 0.42 : 1;
    const rad = Math.max(1.2, Math.sin(t * Math.PI) * h * 0.36 * peduncle + h * 0.06);
    for (let dy = -rad; dy <= rad; dy++) {
      const yy = dy / rad;
      const pal = yy < 0 ? bodyTop : bodyBot;
      const lightT = 0.60 - yy * 0.26;
      shade8(p, x, Math.round(cy + dy), pal, lightT);
    }
  }

  // ── Dorsal fin ──
  const dxS = Math.round(x0 + (x1 - x0) * 0.30);
  const dxE = Math.round(x0 + (x1 - x0) * 0.56);
  const dxP = Math.round((dxS + dxE) / 2);
  const dTop = Math.round(cy - h * 0.22 - h * 0.20);
  const dBase = Math.round(cy - h * 0.22);
  p.line(dxS, dBase, dxP, dTop, bodyTop[3], 178);
  p.line(dxP, dTop, dxE, dBase, bodyTop[3], 178);
  for (let dx = dxS + 1; dx < dxE; dx++) {
    const dt = (dx - dxS) / Math.max(1, dxE - dxS);
    const fh = Math.round((dBase - dTop) * Math.sin(dt * Math.PI));
    for (let dy = 0; dy < fh; dy++) {
      const fy = dBase - dy;
      if (fy >= 0 && fy < h) p.set(dx, fy, bodyTop[2], Math.round(110 * (1 - dy / fh)));
    }
  }

  // ── Pectoral fin ──
  const pfx = Math.round(x0 + (x1 - x0) * 0.68);
  p.ellipse(pfx, Math.round(cy + h * 0.06), 3.2, 1.8, bodyTop[4], 155);

  // ── Anal fin ──
  const afx = Math.round(x0 + (x1 - x0) * 0.50);
  const afY = Math.round(cy + h * 0.22);
  p.line(afx, afY, afx + 3, Math.round(cy + h * 0.34), bodyBot[3], 148);
  p.line(afx + 3, Math.round(cy + h * 0.34), afx + 7, afY, bodyBot[3], 148);

  // ── Neon stripes ──
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    p.set(x, Math.round(cy - h * 0.15), 0x7af0ff, 252);       // cyan top
    p.set(x, Math.round(cy - h * 0.07), 0x40b0e0, 228);       // blue bottom
    p.set(x, Math.round(cy - h * 0.01), 0x1a2a1a, 190);       // dark stripe
    if (t > 0.44) {
      const ra = Math.min(240, Math.round((t - 0.44) / 0.56 * 255));
      p.set(x, Math.round(cy + h * 0.10), 0xe03030, ra);
      p.set(x, Math.round(cy + h * 0.17), 0xb02020, Math.round(ra * 0.65));
    }
  }

  // ── Eye ──
  const ex = x1 - 2, ey = Math.round(cy - h * 0.15);
  p.ellipse(ex, ey, 2.1, 2.0, 0x080808, 255);
  p.ellipse(ex, ey, 1.2, 1.0, 0xa07030, 115);                 // golden iris
  p.set(ex - 1, ey - 1, 0xffffff, 232);

  // ── Tail (forked caudal fin) ──
  const pedX = x0 + Math.round((x1 - x0) * 0.06);
  const flick = Math.sin(phase) * h * 0.20;
  const tailTip = x0 - Math.round(w * 0.08);
  for (let k = 1; k <= 4; k++) {
    const ty = cy - h * 0.04 - k * h * 0.065 + flick * (k / 4);
    p.line(pedX, Math.round(cy - h * 0.04), Math.max(0, tailTip), Math.round(ty), bodyTop[3], 200);
  }
  for (let k = 1; k <= 4; k++) {
    const ty = cy + h * 0.04 + k * h * 0.065 + flick * (k / 4) * 0.55;
    p.line(pedX, Math.round(cy + h * 0.04), Math.max(0, tailTip), Math.round(ty), bodyBot[3], 200);
  }

  p.outline(OUTLINE);
}

// ── Particles ────────────────────────────────────────────────────
function gBubble(p) {
  const r = p.w / 2 - 0.8, cx = p.w / 2, cy = p.h / 2;
  for (let a = 0; a < Math.PI * 2; a += 0.22) {
    p.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 0xc8eeff, 215);
  }
  p.set(Math.round(cx - r * 0.42), Math.round(cy - r * 0.42), 0xffffff, 245);
  p.set(Math.round(cx - r * 0.22), Math.round(cy - r * 0.22), 0xe8f8ff, 180);
}

function gFood(p, seed) {
  const rnd = mulberry32(seed);
  const pal = ramp(0x7a5a32);
  p.ellipse(p.w / 2, p.h / 2, p.w / 2 - 0.8, p.h / 2 - 0.8, pal[2]);
  for (let i = 0; i < 8; i++) p.set(2 + Math.floor(rnd() * (p.w - 4)), 2 + Math.floor(rnd() * (p.h - 4)), pal[0], 175);
  p.outline(darker(0x7a5a32, 0.4));
}

function gMote(p) {
  p.ellipse(p.w / 2, p.h / 2, p.w / 2 - 0.8, p.h / 2 - 0.8, 0xbfe6ff, 145);
  p.set(Math.round(p.w / 2), Math.round(p.h / 2), 0xffffff, 215);
}

// ── Dispatch + sheet assembly ────────────────────────────────────
function drawFrame(p, entry, row, col, cols, seed) {
  const bk = entry.bake;
  switch (bk.kind) {
    case 'rock':     return gRock(p, bk, seed);
    case 'wood':     return gWood(p, bk, seed);
    case 'stem':     return gStem(p, bk, seed);
    case 'grass':    return gGrass(p, bk, seed);
    case 'fern':     return gFern(p, bk, seed);
    case 'rosette':  return gRosette(p, bk, seed);
    case 'crypt':    return gCrypt(p, bk, seed);
    case 'buce':     return gBuce(p, bk, seed);
    case 'lily':     return gLily(p, bk, seed);
    case 'moss':     return gMoss(p, bk, seed);
    case 'floating': return gFloating(p, bk, seed);
    case 'shrimp':   return gShrimp(p, bk, row, col, cols, seed);
    case 'fish':     return gFish(p, bk, col, cols, seed);
    case 'bubble':   return gBubble(p);
    case 'food':     return gFood(p, seed);
    case 'mote':     return gMote(p);
    default:         return;
  }
}

// Bake a full sprite sheet canvas for a manifest entry. Uses frameGrid
// (not aw/ah/frames) to match the manifest contract.
export function bakeSheet(entry) {
  const { rows, cols, frameW: aw, frameH: ah } = entry.frameGrid;
  const sheet = document.createElement('canvas');
  sheet.width  = aw * cols;
  sheet.height = ah * rows;
  const sctx = sheet.getContext('2d');
  const seed  = hashSeed(entry.key);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = new Pix(aw, ah);
      drawFrame(p, entry, r, c, cols, seed);
      sctx.drawImage(p.toCanvas(), c * aw, r * ah);
    }
  }
  return sheet;
}
