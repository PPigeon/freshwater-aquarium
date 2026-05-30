import { Container, Graphics } from 'pixi.js';
import { mixColor } from '../constants.js';

// Slim neon-tetra rig. Head toward +x. Body is static; the tail is a child
// container that flicks (skew/rotation) from the boid's turn + speed. Drawn in
// rig units (~12 long); creatureLayer scales/places/faces it.

const TONES = [
  { body: 0xbfcfd6, stripe: 0x2fa6c8, belly: 0xd0463a }, // classic neon
  { body: 0xc6d2d0, stripe: 0x36b0a0, belly: 0xc23a3a }, // green cast
  { body: 0xc9c6d6, stripe: 0x4a82c8, belly: 0xc24a6a }, // violet cast
];

export class FishRig {
  constructor(tone = 0) {
    const T = TONES[tone % TONES.length];
    this.node = new Container();
    const body = new Graphics();
    // body (fusiform)
    body.moveTo(6, 0);
    body.quadraticCurveTo(2, -3.4, -4, -1.8);
    body.quadraticCurveTo(-5.5, 0, -4, 1.8);
    body.quadraticCurveTo(2, 3.4, 6, 0);
    body.fill({ color: T.body });
    // dorsal shade
    body.moveTo(6, 0);
    body.quadraticCurveTo(2, -3.4, -4, -1.8);
    body.quadraticCurveTo(0, -1.2, 6, 0);
    body.fill({ color: mixColor(T.body, 0x000000, 0.25), alpha: 0.5 });
    // neon lateral stripe
    body.moveTo(5, -0.3);
    body.quadraticCurveTo(0, -1.2, -3.6, -0.6);
    body.lineTo(-3.6, 0.4);
    body.quadraticCurveTo(0, 0.0, 5, 0.5);
    body.fill({ color: T.stripe, alpha: 0.92 });
    // red belly flash (rear half)
    body.moveTo(0, 0.6);
    body.quadraticCurveTo(-2.4, 1.6, -3.8, 1.4);
    body.quadraticCurveTo(-2.0, 2.2, 0.4, 1.4);
    body.fill({ color: T.belly, alpha: 0.85 });
    // eye
    body.circle(4.4, -0.6, 0.7);
    body.fill({ color: 0x0a0a0c });
    body.circle(4.6, -0.8, 0.25);
    body.fill({ color: 0xffffff, alpha: 0.85 });
    this.node.addChild(body);

    // tail (caudal fin) as a flicking child anchored at the body rear
    this.tail = new Container();
    this.tail.x = -4;
    const tg = new Graphics();
    tg.moveTo(0, 0);
    tg.lineTo(-4, -3.2);
    tg.lineTo(-3, 0);
    tg.lineTo(-4, 3.2);
    tg.closePath();
    tg.fill({ color: mixColor(T.body, T.stripe, 0.4), alpha: 0.9 });
    this.tail.addChild(tg);
    this.node.addChild(this.tail);

    this.phase = Math.random() * Math.PI * 2;
  }

  // speed = |v|, turn = signed lateral accel proxy
  update(t, speed = 3, turn = 0) {
    const flick = Math.sin(t * (6 + speed * 0.8) + this.phase) * (0.25 + speed * 0.04);
    this.tail.rotation = flick + turn * 0.1;
  }

  destroy() { this.node.destroy({ children: true }); }
}
