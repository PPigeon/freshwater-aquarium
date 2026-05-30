import { ASSET_DEFS } from '../assetDefs.js';
import { VARIANT_COLORS } from '../../assets.js';

const hex = (s) => parseInt(s.replace('#', ''), 16);

// Fixed art density. One world unit maps to one authored source pixel.
export const ART_SCALE = 1;

const ROCK_PAL = {
  stone_seiryu_lg: { base: 0x59636f, vein: 0xc9d4dd, kind: 'rock', strata: true },
  stone_seiryu_sm: { base: 0x59636f, vein: 0xc9d4dd, kind: 'rock', strata: true },
  stone_dragon: { base: 0x8a6a3a, vein: 0x3a2912, kind: 'rock', pitted: true },
  stone_lava: { base: 0x352a28, vein: 0x6e2f22, kind: 'rock', pitted: true },
  stone_frodo: { base: 0x7d6e55, vein: 0xc7b894, kind: 'rock' },
  stone_pagoda: { base: 0x6c5a42, vein: 0xb8a079, kind: 'rock', strata: true },
};

const WOOD_PAL = {
  wood_spider: 0x6a4f33,
  wood_manzanita: 0x8a7152,
  wood_malaysian: 0x4f3a22,
  wood_mopani: 0x53412a,
  wood_redmoor: 0x6e4a2c,
};

const PLANT_PAL = {
  rotala_small: { kind: 'stem', base: 0x5aa03e, accent: 0xb6643a },
  rotala_mid: { kind: 'stem', base: 0x5aa03e, accent: 0xb6643a },
  rotala_full: { kind: 'stem', base: 0x5aa03e, accent: 0xb6643a },
  crypt: { kind: 'crypt', base: 0x586b30, accent: 0x8b4a36 },
  java_fern: { kind: 'fern', base: 0x356f33, accent: 0x4f9145 },
  anubias: { kind: 'rosette', base: 0x2f7a3e, accent: 0x49a256 },
  vallisneria: { kind: 'grass', base: 0x3f8f46, accent: 0x6fc06a },
  moss: { kind: 'moss', base: 0x3c7d3a, accent: 0x67a85a },
  buce: { kind: 'buce', base: 0x315b42, accent: 0x5e7f56 },
  floating_salvinia: { kind: 'floating', base: 0x4fae5a, accent: 0x86d77e },
  floating_redroot: { kind: 'floating', base: 0x6aa85a, accent: 0x9a4a3a },
};

function withContract(entry) {
  return {
    ...entry,
    frameGrid: {
      rows: entry.frameGrid?.rows ?? 1,
      cols: entry.frameGrid?.cols ?? 1,
      frameW: entry.frameGrid?.frameW ?? entry.worldSize.w,
      frameH: entry.frameGrid?.frameH ?? entry.worldSize.h,
    },
    animTags: entry.animTags ?? {},
  };
}

function placedEntries() {
  const out = {};
  for (const [key, def] of Object.entries(ASSET_DEFS)) {
    const anchor = def.isFloating ? [0.5, 0.0] : [0.5, 1.0];
    const base = withContract({
      key,
      layer: def.layer,
      atlasPath: def.layer === 'hardscape'
        ? `assets/sprites/hardscape/${key}.png`
        : `assets/sprites/plants/${def.key}.png`,
      anchor,
      worldSize: { w: def.w, h: def.h },
      frameGrid: { rows: 1, cols: 1, frameW: def.w, frameH: def.h },
      animTags: def.layer === 'plant' ? { sway: !!def.sway } : {},
      bake: def.layer === 'hardscape'
        ? (key.startsWith('wood_')
          ? { kind: 'wood', base: WOOD_PAL[key] ?? 0x6a4f33 }
          : { ...ROCK_PAL[key] })
        : { ...(PLANT_PAL[key] ?? { kind: 'stem', base: 0x5aa03e, accent: 0x86d77e }) },
    });

    // Rotala variants live in one atlas and use distinct source rectangles.
    if (key === 'rotala_small' || key === 'rotala_mid' || key === 'rotala_full') {
      base.atlasPath = 'assets/sprites/plants/rotala.png';
      base.sourceRect = { x: def.sx, y: def.sy, w: def.sw, h: def.sh };
      base.frameGrid = { rows: 1, cols: 1, frameW: def.sw, frameH: def.sh };
    }
    out[key] = base;
  }
  return out;
}

const SHRIMP_ROWS = { forage: 0, idle: 1, swim: 2 };

function shrimpEntry(key, baseHex, extraBake = {}) {
  return withContract({
    key,
    layer: 'creature',
    atlasPath: `assets/sprites/${key}.png`,
    anchor: [0.5, 0.55],
    worldSize: { w: 30, h: 12 },
    frameGrid: { rows: 3, cols: 6, frameW: 60, frameH: 26 },
    animTags: { activityRows: SHRIMP_ROWS, gendered: true },
    bake: { kind: 'shrimp', base: baseHex, ...extraBake },
  });
}

function shrimpEntries() {
  const out = {};
  const variants = Object.keys(VARIANT_COLORS);
  for (const v of variants) {
    for (const sex of ['male', 'female']) {
      const key = `${v}_${sex}`;
      out[key] = shrimpEntry(key, hex(VARIANT_COLORS[v]), { variant: v, sex });
    }
  }
  out.red_cherry_berried = shrimpEntry(
    'red_cherry_berried',
    hex(VARIANT_COLORS.red_cherry),
    { variant: 'red_cherry', sex: 'female', berried: true },
  );
  out.molt = withContract({
    key: 'molt',
    layer: 'creature',
    atlasPath: 'assets/sprites/molt.png',
    anchor: [0.5, 0.55],
    worldSize: { w: 30, h: 12 },
    frameGrid: { rows: 1, cols: 1, frameW: 60, frameH: 26 },
    sourceRect: { x: 0, y: 0, w: 60, h: 26 },
    animTags: { static: true },
    bake: { kind: 'shrimp', base: 0xdfe7ee, variant: 'molt', sex: 'female', molt: true },
  });
  return out;
}

const BACKGROUND = {
  water_tile: withContract({
    key: 'water_tile',
    layer: 'background',
    atlasPath: 'assets/sprites/background/water_tile.png',
    anchor: [0, 0],
    worldSize: { w: 8, h: 8 },
    frameGrid: { rows: 1, cols: 1, frameW: 8, frameH: 8 },
    animTags: { tileable: true },
    filter: 'linear',
    reviewRole: 'background',
  }),
  substrate_tile: withContract({
    key: 'substrate_tile',
    layer: 'background',
    atlasPath: 'assets/sprites/background/substrate.png',
    anchor: [0, 0],
    worldSize: { w: 48, h: 48 },
    frameGrid: { rows: 1, cols: 1, frameW: 48, frameH: 48 },
    animTags: { tileable: true },
    reviewRole: 'background',
  }),
  caustics_tile: withContract({
    key: 'caustics_tile',
    layer: 'background',
    atlasPath: 'assets/sprites/background/caustics.png',
    anchor: [0, 0],
    worldSize: { w: 32, h: 32 },
    frameGrid: { rows: 1, cols: 4, frameW: 32, frameH: 32 },
    animTags: { tileable: true, animated: true },
    filter: 'linear',
    reviewRole: 'background',
  }),
  background_films: withContract({
    key: 'background_films',
    layer: 'background',
    atlasPath: 'assets/sprites/background/background_films.png',
    anchor: [0, 0],
    worldSize: { w: 280, h: 156 },
    frameGrid: { rows: 1, cols: 1, frameW: 280, frameH: 156 },
    sourceRect: { x: 0, y: 0, w: 280, h: 156 },
    animTags: { overlay: true },
    filter: 'linear',
    reviewRole: 'background',
  }),
  room_bg: withContract({
    key: 'room_bg',
    layer: 'background',
    atlasPath: 'assets/sprites/background/room_bg.png',
    anchor: [0, 0],
    worldSize: { w: 280, h: 156 },
    frameGrid: { rows: 1, cols: 1, frameW: 280, frameH: 156 },
    sourceRect: { x: 0, y: 0, w: 280, h: 156 },
    animTags: { overlay: true },
    filter: 'linear',
    reviewRole: 'background',
  }),
  led_fixture: withContract({
    key: 'led_fixture',
    layer: 'background',
    atlasPath: 'assets/sprites/background/led_fixture.png',
    anchor: [0.5, 0],
    worldSize: { w: 90, h: 3.2 },
    frameGrid: { rows: 1, cols: 1, frameW: 240, frameH: 8 },
    animTags: { overlay: true },
    reviewRole: 'background',
  }),
};

const EXTRA = {
  neon_tetra: withContract({
    key: 'neon_tetra',
    layer: 'creature',
    atlasPath: 'assets/sprites/background/neon_tetra.png',
    anchor: [0.5, 0.5],
    worldSize: { w: 18, h: 8 },
    frameGrid: { rows: 1, cols: 4, frameW: 40, frameH: 18 },
    animTags: { schooling: true },
    bake: { kind: 'fish' },
  }),
  bubble: withContract({
    key: 'bubble',
    layer: 'particle',
    atlasPath: 'assets/sprites/background/bubble.png',
    anchor: [0.5, 0.5],
    worldSize: { w: 3.6, h: 3.6 },
    frameGrid: { rows: 1, cols: 3, frameW: 6, frameH: 6 },
    animTags: { animated: true },
    bake: { kind: 'bubble' },
  }),
  food_wafer: withContract({
    key: 'food_wafer',
    layer: 'particle',
    atlasPath: 'assets/sprites/background/food_wafer.png',
    anchor: [0.5, 0.5],
    worldSize: { w: 3.4, h: 3.4 },
    frameGrid: { rows: 1, cols: 3, frameW: 4, frameH: 8 },
    animTags: { animated: true },
    bake: { kind: 'food' },
  }),
  mote: withContract({
    key: 'mote',
    layer: 'particle',
    atlasPath: 'assets/sprites/background/mote.png',
    anchor: [0.5, 0.5],
    worldSize: { w: 2, h: 2 },
    frameGrid: { rows: 1, cols: 1, frameW: 6, frameH: 6 },
    animTags: { static: true },
  }),
};

export const MANIFEST = {
  ...placedEntries(),
  ...shrimpEntries(),
  ...BACKGROUND,
  ...EXTRA,
};

export { SHRIMP_ROWS };
