import { Texture } from 'pixi.js';

// Procedural textures built on a 2D canvas, then wrapped as Pixi textures.
// Canvas gradients are used (rather than Pixi FillGradient) for stable results
// across Pixi 8.x point releases and full control over painterly falloff.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function toTexture(c, { repeat = false } = {}) {
  const tex = Texture.from(c);
  if (repeat && tex.source) {
    tex.source.addressMode = 'repeat';
    tex.source.style.addressMode = 'repeat';
    tex.source.update?.();
  }
  return tex;
}

// Vertical gradient strip, stretched horizontally by the sprite.
export function verticalGradient(height, stops) {
  const c = canvas(4, height);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, height);
  return toTexture(c);
}

export function horizontalGradient(width, stops) {
  const c = canvas(width, 4);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, 0);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, 4);
  return toTexture(c);
}

// Soft radial glow / vignette. mode 'glow' = bright centre on transparent,
// mode 'vignette' = transparent centre to dark edges.
export function radial(size, stops) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

// A seamless caustic light tile: overlapping soft bright cells on transparent.
export function causticTile(size = 192, seed = 1) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ctx.globalCompositeOperation = 'lighter';
  const cells = 26;
  for (let i = 0; i < cells; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const rad = size * (0.06 + rnd() * 0.12);
    // Draw the cell plus 8 wrapped copies so the tile is seamless.
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const x = cx + ox * size;
        const y = cy + oy * size;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const a = 0.10 + rnd() * 0.10;
        g.addColorStop(0, `rgba(225,245,255,${a})`);
        g.addColorStop(0.5, `rgba(190,230,255,${a * 0.4})`);
        g.addColorStop(1, 'rgba(190,230,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
  }
  return toTexture(c, { repeat: true });
}

// Fine grain / noise tile (for substrate + suspended detail). Returns a
// grayscale-on-transparent speckle that reads as soil texture under multiply.
export function grainTile(size = 128, density = 0.5, dark = true) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const r = Math.random();
    let a = 0;
    if (r < density) a = Math.floor(Math.random() * 90);
    const v = dark ? 0 : 255;
    img.data[i * 4 + 0] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: true });
}

// Small soft round particle / pearl sprite (white core, soft edge).
export function softDot(size = 16) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r * 0.8, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(225,245,255,0.55)');
  g.addColorStop(1, 'rgba(200,235,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // subtle rim highlight for a bubble feel
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.62, Math.PI * 1.05, Math.PI * 1.65);
  ctx.stroke();
  return toTexture(c);
}
