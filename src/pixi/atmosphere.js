import {
  Sprite, TilingSprite, Graphics, Container, Texture,
} from 'pixi.js';
import {
  GW, GH, SUBSTRATE_Y, WATERLINE_Y, BEZEL_TOP, BEZEL_BOTTOM, BEZEL_SIDE,
  LED_FIXTURE_Y, clamp,
} from './constants.js';
import {
  verticalGradient, radial, grainTile,
} from './textures.js';

const BG_COLORS = {
  deep_blue: 0x0d2942,
  black:     0x05080b,
  frosted:   0x183a55,
  riverbank: 0x163029,
};

function fullSprite(tex, w, h) {
  const s = new Sprite(tex);
  s.width = w; s.height = h;
  return s;
}

export class Atmosphere {
  constructor(app, layers, art) {
    this.app = app;
    this.layers = layers;
    this.art = art;
    this._bgMode = null;
    this._buildWater();
    this._buildSubstrate();
    this._buildCaustics();
    this._buildLightCone();
    this._buildDepthHaze();
    this._buildVignette();
    this._buildGlassFX();
    this._buildNightTint();
    this._buildBezel();
    this._buildLED();
  }

  _atlasSprite(key, width, height, alpha = 1) {
    const s = new Sprite(this.art.frame(key));
    s.width = width;
    s.height = height;
    s.alpha = alpha;
    return s;
  }

  _atlasTiling(key, width, height, scale = 1) {
    const t = new TilingSprite({ texture: this.art.frame(key), width, height });
    t.tileScale.set(scale);
    return t;
  }

  // ── Water column ────────────────────────────────────────────
  _buildWater() {
    const L = this.layers.waterBack;

    // Room background: sits in the bezel layer behind everything,
    // visible at the edges when zoomed out. Only added if the asset loaded.
    try {
      this.roomBg = this._atlasSprite('room_bg', GW, GH, 1.0);
      this.layers.bezel.addChildAt(this.roomBg, 0);
    } catch (_) {
      this.roomBg = null; // Asset not yet generated — silently skip
    }

    // Solid base colour (tinted per background mode).
    // Scoped to the inner water area only so the room background
    // shows at the bezel edges.
    this.baseFill = fullSprite(Texture.WHITE, GW - BEZEL_SIDE * 2, SUBSTRATE_Y - WATERLINE_Y);
    this.baseFill.x = BEZEL_SIDE;
    this.baseFill.y = WATERLINE_Y;
    this.baseFill.tint = BG_COLORS.deep_blue;
    L.addChild(this.baseFill);

    // Atlas water tile — bilinear filtered (via registry) for smooth tiling.
    // Tighter tileScale (0.5) keeps individual tile seams below the eye.
    this.waterTile = this._atlasTiling('water_tile', GW, GH, 0.5);
    this.waterTile.alpha = 0.18;
    this.waterTile.blendMode = 'normal';
    L.addChild(this.waterTile);

    // Depth gradient: darker overall for FMV-era tank mood.
    const grad = verticalGradient(GH, [
      [0.00, 'rgba(55,118,152,0.48)'],
      [0.22, 'rgba(28,85,120,0.26)'],
      [0.60, 'rgba(12,50,88,0.10)'],
      [1.00, 'rgba(4,18,40,0.0)'],
    ]);
    this.waterGrad = fullSprite(grad, GW, GH);
    L.addChild(this.waterGrad);

    // A soft top light-shaft from the LED side.
    const shaft = radial(256, [
      [0, 'rgba(190,225,245,0.16)'],
      [0.5, 'rgba(150,200,235,0.05)'],
      [1, 'rgba(150,200,235,0)'],
    ]);
    this.shaft = new Sprite(shaft);
    this.shaft.anchor.set(0.5, 0);
    this.shaft.width = GW * 0.7;
    this.shaft.height = (SUBSTRATE_Y - WATERLINE_Y) * 1.2;
    this.shaft.x = GW * 0.5;
    this.shaft.y = WATERLINE_Y;
    this.shaft.blendMode = 'add';
    L.addChild(this.shaft);

    // Low-contrast pixel texture, closer to the older build's clear aquarium
    // plane than a soft photographic haze.
    const pixels = new Graphics();
    for (let y = WATERLINE_Y + 3; y < SUBSTRATE_Y - 4; y += 4) {
      for (let x = BEZEL_SIDE + ((y >> 2) % 2) * 2; x < GW - BEZEL_SIDE; x += 4) {
        const nearSurface = 1 - (y - WATERLINE_Y) / Math.max(1, SUBSTRATE_Y - WATERLINE_Y);
        const alpha = 0.018 + nearSurface * 0.018;
        pixels.rect(x, y, 1, 1);
        pixels.fill({ color: 0x9ed2df, alpha });
      }
    }
    L.addChild(pixels);
  }

  // ── Substrate (painterly soil) ──────────────────────────────
  _buildSubstrate() {
    const L = this.layers.substrate;
    const top0 = SUBSTRATE_Y;
    // Build a gently uneven top profile and reuse it for fill mask + rim.
    const pts = [];
    for (let x = 0; x <= GW; x += 4) {
      const y = top0
        + Math.sin(x * 0.10) * 1.2
        + Math.sin(x * 0.031 + 1.7) * 1.6
        - 1.2;
      pts.push([x, y]);
    }

    const soil = new Container();
    // Vertical gradient body
    const grad = verticalGradient(GH - top0 + 6, [
      [0.00, 'rgb(74,56,40)'],
      [0.28, 'rgb(56,42,30)'],
      [1.00, 'rgb(26,18,13)'],
    ]);
    const body = fullSprite(grad, GW, GH - top0 + 6);
    body.y = top0 - 6;
    soil.addChild(body);

    // Grain texture (multiply) for tactile soil
    const grain = new TilingSprite({ texture: grainTile(96, 0.55, true), width: GW, height: GH - top0 + 6 });
    grain.y = top0 - 6;
    grain.alpha = 0.28;
    grain.blendMode = 'multiply';
    grain.tileScale.set(0.5);
    soil.addChild(grain);

    // Mask to the uneven top
    const mask = new Graphics();
    mask.moveTo(0, pts[0][1]);
    for (const [x, y] of pts) mask.lineTo(x, y);
    mask.lineTo(GW, GH); mask.lineTo(0, GH); mask.closePath();
    mask.fill(0xffffff);
    soil.addChild(mask);
    soil.mask = mask;
    L.addChild(soil);

    // FMV-processed aquasoil texture tile (48×48 world units per tile).
    // Bilinear filtered via registry — scales smoothly without pixel blocks.
    // tileScale 1.0 = one tile covers 48×48 world units (natural grain size).
    const substrateTile = this._atlasTiling('substrate_tile', GW, GH - top0 + 8, 1.0);
    substrateTile.y = top0 - 4;
    substrateTile.alpha = 0.78;   // prominent enough to read as granular aquasoil
    substrateTile.blendMode = 'normal';
    substrateTile.mask = mask;
    L.addChild(substrateTile);

    // Top rim highlight (grains catching light) — follows the same edge.
    const rim = new Graphics();
    rim.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) rim.lineTo(x, y);
    rim.stroke({ width: 1.2, color: 0x9a7e54, alpha: 0.55 });
    L.addChild(rim);
    const rim2 = new Graphics();
    rim2.moveTo(pts[0][0], pts[0][1] + 1.4);
    for (const [x, y] of pts) rim2.lineTo(x, y + 1.4);
    rim2.stroke({ width: 1.0, color: 0x2a1d12, alpha: 0.5 });
    L.addChild(rim2);
    // Note: the old procedural gravel rectangles (1–3 px squares drawn at 4 px
    // intervals) are intentionally removed.  At 5× world scale they upscaled to
    // 5–15 px blocks that read as pixel-art rather than FMV digitised soil.
    // The substrate gradient + FMV tile above provides the correct look.
  }

  // ── Caustics ────────────────────────────────────────────────
  _buildCaustics() {
    const L = this.layers.caustics;
    const top = SUBSTRATE_Y - 12;
    const h = GH - top;
    this.caustic1 = new TilingSprite({ texture: this.art.frame('caustics_tile', 0, 0), width: GW, height: h });
    this.caustic1.y = top;
    this.caustic1.alpha = 0.16;
    this.caustic1.blendMode = 'add';
    this.caustic1.tileScale.set(0.64);
    L.addChild(this.caustic1);

    this.caustic2 = new TilingSprite({ texture: this.art.frame('caustics_tile', 0, 1), width: GW, height: h });
    this.caustic2.y = top;
    this.caustic2.alpha = 0.11;
    this.caustic2.blendMode = 'add';
    this.caustic2.tileScale.set(0.72);
    L.addChild(this.caustic2);
  }

  // ── Volumetric light cone from the LED ──────────────────────
  _buildLightCone() {
    const L = this.layers.lightCone;
    const tex = radial(256, [
      [0, 'rgba(255,250,224,0.5)'],
      [0.45, 'rgba(230,238,245,0.16)'],
      [1, 'rgba(210,228,245,0)'],
    ]);
    const cone = new Sprite(tex);
    cone.anchor.set(0.5, 0);
    cone.x = GW * 0.5;
    cone.y = LED_FIXTURE_Y + 4;
    cone.width = GW * 0.85;
    cone.height = (SUBSTRATE_Y - LED_FIXTURE_Y) * 1.05;
    cone.blendMode = 'add';
    cone.alpha = 0.5;
    this.lightCone = cone;
    L.addChild(cone);
  }

  // ── Depth haze ──────────────────────────────────────────────
  _buildDepthHaze() {
    const L = this.layers.depthHaze;
    const films = this._atlasSprite('background_films', GW, GH, 0.07);
    films.blendMode = 'add';
    L.addChild(films);
    const grad = verticalGradient(GH, [
      [0.0, 'rgba(120,170,190,0.06)'],
      [0.45, 'rgba(80,130,150,0.025)'],
      [1.0, 'rgba(30,45,60,0.0)'],
    ]);
    L.addChild(fullSprite(grad, GW, GH));
  }

  // ── Vignette ────────────────────────────────────────────────
  _buildVignette() {
    const L = this.layers.vignette;
    const tex = radial(256, [
      [0.0, 'rgba(0,0,0,0)'],
      [0.72, 'rgba(0,0,0,0)'],
      [1.0, 'rgba(0,0,0,0.30)'],
    ]);
    const v = new Sprite(tex);
    v.width = GW * 1.1; v.height = GH * 1.25;
    v.anchor.set(0.5);
    v.x = GW / 2; v.y = GH / 2;
    L.addChild(v);
  }

  // ── Glass front-pane reflections + surface shimmer ──────────
  _buildGlassFX() {
    const L = this.layers.glassFX;
    // Diagonal reflection streaks (upper-left)
    const refl = new Graphics();
    refl.moveTo(BEZEL_SIDE, BEZEL_TOP + 4);
    refl.lineTo(GW * 0.34, BEZEL_TOP + 4);
    refl.lineTo(GW * 0.44, BEZEL_TOP + 16);
    refl.lineTo(BEZEL_SIDE, BEZEL_TOP + 16);
    refl.closePath();
    refl.fill({ color: 0xbfe0ef, alpha: 0.05 });
    refl.moveTo(BEZEL_SIDE, BEZEL_TOP + 6);
    refl.lineTo(GW * 0.16, BEZEL_TOP + 6);
    refl.lineTo(GW * 0.24, BEZEL_TOP + 12);
    refl.lineTo(BEZEL_SIDE, BEZEL_TOP + 12);
    refl.closePath();
    refl.fill({ color: 0xe6f4ff, alpha: 0.04 });
    refl.blendMode = 'add';
    L.addChild(refl);

    // Surface shimmer band near the waterline
    const shimmerTex = radial(64, [
      [0, 'rgba(220,240,255,0.5)'],
      [1, 'rgba(220,240,255,0)'],
    ]);
    this.surface = new TilingSprite({ texture: shimmerTex, width: GW, height: 6 });
    this.surface.x = BEZEL_SIDE;
    this.surface.width = GW - BEZEL_SIDE * 2;
    this.surface.y = WATERLINE_Y - 3;
    this.surface.alpha = 0.25;
    this.surface.blendMode = 'add';
    this.surface.tileScale.set(0.12, 0.1);
    L.addChild(this.surface);

    // Thin meniscus line
    const men = new Graphics();
    men.rect(BEZEL_SIDE, WATERLINE_Y - 1, GW - BEZEL_SIDE * 2, 0.8);
    men.fill({ color: 0xeaf6ff, alpha: 0.4 });
    L.addChild(men);
  }

  _buildNightTint() {
    // A cool overlay that fades in at night, above the scene but below framing.
    this.nightTint = fullSprite(Texture.WHITE, GW, GH);
    this.nightTint.tint = 0x06163a;
    this.nightTint.alpha = 0;
    this.layers.glassFX.addChild(this.nightTint);
  }

  // ── Cinematic bezel frame ───────────────────────────────────
  _buildBezel() {
    const L = this.layers.bezel;
    const g = new Graphics();
    // Outer plastic frame: a thick rounded-rect stroke around the window edge.
    const innerX = BEZEL_SIDE, innerY = BEZEL_TOP;
    const innerW = GW - BEZEL_SIDE * 2, innerH = GH - BEZEL_TOP - BEZEL_BOTTOM;

    // Fill the outer margins with dark plastic via 4 bars (kept crisp).
    g.rect(0, 0, GW, BEZEL_TOP);
    g.rect(0, GH - BEZEL_BOTTOM, GW, BEZEL_BOTTOM);
    g.rect(0, BEZEL_TOP, BEZEL_SIDE, innerH);
    g.rect(GW - BEZEL_SIDE, BEZEL_TOP, BEZEL_SIDE, innerH);
    g.fill({ color: 0x1c2026 });

    // Hard outer frame — sharp corners for authentic FMV/90s tank aesthetic.
    g.rect(0.5, 0.5, GW - 1, GH - 1);
    g.stroke({ width: 1.2, color: 0x2c333d, alpha: 0.9 });

    // Top edge catch-light
    g.rect(0, 0, GW, 1.2);
    g.fill({ color: 0x6a7488, alpha: 0.5 });

    // Inner shadow where bezel meets water (depth)
    g.rect(innerX, innerY, innerW, 1.2);
    g.fill({ color: 0x05080c, alpha: 0.6 });
    g.rect(innerX, innerY + innerH - 1.2, innerW, 1.2);
    g.fill({ color: 0x05080c, alpha: 0.55 });
    g.rect(innerX, innerY, 1.2, innerH);
    g.fill({ color: 0x05080c, alpha: 0.4 });
    g.rect(innerX + innerW - 1.2, innerY, 1.2, innerH);
    g.fill({ color: 0x05080c, alpha: 0.4 });
    L.addChild(g);
  }

  _buildLED() {
    const L = this.layers.bezel;
    const fw = 90, fh = 3.2;
    const fx = (GW - fw) / 2;
    const fy = LED_FIXTURE_Y;
    const led = this._atlasSprite('led_fixture', fw, fh, 1);
    led.x = fx;
    led.y = fy;
    L.addChild(led);

    // Soft glow under the bar
    const glowTex = radial(128, [
      [0, 'rgba(245,250,255,0.7)'],
      [0.5, 'rgba(220,238,255,0.18)'],
      [1, 'rgba(220,238,255,0)'],
    ]);
    this.ledGlow = new Sprite(glowTex);
    this.ledGlow.anchor.set(0.5, 0.2);
    this.ledGlow.x = GW / 2;
    this.ledGlow.y = fy + fh;
    this.ledGlow.width = fw * 1.5;
    this.ledGlow.height = 22;
    this.ledGlow.blendMode = 'add';
    this.ledGlow.alpha = 0.6;
    L.addChild(this.ledGlow);
  }

  // ── Per-frame animation ─────────────────────────────────────
  update(t, state) {
    // Background mode tint
    const mode = state.backgroundMode || 'deep_blue';
    if (mode !== this._bgMode) {
      this._bgMode = mode;
      this.baseFill.tint = BG_COLORS[mode] ?? BG_COLORS.deep_blue;
      this.waterGrad.alpha = mode === 'black' ? 0.5 : 1;
    }

    this.waterTile.tilePosition.x = t * 2.4;
    this.waterTile.tilePosition.y = Math.sin(t * 0.28) * 2.5;

    // Caustics drift
    this.caustic1.tilePosition.x = t * 4.5;
    this.caustic1.tilePosition.y = Math.sin(t * 0.25) * 6;
    this.caustic2.tilePosition.x = -t * 2.6;
    this.caustic2.tilePosition.y = Math.cos(t * 0.18) * 5;
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
    this.caustic1.alpha = 0.2 * pulse;

    // Light cone + LED breathe
    this.lightCone.alpha = 0.42 + 0.08 * Math.sin(t * 0.5);
    this.ledGlow.alpha = 0.55 + 0.06 * Math.sin(t * 0.9);
    this.shaft.alpha = 0.85 + 0.15 * Math.sin(t * 0.4);

    // Surface shimmer
    this.surface.tilePosition.x = t * 6;

    // Day / night
    const night = state.nightOpacity || 0;
    this.nightTint.alpha = clamp(night, 0, 0.6);
  }
}
