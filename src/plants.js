// Plant positions, layout, and sway calculation
// Triangular aquascape: high point right (driftwood + stems), open water left

const GS = 3;

// Stem plant columns — start behind driftwood, extend past its right edge.
// Driftwood native 100px at x=88 → right edge at x=188.
// Columns at 172+ peek out to the right, forming the triangular high point.
export const STEM_COLUMNS = [170, 183, 196, 210, 225];

// Per-plant starting maturity offset (in PLANT_GROW_INTERVAL units).
// Simulates plants pre-established at different sizes before shrimp are added.
// [2=full, 0=seedling, 1=medium, 2=full, 1=medium] → visible variety on day 1
export const PLANT_OFFSETS = [2, 0, 1, 2, 1];

// (Legacy LAYOUT removed — hardscape positions now live in main.js DEFAULT_ASSETS / placedAssets.)

// Substrate Y position (grid units)
export const CARPET_Y_OFFSET = -4;

// Compute per-row sway horizontal offset for a plant pixel
// heightFraction = 0 at base, 1 at tip
export function swayOffset(time, plantX, rowY, groundY, maxHeight) {
  const heightFraction = Math.max(0, (groundY - rowY) / maxHeight);
  const primary = Math.sin(time * 0.34 + plantX * 0.08 + rowY * 0.012);
  const secondary = Math.sin(time * 0.21 + plantX * 0.035);
  return Math.round(
    (primary * 1.05 + secondary * 0.45) * heightFraction
  );
}

// Returns growth stage (0-2) for a stem plant column index
export function getPlantStage(plantStages, colIndex) {
  return plantStages[colIndex] ?? 0;
}

// Rotala source x offset in 24×40 image for each stage
export function rotalaSourceX(stage) {
  return stage * 16;
}

// Plant heights in pixels (native) per stage — must match generate_sprites.py heights[]
export const STEM_HEIGHTS = [24, 36, 48];

// Java fern leaf source rects in java_fern.png (54×40)
export const JAVA_FERN_SIZES = [
  { sx: 0,  sy: 0, sw: 16, sh: 26 },  // small
  { sx: 20, sy: 0, sw: 24, sh: 39 },  // medium
  { sx: 44, sy: 0, sw: 32, sh: 52 },  // large
];
