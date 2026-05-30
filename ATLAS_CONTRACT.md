# Atlas Contract (FMV Diorama)

## Required Manifest Fields
Each manifest entry must define:
- `atlasPath`: PNG path to authored atlas.
- `frameGrid`: `{ rows, cols, frameW, frameH }`.
- `anchor`: normalized `[x, y]` in range `[0..1]`.
- `worldSize`: `{ w, h }` in world units.
- `animTags`: semantic tags and animation metadata.

Optional:
- `sourceRect`: `{ x, y, w, h }` when the frame is cropped from a larger shared atlas.
- `filter`: `"nearest"` or `"linear"`. Default is `"nearest"`.
- `reviewRole`: contact-sheet grouping override for QA tools.

## Validation Rules
- Missing required fields are treated as contract failures.
- `anchor` outside `[0..1]` is invalid.
- `frameGrid` dimensions must be positive finite integers.
- `worldSize` dimensions must be positive finite values.
- Atlas image dimensions must satisfy frame-grid requirements or sourceRect bounds.
- Transparent edge RGB bleed produces warnings for cleanup.
- Any `filter: "linear"` exception should be limited to subtle full-tank overlays,
  never creatures, hardscape, or inspectable plant assets.

## Runtime Behavior
- Atlas files are loaded first-class; procedural baking is not a production path.
- Contract errors do not crash boot; they render magenta error tiles and emit clear
  diagnostics.
- Every loaded frame is forced to nearest-neighbor sampling unless the manifest
  explicitly opts into `filter: "linear"`.

## Vertical Slice Coverage
The first quality gate must include:
- Substrate + water background tiles.
- 2-3 hardscape assets.
- 4 plant archetypes.
- Shrimp variants + neon tetra schooling.
- Bubble/food/mote particles.
- Desktop and mobile screenshots for each review preset.
