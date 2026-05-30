const Y = 128;

export const SCAPE_PRESETS = {
  // ── Iwagumi — Takashi Amano triangular stone composition ──────────────────
  // Main oyaishi slightly right of center; two subsidiary fukuishi frame it;
  // three accent suteishi dot the foreground.  Rotala hedges in the corners
  // open the middle; anubias and moss nestle among the stones.  Minimal
  // floating cover — space is the point.
  iwagumi: {
    name: 'Iwagumi',
    blurb: 'Stone hierarchy with sweeping background stems, restrained foreground epiphytes, and clean negative space.',
    assets: [
      // Oyaishi — main stone, 1/3 from left, dominant height
      { id: 'iwa_oyaishi',    key: 'stone_seiryu_lg', x: 118, y: Y,     scale: 1.18, rotation: -10, flip: false, depth: 'mid'   },
      // Fukuishi — subsidiary stones flanking the oyaishi
      { id: 'iwa_fukuishi_l', key: 'stone_seiryu_lg', x:  72, y: Y + 1, scale: 0.82, rotation:   7, flip: true,  depth: 'mid'   },
      { id: 'iwa_fukuishi_r', key: 'stone_dragon',    x: 170, y: Y + 1, scale: 0.78, rotation:  -8, flip: false, depth: 'mid'   },
      // Suteishi — small accent stones
      { id: 'iwa_suteishi1',  key: 'stone_seiryu_sm', x:  46, y: Y + 2, scale: 0.62, rotation:   5, flip: false, depth: 'front' },
      { id: 'iwa_suteishi2',  key: 'stone_seiryu_sm', x: 194, y: Y + 2, scale: 0.58, rotation:  -5, flip: true,  depth: 'front' },
      { id: 'iwa_suteishi3',  key: 'stone_lava',      x: 148, y: Y + 2, scale: 0.54, rotation:   3, flip: true,  depth: 'front' },
      // Background: rotala stems in far corners, vallisneria framing edges
      { id: 'iwa_val_l',      key: 'vallisneria',     x:  14, y: Y,     scale: 0.62, rotation:   0, flip: false, depth: 'back'  },
      { id: 'iwa_rot_l1',     key: 'rotala_full',     x:  26, y: Y,     scale: 0.90, rotation:   0, flip: false, depth: 'back'  },
      { id: 'iwa_rot_l2',     key: 'rotala_mid',      x:  42, y: Y,     scale: 0.86, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'iwa_rot_r1',     key: 'rotala_full',     x: 220, y: Y,     scale: 0.96, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'iwa_rot_r2',     key: 'rotala_mid',      x: 238, y: Y,     scale: 0.90, rotation:   0, flip: false, depth: 'back'  },
      { id: 'iwa_val_r',      key: 'vallisneria',     x: 270, y: Y,     scale: 0.66, rotation:   0, flip: true,  depth: 'back'  },
      // Foreground epiphytes nestled against the stones
      { id: 'iwa_fern_l',     key: 'java_fern',       x: 104, y: Y + 1, scale: 0.66, rotation:  -2, flip: false, depth: 'front' },
      { id: 'iwa_fern_r',     key: 'java_fern',       x: 156, y: Y + 1, scale: 0.62, rotation:   2, flip: true,  depth: 'front' },
      { id: 'iwa_anubias_l',  key: 'anubias',         x:  80, y: Y + 1, scale: 0.68, rotation:  -2, flip: false, depth: 'front' },
      { id: 'iwa_moss',       key: 'moss',             x: 132, y: Y + 1, scale: 0.58, rotation:   0, flip: false, depth: 'front' },
      // Sparse floating cover — one cluster, off-centre
      { id: 'iwa_float_l',    key: 'floating_salvinia',x:  64, y: 16,   scale: 0.82, rotation:   0, flip: false, depth: 'front' },
      { id: 'iwa_float_r',    key: 'floating_redroot', x: 200, y: 16,   scale: 0.80, rotation:   0, flip: true,  depth: 'front' },
    ],
  },

  // ── Nature Aquarium — dense biotope with wood, stems and epiphytes ────────
  // Asymmetric composition: heavy left hardscape anchor, open right mid-water.
  // Wood scales are calibrated to ≤30% of tank width each so they read as
  // realistic pieces rather than room-filling props.
  nature: {
    name: 'Nature Aquarium',
    blurb: 'Dense nature style with intertwined wood, colorful stems, floaters, and full-height plant mass.',
    assets: [
      // Left anchor: stone base + manzanita driftwood
      { id: 'nat_stone_anchor', key: 'stone_seiryu_lg', x:  76, y: Y,     scale: 0.90, rotation:  -6, flip: false, depth: 'mid'   },
      { id: 'nat_stone_sm',     key: 'stone_seiryu_sm', x:  38, y: Y + 2, scale: 0.68, rotation:  -8, flip: true,  depth: 'front' },
      { id: 'nat_wood_main',    key: 'wood_manzanita',  x: 116, y: Y + 1, scale: 0.44, rotation:  -8, flip: false, depth: 'mid'   },
      // Right section: dragon stone + redmoor root + spider web accent
      { id: 'nat_dragon',       key: 'stone_dragon',    x: 174, y: Y + 1, scale: 0.72, rotation:  -5, flip: true,  depth: 'mid'   },
      { id: 'nat_wood_side',    key: 'wood_redmoor',    x: 208, y: Y + 2, scale: 0.42, rotation:  -9, flip: false, depth: 'mid'   },
      { id: 'nat_wood_accent',  key: 'wood_spider',     x: 242, y: Y + 2, scale: 0.38, rotation:  -8, flip: true,  depth: 'back'  },
      // Background stems — full-height left columns, mid-height right
      { id: 'nat_rot_l1',       key: 'rotala_full',     x:  20, y: Y,     scale: 0.88, rotation:   0, flip: false, depth: 'back'  },
      { id: 'nat_rot_l2',       key: 'rotala_mid',      x:  36, y: Y,     scale: 0.84, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'nat_crypt_l',      key: 'crypt',            x:  56, y: Y,     scale: 0.70, rotation:   0, flip: false, depth: 'back'  },
      { id: 'nat_rot_c1',       key: 'rotala_full',     x: 148, y: Y,     scale: 0.96, rotation:   0, flip: false, depth: 'back'  },
      { id: 'nat_rot_c2',       key: 'rotala_mid',      x: 164, y: Y,     scale: 0.92, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'nat_rot_r1',       key: 'rotala_full',     x: 198, y: Y,     scale: 0.94, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'nat_rot_r2',       key: 'rotala_mid',      x: 216, y: Y,     scale: 0.90, rotation:   0, flip: false, depth: 'back'  },
      { id: 'nat_val_far_r',    key: 'vallisneria',     x: 260, y: Y,     scale: 0.64, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'nat_val_far_r2',   key: 'vallisneria',     x: 274, y: Y,     scale: 0.60, rotation:   0, flip: false, depth: 'back'  },
      // Foreground epiphytes clustered around hardscape
      { id: 'nat_fern_l',       key: 'java_fern',       x:  96, y: Y + 1, scale: 0.72, rotation:  -2, flip: false, depth: 'front' },
      { id: 'nat_anubias_l',    key: 'anubias',         x:  62, y: Y + 1, scale: 0.70, rotation:   0, flip: false, depth: 'front' },
      { id: 'nat_buce',         key: 'buce',             x: 136, y: Y + 1, scale: 0.62, rotation:  -1, flip: false, depth: 'front' },
      { id: 'nat_fern_r',       key: 'java_fern',       x: 180, y: Y + 1, scale: 0.68, rotation:   2, flip: true,  depth: 'front' },
      { id: 'nat_moss',         key: 'moss',             x: 160, y: Y + 1, scale: 0.58, rotation:   0, flip: false, depth: 'front' },
      { id: 'nat_anubias_r',    key: 'anubias',         x: 234, y: Y + 1, scale: 0.64, rotation:   1, flip: true,  depth: 'front' },
      // Floating cover — heavier than iwagumi, offset to the left
      { id: 'nat_float_l',      key: 'floating_redroot', x:  54, y: 16,  scale: 0.86, rotation:   0, flip: true,  depth: 'front' },
      { id: 'nat_float_c',      key: 'floating_salvinia',x: 124, y: 16,  scale: 0.90, rotation:   0, flip: false, depth: 'front' },
      { id: 'nat_float_r',      key: 'floating_redroot', x: 198, y: 16,  scale: 0.84, rotation:   0, flip: false, depth: 'front' },
    ],
  },
  hd2d_slice: {
    name: 'HD-2D Slice',
    blurb: 'Vertical-slice composition for atlas-quality review: realistic fauna proportions, clear silhouettes, subtle depth.',
    assets: [
      { id: 'h2_rock_1', key: 'stone_seiryu_lg', x: 92, y: Y, scale: 1.0, rotation: -5, flip: false, depth: 'mid' },
      { id: 'h2_rock_2', key: 'stone_pagoda', x: 128, y: Y + 1, scale: 0.82, rotation: 8, flip: true, depth: 'mid' },
      { id: 'h2_wood_1', key: 'wood_manzanita', x: 164, y: Y + 1, scale: 0.60, rotation: -8, flip: false, depth: 'mid' },
      { id: 'h2_wood_2', key: 'wood_redmoor', x: 214, y: Y + 2, scale: 0.52, rotation: -11, flip: false, depth: 'mid' },
      { id: 'h2_rot_l', key: 'rotala_full', x: 30, y: Y, scale: 0.90, rotation: 0, flip: false, depth: 'back' },
      { id: 'h2_rot_r', key: 'rotala_mid', x: 222, y: Y, scale: 0.94, rotation: 0, flip: true, depth: 'back' },
      { id: 'h2_fern', key: 'java_fern', x: 126, y: Y + 1, scale: 0.70, rotation: -2, flip: false, depth: 'front' },
      { id: 'h2_crypt', key: 'crypt', x: 182, y: Y, scale: 0.72, rotation: 1, flip: true, depth: 'back' },
      { id: 'h2_anubias', key: 'anubias', x: 84, y: Y + 1, scale: 0.78, rotation: -1, flip: false, depth: 'front' },
      { id: 'h2_moss', key: 'moss', x: 146, y: Y + 1, scale: 0.64, rotation: 0, flip: false, depth: 'front' },
      { id: 'h2_val_r', key: 'vallisneria', x: 260, y: Y, scale: 0.64, rotation: 0, flip: true, depth: 'back' },
      { id: 'h2_float_l', key: 'floating_salvinia', x: 66, y: 16, scale: 0.86, rotation: 0, flip: false, depth: 'front' },
      { id: 'h2_float_m', key: 'floating_redroot', x: 144, y: 16, scale: 0.86, rotation: 0, flip: true, depth: 'front' },
      { id: 'h2_float_r', key: 'floating_salvinia', x: 222, y: 16, scale: 0.86, rotation: 0, flip: true, depth: 'front' },
    ],
  },
};

export function clonePresetAssets(presetId) {
  const preset = SCAPE_PRESETS[presetId];
  if (!preset) return [];
  return preset.assets.map((a) => ({ ...a }));
}
