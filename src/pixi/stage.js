import {
  Application, Container, ColorMatrixFilter, Point,
} from 'pixi.js';
import { GW, GH, clamp } from './constants.js';
import { Atmosphere } from './atmosphere.js?v=21';
import { PlacedView } from './scape/placedView.js?v=19';
import { CreatureLayer } from './creatures/creatureLayer.js';
import { ParticleLayer } from './particles.js?v=19';
import { loadArtRegistry } from './art/registry.js?v=19';

// PixiStage owns the WebGL Application, the world transform (grid-units -> screen),
// the ordered layer stack, and all rendering subsystems. main.js talks to it
// through a small high-level API and never touches Pixi directly.
export class PixiStage {
  constructor() {
    this.app = new Application();
    this.world = new Container();
    this.scene = new Container();   // colour-graded gameplay layers
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.baseScale = 1;
    this.layers = {};
    this._ready = false;
    this._perf = {
      fps: 60,
      ms: 16.7,
      frameCounter: 0,
      lastStamp: 0,
      accumulator: 0,
      enabled: false,
    };
  }

  async init(canvas) {
    await this.app.init({
      canvas,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      resizeTo: window,
      backgroundAlpha: 0,           // body CSS provides the "room" void
      preference: 'webgl',
    });

    this.app.stage.addChild(this.world);
    this.world.addChild(this.scene);

    // Ordered layer stack (back -> front). Scene layers are colour graded.
    const sceneOrder = [
      'waterBack', 'substrate', 'caustics',
      'hardscapeBack', 'plants', 'hardscapeFront',
      'substrateCap',
      'creatures', 'particles', 'foodLayer',
      'lightCone', 'glassFX', 'depthHaze', 'vignette',
    ];
    for (const name of sceneOrder) {
      const c = new Container();
      this.layers[name] = c;
      this.scene.addChild(c);
    }
    // Ungraded framing + editor overlay sit on top of the world.
    for (const name of ['bezel', 'overlay']) {
      const c = new Container();
      this.layers[name] = c;
      this.world.addChild(c);
    }

    // Gentle aquarium grade on the gameplay scene only. Keep this restrained so
    // the authored pixel silhouettes stay crisp and readable.
    this.grade = new ColorMatrixFilter();
    this.grade.saturate(0.06, true);
    this.grade.contrast(0.03, true);
    this.scene.filters = [this.grade];

    // Subsystems
    this.art = await loadArtRegistry();
    this.atmosphere = new Atmosphere(this.app, this.layers, this.art);
    this.placed = new PlacedView(this.layers, this.art);
    this.creatures = new CreatureLayer(this.layers, this.art);
    this.particles = new ParticleLayer(this.layers, this.art);

    // Force the renderer to match the viewport up-front (some browsers don't
    // fire resizeTo's initial pass before first paint), then keep it synced.
    this._resizeRenderer();
    this.layout();
    window.addEventListener('resize', () => { this._resizeRenderer(); this.layout(); });
    this._ready = true;

    if (typeof window !== 'undefined') {
      window.__stage = this;
      window.__artDiagnostics = this.art?.diagnostics ?? [];
      const perfOn = new URLSearchParams(window.location.search).has('perf');
      this._perf.enabled = perfOn;
      window.__perf = this._perf;
    }
  }

  _resizeRenderer() {
    const w = window.innerWidth, h = window.innerHeight;
    this.app.renderer.resize(w, h);
  }

  layout() {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    this.baseScale = Math.min(sw / GW, sh / GH);
    const s = this.baseScale * this.zoom;
    this.world.scale.set(s);
    this.world.x = Math.round((sw - GW * s) / 2 + this.pan.x);
    this.world.y = Math.round((sh - GH * s) / 2 + this.pan.y);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const p = this.world.toLocal(new Point(sx, sy));
    return { gx: p.x, gy: p.y };
  }

  zoomAt(clientX, clientY, factor) {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wp = this.world.toLocal(new Point(sx, sy));
    this.zoom = clamp(this.zoom * factor, 0.6, 4);
    const s = this.baseScale * this.zoom;
    this.world.scale.set(s);
    this.world.x = Math.round(sx - wp.x * s);
    this.world.y = Math.round(sy - wp.y * s);
    // Re-derive pan so a later resize keeps roughly the same framing.
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.pan.x = this.world.x - (sw - GW * s) / 2;
    this.pan.y = this.world.y - (sh - GH * s) / 2;
  }

  // Rebuild placed-asset views when the scape changes (add/remove/preset swap).
  setScape(placedAssets) {
    if (!this._ready) return;
    this.placed.sync(placedAssets);
  }

  // Per-frame update. `state` mirrors what the old renderer.draw received.
  frame(state) {
    if (!this._ready) return;
    const t = state.time;
    this._tickPerf(t);
    this.atmosphere.update(t, state);
    this.placed.update(t, state);
    this.creatures.update(t, state);
    this.particles.update(t, state);
  }

  _tickPerf(timeSec) {
    const p = this._perf;
    if (!p.enabled) return;
    if (!p.lastStamp) {
      p.lastStamp = timeSec;
      return;
    }
    const dt = Math.max(0.0001, timeSec - p.lastStamp);
    p.lastStamp = timeSec;
    p.ms = dt * 1000;
    p.frameCounter += 1;
    p.accumulator += dt;
    if (p.accumulator >= 0.5) {
      p.fps = p.frameCounter / p.accumulator;
      p.frameCounter = 0;
      p.accumulator = 0;
    }
  }
}
