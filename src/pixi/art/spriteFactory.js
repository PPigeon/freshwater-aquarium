import { Container, Sprite } from 'pixi.js';
import { hashSeed, mulberry32 } from '../constants.js';

const FLOATING = new Set(['floating_salvinia', 'floating_redroot']);

function makeSprite(art, key) {
  const entry = art.entry(key);
  const texture = art.frame(key, 0, 0);
  const sprite = new Sprite(texture);
  if (entry) {
    const ax = entry.anchor?.[0] ?? 0.5;
    const authoredY = entry.anchor?.[1] ?? 1;
    const ay = FLOATING.has(key)
      ? authoredY
      : (texture.visualBounds?.bottomNorm ?? authoredY);
    sprite.anchor.set(ax, ay);
    sprite.width = entry.worldW;
    sprite.height = entry.worldH;
  }
  return sprite;
}

export function makePlacedArt(art, def, asset) {
  const node = new Container();
  const sprite = makeSprite(art, asset.key);
  node.addChild(sprite);

  if (def.layer === 'plant') {
    const rnd = mulberry32(hashSeed(asset.id || asset.key));
    const amp = FLOATING.has(asset.key)
      ? 0.025 + rnd() * 0.025
      : 0.010 + rnd() * 0.020;
    return {
      node,
      kind: 'plant',
      sway: [{ part: node, phase: rnd() * Math.PI * 2, amp, base: 0 }],
    };
  }

  return { node, kind: 'hardscape', sway: null };
}

export function animatePlantArt(sway, t) {
  for (const s of sway || []) {
    s.part.rotation = s.base + Math.sin(t * 0.75 + s.phase) * s.amp;
  }
}
