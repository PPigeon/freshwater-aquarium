// Y base for all substrate-anchored placements.
// Anchor is [0.5, 1.0] (bottom-centre), so items grow upward from here.
const Y = 128;

// ── Pixel-fidelity scale vocabulary ─────────────────────────────────────────
// At 5× world-to-screen scale, nearest-neighbour is only perfectly crisp when
// (scape_scale × 5) is an integer.  Use multiples of 0.20:
//   0.20 = 1×   0.40 = 2×   0.60 = 3×   0.80 = 4×
//   1.00 = 5×   1.20 = 6×   1.40 = 7×   1.60 = 8×
// Small variation (±0.02) is acceptable for compositional subtlety.
// Avoid values like 0.34, 0.66, 0.92 — their fractional multiples create
// irregular pixel-block sizes that read as blurriness.
//
// Target proportions (water column = 113 world units):
//   Large stone (hero)    : 1.20–1.40 → 48–56 units = 42–50 % of column
//   Background stems (val): 0.60–0.80 → 70–93 units = 62–82 %
//   Mid-ground plants     : 0.60       → 49–53 units = 43–47 %
//   Foreground / low      : 0.40–0.60
//   Wood main             : 0.60       → 43–48 units = 38–42 %
//   Floating plants       : 0.60       → 28–34 units wide (delicate, not blobs)

export const REVIEW_SCENE_IDS = [
  'iwagumi',
  'nature',
  'review_empty',
  'review_dense',
  'review_fauna',
  'review_dense_balance',
  'review_dense_lush',
  'review_dense_open',
];

export const REVIEW_URLS = [
  { id: 'iwagumi_day', label: 'Iwagumi / day', query: '?review=iwagumi&seed=11&editor=0' },
  { id: 'nature_day', label: 'Nature / day', query: '?review=nature&seed=12&editor=0' },
  { id: 'empty_day', label: 'Empty tank / day', query: '?review=review_empty&seed=13&editor=0' },
  { id: 'dense_day', label: 'Dense tank / day', query: '?review=review_dense&seed=14&editor=0' },
  { id: 'nature_night', label: 'Nature / night', query: '?review=nature&lighting=night&seed=15&editor=0' },
  { id: 'fauna_close', label: 'Close fauna / day', query: '?review=review_fauna&seed=16&editor=0&zoom=1.55&panX=-120&panY=-35' },
  { id: 'dense_balance', label: 'Dense / balance', query: '?review=review_dense_balance&seed=21&editor=0' },
  { id: 'dense_lush', label: 'Dense / lush', query: '?review=review_dense_lush&seed=22&editor=0' },
  { id: 'dense_open', label: 'Dense / open lanes', query: '?review=review_dense_open&seed=23&editor=0' },
];

export const SCAPE_PRESETS = {

  // ── Iwagumi ──────────────────────────────────────────────────────────────────
  // Stone hierarchy — oyaishi at 1.20 (6×, 48 h = 42 % of tank) is the clear hero.
  // Background vals at 0.80 (4×, 93 h = 82 %) visible above stones but not
  // crowding the waterline.  All values are clean pixel multiples.
  iwagumi: {
    name: 'Iwagumi',
    blurb: 'Stone hierarchy with sweeping background stems, restrained foreground epiphytes, and clean negative space.',
    assets: [
      // Stones — 1.20 / 1.00 / 0.80 (6× / 5× / 4× clean)
      { id: 'iwa_oyaishi',    key: 'stone_seiryu_lg', x: 118, y: Y,     scale: 1.20, rotation: -10, flip: false, depth: 'mid'   },
      { id: 'iwa_fukuishi_l', key: 'stone_seiryu_lg', x:  72, y: Y + 1, scale: 0.82, rotation:   7, flip: true,  depth: 'mid'   },
      { id: 'iwa_fukuishi_r', key: 'stone_dragon',    x: 170, y: Y + 1, scale: 0.80, rotation:  -8, flip: false, depth: 'mid'   },
      { id: 'iwa_suteishi1',  key: 'stone_seiryu_sm', x:  46, y: Y + 2, scale: 0.62, rotation:   5, flip: false, depth: 'front' },
      { id: 'iwa_suteishi2',  key: 'stone_seiryu_sm', x: 196, y: Y + 2, scale: 0.60, rotation:  -5, flip: true,  depth: 'front' },
      { id: 'iwa_suteishi3',  key: 'stone_lava',      x: 148, y: Y + 2, scale: 0.60, rotation:   3, flip: true,  depth: 'front' },
      // Tall depth layer (back-most) — scale 1.00 (5×, pixel-perfect); tops reach waterline
      // Cabomba feathery columns flank, with vals between them
      { id: 'iwa_cab_l',   key: 'cabomba',      x:  18, y: Y, scale: 1.20, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_cab_r',   key: 'cabomba',      x: 254, y: Y, scale: 1.20, rotation: 0, flip: true,  depth: 'back' },
      // Vallisneria layer at 0.80 (4×) in front of cabomba
      { id: 'iwa_val_l',  key: 'vallisneria', x:  14, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_rot_l1', key: 'vallisneria', x:  32, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_rot_l2', key: 'crypt',       x:  48, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'iwa_rot_r1', key: 'vallisneria', x: 218, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'iwa_rot_r2', key: 'crypt',       x: 236, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'iwa_val_r',  key: 'vallisneria', x: 268, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      // Mid-ground epiphytes — 0.60 (3×) clean
      { id: 'iwa_fern_l',    key: 'java_fern', x: 104, y: Y + 1, scale: 0.60, rotation: -2, flip: false, depth: 'front' },
      { id: 'iwa_fern_r',    key: 'java_fern', x: 156, y: Y + 1, scale: 0.60, rotation:  2, flip: true,  depth: 'front' },
      { id: 'iwa_anubias_l', key: 'anubias',   x:  82, y: Y + 1, scale: 0.60, rotation: -2, flip: false, depth: 'front' },
      { id: 'iwa_moss',      key: 'moss',      x: 132, y: Y + 1, scale: 0.40, rotation:  0, flip: false, depth: 'front' },
      // Floating plants — 0.60 (3×) clean; small and scattered
      { id: 'iwa_float_l', key: 'floating_salvinia', x:  62, y: 16, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'iwa_float_r', key: 'floating_redroot',  x: 202, y: 16, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
    ],
  },

  // ── Nature Aquarium ───────────────────────────────────────────────────────────
  // Manzanita at 0.60 (3×, h=48 = 42 %) is the mid-scene anchor alongside the stone.
  // Vals at 0.80 (4×, h=93) fill background without dominating.
  nature: {
    name: 'Nature Aquarium',
    blurb: 'Full, vibrant planted scape with layered stems, epiphyte massing, and open shrimp foraging lanes.',
    assets: [
      // Hardscape — 1.00 / 0.80 / 0.60 clean
      { id: 'nat_stone_anchor', key: 'stone_seiryu_lg', x:  74, y: Y,     scale: 1.00, rotation:  -6, flip: false, depth: 'mid'   },
      { id: 'nat_stone_sm',     key: 'stone_seiryu_sm', x:  46, y: Y + 2, scale: 0.60, rotation:  -8, flip: true,  depth: 'front' },
      { id: 'nat_wood_main',    key: 'wood_manzanita',  x: 112, y: Y + 1, scale: 0.60, rotation:  -8, flip: false, depth: 'mid'   },
      { id: 'nat_dragon',       key: 'stone_dragon',    x: 168, y: Y + 1, scale: 0.80, rotation:  -5, flip: true,  depth: 'mid'   },
      { id: 'nat_wood_side',    key: 'wood_redmoor',    x: 200, y: Y + 2, scale: 0.40, rotation:  -9, flip: false, depth: 'mid'   },
      // Extreme-background tall layer — scale 1.00 (5×, pixel-perfect); tops reach waterline.
      // Ludwigia (warm reddish tips) + cabomba (feathery) create COLOUR + TEXTURE depth.
      // Left cluster: cabomba + dense ludwigia group
      { id: 'nat_cab_l',   key: 'cabomba',      x:   6, y: Y, scale: 1.20, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_ludw_l',  key: 'ludwigia',     x:  18, y: Y, scale: 1.00, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_ludw_l2', key: 'ludwigia',     x:  28, y: Y, scale: 1.00, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_ludw_l3', key: 'ludwigia',     x:  38, y: Y, scale: 1.00, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_ludw_l4', key: 'ludwigia',     x:  46, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      // Right cluster: mirror dense ludwigia + cabomba
      { id: 'nat_ludw_r',  key: 'ludwigia',     x: 244, y: Y, scale: 1.00, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_ludw_r2', key: 'ludwigia',     x: 254, y: Y, scale: 1.00, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_ludw_r3', key: 'ludwigia',     x: 264, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_cab_r',   key: 'cabomba',      x: 270, y: Y, scale: 1.20, rotation: 0, flip: true,  depth: 'back' },
      // Amazon sword — large mid-back focal plant, left of centre
      { id: 'nat_sword',   key: 'amazon_sword', x:  88, y: Y, scale: 1.40, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_sword2',  key: 'amazon_sword', x: 108, y: Y, scale: 1.20, rotation: 0, flip: true,  depth: 'back' },
      // Vallisneria layer at 0.80 (4×) filling the background
      { id: 'nat_rot_l1',    key: 'vallisneria', x:  52, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_rot_l2',    key: 'vallisneria', x:  68, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_rot_c1',    key: 'vallisneria', x: 136, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_rot_c2',    key: 'crypt',       x: 152, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_rot_r1',    key: 'vallisneria', x: 208, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_rot_r2',    key: 'vallisneria', x: 224, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_crypt_l',   key: 'crypt',       x: 116, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'nat_crypt_mid', key: 'crypt',       x: 178, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'nat_val_far_r', key: 'vallisneria', x: 244, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      // Mid-ground epiphytes — 0.60 clean
      { id: 'nat_fern_l',    key: 'java_fern', x:  92, y: Y + 1, scale: 0.60, rotation: -2, flip: false, depth: 'front' },
      { id: 'nat_anubias_l', key: 'anubias',   x:  62, y: Y + 1, scale: 0.60, rotation:  0, flip: false, depth: 'front' },
      { id: 'nat_buce',      key: 'buce',      x: 128, y: Y + 1, scale: 0.60, rotation: -1, flip: false, depth: 'front' },
      { id: 'nat_fern_r',    key: 'java_fern', x: 176, y: Y + 1, scale: 0.60, rotation:  2, flip: true,  depth: 'front' },
      { id: 'nat_moss',      key: 'moss',      x: 152, y: Y + 1, scale: 0.40, rotation:  0, flip: false, depth: 'front' },
      { id: 'nat_anubias_r', key: 'anubias',   x: 228, y: Y + 1, scale: 0.60, rotation:  1, flip: true,  depth: 'front' },
      // Floating plants — 0.60 clean
      { id: 'nat_float_l', key: 'floating_redroot',  x:  52, y: 16, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
      { id: 'nat_float_c', key: 'floating_salvinia', x: 124, y: 16, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'nat_float_r', key: 'floating_redroot',  x: 200, y: 16, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
    ],
  },

  // ── Review: Empty ────────────────────────────────────────────────────────────
  review_empty: {
    name: 'Review Empty Tank',
    blurb: 'Baseline water, substrate, lighting, background, and UI obstruction check.',
    reviewOnly: true,
    assets: [],
  },

  // ── Review: Dense ────────────────────────────────────────────────────────────
  review_dense: {
    name: 'Review Dense Tank',
    blurb: 'Heavily planted studio scape with filled verticals, tucked bases, and readable cherry shrimp lanes.',
    reviewOnly: true,
    assets: [
      { id: 'dense_wall_l0', key: 'stem_wall_lush',   x:  42, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_wall_c0', key: 'stem_wall_bronze',  x: 142, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_wall_r0', key: 'stem_wall_lush',   x: 228, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_rot_l0', key: 'vallisneria', x:  12, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_rot_l1', key: 'vallisneria', x:  26, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_rot_l2', key: 'crypt',       x:  40, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_crypt_l',key: 'crypt',       x:  56, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_rot_c0', key: 'vallisneria', x: 132, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_rot_c1', key: 'crypt',       x: 148, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_crypt_c',key: 'crypt',       x: 166, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_rot_r0', key: 'vallisneria', x: 218, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_rot_r1', key: 'vallisneria', x: 234, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_val_r0', key: 'vallisneria', x: 252, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_val_r1', key: 'vallisneria', x: 270, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_stone_l',    key: 'stone_seiryu_lg', x:  64, y: Y,     scale: 0.80, rotation:  -5, flip: false, depth: 'mid'   },
      { id: 'dense_stone_l_sm', key: 'stone_seiryu_sm', x:  42, y: Y,     scale: 0.60, rotation:   5, flip: true,  depth: 'front' },
      { id: 'dense_wood_l',     key: 'wood_manzanita',  x: 104, y: Y,     scale: 0.40, rotation:  -5, flip: false, depth: 'mid'   },
      { id: 'dense_stone_c',    key: 'stone_dragon',    x: 148, y: Y,     scale: 0.60, rotation:   4, flip: true,  depth: 'front' },
      { id: 'dense_wood_r',     key: 'wood_redmoor',    x: 194, y: Y,     scale: 0.40, rotation:  -6, flip: true,  depth: 'back'  },
      { id: 'dense_stone_r',    key: 'stone_pagoda',    x: 222, y: Y,     scale: 0.60, rotation:  -2, flip: false, depth: 'mid'   },
      { id: 'dense_val_l2',   key: 'vallisneria', x:  78, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_crypt_l2', key: 'crypt',       x: 104, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_fern_c2',  key: 'java_fern',   x: 124, y: Y, scale: 0.60, rotation:-1, flip: false, depth: 'front' },
      { id: 'dense_crypt_c2', key: 'crypt',       x: 188, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'dense_val_r2',   key: 'vallisneria', x: 204, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'dense_anubias_l',key: 'anubias',     x:  68, y: Y, scale: 0.60, rotation:-1, flip: false, depth: 'front' },
      { id: 'dense_fern_l',   key: 'java_fern',   x:  94, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'front' },
      { id: 'dense_moss_l',   key: 'moss',        x: 116, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'dense_buce_c',   key: 'buce',        x: 142, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
      { id: 'dense_moss_c',   key: 'moss',        x: 172, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'dense_fern_r',   key: 'java_fern',   x: 202, y: Y, scale: 0.60, rotation: 2, flip: true,  depth: 'front' },
      { id: 'dense_anubias_r',key: 'anubias',     x: 232, y: Y, scale: 0.60, rotation: 1, flip: true,  depth: 'front' },
      { id: 'dense_moss_r',   key: 'moss',        x: 248, y: Y, scale: 0.40, rotation: 0, flip: true,  depth: 'front' },
    ],
  },

  // ── Review: Fauna close-up ────────────────────────────────────────────────────
  review_fauna: {
    name: 'Review Fauna Close-Up',
    blurb: 'Close fauna lane framed by dense planting, clean substrate contact, and low artifact pressure.',
    reviewOnly: true,
    assets: [
      { id: 'fauna_wall_l', key: 'stem_wall_lush',   x:  74, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'fauna_wall_r', key: 'stem_wall_bronze', x: 204, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'fauna_val_l0', key: 'vallisneria', x:  24, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'fauna_val_l1', key: 'vallisneria', x:  44, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'fauna_crypt_l',key: 'crypt',       x:  66, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'fauna_fern_l0',  key: 'java_fern', x:  88, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'front' },
      { id: 'fauna_anubias_l',key: 'anubias',   x: 106, y: Y, scale: 0.60, rotation:-1, flip: false, depth: 'front' },
      { id: 'fauna_moss_l',   key: 'moss',      x: 124, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'fauna_stone_l',  key: 'stone_seiryu_lg', x: 74, y: Y, scale: 0.60, rotation:-5, flip: false, depth: 'mid'   },
      { id: 'fauna_stone_l2', key: 'stone_seiryu_sm', x: 52, y: Y, scale: 0.40, rotation: 5, flip: true,  depth: 'front' },
      { id: 'fauna_moss_c',    key: 'moss',    x: 146, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'fauna_anubias_c', key: 'anubias', x: 164, y: Y, scale: 0.60, rotation: 1, flip: true,  depth: 'front' },
      { id: 'fauna_stone_r',  key: 'stone_dragon', x: 182, y: Y, scale: 0.60, rotation: 4, flip: true,  depth: 'mid'   },
      { id: 'fauna_fern_r0',  key: 'java_fern', x: 198, y: Y, scale: 0.60, rotation: 2, flip: true,  depth: 'front' },
      { id: 'fauna_crypt_r',  key: 'crypt',     x: 220, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back'  },
      { id: 'fauna_val_r0',   key: 'vallisneria', x: 244, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'fauna_val_r1',   key: 'vallisneria', x: 264, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
    ],
  },

  // ── Review: Dense Balance ─────────────────────────────────────────────────────
  review_dense_balance: {
    name: 'Review Dense Balance',
    blurb: 'Concave planted composition with disciplined hardscape scale and clear fauna lanes.',
    reviewOnly: true,
    assets: [
      { id: 'b_wall_l', key: 'stem_wall_lush',   x:  44, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_wall_r', key: 'stem_wall_bronze', x: 226, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'b_rot_l0', key: 'vallisneria', x:  12, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_rot_l1', key: 'vallisneria', x:  28, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'b_rot_l2', key: 'crypt',       x:  44, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_crypt_l',key: 'crypt',       x:  62, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_rot_r0', key: 'vallisneria', x: 212, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'b_rot_r1', key: 'vallisneria', x: 230, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_val_r0', key: 'vallisneria', x: 250, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'b_val_r1', key: 'vallisneria', x: 268, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'b_stone_l', key: 'stone_seiryu_lg', x:  74, y: Y, scale: 0.80, rotation:-4, flip: false, depth: 'mid'  },
      { id: 'b_wood_l',  key: 'wood_manzanita',  x: 110, y: Y, scale: 0.40, rotation:-6, flip: false, depth: 'mid'  },
      { id: 'b_stone_c', key: 'stone_dragon',    x: 146, y: Y, scale: 0.60, rotation: 5, flip: true,  depth: 'front'},
      { id: 'b_wood_r',  key: 'wood_redmoor',    x: 188, y: Y, scale: 0.40, rotation:-6, flip: true,  depth: 'back' },
      { id: 'b_stone_r', key: 'stone_pagoda',    x: 220, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'mid'  },
      { id: 'b_anubias_l',key: 'anubias',   x:  72, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'b_fern_l',   key: 'java_fern', x:  98, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'front' },
      { id: 'b_buce_c',   key: 'buce',      x: 132, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
      { id: 'b_moss_c',   key: 'moss',      x: 170, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'b_fern_r',   key: 'java_fern', x: 202, y: Y, scale: 0.60, rotation: 2, flip: true,  depth: 'front' },
      { id: 'b_anubias_r',key: 'anubias',   x: 232, y: Y, scale: 0.60, rotation: 1, flip: true,  depth: 'front' },
    ],
  },

  // ── Review: Dense Lush ────────────────────────────────────────────────────────
  review_dense_lush: {
    name: 'Review Dense Lush',
    blurb: 'Maximum planted fullness with minimized hardscape and a full-height aquascape wall.',
    reviewOnly: true,
    assets: [
      { id: 'l_wall_l', key: 'stem_wall_lush',   x:  42, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_wall_c', key: 'stem_wall_bronze',  x: 142, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_wall_r', key: 'stem_wall_lush',   x: 228, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_rot_0',  key: 'vallisneria', x:  10, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_rot_1',  key: 'vallisneria', x:  24, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_rot_2',  key: 'crypt',       x:  38, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_crypt_0',key: 'crypt',       x:  54, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_rot_3',  key: 'vallisneria', x: 116, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_rot_4',  key: 'vallisneria', x: 132, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_rot_5',  key: 'crypt',       x: 150, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_crypt_1',key: 'crypt',       x: 168, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_rot_6',  key: 'vallisneria', x: 210, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_rot_7',  key: 'vallisneria', x: 228, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_val_0',  key: 'vallisneria', x: 248, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'l_val_1',  key: 'vallisneria', x: 268, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'l_stone_l', key: 'stone_seiryu_lg', x:  68, y: Y, scale: 0.60, rotation:-4, flip: false, depth: 'mid'  },
      { id: 'l_wood_l',  key: 'wood_manzanita',  x: 104, y: Y, scale: 0.40, rotation:-6, flip: false, depth: 'mid'  },
      { id: 'l_stone_c', key: 'stone_dragon',    x: 152, y: Y, scale: 0.60, rotation: 4, flip: true,  depth: 'front'},
      { id: 'l_anubias_0',key: 'anubias',   x:  62, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'l_fern_0',   key: 'java_fern', x:  86, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'front' },
      { id: 'l_moss_0',   key: 'moss',      x: 112, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'l_buce_0',   key: 'buce',      x: 136, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
      { id: 'l_moss_1',   key: 'moss',      x: 164, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'l_fern_1',   key: 'java_fern', x: 198, y: Y, scale: 0.60, rotation: 2, flip: true,  depth: 'front' },
      { id: 'l_anubias_1',key: 'anubias',   x: 226, y: Y, scale: 0.60, rotation: 1, flip: true,  depth: 'front' },
    ],
  },

  // ── Review: Dense Open Lanes ──────────────────────────────────────────────────
  review_dense_open: {
    name: 'Review Dense Open Lanes',
    blurb: 'Dense side plantings with a polished central viewing lane for fish and cherry shrimp.',
    reviewOnly: true,
    assets: [
      { id: 'o_wall_l', key: 'stem_wall_lush', x:  42, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'o_wall_r', key: 'stem_wall_lush', x: 238, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'o_rot_l0', key: 'vallisneria', x:  12, y: Y, scale: 0.80, rotation: 0, flip: false, depth: 'back' },
      { id: 'o_rot_l1', key: 'vallisneria', x:  28, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'o_rot_l2', key: 'crypt',       x:  44, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'o_crypt_l',key: 'crypt',       x:  62, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'o_rot_r0', key: 'vallisneria', x: 220, y: Y, scale: 0.80, rotation: 0, flip: true,  depth: 'back' },
      { id: 'o_rot_r1', key: 'crypt',       x: 238, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'back' },
      { id: 'o_val_r0', key: 'vallisneria', x: 258, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'back' },
      { id: 'o_stone_l', key: 'stone_seiryu_lg', x:  66, y: Y, scale: 0.80, rotation:-4, flip: false, depth: 'mid'  },
      { id: 'o_wood_l',  key: 'wood_manzanita',  x:  96, y: Y, scale: 0.40, rotation:-6, flip: false, depth: 'mid'  },
      { id: 'o_wood_r',  key: 'wood_redmoor',    x: 198, y: Y, scale: 0.40, rotation:-6, flip: true,  depth: 'back' },
      { id: 'o_stone_r', key: 'stone_pagoda',    x: 222, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'mid'  },
      { id: 'o_anubias_l',key: 'anubias',   x:  68, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'o_fern_l',   key: 'java_fern', x:  92, y: Y, scale: 0.60, rotation:-2, flip: false, depth: 'front' },
      { id: 'o_buce_l',   key: 'buce',      x: 118, y: Y, scale: 0.60, rotation: 0, flip: true,  depth: 'front' },
      { id: 'o_moss_c',   key: 'moss',      x: 146, y: Y, scale: 0.40, rotation: 0, flip: false, depth: 'front' },
      { id: 'o_buce_r',   key: 'buce',      x: 174, y: Y, scale: 0.60, rotation: 0, flip: false, depth: 'front' },
      { id: 'o_fern_r',   key: 'java_fern', x: 206, y: Y, scale: 0.60, rotation: 2, flip: true,  depth: 'front' },
      { id: 'o_anubias_r',key: 'anubias',   x: 232, y: Y, scale: 0.60, rotation: 1, flip: true,  depth: 'front' },
    ],
  },

  // ── FMV Slice ─────────────────────────────────────────────────────────────────
  fmv_slice: {
    name: 'FMV Slice',
    blurb: 'Vertical-slice composition for atlas-quality review: realistic proportions, clear silhouettes, subtle depth.',
    assets: [
      { id: 'h2_rock_1',  key: 'stone_seiryu_lg', x:  92, y: Y,     scale: 1.20, rotation:  -5, flip: false, depth: 'mid'   },
      { id: 'h2_rock_2',  key: 'stone_pagoda',    x: 128, y: Y + 1, scale: 1.00, rotation:   8, flip: true,  depth: 'mid'   },
      { id: 'h2_wood_1',  key: 'wood_manzanita',  x: 164, y: Y + 1, scale: 0.60, rotation:  -8, flip: false, depth: 'mid'   },
      { id: 'h2_wood_2',  key: 'wood_redmoor',    x: 214, y: Y + 2, scale: 0.60, rotation: -11, flip: false, depth: 'mid'   },
      { id: 'h2_rot_l',   key: 'vallisneria',     x:  30, y: Y,     scale: 0.80, rotation:   0, flip: false, depth: 'back'  },
      { id: 'h2_rot_r',   key: 'crypt',           x: 222, y: Y,     scale: 0.60, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'h2_fern',    key: 'java_fern',       x: 126, y: Y + 1, scale: 0.60, rotation:  -2, flip: false, depth: 'front' },
      { id: 'h2_crypt',   key: 'crypt',           x: 182, y: Y,     scale: 0.60, rotation:   1, flip: true,  depth: 'back'  },
      { id: 'h2_anubias', key: 'anubias',         x:  84, y: Y + 1, scale: 0.60, rotation:  -1, flip: false, depth: 'front' },
      { id: 'h2_moss',    key: 'moss',            x: 146, y: Y + 1, scale: 0.40, rotation:   0, flip: false, depth: 'front' },
      { id: 'h2_val_r',   key: 'vallisneria',     x: 260, y: Y,     scale: 0.60, rotation:   0, flip: true,  depth: 'back'  },
      { id: 'h2_float_l', key: 'floating_salvinia', x:  66, y: 16,  scale: 0.60, rotation:   0, flip: false, depth: 'front' },
      { id: 'h2_float_m', key: 'floating_redroot',  x: 144, y: 16,  scale: 0.60, rotation:   0, flip: true,  depth: 'front' },
      { id: 'h2_float_r', key: 'floating_salvinia', x: 222, y: 16,  scale: 0.60, rotation:   0, flip: true,  depth: 'front' },
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
