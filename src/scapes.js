const Y = 128;

export const REVIEW_SCENE_IDS = [
  'iwagumi',
  'nature',
  'review_empty',
  'review_dense',
  'review_fauna',
];

export const REVIEW_URLS = [
  { id: 'iwagumi_day', label: 'Iwagumi / day', query: '?review=iwagumi&seed=11&editor=0' },
  { id: 'nature_day', label: 'Nature / day', query: '?review=nature&seed=12&editor=0' },
  { id: 'empty_day', label: 'Empty tank / day', query: '?review=review_empty&seed=13&editor=0' },
  { id: 'dense_day', label: 'Dense tank / day', query: '?review=review_dense&seed=14&editor=0' },
  { id: 'nature_night', label: 'Nature / night', query: '?review=nature&lighting=night&seed=15&editor=0' },
  { id: 'fauna_close', label: 'Close fauna / day', query: '?review=review_fauna&seed=16&editor=0&zoom=1.55&panX=-120&panY=-35' },
];

export const SCAPE_PRESETS = {
  // Iwagumi: restrained stone hierarchy with open midwater for fauna read tests.
  iwagumi: {
    name: 'Iwagumi',
    blurb: 'Stone hierarchy with sweeping background stems, restrained foreground epiphytes, and clean negative space.',
    assets: [
      { id: 'iwa_oyaishi', key: 'stone_seiryu_lg', x: 118, y: Y, scale: 1.10, rotation: -10, flip: false, depth: 'mid' },
      { id: 'iwa_fukuishi_l', key: 'stone_seiryu_lg', x: 72, y: Y + 1, scale: 0.76, rotation: 7, flip: true, depth: 'mid' },
      { id: 'iwa_fukuishi_r', key: 'stone_dragon', x: 170, y: Y + 1, scale: 0.70, rotation: -8, flip: false, depth: 'mid' },
      { id: 'iwa_suteishi1', key: 'stone_seiryu_sm', x: 46, y: Y + 2, scale: 0.58, rotation: 5, flip: false, depth: 'front' },
      { id: 'iwa_suteishi2', key: 'stone_seiryu_sm', x: 194, y: Y + 2, scale: 0.54, rotation: -5, flip: true, depth: 'front' },
      { id: 'iwa_suteishi3', key: 'stone_lava', x: 148, y: Y + 2, scale: 0.50, rotation: 3, flip: true, depth: 'front' },
      { id: 'iwa_val_l', key: 'vallisneria', x: 14, y: Y, scale: 0.62, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_rot_l1', key: 'rotala_full', x: 26, y: Y, scale: 0.88, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_rot_l2', key: 'rotala_mid', x: 42, y: Y, scale: 0.82, rotation: 0, flip: true, depth: 'back' },
      { id: 'iwa_rot_r1', key: 'rotala_full', x: 220, y: Y, scale: 0.92, rotation: 0, flip: true, depth: 'back' },
      { id: 'iwa_rot_r2', key: 'rotala_mid', x: 238, y: Y, scale: 0.86, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_val_r', key: 'vallisneria', x: 270, y: Y, scale: 0.64, rotation: 0, flip: true, depth: 'back' },
      { id: 'iwa_fern_l', key: 'java_fern', x: 104, y: Y + 1, scale: 0.60, rotation: -2, flip: false, depth: 'front' },
      { id: 'iwa_fern_r', key: 'java_fern', x: 156, y: Y + 1, scale: 0.58, rotation: 2, flip: true, depth: 'front' },
      { id: 'iwa_anubias_l', key: 'anubias', x: 80, y: Y + 1, scale: 0.64, rotation: -2, flip: false, depth: 'front' },
      { id: 'iwa_moss', key: 'moss', x: 132, y: Y + 1, scale: 0.54, rotation: 0, flip: false, depth: 'front' },
      { id: 'iwa_float_l', key: 'floating_salvinia', x: 64, y: 16, scale: 0.78, rotation: 0, flip: false, depth: 'front' },
      { id: 'iwa_float_r', key: 'floating_redroot', x: 200, y: 16, scale: 0.76, rotation: 0, flip: true, depth: 'front' },
    ],
  },

  // Nature Aquarium: rich but still leaves right-center space for small fauna.
  nature: {
    name: 'Nature Aquarium',
    blurb: 'Dense nature style with intertwined wood, colorful stems, floaters, and readable midwater.',
    assets: [
      { id: 'nat_stone_anchor', key: 'stone_seiryu_lg', x: 76, y: Y, scale: 0.82, rotation: -6, flip: false, depth: 'mid' },
      { id: 'nat_stone_sm', key: 'stone_seiryu_sm', x: 38, y: Y + 2, scale: 0.62, rotation: -8, flip: true, depth: 'front' },
      { id: 'nat_wood_main', key: 'wood_manzanita', x: 118, y: Y + 1, scale: 0.38, rotation: -8, flip: false, depth: 'mid' },
      { id: 'nat_dragon', key: 'stone_dragon', x: 174, y: Y + 1, scale: 0.64, rotation: -5, flip: true, depth: 'mid' },
      { id: 'nat_wood_side', key: 'wood_redmoor', x: 206, y: Y + 2, scale: 0.36, rotation: -9, flip: false, depth: 'mid' },
      { id: 'nat_wood_accent', key: 'wood_spider', x: 244, y: Y + 2, scale: 0.32, rotation: -8, flip: true, depth: 'back' },
      { id: 'nat_rot_l1', key: 'rotala_full', x: 20, y: Y, scale: 0.86, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_rot_l2', key: 'rotala_mid', x: 36, y: Y, scale: 0.82, rotation: 0, flip: true, depth: 'back' },
      { id: 'nat_crypt_l', key: 'crypt', x: 56, y: Y, scale: 0.66, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_rot_c1', key: 'rotala_full', x: 148, y: Y, scale: 0.90, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_rot_c2', key: 'rotala_mid', x: 164, y: Y, scale: 0.86, rotation: 0, flip: true, depth: 'back' },
      { id: 'nat_rot_r1', key: 'rotala_full', x: 206, y: Y, scale: 0.88, rotation: 0, flip: true, depth: 'back' },
      { id: 'nat_rot_r2', key: 'rotala_mid', x: 224, y: Y, scale: 0.84, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_val_far_r', key: 'vallisneria', x: 260, y: Y, scale: 0.62, rotation: 0, flip: true, depth: 'back' },
      { id: 'nat_val_far_r2', key: 'vallisneria', x: 274, y: Y, scale: 0.58, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_fern_l', key: 'java_fern', x: 96, y: Y + 1, scale: 0.64, rotation: -2, flip: false, depth: 'front' },
      { id: 'nat_anubias_l', key: 'anubias', x: 62, y: Y + 1, scale: 0.64, rotation: 0, flip: false, depth: 'front' },
      { id: 'nat_buce', key: 'buce', x: 136, y: Y + 1, scale: 0.58, rotation: -1, flip: false, depth: 'front' },
      { id: 'nat_fern_r', key: 'java_fern', x: 180, y: Y + 1, scale: 0.60, rotation: 2, flip: true, depth: 'front' },
      { id: 'nat_moss', key: 'moss', x: 160, y: Y + 1, scale: 0.54, rotation: 0, flip: false, depth: 'front' },
      { id: 'nat_anubias_r', key: 'anubias', x: 234, y: Y + 1, scale: 0.58, rotation: 1, flip: true, depth: 'front' },
      { id: 'nat_float_l', key: 'floating_redroot', x: 54, y: 16, scale: 0.82, rotation: 0, flip: true, depth: 'front' },
      { id: 'nat_float_c', key: 'floating_salvinia', x: 124, y: 16, scale: 0.84, rotation: 0, flip: false, depth: 'front' },
      { id: 'nat_float_r', key: 'floating_redroot', x: 198, y: 16, scale: 0.80, rotation: 0, flip: false, depth: 'front' },
    ],
  },

  review_empty: {
    name: 'Review Empty Tank',
    blurb: 'Baseline water, substrate, lighting, background, and UI obstruction check.',
    reviewOnly: true,
    assets: [],
  },

  review_dense: {
    name: 'Review Dense Tank',
    blurb: 'Stress scene for mixed-media cohesion, scale, occlusion, and silhouette legibility.',
    reviewOnly: true,
    assets: [
      { id: 'dense_wood_l', key: 'wood_manzanita', x: 92, y: Y + 1, scale: 0.42, rotation: -9, flip: false, depth: 'mid' },
      { id: 'dense_wood_r', key: 'wood_spider', x: 198, y: Y + 2, scale: 0.34, rotation: -8, flip: true, depth: 'back' },
      { id: 'dense_stone_l', key: 'stone_seiryu_lg', x: 60, y: Y, scale: 0.82, rotation: -5, flip: false, depth: 'mid' },
      { id: 'dense_stone_c', key: 'stone_dragon', x: 140, y: Y + 1, scale: 0.64, rotation: 6, flip: true, depth: 'front' },
      { id: 'dense_stone_r', key: 'stone_pagoda', x: 220, y: Y + 1, scale: 0.66, rotation: -3, flip: false, depth: 'mid' },
      { id: 'dense_rot_1', key: 'rotala_full', x: 18, y: Y, scale: 0.92, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_rot_2', key: 'rotala_full', x: 38, y: Y, scale: 0.88, rotation: 0, flip: true, depth: 'back' },
      { id: 'dense_rot_3', key: 'rotala_mid', x: 162, y: Y, scale: 0.86, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_val_1', key: 'vallisneria', x: 248, y: Y, scale: 0.66, rotation: 0, flip: true, depth: 'back' },
      { id: 'dense_val_2', key: 'vallisneria', x: 270, y: Y, scale: 0.62, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_fern_1', key: 'java_fern', x: 96, y: Y + 1, scale: 0.62, rotation: -2, flip: false, depth: 'front' },
      { id: 'dense_anubias_1', key: 'anubias', x: 68, y: Y + 1, scale: 0.64, rotation: 0, flip: false, depth: 'front' },
      { id: 'dense_buce_1', key: 'buce', x: 130, y: Y + 1, scale: 0.58, rotation: 0, flip: true, depth: 'front' },
      { id: 'dense_moss_1', key: 'moss', x: 178, y: Y + 1, scale: 0.54, rotation: 0, flip: false, depth: 'front' },
      { id: 'dense_float_1', key: 'floating_salvinia', x: 58, y: 16, scale: 0.84, rotation: 0, flip: false, depth: 'front' },
      { id: 'dense_float_2', key: 'floating_redroot', x: 140, y: 16, scale: 0.82, rotation: 0, flip: true, depth: 'front' },
      { id: 'dense_float_3', key: 'floating_salvinia', x: 218, y: 16, scale: 0.80, rotation: 0, flip: true, depth: 'front' },
    ],
  },

  review_fauna: {
    name: 'Review Fauna Close-Up',
    blurb: 'Sparse hardscape and open water for shrimp animation, tetra scale, and particle readability.',
    reviewOnly: true,
    assets: [
      { id: 'fauna_stone_l', key: 'stone_seiryu_lg', x: 72, y: Y, scale: 0.76, rotation: -7, flip: false, depth: 'mid' },
      { id: 'fauna_stone_r', key: 'stone_dragon', x: 182, y: Y + 1, scale: 0.58, rotation: 5, flip: true, depth: 'mid' },
      { id: 'fauna_wood', key: 'wood_redmoor', x: 136, y: Y + 2, scale: 0.32, rotation: -7, flip: false, depth: 'back' },
      { id: 'fauna_moss', key: 'moss', x: 124, y: Y + 1, scale: 0.50, rotation: 0, flip: false, depth: 'front' },
      { id: 'fauna_anubias', key: 'anubias', x: 94, y: Y + 1, scale: 0.56, rotation: -1, flip: false, depth: 'front' },
      { id: 'fauna_val', key: 'vallisneria', x: 246, y: Y, scale: 0.58, rotation: 0, flip: true, depth: 'back' },
      { id: 'fauna_float', key: 'floating_salvinia', x: 72, y: 16, scale: 0.72, rotation: 0, flip: false, depth: 'front' },
    ],
  },

  fmv_slice: {
    name: 'FMV Slice',
    blurb: 'Vertical-slice composition for atlas-quality review: realistic proportions, clear silhouettes, subtle depth.',
    assets: [
      { id: 'h2_rock_1', key: 'stone_seiryu_lg', x: 92, y: Y, scale: 0.94, rotation: -5, flip: false, depth: 'mid' },
      { id: 'h2_rock_2', key: 'stone_pagoda', x: 128, y: Y + 1, scale: 0.76, rotation: 8, flip: true, depth: 'mid' },
      { id: 'h2_wood_1', key: 'wood_manzanita', x: 164, y: Y + 1, scale: 0.48, rotation: -8, flip: false, depth: 'mid' },
      { id: 'h2_wood_2', key: 'wood_redmoor', x: 214, y: Y + 2, scale: 0.40, rotation: -11, flip: false, depth: 'mid' },
      { id: 'h2_rot_l', key: 'rotala_full', x: 30, y: Y, scale: 0.86, rotation: 0, flip: false, depth: 'back' },
      { id: 'h2_rot_r', key: 'rotala_mid', x: 222, y: Y, scale: 0.88, rotation: 0, flip: true, depth: 'back' },
      { id: 'h2_fern', key: 'java_fern', x: 126, y: Y + 1, scale: 0.62, rotation: -2, flip: false, depth: 'front' },
      { id: 'h2_crypt', key: 'crypt', x: 182, y: Y, scale: 0.66, rotation: 1, flip: true, depth: 'back' },
      { id: 'h2_anubias', key: 'anubias', x: 84, y: Y + 1, scale: 0.68, rotation: -1, flip: false, depth: 'front' },
      { id: 'h2_moss', key: 'moss', x: 146, y: Y + 1, scale: 0.58, rotation: 0, flip: false, depth: 'front' },
      { id: 'h2_val_r', key: 'vallisneria', x: 260, y: Y, scale: 0.62, rotation: 0, flip: true, depth: 'back' },
      { id: 'h2_float_l', key: 'floating_salvinia', x: 66, y: 16, scale: 0.78, rotation: 0, flip: false, depth: 'front' },
      { id: 'h2_float_m', key: 'floating_redroot', x: 144, y: 16, scale: 0.78, rotation: 0, flip: true, depth: 'front' },
      { id: 'h2_float_r', key: 'floating_salvinia', x: 222, y: 16, scale: 0.78, rotation: 0, flip: true, depth: 'front' },
    ],
  },
};

// Backward-compatible alias for older localStorage slots and GitHub links.
SCAPE_PRESETS.hd2d_slice = {
  ...SCAPE_PRESETS.fmv_slice,
  name: 'FMV Slice',
  blurb: `${SCAPE_PRESETS.fmv_slice.blurb} Legacy id: hd2d_slice.`,
};

export function clonePresetAssets(presetId) {
  const preset = SCAPE_PRESETS[presetId];
  if (!preset) return [];
  return preset.assets.map((a) => ({ ...a }));
}
