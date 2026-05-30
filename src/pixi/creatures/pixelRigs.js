import { Container, Sprite } from 'pixi.js';

const SHRIMP_ROW = {
  substrate_forage: 0,
  social_avoid_pass: 0,
  rest_idle: 1,
  hardscape_graze: 1,
  glass_graze: 1,
  surface_film_graze: 1,
  slow_swim: 2,
  dart_escape: 2,
};

function sizeSprite(sprite, entry) {
  if (!entry) return;
  sprite.anchor.set(entry.anchor?.[0] ?? 0.5, entry.anchor?.[1] ?? 0.5);
  sprite.width = entry.worldW;
  sprite.height = entry.worldH;
}

export class PixelShrimpRig {
  constructor(art, shrimp) {
    this.art = art;
    this.s = shrimp;
    this.node = new Container();
    this.sprite = new Sprite();
    this.node.addChild(this.sprite);
    this._lastKey = '';
    this._lastRow = -1;
    this._lastCol = -1;
    this.phase = Math.random() * Math.PI * 2;
    this.update(0);
  }

  update(t) {
    const key = this.s.spriteKey;
    const row = SHRIMP_ROW[this.s.activityState] ?? 1;
    const cols = this.art.frameCount(key);
    const col = Math.max(0, (this.s.animFrame ?? Math.floor(t * 8)) % cols);
    if (key !== this._lastKey || row !== this._lastRow || col !== this._lastCol) {
      this.sprite.texture = this.art.frame(key, row, col);
      sizeSprite(this.sprite, this.art.entry(key));
      this._lastKey = key;
      this._lastRow = row;
      this._lastCol = col;
    }
  }

  destroy() {
    this.node.destroy({ children: true });
  }
}

export class PixelFishRig {
  constructor(art) {
    this.art = art;
    this.node = new Container();
    this.sprite = new Sprite();
    this.node.addChild(this.sprite);
    this._lastCol = -1;
    this.phase = Math.random() * Math.PI * 2;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.update(0);
  }

  update(t, speed = 3, turn = 0) {
    const cols = this.art.frameCount('neon_tetra');
    const col = Math.floor(t * (5 + speed * 0.5) + this.phase) % cols;
    if (col !== this._lastCol) {
      this.sprite.texture = this.art.frame('neon_tetra', 0, col);
      sizeSprite(this.sprite, this.art.entry('neon_tetra'));
      this._lastCol = col;
    }
    this.sprite.y = Math.sin(t * 6 + this.bobPhase) * 0.18;
    this.sprite.rotation = Math.max(-0.1, Math.min(0.1, turn * 0.035));
  }

  destroy() {
    this.node.destroy({ children: true });
  }
}
