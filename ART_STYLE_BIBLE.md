# FMV Aquarium Style Bible

## North Star
This project is a 90s FMV/VGA freshwater aquarium editor: a digitized diorama with
real aquatic material, crisp pixel presentation, and DOS-era tooling. "HD-2D" means
layered depth, parallax, and cinematic staging; it does not mean painterly fantasy
pixel art.

## Visual Priorities
1. Silhouette readability at a glance.
2. Real freshwater anatomy, hardscape texture, and plant material.
3. VGA-era capture character without losing crisp edges.
4. Calm aquarium motion and believable scale.

## Pixel Density + Framing
- Authoring density: `1 source pixel = 1 world unit` (`ART_SCALE = 1`).
- Display textures use nearest-neighbor sampling by default.
- Any smooth-filter exception must be declared in the manifest with
  `filter: "linear"` and justified by the asset's role.
- Camera/world transforms remain integer aligned to avoid shimmer.

## Palette + Value Rules
- Source art is digitized through the shared FMV pipeline: warm grade, VGA 6-bit
  channel quantization, Bayer dither, and controlled analog/capture artifacts.
- Use constrained ramps per material class:
  - Plant tissue: 4-6 values with one warm accent tier.
  - Stone: 5-7 values with cool highlight and dark fracture tier.
  - Wood: 5-7 values with a warm midtone and cool shadow split.
  - Creature body: 5-8 values with high-contrast feature bands.
- Keep deep blacks sparse; reserve near-black for outlines, creases, occlusion,
  and VHS/capture falloff.
- Texture should read as clustered capture grain, not static noise.

## Outline + Edge Policy
- Outer contour: readable dark edge or natural high-contrast cutout.
- Inner lines: only where anatomy, wood grain, stone fracture, or leaf structure
  needs them.
- Transparent edge bleed is disallowed; zero-alpha pixels should not carry bright
  RGB contamination.
- Photo-derived assets must still survive a small in-scene read test.

## Lighting + Post
- Atmosphere and volumetric layers are secondary to sprite legibility.
- Allowed: restrained light cone, soft depth haze, very light vignette, thin
  caustics, VGA film grain.
- Disallowed: blur on sprites, bloom that smears edges, heavy global grade shifts,
  or effects that hide small fauna.

## Motion Language
- Motion should feel calm and natural:
  - Fish: clean tail cadence and micro body sway.
  - Shrimp: readable leg and antenna movement without visual chatter.
  - Plants: low-amplitude sway focused near tips.
- Animation contrast comes from shape rhythm and timing, not blur.

## Review Gates
- Review with deterministic scene URLs before accepting new art.
- Always compare the three iteration variants: conservative, stronger FMV, cleaner
  pixel.
- Contact sheets must flag alpha bleed, weak silhouettes, palette drift,
  mismatched scale, and assets that vanish against water or substrate.

## Performance Envelope
- Target: smooth 60 FPS on desktop and mobile for representative scenes.
- Cap additive overlays and particle counts before reducing sprite detail.
- Atlas memory is preferred over runtime procedural complexity.
