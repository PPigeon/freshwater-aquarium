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

function substrateProfile() {
  const pts = [];
  for (let x = 0; x <= GW; x += 4) {
    const y = SUBSTRATE_Y
      + Math.sin(x * 0.10) * 1.2
      + Math.sin(x * 0.031 + 1.7) * 1.6
      - 1.2;
    pts.push([x, y]);
  }
  return pts;
}

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

    // Room background behind the water column.
    try {
      this.roomBg = this._atlasSprite('room_bg', GW, GH, 1.0);
      L.addChildAt(this.roomBg, 0);
    } catch (_) {
      this.roomBg = null;
    }

    // Solid base colour — at 0.82 alpha to let room_bg show through faintly.
    // The room_bg is a dark digitized fish room; the tinted fill above it adds
    // the deep-blue water cast while keeping the room visible as depth reference.
    this.baseFill = fullSprite(Texture.WHITE, GW - BEZEL_SIDE * 2, SUBSTRATE_Y - WATERLINE_Y);
    this.baseFill.x = BEZEL_SIDE;
    this.baseFill.y = WATERLINE_Y;
    this.baseFill.tint = BG_COLORS.deep_blue;
    this.baseFill.alpha = 0.82;
    L.addChild(this.baseFill);

    // Atlas water tile — bilinear filtered (via registry) for smooth tiling.
    this.waterTile = this._atlasTiling('water_tile', GW, GH, 0.5);
    this.waterTile.alpha = 0.18;
    this.waterTile.blendMode = 'normal';
    L.addChild(this.waterTile);

    // Depth gradient: darker at bottom, lighter blue at top.
    const grad = verticalGradient(GH, [
      [0.00, 'rgba(55,118,152,0.48)'],
      [0.22, 'rgba(28,85,120,0.26)'],
      [0.60, 'rgba(12,50,88,0.10)'],
      [1.00, 'rgba(4,18,40,0.0)'],
    ]);
    this.waterGrad = fullSprite(grad, GW, GH);
    L.addChild(this.waterGrad);

    // Faint water column pixel scatter near the surface (very subtle).
    const pixels = new Graphics();
    for (let y = WATERLINE_Y + 3; y < WATERLINE_Y + 20; y += 4) {
      for (let x = BEZEL_SIDE + ((y >> 2) % 2) * 2; x < GW - BEZEL_SIDE; x += 4) {
        const nearSurface = 1 - (y - WATERLINE_Y) / 20;
        const alpha = 0.012 + nearSurface * 0.010;
        pixels.rect(x, y, 1, 1);
        pixels.fill({ color: 0x9ed2df, alpha });
      }
    }
    L.addChild(pixels);
  }

  // ── Substrate (painterly aquasoil) ──────────────────────────
  _buildSubstrate() {
    const L = this.layers.substrate;
    const top0 = SUBSTRATE_Y;
    const pts = substrateProfile();

    const soil = new Container();
    // Vertical gradient body — dark brown ADA Amazonia tones
    const grad = verticalGradient(GH - top0 + 6, [
      [0.00, 'rgb(68,50,34)'],
      [0.22, 'rgb(52,38,24)'],
      [0.55, 'rgb(34,24,14)'],
      [1.00, 'rgb(18,12,7)'],
    ]);
    const body = fullSprite(grad, GW, GH - top0 + 6);
    body.y = top0 - 6;
    soil.addChild(body);

    // Very subtle grain texture — low opacity so the substrate tile dominates.
    // Multiply blend + low alpha gives organic variation without a visible grid.
    const grain = new TilingSprite({ texture: grainTile(96, 0.55, true), width: GW, height: GH - top0 + 6 });
    grain.y = top0 - 6;
    grain.alpha = 0.22;  // organic noise texture to break up substrate into gravel-like variation
    grain.blendMode = 'multiply';
    grain.tileScale.set(0.38);
    soil.addChild(grain);

    // Mask to uneven top profile
    const mask = new Graphics();
    mask.moveTo(0, pts[0][1]);
    for (const [x, y] of pts) mask.lineTo(x, y);
    mask.lineTo(GW, GH); mask.lineTo(0, GH); mask.closePath();
    mask.fill(0xffffff);
    soil.addChild(mask);
    soil.mask = mask;
    L.addChild(soil);

    // FMV-processed aquasoil texture tile — subtle grain layer, not dominant.
    // The gradient body carries the colour; this tile adds micro-texture only.
    // tileScale 1.6 = coarser grain, less visible grid pattern at 5× world scale.
    const substrateTile = this._atlasTiling('substrate_tile', GW, GH - top0 + 8, 1.6);
    substrateTile.y = top0 - 4;
    substrateTile.alpha = 0.36;
    substrateTile.blendMode = 'multiply';
    substrateTile.mask = mask;
    L.addChild(substrateTile);

    // Top edge: thin warm highlight (grains catching light from above)
    const rim = new Graphics();
    rim.moveTo(pts[0][0], pts[0][1] - 0.5);
    for (const [x, y] of pts) rim.lineTo(x, y - 0.5);
    rim.stroke({ width: 0.9, color: 0xa88858, alpha: 0.42 });
    L.addChild(rim);

    // Second darker shadow line just below
    const rim2 = new Graphics();
    rim2.moveTo(pts[0][0], pts[0][1] + 1.2);
    for (const [x, y] of pts) rim2.lineTo(x, y + 1.2);
    rim2.stroke({ width: 0.8, color: 0x1c1208, alpha: 0.55 });
    L.addChild(rim2);
  }

  // ── Caustics ────────────────────────────────────────────────
  _buildCaustics() {
    const L = this.layers.caustics;
    const top = SUBSTRATE_Y - 14;
    const h = GH - top;
    this.caustic1 = new TilingSprite({ texture: this.art.frame('caustics_tile', 0, 0), width: GW, height: h });
    this.caustic1.y = top;
    this.caustic1.alpha = 0.15;
    this.caustic1.blendMode = 'add';
    this.caustic1.tileScale.set(0.64);
    L.addChild(this.caustic1);

    this.caustic2 = new TilingSprite({ texture: this.art.frame('caustics_tile', 0, 1), width: GW, height: h });
    this.caustic2.y = top;
    this.caustic2.alpha = 0.10;
    this.caustic2.blendMode = 'add';
    this.caustic2.tileScale.set(0.72);
    L.addChild(this.caustic2);
  }

  // ── Overhead light — flat horizontal wash from LED bar ──────
  _buildLightCone() {
    const L = this.layers.lightCone;
    // Real aquarium LED bars spread light as a wide, even horizontal wash —
    // NOT as a circular spotlight cone. Replace radial point-source with a
    // full-width top-to-bottom gradient that fades to zero by mid-tank.
    const tex = verticalGradient(GH, [
      [0.00, 'rgba(205,232,248,0.13)'],
      [0.05, 'rgba(180,218,240,0.09)'],
      [0.18, 'rgba(145,195,225,0.04)'],
      [0.38, 'rgba(100,160,210,0.01)'],
      [0.60, 'rgba(0,0,0,0)'],
      [1.00, 'rgba(0,0,0,0)'],
    ]);
    this.lightCone = fullSprite(tex, GW - BEZEL_SIDE * 2, GH);
    this.lightCone.x = BEZEL_SIDE;
    this.lightCone.y = 0;
    this.lightCone.blendMode = 'add';
    this.lightCone.alpha = 1.0;
    L.addChild(this.lightCone);
  }

  // ── Depth haze ──────────────────────────────────────────────
  _buildDepthHaze() {
    const L = this.layers.depthHaze;
    this.films = this._atlasSprite('background_films', GW, GH, 0.006);
    this.films.blendMode = 'normal';
    L.addChild(this.films);
    const grad = verticalGradient(GH, [
      [0.0, 'rgba(120,170,190,0.05)'],
      [0.45, 'rgba(80,130,150,0.02)'],
      [1.0, 'rgba(30,45,60,0.0)'],
    ]);
    L.addChild(fullSprite(grad, GW, GH));
  }

  // ── Vignette ────────────────────────────────────────────────
  _buildVignette() {
    const L = this.layers.vignette;
    const tex = radial(256, [
      [0.0, 'rgba(0,0,0,0)'],
      [0.68, 'rgba(0,0,0,0)'],
      [1.0, 'rgba(0,0,0,0.28)'],
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
    // Subtle diagonal reflection streaks (upper-left corner)
    const refl = new Graphics();
    refl.moveTo(BEZEL_SIDE, BEZEL_TOP + 4);
    refl.lineTo(GW * 0.28, BEZEL_TOP + 4);
    refl.lineTo(GW * 0.38, BEZEL_TOP + 14);
    refl.lineTo(BEZEL_SIDE, BEZEL_TOP + 14);
    refl.closePath();
    refl.fill({ color: 0xbfe0ef, alpha: 0.04 });
    refl.blendMode = 'add';
    L.addChild(refl);

    // Surface shimmer band at waterline
    const shimmerTex = radial(64, [
      [0, 'rgba(200,230,255,0.45)'],
      [1, 'rgba(200,230,255,0)'],
    ]);
    this.surface = new TilingSprite({ texture: shimmerTex, width: GW, height: 5 });
    this.surface.x = BEZEL_SIDE;
    this.surface.width = GW - BEZEL_SIDE * 2;
    this.surface.y = WATERLINE_Y - 2;
    this.surface.alpha = 0.14;
    this.surface.blendMode = 'add';
    this.surface.tileScale.set(0.10, 0.08);
    L.addChild(this.surface);

    // Thin meniscus line at water surface
    const men = new Graphics();
    men.rect(BEZEL_SIDE, WATERLINE_Y - 0.8, GW - BEZEL_SIDE * 2, 0.7);
    men.fill({ color: 0xe8f5ff, alpha: 0.35 });
    L.addChild(men);
  }

  _buildNightTint() {
    this.nightTint = fullSprite(Texture.WHITE, GW, GH);
    this.nightTint.tint = 0x06163a;
    this.nightTint.alpha = 0;
    this.layers.glassFX.addChild(this.nightTint);
  }

  // ── Tank frame (bezel) ──────────────────────────────────────
  _buildBezel() {
    const L = this.layers.bezel;
    const g = new Graphics();
    const innerX = BEZEL_SIDE, innerY = BEZEL_TOP;
    const innerW = GW - BEZEL_SIDE * 2, innerH = GH - BEZEL_TOP - BEZEL_BOTTOM;

    // Dark plastic margins
    g.rect(0, 0, GW, BEZEL_TOP);
    g.rect(0, GH - BEZEL_BOTTOM, GW, BEZEL_BOTTOM);
    g.rect(0, BEZEL_TOP, BEZEL_SIDE, innerH);
    g.rect(GW - BEZEL_SIDE, BEZEL_TOP, BEZEL_SIDE, innerH);
    g.fill({ color: 0x1a1d22 });

    // Outer frame edge
    g.rect(0.5, 0.5, GW - 1, GH - 1);
    g.stroke({ width: 1.2, color: 0x292f38, alpha: 0.9 });

    // Top edge catch-light (frame plastic highlights)
    g.rect(0, 0, GW, 1.0);
    g.fill({ color: 0x5a6278, alpha: 0.55 });

    // Inner shadow where frame meets glass
    g.rect(innerX, innerY, innerW, 1.0);
    g.fill({ color: 0x04070b, alpha: 0.65 });
    g.rect(innerX, innerY + innerH - 1.0, innerW, 1.0);
    g.fill({ color: 0x04070b, alpha: 0.55 });
    g.rect(innerX, innerY, 1.0, innerH);
    g.fill({ color: 0x04070b, alpha: 0.40 });
    g.rect(innerX + innerW - 1.0, innerY, 1.0, innerH);
    g.fill({ color: 0x04070b, alpha: 0.40 });
    L.addChild(g);
  }

  // ── LED fixture bar + horizontal glow ───────────────────────
  _buildLED() {
    const L = this.layers.bezel;

    // Fixture bar spans nearly the full inner tank width.
    // Real planted-tank LED bars are slim and wide — not small center-mounted units.
    const fw = GW - BEZEL_SIDE * 2 - 4;  // 268 world units (inner width minus small margin)
    const fh = 2.8;
    const fx = BEZEL_SIDE + 2;
    const fy = LED_FIXTURE_Y;
    const led = this._atlasSprite('led_fixture', fw, fh, 1);
    led.x = fx;
    led.y = fy;
    L.addChild(led);

    // LED glow: a flat horizontal bar gradient fading downward.
    // Spans the full tank width — simulates even bar-light emission, not a point orb.
    const glowH = 16;
    const glowTex = verticalGradient(glowH, [
      [0.00, 'rgba(228,244,255,0.48)'],
      [0.28, 'rgba(200,232,255,0.18)'],
      [0.65, 'rgba(175,218,255,0.05)'],
      [1.00, 'rgba(175,218,255,0)'],
    ]);
    this.ledGlow = fullSprite(glowTex, GW - BEZEL_SIDE * 2, glowH);
    this.ledGlow.x = BEZEL_SIDE;
    this.ledGlow.y = fy + fh;
    this.ledGlow.blendMode = 'add';
    this.ledGlow.alpha = 0.75;
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
    this.caustic1.alpha = 0.18 * pulse;

    // LED glow breathes very gently (real LEDs are stable — minimal flicker)
    this.ledGlow.alpha = 0.70 + 0.05 * Math.sin(t * 0.6);

    // Surface shimmer
    this.surface.tilePosition.x = t * 5;
    if (this.films) this.films.alpha = state.reviewMode ? 0 : 0.006;

    // Day / night
    const night = state.nightOpacity || 0;
    this.nightTint.alpha = clamp(night, 0, 0.6);
  }
}
