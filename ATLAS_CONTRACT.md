# Atlas Contract (HD-2D)

## Required Manifest Fields
Each manifest entry must define:
- `atlasPath`: PNG path to authored atlas.
- `frameGrid`: `{ rows, cols, frameW, frameH }`.
- `anchor`: normalized `[x, y]` in range `[0..1]`.
- `worldSize`: `{ w, h }` in world units.
- `animTags`: semantic tags and animation metadata.

Optional:
- `sourceRect`: `{ x, y, w, h }` when the frame is cropped from a larger shared atlas.

## Validation Rules
- Missing required fields are treated as contract failures.
- `anchor` outside `[0..1]` is invalid.
- `frameGrid` dimensions must be positive finite integers.
- `worldSize` dimensions must be positive finite values.
- Atlas image dimensions must satisfy frame-grid requirements or sourceRect bounds.
- Transparent edge RGB bleed produces warnings for cleanup.

## Runtime Behavior
- Atlas files are loaded first-class; procedural baking is not a production path.
- Contract errors do not crash boot; they render magenta error tiles and emit clear diagnostics.
- Every loaded frame is forced to nearest-neighbor sampling.

## Vertical Slice Coverage
The first quality gate must include:
- Substrate + water background tiles.
- 2-3 hardscape assets.
- 4 plant archetypes.
- Shrimp variants + neon tetra schooling.
- Bubble/food/mote particles.
