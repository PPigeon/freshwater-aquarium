import { loadAssets, VARIANT_COLORS } from './assets.js';
import { Simulation } from './simulation.js';
import { initShrimp } from './shrimp.js';
import { ASSET_DEFS } from './pixi/assetDefs.js?v=19';
import { SUBSTRATE_Y, WATERLINE_Y } from './pixi/constants.js';
import { PixiStage } from './pixi/stage.js?v=19';
import { SCAPE_PRESETS, REVIEW_URLS, clonePresetAssets } from './scapes.js?v=19';

const CANVAS_W = 280;
const CANVAS_H = 156;
const PLACED_KEY = 'aquarium_placed_assets_v7';   // legacy, read once for migration
const SCAPES_KEY = 'aquarium_scapes_v6';           // [{id, name, presetSource?, assets, createdAt, modifiedAt}]
const ACTIVE_SCAPE_KEY = 'aquarium_active_scape_v6';
const SCAPE_KEY = 'aquarium_current_scape_v6';     // legacy, only for first-time detection
const LIGHTING_KEY = 'aquarium_lighting_v1';
const LIGHTING_SETTINGS_KEY = 'aquarium_lighting_settings_v1';
const BACKGROUND_KEY = 'aquarium_background_v1';
const TOOLBOX_COLLAPSED_KEY = 'aquarium_toolbox_collapsed_v1';
const REVIEW_PARAMS = new URLSearchParams(window.location.search);
const REVIEW_PRESET = REVIEW_PARAMS.get('review');
const REVIEW_MODE = !!(REVIEW_PRESET && SCAPE_PRESETS[REVIEW_PRESET]);
// Legacy fallback array kept inline for safety if scapes.js fails to import.
// In normal operation, placedAssets is populated from a SCAPE_PRESETS preset.
const DEFAULT_ASSETS = [
  // Iwagumi-style stone cluster, all leaning toward the focal point (golden ratio at x≈107)
  { id: 'base_stone_sm_b',  key: 'stone_seiryu_sm', x: 24,  y: SUBSTRATE_Y - 1, scale: 0.85, rotation: -4,  flip: true },
  { id: 'base_stone_lg',    key: 'stone_seiryu_lg', x: 90,  y: SUBSTRATE_Y,     scale: 1.00, rotation: -2,  flip: false },
  { id: 'base_stone_sm_a',  key: 'stone_seiryu_sm', x: 62,  y: SUBSTRATE_Y,     scale: 0.95, rotation: 2,   flip: false },
  { id: 'base_stone_dragon',key: 'stone_dragon',    x: 78,  y: SUBSTRATE_Y,     scale: 0.62, rotation: -3,  flip: false },
  // Manzanita centerpiece — leans up-right from the main rock base
  { id: 'base_wood_main',   key: 'wood_manzanita',  x: 130, y: SUBSTRATE_Y + 6, scale: 0.55, rotation: 0,   flip: false },
  // Smaller spider wood off to the side filling the right-low gap
  { id: 'base_wood_side',   key: 'wood_redmoor',    x: 178, y: SUBSTRATE_Y + 2, scale: 0.42, rotation: 0,   flip: false },
  // Plants on hardscape
  { id: 'base_fern_lg',     key: 'java_fern',       x: 108, y: SUBSTRATE_Y - 4, scale: 0.70, rotation: 0,   flip: false },
  { id: 'base_fern_sm',     key: 'java_fern',       x: 96,  y: SUBSTRATE_Y - 6, scale: 0.48, rotation: -6,  flip: true },
  { id: 'base_moss',        key: 'moss',            x: 128, y: SUBSTRATE_Y - 14,scale: 0.62, rotation: -4,  flip: false },
  { id: 'base_anubias_a',   key: 'anubias',         x: 58,  y: SUBSTRATE_Y - 3, scale: 0.82, rotation: 0,   flip: false },
  { id: 'base_anubias_b',   key: 'anubias',         x: 86,  y: SUBSTRATE_Y - 4, scale: 0.70, rotation: 0,   flip: true },
  // Background stems on right side
  { id: 'base_rotala_a',    key: 'rotala_full',     x: 168, y: SUBSTRATE_Y,     scale: 1.0,  rotation: 0,   flip: false },
  { id: 'base_rotala_b',    key: 'rotala_small',    x: 182, y: SUBSTRATE_Y,     scale: 0.95, rotation: 0,   flip: false },
  { id: 'base_rotala_c',    key: 'rotala_mid',      x: 196, y: SUBSTRATE_Y,     scale: 1.0,  rotation: 0,   flip: false },
  { id: 'base_val_a',       key: 'vallisneria',     x: 215, y: SUBSTRATE_Y,     scale: 0.72, rotation: 0,   flip: false },
  { id: 'base_val_b',       key: 'vallisneria',     x: 232, y: SUBSTRATE_Y,     scale: 0.60, rotation: 0,   flip: true },
  { id: 'base_crypt',       key: 'crypt',           x: 150, y: SUBSTRATE_Y,     scale: 0.66, rotation: 0,   flip: false },
];
let scapes = [];
let activeScapeId = null;
const placedAssets = loadPlacedAssets();
let activeTool = 'food';
let activeWorkspace = 'scene';
let switchWorkspace = () => {};
let lightingMode = REVIEW_PARAMS.get('lighting') || localStorage.getItem(LIGHTING_KEY) || 'daylight';
if (lightingMode !== 'daylight' && lightingMode !== 'night') lightingMode = 'daylight';
let backgroundMode = REVIEW_PARAMS.get('background') || localStorage.getItem(BACKGROUND_KEY) || 'frosted';
const lightingSettings = loadLightingSettings();
let selectedAssetId = null;
let dragState = null;
const invalidAssetIds = new Set();
const compositionOverlays = { goldenRatio: false, triangle: false };
const ROOTED_PLANTS = new Set(['rotala_small', 'rotala_mid', 'rotala_full', 'vallisneria', 'crypt', 'buce', 'carpet']);
const EPIPHYTE_PLANTS = new Set(['java_fern', 'anubias', 'moss']);
const FLOATING_PLANTS = new Set(['floating_salvinia', 'floating_redroot']);
const ROOTED_ANCHOR_Y = SUBSTRATE_Y;
const HARDSCAPE_ANCHOR_Y = SUBSTRATE_Y + 1;
const FLOATING_ANCHOR_Y = WATERLINE_Y + 1;

const ASSET_KEY_MIGRATIONS = {
  driftwood: 'wood_malaysian',
  driftwood_spider: 'wood_spider',
  driftwood_mopani: 'wood_mopani',
  driftwood_root: 'wood_redmoor',
  rock_lg: 'stone_seiryu_lg',
  rock_sm: 'stone_seiryu_sm',
  dragon_stone: 'stone_dragon',
  lava_rock: 'stone_lava',
  slate: 'stone_frodo',
};

const PRESET_ID_MIGRATIONS = {
  jungle: 'nature',
  empty: 'iwagumi',
  hd2d_slice: 'fmv_slice',
};

function seededRandom(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return t / 4294967296;
  };
}

function installReviewSeed() {
  const seed = REVIEW_PARAMS.get('seed');
  if (!seed) return;
  Math.random = seededRandom(seed);
}

function applyReviewPreset() {
  if (!REVIEW_MODE) return;
  placedAssets.splice(0, placedAssets.length, ...clonePresetAssets(REVIEW_PRESET));
  selectedAssetId = null;
  activeScapeId = `review_${REVIEW_PRESET}`;
}

function normalizeAsset(asset) {
  return {
    ...asset,
    key: ASSET_KEY_MIGRATIONS[asset.key] ?? asset.key,
    depth: asset.depth ?? 'mid',
  };
}

// ─── Bubble system ────────────────────────────────────────────
const bubbles = [];
const MAX_BUBBLES = 12;

function spawnBubble() {
  if (bubbles.length >= MAX_BUBBLES) return;
  bubbles.push({
    x: 10 + Math.random() * (CANVAS_W - 20),
    y: SUBSTRATE_Y - 4,
    vy: -(4 + Math.random() * 6),    // grid units/s upward
    alpha: 0.6 + Math.random() * 0.4,
    size: 2 + Math.floor(Math.random() * 3),
    frame: Math.floor(Math.random() * 3),
    frameTimer: 0,
  });
}

function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y += b.vy * dt;
    b.frameTimer += dt;
    if (b.frameTimer > 0.3) { b.frameTimer = 0; b.frame = (b.frame + 1) % 3; }
    b.alpha -= dt * 0.04;
    if (b.y < 2 || b.alpha <= 0) bubbles.splice(i, 1);
  }
  if (Math.random() < dt * 0.4) spawnBubble();
}

// ─── Food particles ───────────────────────────────────────────
const foodParticles = [];
const FOOD_FALL_SPEED = 8;  // grid units/s

function dropFood(gx, gy) {
  foodParticles.push({
    x: gx, y: 2,
    targetY: gy,
    alpha: 1.0,
    lifeTimer: 0,
    lifetime: 60,  // seconds on the ground before despawning
    settled: false,
  });
}

function updateFood(dt) {
  for (let i = foodParticles.length - 1; i >= 0; i--) {
    const f = foodParticles[i];
    if (!f.settled) {
      f.y += FOOD_FALL_SPEED * dt;
      if (f.y >= f.targetY) {
        f.y = f.targetY;
        f.settled = true;
      }
    } else {
      f.lifeTimer += dt;
      if (f.lifeTimer > f.lifetime - 10) {
        f.alpha = Math.max(0, 1 - (f.lifeTimer - (f.lifetime - 10)) / 10);
      }
      if (f.lifeTimer >= f.lifetime) {
        foodParticles.splice(i, 1);
      }
    }
  }
}

// ─── Multi-scape slot storage ─────────────────────────────────
// Schema: SCAPES_KEY = [{ id, name, presetSource?, assets, createdAt, modifiedAt }]
function loadScapeSlots() {
  const ensurePresetSlots = (slots) => {
    const haveNature = slots.some(s => s.presetSource === 'nature');
    const haveIwagumi = slots.some(s => s.presetSource === 'iwagumi');
    const now = Date.now();
    if (!haveNature) {
      slots.push({
        id: `scape_${now}_nature`,
        name: SCAPE_PRESETS.nature?.name ?? 'Nature Aquarium',
        presetSource: 'nature',
        assets: clonePresetAssets('nature'),
        createdAt: now,
        modifiedAt: now,
      });
    }
    if (!haveIwagumi) {
      slots.push({
        id: `scape_${now}_iwagumi`,
        name: SCAPE_PRESETS.iwagumi?.name ?? 'Iwagumi',
        presetSource: 'iwagumi',
        assets: clonePresetAssets('iwagumi'),
        createdAt: now,
        modifiedAt: now,
      });
    }
    return slots;
  };

  try {
    const raw = JSON.parse(localStorage.getItem(SCAPES_KEY) || 'null');
    if (Array.isArray(raw) && raw.length) {
      const normalized = raw.map(s => {
        const presetSource = PRESET_ID_MIGRATIONS[s.presetSource] ?? s.presetSource;
        let assets = (s.assets || []).map((a, i) => normalizeAsset({
          ...a,
          id: a.id ?? `asset_restored_${i}_${Date.now()}`,
          rotation: a.rotation ?? 0,
        }));
        const slotName = String(s.name || '').toLowerCase();
        const inferredPreset =
          presetSource
          || (slotName.includes('iwagumi') ? 'iwagumi'
            : (slotName.includes('nature') ? 'nature' : null));
        const isPreset = inferredPreset === 'nature' || inferredPreset === 'iwagumi';
        const hasFloaters = assets.some(a => a.key === 'floating_salvinia' || a.key === 'floating_redroot');
        if (isPreset) {
          // Keep preset slots visually complete and always include floaters.
          assets = hasFloaters ? assets : clonePresetAssets(inferredPreset);
          for (const a of assets) {
            if (a.key === 'floating_salvinia' || a.key === 'floating_redroot') {
              a.y = FLOATING_ANCHOR_Y;
              a.depth = 'front';
            }
          }
        }
        return {
        ...s,
        presetSource: inferredPreset,
        assets,
      }});
      return ensurePresetSlots(normalized);
    }
  } catch {}
  const now = Date.now();
  return ensurePresetSlots([
    {
      id: `scape_${now}_nature_seed`,
      name: SCAPE_PRESETS.nature?.name ?? 'Nature Aquarium',
      presetSource: 'nature',
      assets: clonePresetAssets('nature'),
      createdAt: now,
      modifiedAt: now,
    },
  ]);
}

function saveScapeSlots() {
  try {
    localStorage.setItem(SCAPES_KEY, JSON.stringify(scapes));
    localStorage.setItem(ACTIVE_SCAPE_KEY, activeScapeId || '');
  } catch {}
}

function activeScape() {
  return scapes.find(s => s.id === activeScapeId) ?? null;
}

function loadPlacedAssets() {
  // Returns the active scape's assets (or empty if no slots exist yet).
  scapes = loadScapeSlots();
  activeScapeId = localStorage.getItem(ACTIVE_SCAPE_KEY) || (scapes[0]?.id ?? null);
  if (!scapes.find(s => s.id === activeScapeId)) {
    activeScapeId = scapes[0]?.id ?? null;
  }
  const slot = activeScape();
  return slot ? slot.assets.map(a => ({ ...a })) : [];
}

function savePlacedAssets() {
  // Write through to the active scape slot.
  const slot = activeScape();
  if (slot) {
    slot.assets = placedAssets.map(a => ({ ...a }));
    slot.modifiedAt = Date.now();
  }
  saveScapeSlots();
  // Back-compat: also keep legacy PLACED_KEY in sync so older logic still works.
  try { localStorage.setItem(PLACED_KEY, JSON.stringify(placedAssets)); } catch {}
}

function createScapeSlot({ name, presetSource = null, assets = [] }) {
  const slot = {
    id: `scape_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: name || 'New Scape',
    presetSource,
    assets: assets.map(a => ({ ...a })),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  scapes.push(slot);
  return slot;
}

function setActiveScapeId(id) {
  if (!scapes.find(s => s.id === id)) return;
  activeScapeId = id;
  const fresh = (activeScape()?.assets || []).map(a => ({ ...a }));
  placedAssets.splice(0, placedAssets.length, ...fresh);
  sanitizePlacedAssets();
  selectedAssetId = null;
  saveScapeSlots();
  if (typeof updateInspector === 'function') updateInspector();
  if (typeof refreshScapeSelector === 'function') refreshScapeSelector();
}

// ─── Undo/redo history (in-memory, capped) ───────────────────
const history = { undo: [], redo: [], max: 50 };

function snapshotAssets() {
  return placedAssets.map(a => ({ ...a }));
}

function pushHistory() {
  history.undo.push(snapshotAssets());
  if (history.undo.length > history.max) history.undo.shift();
  history.redo.length = 0;
}

function restoreSnapshot(snap) {
  placedAssets.splice(0, placedAssets.length, ...snap);
  sanitizePlacedAssets();
  selectedAssetId = null;
  savePlacedAssets();
  if (typeof updateInspector === 'function') updateInspector();
}

function undo() {
  if (history.undo.length === 0) return;
  history.redo.push(snapshotAssets());
  if (history.redo.length > history.max) history.redo.shift();
  restoreSnapshot(history.undo.pop());
}

function redo() {
  if (history.redo.length === 0) return;
  history.undo.push(snapshotAssets());
  if (history.undo.length > history.max) history.undo.shift();
  restoreSnapshot(history.redo.pop());
}

// ─── Scape preset picker ──────────────────────────────────────
function applyScapePreset(presetId, { createNewSlot = false } = {}) {
  pushHistory();
  const fresh = clonePresetAssets(presetId);
  const presetName = SCAPE_PRESETS[presetId]?.name || 'New Scape';
  if (createNewSlot || !activeScape()) {
    // Create a new slot for this preset
    const slot = createScapeSlot({
      name: uniqueScapeName(presetName),
      presetSource: presetId,
      assets: fresh,
    });
    activeScapeId = slot.id;
  } else {
    // Replace current slot's content
    const slot = activeScape();
    slot.assets = fresh.map(a => ({ ...a }));
    slot.presetSource = presetId;
    slot.modifiedAt = Date.now();
  }
  placedAssets.splice(0, placedAssets.length, ...fresh);
  sanitizePlacedAssets();
  selectedAssetId = null;
  localStorage.setItem(SCAPE_KEY, presetId);
  savePlacedAssets();
  if (typeof updateInspector === 'function') updateInspector();
  if (typeof refreshScapeSelector === 'function') refreshScapeSelector();
}

function uniqueScapeName(base) {
  const existing = new Set(scapes.map(s => s.name));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function saveAsNewScape() {
  const defaultName = uniqueScapeName(activeScape()?.name ? `${activeScape().name} copy` : 'My Scape');
  const name = (window.prompt('Name for this scape:', defaultName) || '').trim();
  if (!name) return;
  const slot = createScapeSlot({
    name: uniqueScapeName(name),
    presetSource: activeScape()?.presetSource ?? null,
    assets: placedAssets,
  });
  activeScapeId = slot.id;
  saveScapeSlots();
  refreshScapeSelector();
}

function deleteActiveScape() {
  if (scapes.length <= 1) return; // keep at least one
  const idx = scapes.findIndex(s => s.id === activeScapeId);
  if (idx < 0) return;
  if (!window.confirm(`Delete scape "${scapes[idx].name}"?`)) return;
  scapes.splice(idx, 1);
  activeScapeId = scapes[0]?.id ?? null;
  const fresh = (activeScape()?.assets || []).map(a => ({ ...a }));
  placedAssets.splice(0, placedAssets.length, ...fresh);
  saveScapeSlots();
  refreshScapeSelector();
}

let refreshScapeSelector = () => {};

function showScapePicker(allowCancel = false) {
  const modal = document.getElementById('scape-modal');
  const grid  = document.getElementById('scape-presets');
  const cancel = document.getElementById('scape-modal-cancel');
  if (!modal || !grid) return;

  // When the picker is opened *after* startup (user clicks "New Scape"),
  // selecting a preset creates a NEW slot so existing scapes are preserved.
  const createNewSlot = allowCancel;

  grid.innerHTML = '';
  for (const [id, preset] of Object.entries(SCAPE_PRESETS)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'preset-card';
    card.dataset.preset = id;
    const name = document.createElement('div');
    name.className = 'preset-name';
    name.textContent = preset.name;
    const blurb = document.createElement('div');
    blurb.className = 'preset-blurb';
    blurb.textContent = preset.blurb;
    card.appendChild(name);
    card.appendChild(blurb);
    card.addEventListener('click', () => {
      applyScapePreset(id, { createNewSlot });
      hideScapePicker();
    });
    grid.appendChild(card);
  }

  cancel.hidden = !allowCancel;
  if (allowCancel) {
    cancel.onclick = hideScapePicker;
  }
  modal.classList.remove('hidden');
}

function hideScapePicker() {
  const modal = document.getElementById('scape-modal');
  if (modal) modal.classList.add('hidden');
}

function loadLightingSettings() {
  try {
    return {
      x: 0.52,
      intensity: 1,
      ...JSON.parse(localStorage.getItem(LIGHTING_SETTINGS_KEY) || '{}'),
    };
  } catch {
    return { x: 0.52, intensity: 1 };
  }
}

function saveLightingSettings() {
  localStorage.setItem(LIGHTING_SETTINGS_KEY, JSON.stringify(lightingSettings));
}

function placeAsset(key, gx, gy) {
  const def = ASSET_DEFS[key];
  if (!def) return;
  const isRootedPlant = ROOTED_PLANTS.has(key);
  const isFloatingPlant = FLOATING_PLANTS.has(key);
  const substrateAnchor = isRootedPlant
    ? ROOTED_ANCHOR_Y
    : isFloatingPlant
      ? FLOATING_ANCHOR_Y
    : (def.layer === 'hardscape'
      ? Math.min(HARDSCAPE_ANCHOR_Y, Math.max(48, gy))
      : Math.min(SUBSTRATE_Y - 3, Math.max(34, gy)));
  pushHistory();
  const n = placedAssets.length;
  const baseScale = def.defaultScale ?? 0.8;
  const scale = def.layer === 'plant'
    ? baseScale * (0.85 + Math.random() * 0.33)
    : baseScale;
  const asset = {
    id: `asset_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    key,
    x: Math.max(8, Math.min(CANVAS_W - 8, gx)),
    y: substrateAnchor,
    scale,
    rotation: key.startsWith('wood_') ? [-8, -4, 0, 5, 8][n % 5] : 0,
    flip: n % 2 === 1,
    depth: def.layer === 'plant' ? 'back' : 'mid',
  };
  const snapped = findNearestValidPlacement(asset, null);
  if (!snapped) return;
  Object.assign(asset, snapped);
  placedAssets.push(asset);
  selectedAssetId = asset.id;
  savePlacedAssets();
  updateInspector();
  return asset;
}

function selectedAsset() {
  return placedAssets.find(a => a.id === selectedAssetId) ?? null;
}

function selectAsset(asset) {
  selectedAssetId = asset?.id ?? null;
  if (asset) setActiveTool('select');
  if (asset) switchWorkspace('selected');
  updateInspector();
}

function mutateSelected(fn) {
  const asset = selectedAsset();
  if (!asset) return;
  pushHistory();
  const before = { ...asset };
  fn(asset);
  asset.x = Math.max(0, Math.min(CANVAS_W, asset.x));
  if (ROOTED_PLANTS.has(asset.key)) {
    asset.y = ROOTED_ANCHOR_Y;
  } else if (FLOATING_PLANTS.has(asset.key)) {
    asset.y = FLOATING_ANCHOR_Y;
  } else if (ASSET_DEFS[asset.key]?.layer === 'hardscape') {
    asset.y = Math.max(16, Math.min(HARDSCAPE_ANCHOR_Y, asset.y));
  } else {
    asset.y = Math.max(16, Math.min(SUBSTRATE_Y + 2, asset.y));
  }
  asset.scale = Math.max(0.5, Math.min(1.4, asset.scale ?? 1));
  asset.rotation = Math.round(((asset.rotation ?? 0) + 360) % 360);
  const valid = validateAssetPlacement(asset, asset.id);
  if (!valid.ok) {
    const snapped = findNearestValidPlacement(asset, asset.id);
    if (snapped) {
      Object.assign(asset, snapped);
    } else {
      Object.assign(asset, before);
    }
  }
  savePlacedAssets();
  updateInspector();
}

function deleteSelected() {
  const idx = placedAssets.findIndex(a => a.id === selectedAssetId);
  if (idx >= 0) {
    pushHistory();
    placedAssets.splice(idx, 1);
    selectedAssetId = null;
    savePlacedAssets();
    updateInspector();
  }
}

function assetBounds(asset) {
  const def = ASSET_DEFS[asset.key];
  if (!def) return null;
  const scale = asset.scale ?? def.defaultScale ?? 1;
  const w = def.w * scale;
  const h = def.h * scale;
  if (FLOATING_PLANTS.has(asset.key)) {
    // Floating plants use a top anchor in renderer draw logic.
    return {
      left: asset.x - w / 2,
      right: asset.x + w / 2,
      top: asset.y,
      bottom: asset.y + h,
    };
  }
  return {
    left: asset.x - w / 2,
    right: asset.x + w / 2,
    top: asset.y - h,
    bottom: asset.y,
  };
}

function boundsOverlap(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function validateAssetPlacement(asset, ignoreId = null) {
  const def = ASSET_DEFS[asset.key];
  const b = assetBounds(asset);
  if (!def || !b) return { ok: false, reason: 'missing-def' };
  if (b.left < 2 || b.right > CANVAS_W - 2) return { ok: false, reason: 'tank-sides' };
  if (!FLOATING_PLANTS.has(asset.key) && b.top < 14) return { ok: false, reason: 'waterline' };
  if (FLOATING_PLANTS.has(asset.key)) {
    if (b.top < WATERLINE_Y - 1) return { ok: false, reason: 'surface-overlap' };
    if (b.top > WATERLINE_Y + 3) return { ok: false, reason: 'surface-miss' };
  }
  if (b.bottom > SUBSTRATE_Y + 2) return { ok: false, reason: 'below-substrate' };
  if (ROOTED_PLANTS.has(asset.key) && Math.abs(asset.y - ROOTED_ANCHOR_Y) > 1) {
    return { ok: false, reason: 'root-anchor' };
  }
  if (FLOATING_PLANTS.has(asset.key) && Math.abs(asset.y - FLOATING_ANCHOR_Y) > 2) {
    return { ok: false, reason: 'floating-anchor' };
  }
  if (ASSET_DEFS[asset.key]?.layer === 'hardscape' && asset.y > HARDSCAPE_ANCHOR_Y) {
    return { ok: false, reason: 'hardscape-anchor' };
  }
  return { ok: true };
}

function findNearestValidPlacement(asset, ignoreId = null) {
  const base = { ...asset };
  const steps = [0, 1, 2, 3, 4, 5, 7, 9, 12];
  for (const r of steps) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const candidate = {
          ...base,
          x: Math.max(2, Math.min(CANVAS_W - 2, Math.round(base.x + dx))),
          y: Math.max(14, Math.min(SUBSTRATE_Y + 2, Math.round(base.y + dy))),
        };
        if (ROOTED_PLANTS.has(candidate.key)) candidate.y = ROOTED_ANCHOR_Y;
        if (FLOATING_PLANTS.has(candidate.key)) candidate.y = FLOATING_ANCHOR_Y;
        if (ASSET_DEFS[candidate.key]?.layer === 'hardscape') {
          candidate.y = Math.min(candidate.y, HARDSCAPE_ANCHOR_Y);
        }
        if (validateAssetPlacement(candidate, ignoreId).ok) return candidate;
      }
    }
  }
  return null;
}

function sanitizePlacedAssets() {
  const existing = [...placedAssets];
  placedAssets.length = 0;
  for (const a of existing) {
    const normalized = { ...a };
    if (ROOTED_PLANTS.has(normalized.key)) normalized.y = ROOTED_ANCHOR_Y;
    if (FLOATING_PLANTS.has(normalized.key)) normalized.y = FLOATING_ANCHOR_Y;
    if (ASSET_DEFS[normalized.key]?.layer === 'hardscape') {
      normalized.y = Math.min(normalized.y, HARDSCAPE_ANCHOR_Y);
    }
    const snapped = findNearestValidPlacement({ ...normalized }, null);
    if (snapped) placedAssets.push({ ...normalized, ...snapped });
  }
}

function hitTestAsset(gx, gy) {
  for (let i = placedAssets.length - 1; i >= 0; i--) {
    const b = assetBounds(placedAssets[i]);
    if (b && gx >= b.left && gx <= b.right && gy >= b.top && gy <= b.bottom) {
      return placedAssets[i];
    }
  }
  return null;
}

function setActiveTool(tool) {
  activeTool = tool;
  if (tool === 'select') switchWorkspace('selected');
  else if (ASSET_DEFS[tool]) switchWorkspace('assets');
  else switchWorkspace('scene');
  document.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

function makePreviewCanvas(assets, def) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  canvas.className = 'tool-preview';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const img = assets[def.key];
  if (!img) return canvas;
  const sx = def.sx ?? 0;
  const sy = def.sy ?? 0;
  const sw = def.sw ?? def.w;
  const sh = def.sh ?? def.h;
  const scale = Math.min(30 / def.w, 22 / def.h);
  const dw = Math.max(1, Math.floor(def.w * scale));
  const dh = Math.max(1, Math.floor(def.h * scale));
  ctx.drawImage(img, sx, sy, sw, sh, Math.floor((32 - dw) / 2), Math.floor((24 - dh) / 2), dw, dh);
  return canvas;
}

function buildToolbox(assets) {
  const actions = document.getElementById('tool-actions');
  const lighting = document.getElementById('lighting-tools');
  const backgrounds = document.getElementById('background-tools');
  const hardscape = document.getElementById('hardscape-tools');
  const plants = document.getElementById('plant-tools');
  actions.innerHTML = '';
  lighting.innerHTML = '';
  backgrounds.innerHTML = '';
  hardscape.innerHTML = '';
  plants.innerHTML = '';

  // Saved-scape selector dropdown + Save As + Delete
  const scapeRow = document.createElement('div');
  scapeRow.className = 'scape-row';
  const scapeSelect = document.createElement('select');
  scapeSelect.id = 'scape-selector';
  scapeSelect.title = 'Switch between saved scapes';
  scapeSelect.addEventListener('change', () => setActiveScapeId(scapeSelect.value));
  const saveAsBtn = document.createElement('button');
  saveAsBtn.type = 'button';
  saveAsBtn.className = 'scape-row-btn';
  saveAsBtn.textContent = 'Save As';
  saveAsBtn.title = 'Save as new scape';
  saveAsBtn.addEventListener('click', saveAsNewScape);
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'scape-row-btn danger';
  delBtn.textContent = 'Delete';
  delBtn.title = 'Delete this scape (must keep at least one)';
  delBtn.addEventListener('click', deleteActiveScape);
  scapeRow.append(scapeSelect, saveAsBtn, delBtn);
  actions.appendChild(scapeRow);

  refreshScapeSelector = () => {
    scapeSelect.innerHTML = '';
    for (const s of scapes) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === activeScapeId) opt.selected = true;
      scapeSelect.appendChild(opt);
    }
    delBtn.disabled = scapes.length <= 1;
  };
  refreshScapeSelector();

  // "New Scape" button — opens preset picker (creates new slot)
  const newScapeBtn = document.createElement('button');
  newScapeBtn.type = 'button';
  newScapeBtn.className = 'tool-new-scape';
  newScapeBtn.textContent = '◆ New Scape';
  newScapeBtn.title = 'Pick a fresh preset layout — creates a new scape slot';
  newScapeBtn.addEventListener('click', () => showScapePicker(true));
  actions.appendChild(newScapeBtn);

  const actionTools = [
    { key: 'select', label: 'Select' },
    { key: 'food', label: 'Food' },
    { key: 'clear', label: 'Clear' },
  ];
  for (const item of actionTools) {
    const btn = document.createElement('button');
    btn.className = `tool action${item.key === activeTool ? ' active' : ''}`;
    btn.dataset.tool = item.key;
    btn.textContent = item.label;
    btn.title = item.key === 'select' ? 'Move and edit placed assets' : item.label;
    actions.appendChild(btn);
  }

  const lightTools = [
    { key: 'daylight', label: 'Day' },
    { key: 'night', label: 'Night' },
  ];
  for (const item of lightTools) {
    const btn = document.createElement('button');
    btn.className = `tool lighting${item.key === lightingMode ? ' active' : ''}`;
    btn.dataset.lighting = item.key;
    btn.textContent = item.label;
    btn.title = `${item.label} tank lighting`;
    lighting.appendChild(btn);
  }

  const backgroundTools = [
    { key: 'deep_blue', label: 'Blue' },
    { key: 'black', label: 'Black' },
    { key: 'frosted', label: 'Frosted' },
    { key: 'riverbank', label: 'River' },
  ];
  for (const item of backgroundTools) {
    const btn = document.createElement('button');
    btn.className = `tool lighting${item.key === backgroundMode ? ' active' : ''}`;
    btn.dataset.background = item.key;
    btn.textContent = item.label;
    btn.title = `${item.label} aquarium background`;
    backgrounds.appendChild(btn);
  }

  for (const [toolKey, def] of Object.entries(ASSET_DEFS)) {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.tool = toolKey;
    btn.title = def.label;
    btn.appendChild(makePreviewCanvas(assets, def));
    const label = document.createElement('span');
    label.textContent = def.label;
    btn.appendChild(label);
    (def.layer === 'plant' ? plants : hardscape).appendChild(btn);
  }

  document.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'clear') {
        pushHistory();
        placedAssets.splice(0, placedAssets.length);
        selectedAssetId = null;
        savePlacedAssets();
        updateInspector();
        return;
      }
      setActiveTool(tool);
    });
  });

  document.querySelectorAll('[data-lighting]').forEach(btn => {
    btn.addEventListener('click', () => {
      lightingMode = btn.dataset.lighting;
      localStorage.setItem(LIGHTING_KEY, lightingMode);
      document.querySelectorAll('[data-lighting]').forEach(el => {
        el.classList.toggle('active', el.dataset.lighting === lightingMode);
      });
    });
  });

  document.querySelectorAll('[data-background]').forEach(btn => {
    btn.addEventListener('click', () => {
      backgroundMode = btn.dataset.background;
      localStorage.setItem(BACKGROUND_KEY, backgroundMode);
      document.querySelectorAll('[data-background]').forEach(el => {
        el.classList.toggle('active', el.dataset.background === backgroundMode);
      });
    });
  });

  document.querySelectorAll('.menu-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.menu-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.toggle('active', el.id === `${tab}-panel`));
    });
  });

  const setWorkspace = (name) => {
    activeWorkspace = name;
    document.querySelectorAll('.rail-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.workspace === name);
    });
    document.querySelectorAll('.workspace-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `workspace-${name}`);
    });
  };
  switchWorkspace = setWorkspace;
  document.querySelectorAll('.rail-tab').forEach((btn) => {
    btn.addEventListener('click', () => setWorkspace(btn.dataset.workspace));
  });
  setWorkspace(activeWorkspace);

  const lightX = document.getElementById('light-x-control');
  const lightIntensity = document.getElementById('light-intensity-control');
  const lightRows = document.querySelectorAll('.slider-row.compact');
  lightRows.forEach((el) => { el.style.display = 'none'; });
  if (lightX) {
    lightX.value = Math.round(lightingSettings.x * 100);
    lightX.addEventListener('input', e => {
      lightingSettings.x = Number(e.target.value) / 100;
      saveLightingSettings();
    });
  }
  if (lightIntensity) {
    lightIntensity.value = Math.round(lightingSettings.intensity * 100);
    lightIntensity.addEventListener('input', e => {
      lightingSettings.intensity = Number(e.target.value) / 100;
      saveLightingSettings();
    });
  }

  const toolbox = document.getElementById('toolbox');
  const toggle = document.getElementById('toolbox-toggle');
  const setCollapsed = (collapsed, { persist = true } = {}) => {
    toolbox.classList.toggle('collapsed', collapsed);
    if (toggle) toggle.textContent = collapsed ? 'Edit Tank' : 'Close Editor';
    if (persist) {
      try {
        localStorage.setItem(TOOLBOX_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {}
    }
  };
  // Default to COLLAPSED — the tank is the primary experience, editing is a deliberate mode.
  // (Only override if the user has previously left it open.)
  let collapsedByDefault = true;
  try {
    const stored = localStorage.getItem(TOOLBOX_COLLAPSED_KEY);
    if (stored !== null) collapsedByDefault = stored === '1';
  } catch {}
  setCollapsed(collapsedByDefault);
  if (REVIEW_PARAMS.has('editor')) {
    setCollapsed(REVIEW_PARAMS.get('editor') === '0', { persist: false });
  }
  toggle?.addEventListener('click', () => setCollapsed(!toolbox.classList.contains('collapsed')));

  // Escape closes the editor when expanded
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !toolbox.classList.contains('collapsed')) {
      setCollapsed(true);
    }
  });
}

function updateInspector() {
  const panel = document.getElementById('asset-inspector');
  if (!panel) return;
  const title = panel.querySelector('.inspector-title');
  const scale = document.getElementById('scale-control');
  const scaleLabel = scale?.closest('.slider-row')?.querySelector('span');
  const asset = selectedAsset();
  panel.classList.toggle('disabled', !asset);
  panel.querySelectorAll('button, input').forEach(el => { el.disabled = !asset; });
  if (!asset) {
    title.textContent = 'No asset selected';
    if (scaleLabel) scaleLabel.textContent = 'Scale';
    if (scale) scale.value = 100;
    return;
  }
  const def = ASSET_DEFS[asset.key];
  if (scaleLabel) scaleLabel.textContent = def?.layer === 'plant' ? 'Growth' : 'Scale';
  title.textContent = `${def?.label ?? asset.key} · ${Math.round(asset.rotation ?? 0)}deg · ${asset.depth ?? 'mid'}`;
  if (scale) scale.value = Math.round((asset.scale ?? def?.defaultScale ?? 1) * 100);
}

// ─── Night calculation ────────────────────────────────────────
function nightOpacity() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  // 0 at noon (h=12), 0.5 at midnight (h=0/24), smooth cosine
  const t = Math.cos((h / 12) * Math.PI);  // 1 at noon, -1 at midnight
  return (1 - t) * 0.25;  // range 0…0.5
}

function nightSpeedFactor() {
  const op = nightOpacity();
  return 1.0 - op * 0.8;  // 1.0 at noon, 0.6 at midnight
}

// ─── HUD ──────────────────────────────────────────────────────
function updateHUD(sim, shrimpObjs) {
  const count    = document.getElementById('hud-shrimp');
  const day      = document.getElementById('hud-day');
  const timeEl   = document.getElementById('hud-time');
  const legend   = document.getElementById('hud-legend');
  const perfEl   = document.getElementById('hud-perf');

  count.textContent = `♦ ${shrimpObjs.length} shrimp`;
  day.textContent   = `Day ${sim.dayCounter}`;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}`;

  // Legend dots: unique variants in tank
  const seen = new Set(shrimpObjs.map(s => s.variant));
  legend.innerHTML = '';
  for (const v of seen) {
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = VARIANT_COLORS[v] ?? '#888';
    dot.title = v.replace(/_/g, ' ');
    legend.appendChild(dot);
  }

  if (perfEl) {
    updatePerfHUD(perfEl);
  }
}

function updatePerfHUD(perfEl = null) {
  const el = perfEl || document.getElementById('hud-perf');
  if (!el) return;
  const perf = window.__perf;
  const enabled = !!perf?.enabled;
  el.hidden = !enabled;
  if (!enabled) return;
  const fps = perf?.fps ?? 0;
  const ms = perf?.ms ?? 0;
  const warn = fps < 55;
  el.style.color = warn ? 'rgba(255, 180, 148, 0.92)' : 'rgba(206, 236, 196, 0.82)';
  el.textContent = `FPS ${fps.toFixed(1)} · ${ms.toFixed(1)}ms`;
}

// ─── Input handling ───────────────────────────────────────────
let lastPinchDist = 0;
let isPinching = false;
let pinchMid = { x: 0, y: 0 };

function setupInput(canvas, stage) {
  // World hit-testing goes through the Pixi world transform (grid units).
  const gridAt = (e) => stage.screenToWorld(e.clientX, e.clientY);

  document.getElementById('asset-inspector')?.addEventListener('click', e => {
    const action = e.target?.dataset?.action;
    if (!action) return;
    if (action === 'rotate-left') mutateSelected(a => { a.rotation = (a.rotation ?? 0) - 15; });
    if (action === 'rotate-right') mutateSelected(a => { a.rotation = (a.rotation ?? 0) + 15; });
    if (action === 'flip') mutateSelected(a => { a.flip = !a.flip; });
    if (action === 'depth-back') mutateSelected(a => { a.depth = 'back'; });
    if (action === 'depth-mid') mutateSelected(a => { a.depth = 'mid'; });
    if (action === 'depth-front') mutateSelected(a => { a.depth = 'front'; });
    if (action === 'delete') deleteSelected();
  });

  document.getElementById('scale-control')?.addEventListener('input', e => {
    mutateSelected(a => { a.scale = Number(e.target.value) / 100; });
  });

  canvas.addEventListener('pointerdown', e => {
    const { gx, gy } = gridAt(e);
    const hit = hitTestAsset(gx, gy);

    if (activeTool === 'select' || hit) {
      selectAsset(hit);
      if (hit) {
        // Snapshot pre-drag state; drag itself doesn't push more history.
        pushHistory();
        dragState = { id: hit.id, dx: gx - hit.x, dy: gy - hit.y, moved: false, original: { ...hit } };
        invalidAssetIds.clear();
        canvas.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (activeTool === 'food') {
      const foodY = Math.min(SUBSTRATE_Y - 6, Math.max(4, gy));
      dropFood(gx, foodY);
      return;
    }

    placeAsset(activeTool, gx, gy);
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragState) return;
    const asset = placedAssets.find(a => a.id === dragState.id);
    if (!asset) return;
    const { gx, gy } = gridAt(e);
    asset.x = Math.max(0, Math.min(CANVAS_W, gx - dragState.dx));
    if (ROOTED_PLANTS.has(asset.key)) {
      asset.y = ROOTED_ANCHOR_Y;
    } else if (FLOATING_PLANTS.has(asset.key)) {
      asset.y = FLOATING_ANCHOR_Y;
    } else if (ASSET_DEFS[asset.key]?.layer === 'hardscape') {
      asset.y = Math.max(14, Math.min(HARDSCAPE_ANCHOR_Y, gy - dragState.dy));
    } else {
      asset.y = Math.max(14, Math.min(SUBSTRATE_Y + 2, gy - dragState.dy));
    }
    invalidAssetIds.clear();
    dragState.moved = true;
  });

  canvas.addEventListener('pointerup', e => {
    if (dragState) {
      const asset = placedAssets.find(a => a.id === dragState.id);
      if (asset) {
        const snapped = findNearestValidPlacement(asset, asset.id);
        if (snapped) Object.assign(asset, snapped);
        else Object.assign(asset, dragState.original);
        savePlacedAssets();
      }
      invalidAssetIds.clear();
      canvas.releasePointerCapture?.(e.pointerId);
      dragState = null;
    }
  });

  window.addEventListener('keydown', e => {
    // Undo / redo shortcuts work whether or not an asset is selected
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
    }

    const asset = selectedAsset();
    if (!asset) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key.toLowerCase() === 'q') {
      e.preventDefault();
      mutateSelected(a => { a.rotation = (a.rotation ?? 0) - 5; });
    } else if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      mutateSelected(a => { a.rotation = (a.rotation ?? 0) + 5; });
    } else if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      mutateSelected(a => { a.scale = (a.scale ?? 1) + 0.05; });
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      mutateSelected(a => { a.scale = (a.scale ?? 1) - 0.05; });
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      mutateSelected(a => {
        if (e.key === 'ArrowLeft') a.x -= step;
        if (e.key === 'ArrowRight') a.x += step;
        if (e.key === 'ArrowUp') a.y -= step;
        if (e.key === 'ArrowDown') a.y += step;
      });
    }
  });

  // Scroll wheel → zoom (anchored at the cursor, via the world transform)
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    stage.zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });

  // Touch pinch → zoom
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.sqrt(dx*dx + dy*dy);
      pinchMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const factor = dist / (lastPinchDist || dist);
      pinchMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      stage.zoomAt(pinchMid.x, pinchMid.y, factor);
      lastPinchDist = dist;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => { isPinching = false; });
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  installReviewSeed();
  const canvas = document.getElementById('tank');
  const stage  = new PixiStage();
  await stage.init(canvas);

  const assets = await loadAssets();   // PNGs only feed the toolbox thumbnails
  applyReviewPreset();
  sanitizePlacedAssets();
  if (!REVIEW_MODE) savePlacedAssets();
  buildToolbox(assets);
  updateInspector();
  stage.setScape(placedAssets);        // placedView reconciles this array live
  if (REVIEW_MODE) {
    const zoom = Number(REVIEW_PARAMS.get('zoom') || '1');
    const panX = Number(REVIEW_PARAMS.get('panX') || '0');
    const panY = Number(REVIEW_PARAMS.get('panY') || '0');
    if (Number.isFinite(zoom) && zoom > 0) stage.zoom = zoom;
    if (Number.isFinite(panX)) stage.pan.x = panX;
    if (Number.isFinite(panY)) stage.pan.y = panY;
    stage.layout();
  }

  // First-time onboarding: if no scape has been chosen, show the picker.
  if (!REVIEW_MODE && !localStorage.getItem(SCAPE_KEY) && placedAssets.length === 0) {
    showScapePicker(false);
  }

  const sim   = new Simulation();
  let shrimp  = initShrimp(sim.population, CANVAS_W, SUBSTRATE_Y, SUBSTRATE_Y);

  setupInput(canvas, stage);
  if (typeof window !== 'undefined') {
    window.__review = {
      mode: REVIEW_MODE,
      preset: REVIEW_PRESET,
      urls: REVIEW_URLS,
      lightingMode,
      backgroundMode,
      assetCount: placedAssets.length,
      ready: false,
    };
  }

  // Fixed-timestep accumulator: simulation steps at a stable 60 Hz regardless
  // of frame rate, so motion never stutters when the tab is busy. Rendering
  // runs every animation frame off the same wall clock.
  const STEP = 1 / 60;
  const MAX_FRAME = 0.1;
  let lastTime = performance.now();
  let acc = 0;
  let saveTimer = 0;

  function step(dt) {
    sim.tick(Date.now());
    if (shrimp.length !== sim.population.length) {
      shrimp = initShrimp(sim.population, CANVAS_W, SUBSTRATE_Y, SUBSTRATE_Y);
    }
    const settledFood = foodParticles.filter(f => f.settled);
    for (const s of shrimp) s.update(dt, 1, settledFood, shrimp);
    updateBubbles(dt);
    updateFood(dt);
    for (const m of sim.moltEvents) {
      if (m.x < 0) {
        const s = shrimp.find(sh => sh.id === m.shrimpId);
        if (s) sim.setMoltPosition(m.shrimpId, s.x, s.renderY ?? s.y);
      }
    }
  }

  function loop(now) {
    const frameDt = Math.min((now - lastTime) / 1000, MAX_FRAME);
    lastTime = now;
    acc += frameDt;
    let steps = 0;
    while (acc >= STEP && steps < 8) { step(STEP); acc -= STEP; steps += 1; }
    if (steps === 8) acc = 0;   // avoid spiral-of-death after a long stall

    stage.frame({
      time: now / 1000,
      reviewMode: REVIEW_MODE,
      nightOpacity: lightingMode === 'night' ? 0.46 : nightOpacity(),
      shrimp,
      plantStages: sim.plantStages,
      foodParticles,
      placedAssets,
      selectedAssetId,
      bubbles,
      moltEvents: sim.moltEvents,
      lightingMode,
      lightingSettings,
      backgroundMode,
      compositionOverlays,
      invalidAssetIds: [...invalidAssetIds],
    });
    if (window.__review) {
      window.__review.ready = true;
      window.__review.lightingMode = lightingMode;
      window.__review.backgroundMode = backgroundMode;
      window.__review.assetCount = placedAssets.length;
    }
    updatePerfHUD();

    saveTimer += frameDt;
    if (saveTimer > 2) {
      saveTimer = 0;
      updateHUD(sim, shrimp);
      sim.save();
    }

    requestAnimationFrame(loop);
  }

  updateHUD(sim, shrimp);
  requestAnimationFrame(loop);
}

main();
