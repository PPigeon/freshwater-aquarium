import { Texture } from 'pixi.js';
import { MANIFEST } from './manifest.js';
import { bakeSheet } from './spriteBaker.js';

function toAbs(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function isFinitePos(v) {
  return Number.isFinite(v) && v > 0;
}

function setNearest(texture) {
  const src = texture.source;
  if (!src) return texture;
  src.scaleMode = 'nearest';
  if (src.style) {
    src.style.scaleMode = 'nearest';
    src.style.addressMode = src.style.addressMode || 'clamp-to-edge';
  }
  src.update?.();
  if (src.scaleMode !== 'nearest') {
    console.warn('[Art Atlas] Texture source scaleMode did not stick to nearest.');
  }
  if (src.style && src.style.scaleMode !== 'nearest') {
    console.warn('[Art Atlas] Texture style scaleMode did not stick to nearest.');
  }
  return texture;
}

function makeErrorTexture(message) {
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 12;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a101a';
  ctx.fillRect(0, 0, 12, 12);
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(0, 0, 6, 6);
  ctx.fillRect(6, 6, 6, 6);
  ctx.strokeStyle = '#260026';
  ctx.strokeRect(0.5, 0.5, 11, 11);
  if (typeof console !== 'undefined') console.error(message);
  return setNearest(Texture.from(c));
}

function validateManifestEntry(entry, key) {
  const problems = [];
  if (!entry.atlasPath || typeof entry.atlasPath !== 'string') {
    problems.push('Missing required `atlasPath`.');
  }
  if (!entry.frameGrid) problems.push('Missing required `frameGrid`.');
  if (!entry.worldSize) problems.push('Missing required `worldSize`.');
  if (entry.filter && entry.filter !== 'nearest' && entry.filter !== 'linear') {
    problems.push(`Invalid filter ${JSON.stringify(entry.filter)}. Use "nearest" or "linear".`);
  }
  if (!Array.isArray(entry.anchor) || entry.anchor.length !== 2) {
    problems.push('Missing required `anchor` array [x, y].');
  } else if (entry.anchor[0] < 0 || entry.anchor[0] > 1 || entry.anchor[1] < 0 || entry.anchor[1] > 1) {
    problems.push(`Anchor ${JSON.stringify(entry.anchor)} must be normalized to [0..1].`);
  }
  const g = entry.frameGrid || {};
  if (!Number.isInteger(g.rows) || g.rows < 1 || !Number.isInteger(g.cols) || g.cols < 1) {
    problems.push(`Invalid frameGrid rows/cols for ${key}.`);
  }
  if (!isFinitePos(g.frameW) || !isFinitePos(g.frameH)) {
    problems.push(`Invalid frameGrid frame size for ${key}.`);
  }
  const ws = entry.worldSize || {};
  if (!isFinitePos(ws.w) || !isFinitePos(ws.h)) {
    problems.push(`Invalid worldSize for ${key}.`);
  }
  if (problems.length) {
    throw new Error(`[Art Manifest] ${key}: ${problems.join(' ')}`);
  }
}

async function loadImage(path) {
  const img = new Image();
  img.decoding = 'async';
  img.src = path;
  await img.decode();
  return img;
}

function listFrames(entry, imageW, imageH) {
  const frames = [];
  if (entry.sourceRect) {
    const r = entry.sourceRect;
    frames.push({ x: r.x, y: r.y, w: r.w, h: r.h });
    return frames;
  }
  const { rows, cols, frameW, frameH } = entry.frameGrid;
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      line.push({ x: col * frameW, y: row * frameH, w: frameW, h: frameH });
    }
    frames.push(line);
  }
  const expectedW = cols * frameW;
  const expectedH = rows * frameH;
  if (imageW < expectedW || imageH < expectedH) {
    throw new Error(`[Art Atlas] ${entry.key}: image ${imageW}x${imageH} smaller than expected ${expectedW}x${expectedH}.`);
  }
  return frames;
}

function checkAlphaEdges(entry, imageData, w, h) {
  // Warn (not fail) when transparent-edge RGB data is likely to bleed.
  let suspect = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = imageData[i + 3];
      if (a > 0) continue;
      const n1 = imageData[((y - 1) * w + x) * 4 + 3];
      const n2 = imageData[((y + 1) * w + x) * 4 + 3];
      const n3 = imageData[(y * w + (x - 1)) * 4 + 3];
      const n4 = imageData[(y * w + (x + 1)) * 4 + 3];
      if (n1 || n2 || n3 || n4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        if (r !== 0 || g !== 0 || b !== 0) suspect++;
      }
    }
  }
  if (suspect > 6) {
    console.warn(`[Art Atlas] ${entry.key}: ${suspect} transparent-edge pixels contain color. This may cause fringe bleed.`);
  }
}

function frameTexture(image, frame, nearest = true) {
  const c = document.createElement('canvas');
  c.width = frame.w;
  c.height = frame.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  const tex = Texture.from(c);
  // Atlas art is nearest by default. A small number of full-tank overlays may
  // opt into linear filtering in the manifest when their role is atmospheric.
  return nearest ? setNearest(tex) : tex;
}

async function loadEntry(raw) {
  const entry = {
    ...raw,
    worldW: raw.worldSize?.w,
    worldH: raw.worldSize?.h,
  };
  validateManifestEntry(entry, entry.key);
  const image = await loadImage(toAbs(entry.atlasPath));
  const frames = listFrames(entry, image.width, image.height);

  const probe = document.createElement('canvas');
  probe.width = image.width;
  probe.height = image.height;
  const pctx = probe.getContext('2d');
  pctx.drawImage(image, 0, 0);
  checkAlphaEdges(entry, pctx.getImageData(0, 0, image.width, image.height).data, image.width, image.height);

  // Nearest is the default; manifest entries must explicitly opt into linear.
  const useNearest = entry.filter !== 'linear';

  if (entry.sourceRect) {
    const r = entry.sourceRect;
    if (r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > image.width || r.y + r.h > image.height) {
      throw new Error(`[Art Atlas] ${entry.key}: invalid sourceRect ${JSON.stringify(r)} for ${image.width}x${image.height}.`);
    }
    return { entry, frames: [[frameTexture(image, r, useNearest)]] };
  }

  const out = [];
  for (let row = 0; row < frames.length; row++) {
    out[row] = [];
    for (let col = 0; col < frames[row].length; col++) {
      out[row][col] = frameTexture(image, frames[row][col], useNearest);
    }
  }
  return { entry, frames: out };
}

export async function loadArtRegistry() {
  const records = {};
  const diagnostics = [];

  await Promise.all(Object.entries(MANIFEST).map(async ([key, entry]) => {
    try {
      records[key] = await loadEntry(entry);
    } catch (err) {
      if (entry.bake) {
        // PNG missing or wrong size — bake a pixel-art placeholder instead.
        try {
          const sheet = bakeSheet(entry);
          const { rows, cols, frameW, frameH } = entry.frameGrid;
          const out = [];
          for (let r = 0; r < rows; r++) {
            out[r] = [];
            for (let c = 0; c < cols; c++) {
              out[r][c] = frameTexture(sheet, { x: c * frameW, y: r * frameH, w: frameW, h: frameH });
            }
          }
          records[key] = {
            entry: { ...entry, worldW: entry.worldSize.w, worldH: entry.worldSize.h },
            frames: out,
          };
        } catch (bakeErr) {
          const msg = `[Baker] ${key}: ${bakeErr?.message || bakeErr}`;
          diagnostics.push(msg);
          records[key] = { entry: { ...entry, worldW: entry.worldSize?.w ?? 12, worldH: entry.worldSize?.h ?? 12 }, frames: [[makeErrorTexture(msg)]] };
        }
      } else {
        // Background/overlay entries with no bake definition — show error tile.
        const msg = err?.message || String(err);
        diagnostics.push(msg);
        records[key] = { entry: { ...entry, worldW: entry.worldSize?.w ?? 12, worldH: entry.worldSize?.h ?? 12 }, frames: [[makeErrorTexture(msg)]] };
      }
    }
  }));

  if (diagnostics.length) {
    console.groupCollapsed(`[Art] Atlas validation issues (${diagnostics.length})`);
    diagnostics.forEach((m) => console.error(m));
    console.groupEnd();
  }

  return {
    diagnostics,
    entry(key) {
      return records[key]?.entry ?? null;
    },
    frame(key, row = 0, col = 0) {
      const rec = records[key];
      if (!rec) return Texture.WHITE;
      const rows = rec.frames.length;
      const cols = rec.frames[0]?.length ?? 1;
      const rr = ((row % rows) + rows) % rows;
      const cc = ((col % cols) + cols) % cols;
      return rec.frames[rr][cc];
    },
    frameCount(key) {
      const rec = records[key];
      return rec?.frames[0]?.length ?? 1;
    },
  };
}
