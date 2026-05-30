import { Container, Sprite } from 'pixi.js';
import { GW, SUBSTRATE_Y, BEZEL_TOP } from '../constants.js';
import { PixelShrimpRig, PixelFishRig } from './pixelRigs.js';

const FRAME_H = 10;       // shrimp sprite frame height (grid units)
const FISH_SCALE = 0.72;
const SCHOOL_SIZE = 12;

// Owns all living things: articulated shrimp rigs (keyed by shrimp id), the
// midwater tetra school (boids ported from the legacy renderer), and shed
// molts. Reads the live simulation state each frame.
export class CreatureLayer {
  constructor(layers, art) {
    this.layers = layers;
    this.art = art;
    const root = layers.creatures;

    this.fishC = new Container();
    this.moltC = new Container();
    this.shrimpC = new Container();
    this.shrimpC.sortableChildren = true;
    root.addChild(this.fishC, this.moltC, this.shrimpC);

    this.rigs = new Map();    // shrimpId -> ShrimpRig
    this.molts = new Map();   // shrimpId -> Graphics
    this._buildSchool();
    this._lastTick = null;
    this._targetShift = 0;
    this._schoolBias = { x: GW * 0.62, y: BEZEL_TOP + 34 };
  }

  // ── Tetra school ────────────────────────────────────────────
  _buildSchool() {
    this.school = [];
    this.fish = [];
    for (let i = 0; i < SCHOOL_SIZE; i++) {
      const f = {
        x: GW * 0.30 + Math.random() * (GW * 0.46),
        y: BEZEL_TOP + 24 + Math.random() * 34,
        vx: (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 0.9),
        vy: (Math.random() - 0.5) * 0.4,
        phase: Math.random() * Math.PI * 2,
        tone: i % 3,
      };
      this.school.push(f);
      const rig = new PixelFishRig(this.art, f.tone);
      this.fishC.addChild(rig.node);
      this.fish.push(rig);
    }
    this.schoolTarget = { x: GW * 0.60, y: BEZEL_TOP + 36 };
  }

  _tickSchool(t, dt) {
    if (t - this._targetShift > 5.5) {
      this._targetShift = t;
      this.schoolTarget.x = 56 + Math.random() * (GW - 112);
      this.schoolTarget.y = BEZEL_TOP + 24 + Math.random() * 30;
    }
    const n = this.school.length;
    const cx = this.school.reduce((a, f) => a + f.x, 0) / n;
    const cy = this.school.reduce((a, f) => a + f.y, 0) / n;
    const avx = this.school.reduce((a, f) => a + f.vx, 0) / n;
    const avy = this.school.reduce((a, f) => a + f.vy, 0) / n;

    for (const f of this.school) {
      f.phase += dt * 1.2;
      let ax = 0, ay = 0;
      ax += (cx - f.x) * 0.11; ay += (cy - f.y) * 0.07;
      ax += (avx - f.vx) * 0.34; ay += (avy - f.vy) * 0.30;
      ax += (this.schoolTarget.x - f.x) * 0.05; ay += (this.schoolTarget.y - f.y) * 0.04;
      ax += Math.sin(f.phase * 1.7) * 0.03; ay += Math.cos(f.phase * 1.1) * 0.02;
      for (const o of this.school) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.0001 && d2 < 180) { ax += (dx / d2) * 11; ay += (dy / d2) * 7; }
      }
      f.turn = ax;
      f.vx += ax * dt * 2.0; f.vy += ay * dt * 2.0;
      const sp = Math.hypot(f.vx, f.vy), minS = 1.5, maxS = 4.2;
      if (sp > maxS) { f.vx = (f.vx / sp) * maxS; f.vy = (f.vy / sp) * maxS; }
      else if (sp < minS) { f.vx = (f.vx / (sp || 1)) * minS; f.vy = (f.vy / (sp || 1)) * minS; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 14) { f.x = 14; f.vx = Math.abs(f.vx) * 0.9; }
      if (f.x > GW - 14) { f.x = GW - 14; f.vx = -Math.abs(f.vx) * 0.9; }
      if (f.y < BEZEL_TOP + 16) { f.y = BEZEL_TOP + 16; f.vy = Math.abs(f.vy) * 0.8; }
      if (f.y > SUBSTRATE_Y - 42) { f.y = SUBSTRATE_Y - 42; f.vy = -Math.abs(f.vy) * 0.8; }
    }
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.school[i], rig = this.fish[i];
      const dir = f.vx >= 0 ? 1 : -1;
      rig.node.x = f.x; rig.node.y = f.y;
      rig.node.scale.set(FISH_SCALE * dir, FISH_SCALE);
      rig.node.alpha = 0.92;
      rig.update(t, Math.hypot(f.vx, f.vy), f.turn || 0);
    }
  }

  // ── Molts ───────────────────────────────────────────────────
  _moltSprite() {
    const entry = this.art.entry('molt');
    const s = new Sprite(this.art.frame('molt'));
    s.anchor.set(entry?.anchor?.[0] ?? 0.5, entry?.anchor?.[1] ?? 0.55);
    s.width = entry?.worldW ?? 30;
    s.height = entry?.worldH ?? 12;
    s.scale.set(0.34);
    s.alpha = 0.48;
    return s;
  }

  _syncMolts(moltEvents) {
    const live = new Set();
    for (const m of moltEvents || []) {
      if (m.x == null || m.x < 0) continue;
      live.add(m.shrimpId);
      let s = this.molts.get(m.shrimpId);
      if (!s) { s = this._moltSprite(); this.moltC.addChild(s); this.molts.set(m.shrimpId, s); }
      s.x = m.x; s.y = m.y;
    }
    for (const [id, s] of this.molts) {
      if (!live.has(id)) { s.parent?.removeChild(s); s.destroy(); this.molts.delete(id); }
    }
  }

  // ── Shrimp rigs ─────────────────────────────────────────────
  _syncShrimp(shrimp, t) {
    const live = new Set();
    for (const s of shrimp || []) {
      live.add(s.id);
      let rig = this.rigs.get(s.id);
      // Rebuild if molt/berried structural state changed.
      const sig = s.spriteKey;
      if (!rig || rig._sig !== sig) {
        if (rig) { rig.node.parent?.removeChild(rig.node); rig.destroy(); }
        rig = new PixelShrimpRig(this.art, s);
        rig._sig = sig;
        this.shrimpC.addChild(rig.node);
        this.rigs.set(s.id, rig);
      }
      const sc = s.scale ?? 0.36;
      const dir = s.facing < 0 ? -1 : 1;
      rig.node.x = s.x + (s.pickX ?? 0);
      rig.node.y = (s.renderY ?? s.y) + (FRAME_H * sc) / 2;
      rig.node.scale.set(sc * dir, sc);
      rig.node.rotation = ((s.rotationDeg ?? 0) * Math.PI) / 180;
      rig.node.zIndex = rig.node.y;          // y-sort: lower = front
      rig.update(t);
    }
    for (const [id, rig] of this.rigs) {
      if (!live.has(id)) { rig.node.parent?.removeChild(rig.node); rig.destroy(); this.rigs.delete(id); }
    }
  }

  update(t, state) {
    if (this._lastTick === null) this._lastTick = t;
    const dt = Math.max(0, Math.min(0.1, t - this._lastTick));
    this._lastTick = t;

    this._tickSchool(t, dt);
    this._syncMolts(state.moltEvents);
    this._syncShrimp(state.shrimp, t);
  }
}
