// Tiny pixel-buffer used by the placeholder sprite baker. Drawing happens at
// "art resolution" (one entry per pixel) so edges stay hard — the resulting
// canvas is wrapped as a nearest-neighbour Pixi texture for a crisp pixel-art
// look when upscaled into the world. Real AI atlases replace these later.

import { mixColor } from '../constants.js';

export class Pix {
  constructor(w, h) {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // Alpha-blended pixel set (src-over). Integer coords.
  set(x, y, rgb, a = 255) {
    x |= 0; y |= 0;
    if (!this.inb(x, y) || a <= 0) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.d[i] = (rgb >> 16) & 255;
      this.d[i + 1] = (rgb >> 8) & 255;
      this.d[i + 2] = rgb & 255;
      this.d[i + 3] = 255;
      return;
    }
    const sa = a / 255;
    const da = this.d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    const sr = (rgb >> 16) & 255, sg = (rgb >> 8) & 255, sb = rgb & 255;
    this.d[i] = (sr * sa + this.d[i] * da * (1 - sa)) / oa;
    this.d[i + 1] = (sg * sa + this.d[i + 1] * da * (1 - sa)) / oa;
    this.d[i + 2] = (sb * sa + this.d[i + 2] * da * (1 - sa)) / oa;
    this.d[i + 3] = oa * 255;
  }

  getA(x, y) { return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }

  hline(x0, x1, y, rgb, a) {
    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    for (let x = x0; x <= x1; x++) this.set(x, y, rgb, a);
  }

  vline(x, y0, y1, rgb, a) {
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    for (let y = y0; y <= y1; y++) this.set(x, y, rgb, a);
  }

  rect(x0, y0, w, h, rgb, a) {
    for (let y = 0; y < h; y++) this.hline(x0, x0 + w - 1, y0 + y, rgb, a);
  }

  // Bresenham line.
  line(x0, y0, x1, y1, rgb, a) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, rgb, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Thick line — a tapered span used for wood limbs / blades.
  limb(x0, y0, x1, y1, w0, w1, rgb, a) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.max(1, Math.hypot(dx, dy));
    const steps = Math.ceil(len);
    const nx = -dy / len, ny = dx / len;        // unit normal
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + dx * t, cy = y0 + dy * t;
      const hw = (w0 + (w1 - w0) * t) / 2;
      for (let o = -hw; o <= hw; o += 0.6) {
        this.set(Math.round(cx + nx * o), Math.round(cy + ny * o), rgb, a);
      }
    }
  }

  ellipse(cx, cy, rx, ry, rgb, a) {
    rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const yy = y / ry;
      if (yy * yy > 1) continue;
      const xr = Math.floor(rx * Math.sqrt(1 - yy * yy));
      this.hline(Math.round(cx) - xr, Math.round(cx) + xr, Math.round(cy) + y, rgb, a);
    }
  }

  // Outline pass: transparent pixels orthogonally touching opaque become `rgb`.
  outline(rgb, a = 255) {
    const src = this.d.slice();
    const A = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h) ? src[(y * this.w + x) * 4 + 3] : 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[(y * this.w + x) * 4 + 3] !== 0) continue;
        if (A(x - 1, y) > 40 || A(x + 1, y) > 40 || A(x, y - 1) > 40 || A(x, y + 1) > 40) {
          this.set(x, y, rgb, a);
        }
      }
    }
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}

// 5-step shading ramp (darkest → lightest) from a base colour.
export function ramp(base) {
  return [
    mixColor(base, 0x000000, 0.50),
    mixColor(base, 0x000000, 0.26),
    base,
    mixColor(base, 0xffffff, 0.20),
    mixColor(base, 0xffffff, 0.42),
  ];
}

export function darker(c, t) { return mixColor(c, 0x000000, t); }
export function lighter(c, t) { return mixColor(c, 0xffffff, t); }

// Ordered 2x2 dither: returns true when (x,y) should take the lighter step for
// a given 0..1 threshold — gives painterly pixel gradients without banding.
const BAYER = [[0, 2], [3, 1]];
export function dither(x, y, t) {
  return t * 4 > BAYER[((y % 2) + 2) % 2][((x % 2) + 2) % 2];
}

// 4×4 Bayer matrix (16 thresholds) for smooth gradients with ramp8.
const BAYER4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];
export function dither8(x, y, t) {
  return t * 16 > BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4];
}

// 8-step shading ramp with optional cool shadow shift + warm highlight shift.
// Shadows: blend toward `shadow` (default cool-blue). Highlights: blend toward
// `highlight` (default warm-cream). Gives the Owlboy form-reading look.
export function ramp8(base, shadow = 0x1a2a40, highlight = 0xfff0c0) {
  return [
    mixColor(mixColor(base, 0x000000, 0.62), shadow, 0.22),    // 0 deep shadow
    mixColor(mixColor(base, 0x000000, 0.48), shadow, 0.15),    // 1 shadow
    mixColor(base, 0x000000, 0.34),                             // 2 dark
    mixColor(base, 0x000000, 0.18),                             // 3 mid-dark
    base,                                                        // 4 midtone
    mixColor(base, 0xffffff, 0.18),                             // 5 mid-light
    mixColor(mixColor(base, 0xffffff, 0.36), highlight, 0.12),  // 6 light
    mixColor(mixColor(base, 0xffffff, 0.58), highlight, 0.24),  // 7 highlight/specular
  ];
}

// Scatter pixels of `rgb` over already-opaque pixels in a bounding box.
// Density 0..1. Useful for bark texture, rock roughness, lichen, substrate.
export function scatter(p, x0, y0, x1, y1, density, rgb, a, rnd) {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      if (p.getA(x, y) > 10 && rnd() < density) p.set(x, y, rgb, a);
    }
  }
}
