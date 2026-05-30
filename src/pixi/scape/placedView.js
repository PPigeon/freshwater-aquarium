import { Container, Graphics } from 'pixi.js';
import { ASSET_DEFS } from '../assetDefs.js';
import { makePlacedArt, animatePlantArt } from '../art/spriteFactory.js';

const FLOATING = new Set(['floating_salvinia', 'floating_redroot']);

// Maps the simulation's placedAssets array onto procedural Pixi views, sorted
// into the back/plant/front layers. Reconciles every frame (cheap for ~20
// items) so placement edits, drags, adds and removes reflect live without the
// orchestrator wiring every mutation. Also draws the editor selection box.
export class PlacedView {
  constructor(layers, art) {
    this.layers = layers;
    this.art = art;
    this.assets = [];
    this.entries = new Map();        // id -> { asset, node, sway, kind, sig }
    this.selection = new Graphics();
    this.layers.overlay.addChild(this.selection);
  }

  sync(placedAssets) {
    this.assets = placedAssets || [];
    this._reconcile();
  }

  _layerFor(asset, def) {
    if (def.layer === 'plant') return this.layers.plants;
    return (asset.depth ?? 'mid') === 'back' ? this.layers.hardscapeBack : this.layers.hardscapeFront;
  }

  _signature(asset) {
    // Rebuild geometry only when something structural changes.
    return `${asset.key}|${asset.depth ?? 'mid'}|${asset.flip ? 1 : 0}`;
  }

  _build(asset, def) {
    return makePlacedArt(this.art, def, asset);
  }

  _reconcile() {
    const seen = new Set();
    for (const asset of this.assets) {
      const def = ASSET_DEFS[asset.key];
      if (!def) continue;
      seen.add(asset.id);
      const sig = this._signature(asset);
      let entry = this.entries.get(asset.id);
      if (!entry || entry.sig !== sig) {
        if (entry) entry.node.parent?.removeChild(entry.node);
        const built = this._build(asset, def);
        built.node.zIndex = 0;
        this._layerFor(asset, def).addChild(built.node);
        entry = { ...built, sig };
        this.entries.set(asset.id, entry);
      }
      entry.asset = asset;
    }
    // Remove stale entries.
    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) {
        entry.node.parent?.removeChild(entry.node);
        entry.node.destroy({ children: true });
        this.entries.delete(id);
      }
    }
  }

  update(t, state) {
    this._reconcile();

    for (const entry of this.entries.values()) {
      const a = entry.asset;
      const def = ASSET_DEFS[a.key];
      if (!def) continue;
      const sc = a.scale ?? def.defaultScale ?? 1;
      const flip = a.flip ? -1 : 1;
      entry.node.x = a.x;
      entry.node.y = a.y;
      entry.node.rotation = ((a.rotation ?? 0) * Math.PI) / 180;
      if (entry.kind === 'plant') {
        entry.node.scale.set(sc * flip, sc);
        if (entry.sway) animatePlantArt(entry.sway, t + (a.x * 0.03));
      } else {
        entry.node.scale.set(sc * flip, sc);
      }
    }

    this._drawSelection(state);
  }

  _drawSelection(state) {
    const g = this.selection;
    g.clear();
    const id = state.selectedAssetId;
    if (!id) return;
    const asset = this.assets.find(a => a.id === id);
    if (!asset) return;
    const def = ASSET_DEFS[asset.key];
    if (!def) return;
    const sc = asset.scale ?? def.defaultScale ?? 1;
    const w = def.w * sc, h = def.h * sc;
    let top, bottom;
    if (FLOATING.has(asset.key)) { top = asset.y; bottom = asset.y + h; }
    else { top = asset.y - h; bottom = asset.y; }
    const left = asset.x - w / 2, right = asset.x + w / 2;
    const invalid = (state.invalidAssetIds || []).includes(id);
    const col = invalid ? 0xff5a5a : 0x7fd4ff;

    g.rect(left, top, right - left, bottom - top);
    g.stroke({ width: 0.8, color: col, alpha: 0.95 });
    // corner handles
    for (const [hx, hy] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
      g.rect(hx - 1, hy - 1, 2, 2);
      g.fill({ color: col, alpha: 0.9 });
    }
  }
}
