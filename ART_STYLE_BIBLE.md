# HD-2D Aquarium Style Bible

## Visual Priorities
1. Silhouette readability at a glance.
2. Realistic aquatic anatomy and material language.
3. Subtle cinematic depth without softening pixel edges.

## Pixel Density + Framing
- Authoring density: `1 source pixel = 1 world unit` (`ART_SCALE = 1`).
- All display textures use nearest-neighbor sampling only.
- Camera/world transforms remain integer aligned to avoid shimmer.

## Palette + Value Rules
- Use constrained ramps per material class:
  - Plant tissue: 4-6 values with one warm accent tier.
  - Stone: 5-7 values with cool highlight and dark fracture tier.
  - Wood: 5-7 values with a warm midtone and cool shadow split.
  - Creature body: 5-8 values with high-contrast feature bands (eye, stripe, markings).
- Keep deep blacks sparse; reserve near-black for outlines, creases, and occlusion seams.
- No random noise flood fill. Texture should read as clustered brushwork, not static.

## Outline + Edge Policy
- Outer contour: 1px dark outline for readability in front of bright water.
- Inner lines: only where anatomical structure or material breaks are needed.
- Transparent edge bleed is disallowed; zero-alpha pixels should avoid bright RGB contamination.

## Lighting + Post
- Atmosphere and volumetric layers are always secondary to sprite legibility.
- Allowed: restrained light cone, soft depth haze, very light vignette, thin caustics.
- Disallowed: blur on sprites, bloom that smears edge readability, heavy global grade shifts.

## Motion Language
- Motion should feel calm and natural:
  - Fish: clean tail cadence and micro body sway.
  - Shrimp: readable leg and antenna movement without visual chatter.
  - Plants: low-amplitude sway focused near tips.
- Animation contrast comes from shape rhythm and timing, not blur.

## Performance Envelope
- Target: smooth 60 FPS on desktop and mobile for representative scenes.
- Cap additive overlays and particle counts before reducing sprite detail.
- Atlas memory is preferred over runtime procedural complexity.
