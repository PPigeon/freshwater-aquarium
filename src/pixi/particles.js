import { Container, Sprite } from 'pixi.js';
import { GW, SUBSTRATE_Y, WATERLINE_Y, BEZEL_TOP } from './constants.js';

// Ambient particle systems: suspended drift specks (self-simulated), rising
// bubbles + plant pearls, and food wafers. Bubbles/food are driven from the
// orchestrator's state arrays; drift specks live here.
export class ParticleLayer {
  constructor(layers, art) {
    this.layers = layers;
    this.art = art;

    // Suspended drift specks
    this.driftC = new Container();
    layers.particles.addChild(this.driftC);
    this.drift = [];
    for (let i = 0; i < 24; i++) {
      const s = new Sprite(this.art.frame('mote'));
      s.anchor.set(0.5);
      const d = {
        x: Math.random() * GW,
        y: BEZEL_TOP + 4 + Math.random() * (SUBSTRATE_Y - BEZEL_TOP - 8),
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() < 0.3 ? 1.8 : 1.0,
        alpha: 0.14 + Math.random() * 0.2,
        tw: Math.random() * Math.PI * 2,
        sprite: s,
      };
      s.tint = 0xcfe6f2;
      this.driftC.addChild(s);
      this.drift.push(d);
    }

    // Bubble + pearl pool
    this.bubbleC = new Container();
    layers.particles.addChild(this.bubbleC);
    this.bubblePool = [];

    // Plant pearls (oxygen streams) — self-simulated risers
    this.pearls = [];
    this._pearlTimer = 0;

    // Food
    this.foodC = new Container();
    layers.foodLayer.addChild(this.foodC);
    this.foodPool = [];

    this._last = null;
  }

  _bubble() {
    const s = new Sprite(this.art.frame('bubble'));
    s.anchor.set(0.5);
    s.tint = 0xdff2ff;
    this.bubbleC.addChild(s);
    return s;
  }

  _foodSprite() {
    const g = new Sprite(this.art.frame('food_wafer'));
    g.anchor.set(0.5);
    const entry = this.art.entry('food_wafer');
    g.width = entry?.worldW ?? 3.4;
    g.height = entry?.worldH ?? 3.4;
    this.foodC.addChild(g);
    return g;
  }

  _updateDrift(t, dt) {
    for (const p of this.drift) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.tw += dt * 2;
      if (p.x < -2) p.x = GW + 2;
      if (p.x > GW + 2) p.x = -2;
      if (p.y < BEZEL_TOP + 3) p.vy = Math.abs(p.vy);
      if (p.y > SUBSTRATE_Y - 4) p.vy = -Math.abs(p.vy);
      const s = p.sprite;
      s.x = p.x; s.y = p.y;
      s.width = s.height = p.size * 2.2;
      s.alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.tw));
    }
  }

  _updatePearls(t, dt) {
    this._pearlTimer -= dt;
    if (this._pearlTimer <= 0 && this.pearls.length < 30) {
      this._pearlTimer = 0.5 + Math.random() * 1.2;
      this.pearls.push({
        x: 20 + Math.random() * (GW - 40),
        y: SUBSTRATE_Y - 6 - Math.random() * 30,
        vy: -(3 + Math.random() * 4),
        wob: Math.random() * Math.PI * 2,
        size: 0.8 + Math.random() * 1.2,
        alpha: 0.5 + Math.random() * 0.4,
      });
    }
    for (let i = this.pearls.length - 1; i >= 0; i--) {
      const p = this.pearls[i];
      p.y += p.vy * dt; p.wob += dt * 3; p.alpha -= dt * 0.06;
      if (p.y < WATERLINE_Y + 1 || p.alpha <= 0) { this.pearls.splice(i, 1); }
    }
  }

  // Render bubbles (state) + pearls (local) through one shared pool.
  _renderBubbles(stateBubbles) {
    const list = [];
    for (const b of stateBubbles || []) list.push({ x: b.x, y: b.y, size: (b.size ?? 2) * 0.9, alpha: b.alpha ?? 0.7 });
    for (const p of this.pearls) list.push({ x: p.x + Math.sin(p.wob) * 1.2, y: p.y, size: p.size, alpha: p.alpha });
    while (this.bubblePool.length < list.length) this.bubblePool.push(this._bubble());
    for (let i = 0; i < this.bubblePool.length; i++) {
      const s = this.bubblePool[i];
      if (i < list.length) {
        const b = list[i];
        s.visible = true; s.x = b.x; s.y = b.y;
        s.width = s.height = b.size * 2.4; s.alpha = b.alpha;
      } else s.visible = false;
    }
  }

  _renderFood(food) {
    const list = food || [];
    while (this.foodPool.length < list.length) this.foodPool.push(this._foodSprite());
    for (let i = 0; i < this.foodPool.length; i++) {
      const g = this.foodPool[i];
      if (i < list.length) {
        const f = list[i];
        g.visible = true; g.x = f.x; g.y = f.y; g.alpha = f.alpha ?? 1;
      } else g.visible = false;
    }
  }

  update(t, state) {
    if (this._last === null) this._last = t;
    const dt = Math.max(0, Math.min(0.1, t - this._last));
    this._last = t;
    this._updateDrift(t, dt);
    this._updatePearls(t, dt);
    this._renderBubbles(state.bubbles);
    this._renderFood(state.foodParticles);
  }
}
