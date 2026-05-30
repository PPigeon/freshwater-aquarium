// Asset-key vocabulary shared by placement, persistence and the procedural
// factories. Preserved verbatim from the legacy renderer so saved scapes and
// scape presets keep working. Each key maps to a procedural Pixi factory
// (see flora/hardscapeFactory.js + flora/plantFactory.js) instead of a PNG.
// `sx/sy/sw/sh` are legacy sprite-sheet rects, now only used to size preview
// thumbnails; the live tank ignores them.

export const ASSET_DEFS = {
  // ── Driftwood species (5) ──
  wood_spider:    { key: 'wood_spider',    label: 'Spider Wood',     w: 140, h: 70, layer: 'hardscape', defaultScale: 0.62 },
  wood_manzanita: { key: 'wood_manzanita', label: 'Manzanita',       w: 160, h: 80, layer: 'hardscape', defaultScale: 0.55 },
  wood_malaysian: { key: 'wood_malaysian', label: 'Malaysian',       w: 90,  h: 55, layer: 'hardscape', defaultScale: 0.92 },
  wood_mopani:    { key: 'wood_mopani',    label: 'Mopani',          w: 110, h: 55, layer: 'hardscape', defaultScale: 0.78 },
  wood_redmoor:   { key: 'wood_redmoor',   label: 'Redmoor Root',    w: 150, h: 45, layer: 'hardscape', defaultScale: 0.60 },
  // ── Rock species (6) ──
  stone_seiryu_lg:{ key: 'stone_seiryu_lg',label: 'Seiryu (Large)',  w: 60,  h: 40, layer: 'hardscape', defaultScale: 0.92 },
  stone_seiryu_sm:{ key: 'stone_seiryu_sm',label: 'Seiryu (Small)',  w: 40,  h: 28, layer: 'hardscape', defaultScale: 0.82 },
  stone_dragon:   { key: 'stone_dragon',   label: 'Dragon Stone',    w: 70,  h: 45, layer: 'hardscape', defaultScale: 0.82 },
  stone_lava:     { key: 'stone_lava',     label: 'Lava Rock',       w: 50,  h: 35, layer: 'hardscape', defaultScale: 0.85 },
  stone_frodo:    { key: 'stone_frodo',    label: 'Frodo Stone',     w: 65,  h: 40, layer: 'hardscape', defaultScale: 0.88 },
  stone_pagoda:   { key: 'stone_pagoda',   label: 'Pagoda Stone',    w: 55,  h: 38, layer: 'hardscape', defaultScale: 0.88 },
  // ── Plants (8 + 2 floating) ──
  rotala_small: { key: 'rotala', label: 'Rotala S', w: 24, h: 52, sx: 0,  sy: 44, sw: 24, sh: 52, layer: 'plant', defaultScale: 0.9,  sway: true },
  rotala_mid:   { key: 'rotala', label: 'Rotala M', w: 24, h: 74, sx: 24, sy: 22, sw: 24, sh: 74, layer: 'plant', defaultScale: 0.88, sway: true },
  rotala_full:  { key: 'rotala', label: 'Rotala L', w: 24, h: 96, sx: 48, sy: 0,  sw: 24, sh: 96, layer: 'plant', defaultScale: 0.84, sway: true },
  java_fern:    { key: 'java_fern', label: 'Java Fern', w: 40, h: 88, layer: 'plant', defaultScale: 0.74 },
  anubias:      { key: 'anubias', label: 'Anubias Nana', w: 52, h: 38, layer: 'plant', defaultScale: 0.8, anchorYOffset: 3 },
  crypt:        { key: 'crypt', label: 'Cryptocoryne', w: 56, h: 82, layer: 'plant', defaultScale: 0.68, sway: true },
  vallisneria:  { key: 'vallisneria', label: 'Vallisneria', w: 40, h: 116, layer: 'plant', defaultScale: 0.66, sway: true },
  moss:         { key: 'moss', label: 'Java Moss', w: 64, h: 34, layer: 'plant', defaultScale: 0.62 },
  buce:         { key: 'buce', label: 'Bucephalandra', w: 48, h: 84, layer: 'plant', defaultScale: 0.66, sway: true },
  floating_salvinia: { key: 'floating_salvinia', label: 'Salvinia Floater', w: 56, h: 32, layer: 'plant', defaultScale: 0.92, isFloating: true },
  floating_redroot:  { key: 'floating_redroot',  label: 'Red Root Floater', w: 48, h: 34, layer: 'plant', defaultScale: 0.92, isFloating: true },
};
