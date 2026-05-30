import { Container, Graphics } from 'pixi.js';
import { VARIANT_COLORS } from '../../assets.js';
import { mixColor } from '../constants.js';

// Articulated procedural shrimp. The node is drawn in "rig units" with the
// head toward +x and the body centred near the origin; creatureLayer handles
// world placement, scale, facing-flip and rotation. update(t) drives the
// articulation (abdomen curl, antennae sweep, leg picking, pleopod beat) from
// the live Shrimp state machine — this is where the minute life lives.

function toInt(css) {
  if (!css) return 0xc82820;
  return parseInt(css.replace('#', ''), 16);
}

// Segment profile: [width, height] in rig units, head → tail.
const SEG = [
  [9.5, 7.5],
  [9.0, 7.8],
  [8.0, 7.0],
  [6.6, 6.0],
  [5.2, 4.8],
  [3.6, 3.4],
];
const SEG_LEN = 2.9;
const HEAD_X = 8.5;

export class ShrimpRig {
  constructor(shrimp) {
    this.s = shrimp;
    this.node = new Container();
    this.body = new Container();
    this.node.addChild(this.body);

    const variant = shrimp.variant;
    let base = toInt(VARIANT_COLORS[variant] ?? '#c82820');
    if (shrimp.isMolt) base = 0xdfe7ee;
    this.baseColor = base;
    this.topColor = mixColor(base, 0xffffff, 0.32);
    this.bellyColor = mixColor(base, 0x000000, 0.4);

    this.segs = [];
    let parent = this.body;
    for (let i = 0; i < SEG.length; i++) {
      const seg = new Container();
      seg.x = i === 0 ? HEAD_X : -SEG_LEN;
      parent.addChild(seg);
      this._drawSegment(seg, i);
      this.segs.push(seg);
      parent = seg;
    }

    this._buildHead();
    this._buildTail(this.segs[SEG.length - 1]);
    this._buildLegs();
    this._buildAntennae();
    if (shrimp.isBerried) this._buildEggs();

    if (shrimp.isMolt) {
      this.node.alpha = 0.45;
    }

    // per-instance phase so the school doesn't pulse in unison
    this.phase = Math.random() * Math.PI * 2;
  }

  _drawSegment(seg, i) {
    const [w, h] = SEG[i];
    const g = new Graphics();
    // belly shadow
    g.ellipse(0, 0.8, w / 2, h / 2);
    g.fill({ color: this.bellyColor });
    // main body
    g.ellipse(0, 0, w / 2, (h / 2) * 0.9);
    g.fill({ color: this.baseColor });
    // dorsal highlight
    g.ellipse(0, -h * 0.18, w / 2.6, h * 0.22);
    g.fill({ color: this.topColor, alpha: 0.7 });
    // faint segment seam
    if (i > 0) {
      g.moveTo(w / 2, -h / 2.4);
      g.quadraticCurveTo(w / 2 + 0.6, 0, w / 2, h / 2.4);
      g.stroke({ width: 0.4, color: this.bellyColor, alpha: 0.5 });
    }
    seg.addChild(g);
  }

  _buildHead() {
    const head = this.segs[0];
    const g = new Graphics();
    // rostrum (pointed beak) sweeping forward-up
    g.moveTo(4.0, -2.6);
    g.quadraticCurveTo(9.5, -3.6, 11.5, -5.4);
    g.quadraticCurveTo(8.5, -2.2, 4.6, -1.2);
    g.fill({ color: this.baseColor });
    g.moveTo(4.0, -2.6);
    g.lineTo(11.5, -5.4);
    g.stroke({ width: 0.4, color: this.topColor, alpha: 0.6 });
    head.addChild(g);

    // eye on a short stalk
    const eye = new Graphics();
    eye.circle(4.4, -1.4, 0.6);
    eye.fill({ color: this.bellyColor });
    eye.circle(5.0, -2.4, 1.25);
    eye.fill({ color: 0x0a0a0c });
    eye.circle(5.4, -2.8, 0.42);
    eye.fill({ color: 0xffffff, alpha: 0.9 });
    head.addChild(eye);
  }

  _buildTail(last) {
    const g = new Graphics();
    // uropod fan opening backward (-x)
    const blades = [-0.9, -0.3, 0.3, 0.9];
    for (const a of blades) {
      g.moveTo(-1.0, 0);
      g.quadraticCurveTo(-3.2, a * 3.0, -4.6, a * 3.6);
      g.quadraticCurveTo(-3.0, a * 1.2, -1.0, 0);
      g.fill({ color: mixColor(this.baseColor, 0x000000, 0.15), alpha: 0.85 });
    }
    g.moveTo(-1, -2); g.lineTo(-4.4, -3.4);
    g.moveTo(-1, 2); g.lineTo(-4.4, 3.4);
    g.stroke({ width: 0.3, color: this.topColor, alpha: 0.4 });
    last.addChild(g);
    this.tail = g;
  }

  _buildLegs() {
    // Three pairs of pereiopods under the thorax + swimmerets under abdomen.
    this.legs = [];
    const hips = [
      { seg: 0, x: 2.0, len: 4.2, spread: 0.5 },
      { seg: 1, x: -0.5, len: 4.0, spread: 0.2 },
      { seg: 1, x: -2.5, len: 3.6, spread: -0.1 },
    ];
    for (const hip of hips) {
      const pivot = new Container();
      pivot.x = hip.x; pivot.y = 2.4;
      const g = new Graphics();
      g.moveTo(0, 0);
      g.lineTo(hip.len * 0.4, hip.len * 0.5);
      g.lineTo(hip.len * 0.2, hip.len);
      g.stroke({ width: 0.7, color: this.bellyColor, alpha: 0.85 });
      pivot.addChild(g);
      this.segs[hip.seg].addChild(pivot);
      this.legs.push({ pivot, base: hip.spread, amp: 0.5 });
    }
    // pleopods (swimmerets) under the rear segments
    this.pleopods = [];
    for (let i = 2; i < SEG.length - 1; i++) {
      const pivot = new Container();
      pivot.y = SEG[i][1] / 2 - 0.4;
      const g = new Graphics();
      g.moveTo(0, 0); g.lineTo(0.4, 2.4);
      g.stroke({ width: 0.6, color: this.bellyColor, alpha: 0.7 });
      pivot.addChild(g);
      this.segs[i].addChild(pivot);
      this.pleopods.push({ pivot, phase: i * 0.7 });
    }
  }

  _buildAntennae() {
    // Two long whip antennae, redrawn each frame for a living sweep.
    this.antA = new Graphics();
    this.antB = new Graphics();
    this.segs[0].addChild(this.antA, this.antB);
  }

  _drawAntennae(t) {
    const s = this.s;
    const active = s.activityState;
    const sweep = active === 'substrate_forage' || active === 'hardscape_graze' ? 0.9 : 0.45;
    const droop = active === 'rest_idle' ? 0.5 : 0.1;
    for (const [g, dir, ph] of [[this.antA, 1, 0], [this.antB, 1, 1.3]]) {
      g.clear();
      const wob = Math.sin(t * 2.4 + this.phase + ph) * sweep;
      const wob2 = Math.cos(t * 3.1 + this.phase + ph) * sweep * 0.6;
      const x0 = 5.5, y0 = -2.2 + ph * 0.8;
      const cx1 = x0 + 8, cy1 = y0 - 3 + wob * 3 + droop * 4;
      const cx2 = x0 + 16, cy2 = y0 + wob2 * 4 + droop * 8;
      const ex = x0 + 22, ey = y0 + 4 + wob * 6 + droop * 12;
      g.moveTo(x0, y0);
      g.bezierCurveTo(cx1, cy1, cx2, cy2, ex, ey);
      g.stroke({ width: 0.55, color: this.bellyColor, alpha: 0.8 });
    }
  }

  _buildEggs() {
    const g = new Graphics();
    for (let i = 0; i < 12; i++) {
      const seg = 2 + (i % 3);
      const x = -SEG_LEN * (i % 3) - 1;
      const y = SEG[seg][1] / 2 + 0.6 + Math.floor(i / 3) * 0.2;
      this.segs[seg].addChild(this._egg(x % 4 - 2, y));
    }
  }
  _egg(x, y) {
    const g = new Graphics();
    g.circle(x, y, 0.9);
    g.fill({ color: 0xe0a83c, alpha: 0.92 });
    g.circle(x - 0.3, y - 0.3, 0.3);
    g.fill({ color: 0xfff0c0, alpha: 0.7 });
    return g;
  }

  update(t) {
    const s = this.s;
    const active = s.activityState;
    const af = (s.animFrame ?? 0);

    // Abdomen curl: dart tucks hard, forage arches down, rest relaxes.
    let curlBase, undAmp, undFreq;
    switch (active) {
      case 'dart_escape':
        curlBase = 0.34; undAmp = 0.10; undFreq = 18; break;
      case 'slow_swim':
      case 'social_avoid_pass':
        curlBase = 0.10; undAmp = 0.06; undFreq = 7; break;
      case 'substrate_forage':
      case 'hardscape_graze':
        curlBase = 0.16; undAmp = 0.03; undFreq = 4; break;
      default:
        curlBase = 0.06; undAmp = 0.02; undFreq = 2; break;
    }
    for (let i = 1; i < this.segs.length; i++) {
      const u = Math.sin(t * undFreq + this.phase - i * 0.6) * undAmp;
      this.segs[i].rotation = curlBase * (i / this.segs.length) + u;
    }

    // Head tips down a touch when grazing the substrate.
    const grazing = active === 'substrate_forage';
    this.body.rotation = grazing ? 0.12 : 0.0;

    // Legs: picking motion strongest while foraging (driven by pickY).
    const pick = (s.pickY ?? 0) * 6 + (grazing ? 0.4 : 0.08);
    for (let i = 0; i < this.legs.length; i++) {
      const L = this.legs[i];
      L.pivot.rotation = L.base + Math.sin(t * 9 + i * 1.1 + this.phase) * pick;
    }
    // Pleopods beat when swimming.
    const beat = (active === 'slow_swim' || active === 'dart_escape') ? 0.5 : 0.12;
    for (const p of this.pleopods) {
      p.pivot.rotation = Math.sin(t * 10 + p.phase) * beat;
    }

    this._drawAntennae(t);
  }

  destroy() {
    this.node.destroy({ children: true });
  }
}
