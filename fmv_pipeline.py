#!/usr/bin/env python3
"""
fmv_pipeline.py — Real-Reference Photo-to-FMV-Sprite Digitization Pipeline
============================================================================
Converts reference photographs into authentic 90s FMV game sprites matching
the visual quality of Harvester (1996) and Phantasmagoria (1995).

Usage:
    python fmv_pipeline.py                          # Process all references
    python fmv_pipeline.py --dry                    # Show what would be processed
    python fmv_pipeline.py --subject shrimp/red_cherry   # One subject only
    python fmv_pipeline.py --stage 1                # Re-run from stage N
    python fmv_pipeline.py --palette-only           # Rebuild shared palette, re-quantize

Requirements:
    pip install rembg[cpu] hitherdither imagequant numpy scipy pillow
    pip install git+https://github.com/hbldh/hitherdither.git  (if not on PyPI)

Directory structure:
    references/{category}/{subject}/    ← Drop source photos here
    _intermediates/                     ← Intermediate processing steps (inspect here)
    assets/sprites/                     ← Output (drop-in replacement for existing sprites)
"""

import sys, os, math, json, hashlib, io, argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from rembg import remove, new_session

PYTHON = sys.executable
PROJECT_ROOT = Path(__file__).parent
REFERENCES   = PROJECT_ROOT / 'references'
INTERMEDIATES = PROJECT_ROOT / '_intermediates'
OUTPUT_ROOT  = PROJECT_ROOT / 'assets' / 'sprites'
PALETTE_CACHE = INTERMEDIATES / '_palette.json'  # legacy — removed on startup

# ── 8×8 Bayer matrix for ordered dithering ─────────────────────────────────
# Used by stage7_bayer_dither.  Palette-free: displaces each pixel by the
# matrix value then re-snaps to the VGA 6-bit grid.  This is how VGA hardware
# ordered dithering actually worked — no predefined colour table required.
BAYER8 = np.array([
    [ 0, 32,  8, 40,  2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44,  4, 36, 14, 46,  6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [ 3, 35, 11, 43,  1, 33,  9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47,  7, 39, 13, 45,  5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
], dtype=np.float32) / 64.0   # normalised 0..1

# ──────────────────────────────────────────────────────────────────────────────
# MANIFEST SPECS
# Maps subject path (e.g. 'shrimp/red_cherry') -> output spec
# All dimensions in pixels. Matches manifest.js exactly.
# ──────────────────────────────────────────────────────────────────────────────

SHRIMP_VARIANTS = [
    'red_cherry', 'blue_dream', 'yellow_fire', 'black_rose',
    'snowball', 'rili', 'carbon_rili', 'blue_rili', 'orange_pumpkin', 'green_jade',
]
SHRIMP_SEXES = ['male', 'female']

# Color shift parameters for synthesized shrimp variants (hue rotation in degrees)
# Applied to the nearest photographed base variant
SHRIMP_SYNTH = {
    # 'variant': ('base_variant', hue_shift_deg, sat_factor, val_factor)
    'snowball':      ('red_cherry',  0,   0.05, 1.15),   # Near-white: desaturate heavily
    'rili':          ('red_cherry',  0,   1.0,  1.0),    # Same as red but rili pattern added
    'carbon_rili':   ('black_rose',  0,   1.0,  1.0),    # Same as black but rili
    'blue_rili':     ('blue_dream',  0,   1.0,  1.0),    # Same as blue but rili
    'orange_pumpkin':('yellow_fire', 15,  1.1,  0.95),   # Slightly redder yellow
    'green_jade':    ('blue_dream',  90,  0.9,  0.95),   # Shift blue to green
}

# Which are rili variants (translucent middle segments)
RILI_VARIANTS = {'rili', 'carbon_rili', 'blue_rili'}

SPECS = {
    # Shrimp: generated dynamically in build_subject_list()
    # Fish
    'fish/neon_tetra': {
        'output': 'background/neon_tetra.png',
        'frame_w': 40, 'frame_h': 18,    # Matches manifest frameGrid exactly
        'cols': 4, 'rows': 1,
        'num_frames': 4,
        'subject_type': 'fish',
        'category': 'fish',
    },
    # Plants (single frame each)
    'plants/java_fern':   {'output': 'plants/java_fern.png',  'frame_w': 40, 'frame_h': 88,  'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/anubias':     {'output': 'plants/anubias.png',    'frame_w': 52, 'frame_h': 38,  'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/vallisneria': {'output': 'plants/vallisneria.png','frame_w': 40, 'frame_h': 116, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/crypt':       {'output': 'plants/crypt.png',      'frame_w': 56, 'frame_h': 82,  'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/moss':        {'output': 'plants/moss.png',       'frame_w': 64, 'frame_h': 34,  'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/buce':        {'output': 'plants/buce.png',       'frame_w': 48, 'frame_h': 84,  'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/salvinia':    {'output': 'plants/floating_salvinia.png', 'frame_w': 56, 'frame_h': 32, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    'plants/redroot':     {'output': 'plants/floating_redroot.png',  'frame_w': 48, 'frame_h': 34, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'plant', 'category': 'plant'},
    # Rotala: 3 growth stages side by side in one sheet
    'plants/rotala': {
        'output': 'plants/rotala.png',
        'frame_w': 24, 'frame_h': 96, 'cols': 3, 'rows': 1, 'num_frames': 3,
        'subject_type': 'plant_multi', 'category': 'plant',
    },
    # Hardscape
    'hardscape/stone_seiryu': {'output': 'hardscape/stone_seiryu_lg.png', 'frame_w': 60, 'frame_h': 40, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/stone_dragon': {'output': 'hardscape/stone_dragon.png',    'frame_w': 70, 'frame_h': 45, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/stone_lava':   {'output': 'hardscape/stone_lava.png',      'frame_w': 50, 'frame_h': 35, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/stone_frodo':  {'output': 'hardscape/stone_frodo.png',     'frame_w': 65, 'frame_h': 40, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/stone_pagoda': {'output': 'hardscape/stone_pagoda.png',    'frame_w': 55, 'frame_h': 38, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/wood_manzanita':{'output': 'hardscape/wood_manzanita.png', 'frame_w': 160,'frame_h': 80, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/wood_spider':  {'output': 'hardscape/wood_spider.png',     'frame_w': 140,'frame_h': 70, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/wood_malaysian':{'output': 'hardscape/wood_malaysian.png', 'frame_w': 90, 'frame_h': 55, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/wood_mopani':  {'output': 'hardscape/wood_mopani.png',     'frame_w': 110,'frame_h': 55, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    'hardscape/wood_redmoor': {'output': 'hardscape/wood_redmoor.png',    'frame_w': 150,'frame_h': 45, 'cols': 1, 'rows': 1, 'num_frames': 1, 'subject_type': 'hardscape', 'category': 'hardscape'},
    # Background
    'background/room': {
        'output': 'background/room_bg.png',
        'frame_w': 280, 'frame_h': 156, 'cols': 1, 'rows': 1, 'num_frames': 1,
        'subject_type': 'background', 'category': 'background',
    },
}

# Animation frame parameters per subject type
DEFORM = {
    'shrimp':    {'sigma': 5.0, 'smoothing': 30},
    'fish':      {'sigma': 7.0, 'smoothing': 20},
    'plant':     {'sigma': 0.0, 'smoothing': 0},   # Static
    'plant_multi':{'sigma': 0.0,'smoothing': 0},   # Static (3 growth stages)
    'hardscape': {'sigma': 0.0, 'smoothing': 0},   # Static
    'background':{'sigma': 0.0, 'smoothing': 0},   # Static
}

# ──────────────────────────────────────────────────────────────────────────────
# SUBJECT LIST BUILDER
# ──────────────────────────────────────────────────────────────────────────────

def build_subject_list():
    """Extend SPECS with all shrimp variant entries."""
    for variant in SHRIMP_VARIANTS:
        for sex in SHRIMP_SEXES:
            key = f'shrimp/{variant}'
            output_key = f'{variant}_{sex}'
            # Note: all sexes share the same reference dir; sex differentiation
            # is handled at frame assignment (forage/idle/swim rows differ by size)
            # Synthesized variants borrow references from their base variant.
            synth_info  = SHRIMP_SYNTH.get(variant)
            ref_dir_val = f'shrimp/{synth_info[0]}' if synth_info else key
            SPECS[f'shrimp/{variant}/{sex}'] = {
                'output': f'{output_key}.png',
                'frame_w': 60, 'frame_h': 26,    # Matches manifest frameGrid exactly
                'cols': 6, 'rows': 3,
                'num_frames': 18,  # 6 cols x 3 rows: forage(6) + idle(6) + swim(6)
                'subject_type': 'shrimp',
                'category': 'shrimp',
                'ref_dir': ref_dir_val,
                'variant': variant,
                'sex': sex,
                'synth': synth_info is not None,
                'synth_params': synth_info,   # (base, hue_deg, sat_factor, val_factor)
                'rili': variant in RILI_VARIANTS,
            }
        # Also berried version for red_cherry
        if variant == 'red_cherry':
            SPECS['shrimp/red_cherry/berried'] = {
                'output': 'red_cherry_berried.png',
                'frame_w': 60, 'frame_h': 26,
                'cols': 6, 'rows': 3, 'num_frames': 18,
                'subject_type': 'shrimp',
                'category': 'shrimp',
                'ref_dir': 'shrimp/red_cherry',
                'variant': 'red_cherry', 'sex': 'female',
                'synth': False, 'rili': False, 'berried': True,
            }
    # Small seiryu stone
    SPECS['hardscape/stone_seiryu_sm'] = {
        'output': 'hardscape/stone_seiryu_sm.png',
        'frame_w': 35, 'frame_h': 24, 'cols': 1, 'rows': 1, 'num_frames': 1,
        'subject_type': 'hardscape', 'category': 'hardscape',
        'ref_dir': 'hardscape/stone_seiryu',  # Reuse the same reference
    }

build_subject_list()

# ──────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def find_reference_images(subject_key, spec):
    """Find all images in the reference directory for a subject."""
    ref_dir_key = spec.get('ref_dir', subject_key)
    ref_dir = REFERENCES / ref_dir_key
    if not ref_dir.exists():
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.bmp'}
    imgs = [p for p in sorted(ref_dir.iterdir()) if p.suffix.lower() in exts]
    return imgs

def subject_intermediate_dir(subject_key):
    safe = subject_key.replace('/', '_')
    d = INTERMEDIATES / safe
    d.mkdir(parents=True, exist_ok=True)
    return d

def det_seed(subject_key, frame_idx):
    """Deterministic seed from subject + frame index."""
    h = hashlib.md5(f'{subject_key}_{frame_idx}'.encode()).digest()
    return int.from_bytes(h[:4], 'little')

def img_to_rgba(img):
    return img.convert('RGBA')

def split_alpha(img_rgba):
    r, g, b, a = img_rgba.split()
    return Image.merge('RGB', (r, g, b)), a

def merge_alpha(img_rgb, alpha):
    r, g, b = img_rgb.split()
    return Image.merge('RGBA', (r, g, b, alpha))

def cleanup_alpha_edges(img_rgba, subject_type='sprite'):
    """
    Remove RGB bleed from transparent pixels and premultiply faint fringe pixels
    so sprites composite cleanly against water and substrate.
    """
    arr = np.array(img_rgba.convert('RGBA'), dtype=np.uint8)
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3].astype(np.uint8)

    # Fully transparent pixels should not retain source-photo colour.
    fully_transparent = alpha == 0
    rgb[fully_transparent] = 0

    # Very faint antialias pixels tend to create bright halos after quantization.
    # Premultiply them back down and discard the weakest remnants.
    edge_threshold = 42 if subject_type in {'hardscape', 'plant', 'plant_multi'} else 32
    faint = (alpha > 0) & (alpha < edge_threshold)
    if np.any(faint):
        scale = (alpha[faint].astype(np.float32) / 255.0)[:, None]
        rgb[faint] *= scale
    alpha[alpha <= 4] = 0
    rgb[alpha == 0] = 0

    out = np.dstack((
        rgb.clip(0, 255).astype(np.uint8),
        alpha.astype(np.uint8)
    ))
    return Image.fromarray(out, 'RGBA')

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 1: BACKGROUND REMOVAL
# ──────────────────────────────────────────────────────────────────────────────

_rembg_session = None

def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        print("  [rembg] Loading birefnet-general model (first run downloads ~180MB)...")
        _rembg_session = new_session('birefnet-general')
        print("  [rembg] Model ready.")
    return _rembg_session

def stage1_remove_background(source_path, out_dir, subject_key):
    """Remove background from source image. Returns path to RGBA PNG."""
    stem = source_path.stem
    out_auto = out_dir / f'{stem}_nobg_auto.png'
    out_corrected = out_dir / f'{stem}_nobg.png'  # User may place corrected version here

    # If user already hand-corrected, use that
    if out_corrected.exists():
        print(f"    [S1] Using hand-corrected: {out_corrected.name}")
        return Image.open(out_corrected).convert('RGBA')

    # Auto removal
    if out_auto.exists():
        print(f"    [S1] Using cached auto-removal: {out_auto.name}")
        return Image.open(out_auto).convert('RGBA')

    print(f"    [S1] Removing background from {source_path.name}...")
    session = get_rembg_session()
    with open(source_path, 'rb') as f:
        data = f.read()
    result = remove(
        data, session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=230,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=4,
    )
    img = Image.open(io.BytesIO(result)).convert('RGBA')
    img.save(out_auto)
    print(f"    [S1] Saved to {out_auto.name}. Review and optionally save corrected version as {out_corrected.name}")
    return img

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 2: RESIZE TO INTERMEDIATE RESOLUTION (3x game size)
# ──────────────────────────────────────────────────────────────────────────────

def stage2_resize_intermediate(img_rgba, spec):
    fw, fh = spec['frame_w'], spec['frame_h']
    # 5× gives the VGA downsample more pixels to work with → finer dithering
    # grain and cleaner alpha edges while still landing at the FMV target size.
    iw, ih = fw * 5, fh * 5
    return img_rgba.resize((iw, ih), Image.LANCZOS)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 3: ANIMATION FRAME SYNTHESIS (elastic deformation via scipy)
# ──────────────────────────────────────────────────────────────────────────────

def _elastic_deform_scipy(img_array, sigma, smoothing, seed):
    """
    Elastic deformation using scipy.ndimage.
    Equivalent to elasticdeform.deform_random_grid but numpy-2.x compatible.

    sigma     : displacement field amplitude in pixels
    smoothing : gaussian smoothing sigma for the displacement field
    """
    from scipy.ndimage import gaussian_filter, map_coordinates

    np.random.seed(seed)
    H, W = img_array.shape[:2]

    # Generate random displacement fields and smooth them
    dx = gaussian_filter((np.random.rand(H, W) * 2 - 1), smoothing) * sigma
    dy = gaussian_filter((np.random.rand(H, W) * 2 - 1), smoothing) * sigma

    # Create coordinate grids
    y_coords, x_coords = np.meshgrid(np.arange(H), np.arange(W), indexing='ij')
    new_y = (y_coords + dy).clip(0, H - 1)
    new_x = (x_coords + dx).clip(0, W - 1)
    coords = [new_y.ravel(), new_x.ravel()]

    # Apply deformation to each channel independently
    result = np.zeros_like(img_array)
    for c in range(img_array.shape[2]):
        result[:, :, c] = map_coordinates(
            img_array[:, :, c], coords, order=1, mode='constant', cval=0
        ).reshape(H, W)

    return result.astype(np.uint8)

def stage3_generate_frames(img_rgba_intermediate, spec, subject_key):
    """
    Generate the required number of animation frames.
    Frame 0 is the source image unchanged.
    Subsequent frames are organically deformed variations.
    """
    num_frames = spec['num_frames']
    subject_type = spec['subject_type']
    params = DEFORM.get(subject_type, {'sigma': 0, 'smoothing': 0})
    sigma = params['sigma']
    smoothing = params['smoothing']

    arr = np.array(img_rgba_intermediate)
    frames = [img_rgba_intermediate]

    if sigma > 0 and num_frames > 1:
        for i in range(1, num_frames):
            seed = det_seed(subject_key, i)
            deformed = _elastic_deform_scipy(arr, sigma=sigma, smoothing=smoothing, seed=seed)
            frames.append(Image.fromarray(deformed))

    return frames

# (palette-based dithering removed — direct Bayer threshold dithering is used
#  instead.  No shared palette is built or loaded.)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 5: VGA 6-BIT CHANNEL QUANTIZATION
# ──────────────────────────────────────────────────────────────────────────────

def stage5_vga_quantize(img_rgb):
    """Snap each channel to 64-level VGA 6-bit hardware grid."""
    arr = np.array(img_rgb, dtype=np.float32)
    q = np.round(arr / 255.0 * 63)
    arr_q = (q * (255.0 / 63)).astype(np.uint8)
    return Image.fromarray(arr_q, 'RGB')

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 6: WARM DESATURATION (consumer camcorder color grade)
# ──────────────────────────────────────────────────────────────────────────────

def stage6_vhs_grade(img_rgb, subject_type='sprite', background=False):
    """
    Per-type colour grade simulating consumer camcorder / video capture science.

    - shrimp / fish  : warm shift (+4% R, −5% B), 12% desaturation, 12% contrast
    - hardscape      : neutral — preserve natural stone/wood hues; just slight
                       desaturation + contrast.  No warm push (stones are grey/
                       blue-grey; driftwood is brown-ochre — not salmon).
    - plant          : near-neutral — 1% warm push only; preserve green and red
                       tones that make stem plants and mosses legible.
    - background     : heavy dark grade matching FMV game scene panels.
    """
    arr = np.array(img_rgb, dtype=np.float32) / 255.0

    if background:
        warm = np.array([[1.03, 0.00, 0.00],
                         [0.00, 1.00, 0.00],
                         [0.00, -0.02, 0.97]])
        arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
        img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')
        img_w = ImageEnhance.Color(img_w).enhance(0.75)
        img_w = ImageEnhance.Contrast(img_w).enhance(1.25)
        img_w = ImageEnhance.Brightness(img_w).enhance(0.55)
        return img_w

    if subject_type == 'hardscape':
        # Keep hardscape natural, but push it a little farther toward the same
        # digitized-FMV space as the fauna and plants so it stops reading like a
        # raw pasted photo.
        warm = np.array([[1.01, 0.00, 0.00],
                         [0.00, 0.99, 0.00],
                         [0.00, -0.01, 0.96]])
        arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
        img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')
        img_w = ImageEnhance.Color(img_w).enhance(0.82)
        img_w = ImageEnhance.Contrast(img_w).enhance(1.04)
        img_w = ImageEnhance.Brightness(img_w).enhance(0.97)
        return img_w

    if subject_type in ('plant', 'plant_multi'):
        # Near-neutral: preserve green and red hues of stem plants/mosses.
        warm = np.array([[1.01, 0.00, 0.00],
                         [0.00, 1.00, 0.00],
                         [0.00, 0.00, 0.99]])
        arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
        img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')
        img_w = ImageEnhance.Color(img_w).enhance(0.95)    # minimal desaturation
        img_w = ImageEnhance.Contrast(img_w).enhance(1.06)
        return img_w

    if subject_type == 'fish':
        warm = np.array([[1.03, 0.00, 0.00],
                         [0.00, 1.00, 0.00],
                         [0.00, -0.03, 0.96]])
        arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
        img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')
        img_w = ImageEnhance.Color(img_w).enhance(0.92)
        img_w = ImageEnhance.Contrast(img_w).enhance(1.08)
        return img_w

    # shrimp / fish / generic sprite — full 90s camcorder warm grade
    warm = np.array([[1.04, 0.00,  0.00],
                     [0.00, 1.00,  0.00],
                     [0.00, -0.04, 0.95]])
    arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
    img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')
    img_w = ImageEnhance.Color(img_w).enhance(0.88)
    img_w = ImageEnhance.Contrast(img_w).enhance(1.12)
    return img_w

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 7: BAYER ORDERED DITHERING
# ──────────────────────────────────────────────────────────────────────────────

def stage7_bayer_dither(img_rgb, threshold=10.0):
    """
    Direct 8×8 Bayer threshold dithering — no shared palette required.

    Displaces each pixel by the Bayer matrix value then re-snaps to the VGA
    6-bit grid.  This is how actual VGA hardware ordered dithering worked: the
    matrix offsets the quantisation threshold per pixel to simulate intermediate
    tones without mapping to a predefined colour table.

    Removing the shared-palette step is critical: palette-derived dithering
    maps ALL subjects to the nearest palette colour, which causes hue
    contamination when the palette is skewed by one vivid subject type
    (e.g. red cherry shrimp polluting the colours of grey stone).

    threshold : displacement amplitude in 0–255 units.
                10 = clearly visible Bayer grain, fidelity still good at 5×
                     intermediate → 1× final downscale ratio.
    """
    arr  = np.array(img_rgb, dtype=np.float32)
    H, W = arr.shape[:2]
    iy   = np.arange(H) % 8
    ix   = np.arange(W) % 8
    mat  = BAYER8[np.ix_(iy, ix)]                     # (H, W) tiled 0..1 pattern
    displaced = arr + (mat[:, :, np.newaxis] - 0.5) * threshold * 2
    # Re-snap to VGA 6-bit grid
    q      = np.round(displaced.clip(0, 255) / 255.0 * 63)
    result = (q * (255.0 / 63)).clip(0, 255).astype(np.uint8)
    return Image.fromarray(result, 'RGB')


def stage7_subject_dither(img_rgb, subject_type='sprite'):
    threshold = 10.0
    if subject_type == 'hardscape':
        threshold = 13.0
    elif subject_type == 'fish':
        threshold = 8.5
    elif subject_type in ('plant', 'plant_multi'):
        threshold = 9.0
    return stage7_bayer_dither(img_rgb, threshold=threshold)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 8: CINEPAK BLOCK QUANTIZATION (4x4 block V1 codebook simulation)
# ──────────────────────────────────────────────────────────────────────────────

def stage8_cinepak_blocks(img_rgb, pull=0.05):
    """Simulate Cinepak V1 codebook: pull each 4x4 block 15% toward its mean."""
    arr = np.array(img_rgb, dtype=np.float32)
    H, W = arr.shape[:2]
    for by in range(0, H, 4):
        for bx in range(0, W, 4):
            block = arr[by:by+4, bx:bx+4]
            mean = block.mean(axis=(0, 1), keepdims=True)
            arr[by:by+4, bx:bx+4] = block * (1.0 - pull) + mean * pull
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGB')


def stage8_subject_cinepak(img_rgb, subject_type='sprite'):
    pull = 0.05
    if subject_type == 'hardscape':
        pull = 0.10
    elif subject_type == 'fish':
        pull = 0.07
    return stage8_cinepak_blocks(img_rgb, pull=pull)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 9: ANALOG SIGNAL CHAIN (blur/resharpen for video capture artifacts)
# ──────────────────────────────────────────────────────────────────────────────

def stage9_analog_chain(img_rgb, blur_radius=0.4, sharpen=1.95):
    """Simulate bandlimited analog capture + post-sharpening -> edge halos."""
    blurred = img_rgb.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    resharpened = ImageEnhance.Sharpness(blurred).enhance(sharpen)
    return resharpened


def stage9_subject_analog(img_rgb, subject_type='sprite'):
    blur_radius = 0.4
    sharpen = 1.95
    if subject_type == 'hardscape':
        blur_radius = 0.55
        sharpen = 1.35
    elif subject_type == 'fish':
        blur_radius = 0.35
        sharpen = 1.75
    elif subject_type in ('plant', 'plant_multi'):
        blur_radius = 0.32
        sharpen = 1.80
    return stage9_analog_chain(img_rgb, blur_radius=blur_radius, sharpen=sharpen)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 10: CHROMA FRINGE (blue-screen compositing artifacts)
# ──────────────────────────────────────────────────────────────────────────────

def stage10_chroma_fringe(img_rgb, alpha):
    """Add warm/cool color fringe on pixels adjacent to the alpha boundary."""
    alpha_arr = np.array(alpha)
    rgb_arr = np.array(img_rgb, dtype=np.int16)

    # Find boundary pixels: opaque pixels adjacent to transparent pixels
    # Vectorized: shift alpha arrays and compare
    left_transparent  = np.roll(alpha_arr, 1, axis=1) == 0
    right_transparent = np.roll(alpha_arr, -1, axis=1) == 0
    on_boundary = (alpha_arr > 0) & (left_transparent | right_transparent)

    # Apply fringe: warm shift (R+12) and cool pull (B-9)
    rgb_arr[on_boundary, 0] = (rgb_arr[on_boundary, 0] + 12).clip(0, 255)
    rgb_arr[on_boundary, 2] = (rgb_arr[on_boundary, 2] - 9).clip(0, 255)

    result_rgb = Image.fromarray(rgb_arr.clip(0, 255).astype(np.uint8), 'RGB')
    return merge_alpha(result_rgb, alpha)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 11: FINAL DOWNSCALE
# ──────────────────────────────────────────────────────────────────────────────

def stage11_downscale(img_rgba, frame_w, frame_h):
    """Downscale to final game sprite dimensions."""
    return img_rgba.resize((frame_w, frame_h), Image.LANCZOS)

# ──────────────────────────────────────────────────────────────────────────────
# STAGE 12: SPRITE SHEET ASSEMBLY
# ──────────────────────────────────────────────────────────────────────────────

def stage12_assemble(frames, cols, rows, frame_w, frame_h):
    """Assemble processed frames into a grid sprite sheet."""
    sheet = Image.new('RGBA', (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    for i, frame in enumerate(frames[:cols * rows]):
        col = i % cols
        row = i // cols
        x, y = col * frame_w, row * frame_h
        # Center frame in cell
        padded = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
        ox = (frame_w - frame.width) // 2
        oy = (frame_h - frame.height) // 2
        padded.paste(frame, (ox, oy), frame)
        sheet.paste(padded, (x, y), padded)
    return cleanup_alpha_edges(sheet)

# ──────────────────────────────────────────────────────────────────────────────
# SHRIMP COLOR VARIANT SYNTHESIS
# ──────────────────────────────────────────────────────────────────────────────

def apply_hue_shift(img_rgba, hue_shift_deg, sat_factor, val_factor):
    """
    Vectorized HSV hue/saturation/value shift.
    Operates on all pixels at once via numpy, so fast on any image size.
    """
    rgb, alpha = split_alpha(img_rgba)
    arr = np.array(rgb, dtype=np.float32) / 255.0

    # RGB -> HSV (all vectorized)
    R, G, B = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    Cmax = np.maximum.reduce([R, G, B])
    Cmin = np.minimum.reduce([R, G, B])
    delta = Cmax - Cmin

    # Hue calculation
    H = np.zeros_like(Cmax)
    mask = delta != 0
    # Red sector
    m = mask & (Cmax == R)
    H[m] = ((G[m] - B[m]) / delta[m]) % 6
    # Green sector
    m = mask & (Cmax == G)
    H[m] = (B[m] - R[m]) / delta[m] + 2
    # Blue sector
    m = mask & (Cmax == B)
    H[m] = (R[m] - G[m]) / delta[m] + 4
    H = H / 6.0  # Normalize to 0..1

    # Saturation
    S = np.where(Cmax == 0, 0.0, delta / Cmax)

    # Value
    V = Cmax

    # Apply shift
    H = (H + hue_shift_deg / 360.0) % 1.0
    S = (S * sat_factor).clip(0, 1)
    V = (V * val_factor).clip(0, 1)

    # HSV -> RGB (vectorized)
    i = (H * 6).astype(int) % 6
    f = H * 6 - np.floor(H * 6)
    p = V * (1 - S)
    q = V * (1 - f * S)
    t = V * (1 - (1 - f) * S)

    out = np.zeros_like(arr)
    for sector, (r, g, b) in enumerate([(V,t,p),(q,V,p),(p,V,t),(p,q,V),(t,p,V),(V,p,q)]):
        m = i == sector
        out[:,:,0][m] = r[m]
        out[:,:,1][m] = g[m]
        out[:,:,2][m] = b[m]

    result_rgb = Image.fromarray((out * 255).clip(0,255).astype(np.uint8), 'RGB')
    return merge_alpha(result_rgb, alpha)

# ──────────────────────────────────────────────────────────────────────────────
# FULL PROCESSING PIPELINE FOR ONE FRAME
# ──────────────────────────────────────────────────────────────────────────────

def process_frame(img_rgba_intermediate, frame_w, frame_h, subject_type='sprite'):
    """
    Run stages 5–11 on a single RGBA intermediate-resolution frame.
    Returns final RGBA frame at game resolution.
    """
    is_background = (subject_type == 'background')

    # Split alpha for RGB processing
    img_rgb, alpha = split_alpha(img_rgba_intermediate)

    # Stage 5: VGA 6-bit quantization
    img_rgb = stage5_vga_quantize(img_rgb)

    # Stage 6: Per-type colour grade (preserves hue fidelity for non-creature subjects)
    img_rgb = stage6_vhs_grade(img_rgb, subject_type=subject_type, background=is_background)

    # Stage 7: Bayer dithering to shared palette
    img_rgb = stage7_subject_dither(img_rgb, subject_type=subject_type)

    # Stage 8: Cinepak block quantization
    img_rgb = stage8_subject_cinepak(img_rgb, subject_type=subject_type)

    # Stage 9: Analog blur/resharpen
    img_rgb = stage9_subject_analog(img_rgb, subject_type=subject_type)

    # Stage 10: Chroma fringe (skip for backgrounds — they're not on blue screen)
    if not is_background:
        result_rgba = stage10_chroma_fringe(img_rgb, alpha)
    else:
        result_rgba = merge_alpha(img_rgb, alpha)

    # Stage 11: Downscale to game resolution
    result_rgba = stage11_downscale(result_rgba, frame_w, frame_h)

    # Stage 11b: Final micro-sharpen — recovers detail lost in LANCZOS downscale
    # and gives the crisp-edge quality of digitised FMV sprites.
    if not is_background:
        rgb_s, alpha_s = split_alpha(result_rgba)
        final_sharpen = 1.55
        if subject_type == 'hardscape':
          final_sharpen = 1.18
        elif subject_type == 'fish':
          final_sharpen = 1.38
        rgb_s = ImageEnhance.Sharpness(rgb_s).enhance(final_sharpen)
        result_rgba = merge_alpha(rgb_s, alpha_s)

    return cleanup_alpha_edges(result_rgba, subject_type=subject_type)

# ──────────────────────────────────────────────────────────────────────────────
# PROCESS ONE SUBJECT
# ──────────────────────────────────────────────────────────────────────────────

def process_subject(subject_key, spec, dry_run=False):
    """Process a single subject from reference photos to sprite sheet.

    For animated multi-row subjects (shrimp) with ≥ rows reference photos,
    a different reference photo is used per animation row so each row shows
    a genuinely distinct body pose rather than an elastic-deform clone of
    the same still image.  Within each row the frames are mildly deformed
    from that row's reference photo.

    Row-specific deformation parameters for shrimp:
      Row 0 forage : sigma 2.5 / smoothing 18  (subtle head-dip variation)
      Row 1 idle   : sigma 1.0 / smoothing 25  (minimal — near-static)
      Row 2 swim   : sigma 3.5 / smoothing 12  (more lateral body shift)
    """
    SHRIMP_ROW_DEFORM = [
        {'sigma': 2.5, 'smoothing': 18},   # row 0: forage
        {'sigma': 1.0, 'smoothing': 25},   # row 1: idle
        {'sigma': 3.5, 'smoothing': 12},   # row 2: swim
    ]

    ref_dir_key = spec.get('ref_dir', subject_key)
    ref_dir = REFERENCES / ref_dir_key
    out_dir = subject_intermediate_dir(subject_key)
    output_path = OUTPUT_ROOT / spec['output']
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[{subject_key}]")

    # Find reference images
    ref_images = find_reference_images(subject_key, spec)
    if not ref_images:
        print(f"  WARN No reference images found in {ref_dir}")
        print(f"  Drop photos into: {ref_dir}")
        print(f"  Skipping.")
        return None

    print(f"  Found {len(ref_images)} reference(s): {', '.join(p.name for p in ref_images)}")

    if dry_run:
        print(f"  -> Would output: {output_path}")
        return None

    fw, fh       = spec['frame_w'], spec['frame_h']
    subject_type = spec['subject_type']
    rows         = spec.get('rows', 1)
    cols         = spec.get('cols', 1)
    is_shrimp    = (subject_type == 'shrimp')
    multi_ref    = is_shrimp and len(ref_images) >= 2

    # ── Multi-reference animated path (shrimp with ≥2 photos) ──────────────
    if multi_ref:
        print(f"  [ANIM] Using per-row reference photos for {rows}-row animation")
        processed_frames = []
        synth_info = spec.get('synth', False)

        for row_idx in range(rows):
            # Assign a different reference photo to each row
            ref_idx   = row_idx % len(ref_images)
            src_path  = ref_images[ref_idx]
            row_key   = f'{subject_key}_row{row_idx}'
            print(f"    Row {row_idx}: {src_path.name}")

            # Stage 1: Background removal (cached per source photo)
            img_rgba_full = stage1_remove_background(src_path, out_dir, subject_key)

            # Colour synthesis for synthesised shrimp variants
            if synth_info:
                variant = spec['variant']
                _, hue_shift, sat_f, val_f = SHRIMP_SYNTH[variant]
                img_rgba_full = apply_hue_shift(img_rgba_full, hue_shift, sat_f, val_f)

            # Stage 2: Resize
            img_rgba_inter = stage2_resize_intermediate(img_rgba_full, spec)

            # Stage 3: Generate 'cols' frames with row-specific mild deformation
            row_deform = SHRIMP_ROW_DEFORM[row_idx] if row_idx < len(SHRIMP_ROW_DEFORM) else {'sigma': 2.0, 'smoothing': 18}
            arr = np.array(img_rgba_inter)
            row_frames = [img_rgba_inter]
            for i in range(1, cols):
                seed = det_seed(row_key, i)
                deformed = _elastic_deform_scipy(arr, sigma=row_deform['sigma'], smoothing=row_deform['smoothing'], seed=seed)
                row_frames.append(Image.fromarray(deformed))

            # Stages 5–11: Process each frame in this row
            for frame_img in row_frames:
                processed_frames.append(process_frame(frame_img, fw, fh, subject_type))

        # Stage 12: Assemble
        sheet = stage12_assemble(processed_frames, cols=cols, rows=rows, frame_w=fw, frame_h=fh)
        sheet.save(output_path)
        print(f"  [S12] OK {sheet.width}x{sheet.height}px -> {output_path}")
        return processed_frames

    # ── Single-reference path (plants, hardscape, fish, single-photo shrimp) ─
    source_path = ref_images[0]

    # Stage 1: Background removal
    img_rgba_full = stage1_remove_background(source_path, out_dir, subject_key)

    # Apply color variant synthesis for synthesized shrimp variants
    synth_info = spec.get('synth', False)
    if synth_info:
        variant = spec['variant']
        base_variant, hue_shift, sat_f, val_f = SHRIMP_SYNTH[variant]
        print(f"  [SYNTH] Applying hue shift from {base_variant}: h={hue_shift}° sx{sat_f} vx{val_f}")
        img_rgba_full = apply_hue_shift(img_rgba_full, hue_shift, sat_f, val_f)

    # Stage 2: Resize to 5× game resolution
    img_rgba_inter = stage2_resize_intermediate(img_rgba_full, spec)
    # Save intermediate for inspection
    inter_path = out_dir / 'intermediate.png'
    img_rgba_inter.save(inter_path)
    print(f"  [S2] Intermediate: {img_rgba_inter.width}x{img_rgba_inter.height}px -> {inter_path.name}")

    # Stage 3: Generate animation frames
    frames_intermediate = stage3_generate_frames(img_rgba_inter, spec, subject_key)
    print(f"  [S3] Generated {len(frames_intermediate)} animation frame(s)")

    # Stages 5–11: Process each frame
    processed_frames = []

    for i, frame_img in enumerate(frames_intermediate):
        frame_out = process_frame(frame_img, fw, fh, subject_type)
        processed_frames.append(frame_out)
        # Save individual frame for inspection
        frame_inspect = out_dir / f'frame_{i:02d}.png'
        frame_out.save(frame_inspect)

    # Stage 12: Assemble sprite sheet
    sheet = stage12_assemble(
        processed_frames,
        cols=spec['cols'],
        rows=spec['rows'],
        frame_w=fw,
        frame_h=fh,
    )

    sheet.save(output_path)
    print(f"  [S12] OK {sheet.width}x{sheet.height}px sprite sheet -> {output_path}")
    return processed_frames


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='FMV Sprite Digitization Pipeline')
    parser.add_argument('--dry', action='store_true', help='Dry run: show what would be processed')
    parser.add_argument('--subject', type=str, help='Process only this subject key (e.g. shrimp/red_cherry/male)')
    args = parser.parse_args()

    # Ensure output directories exist
    (OUTPUT_ROOT / 'plants').mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / 'hardscape').mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / 'background').mkdir(parents=True, exist_ok=True)
    INTERMEDIATES.mkdir(parents=True, exist_ok=True)

    # Build subject list
    if args.subject:
        subjects = [(k, v) for k, v in SPECS.items() if k.startswith(args.subject)]
        if not subjects:
            print(f"No subjects match '{args.subject}'. Known prefixes:")
            categories = sorted(set(k.split('/')[0] for k in SPECS))
            for c in categories:
                print(f"  {c}/...")
            sys.exit(1)
    else:
        subjects = list(SPECS.items())

    print(f"FMV Pipeline — {len(subjects)} subjects to process")
    print(f"References root: {REFERENCES}")
    print(f"Output root:     {OUTPUT_ROOT}")
    print()

    # Remove legacy palette cache — palette-based dithering has been replaced
    # with direct Bayer threshold dithering, no shared colour table needed.
    if PALETTE_CACHE.exists():
        PALETTE_CACHE.unlink()
        print("[INFO] Removed legacy palette cache (direct Bayer dithering active).")

    # Count available references
    available = [(k, v) for k, v in subjects if find_reference_images(k, v)]
    print(f"Subjects with reference photos: {len(available)} / {len(subjects)}")

    if args.dry:
        print("\nDRY RUN — no files will be written\n")
        for k, v in subjects:
            refs = find_reference_images(k, v)
            status = f"OK {len(refs)} refs" if refs else "WARN NO REFERENCES"
            print(f"  {k:<40} -> {v['output']:<45} [{status}]")
        return

    if not available:
        print("\nWARN No reference photos found anywhere.")
        print("Add photos to the references/ directory and re-run.")
        print("\nExample structure:")
        print("  references/shrimp/red_cherry/photo1.jpg")
        print("  references/plants/java_fern/photo1.jpg")
        print("  references/background/room/photo1.jpg")
        return

    # PROCESSING PASS: run full pipeline per subject
    print(f"\n=== PROCESSING {len(available)} SUBJECTS ===")
    success, skipped, failed = 0, 0, 0

    for subject_key, spec in subjects:
        refs = find_reference_images(subject_key, spec)
        if not refs:
            skipped += 1
            continue
        try:
            result = process_subject(subject_key, spec, dry_run=args.dry)
            if result is not None:
                success += 1
        except Exception as e:
            import traceback
            print(f"  FAIL FAILED: {e}")
            traceback.print_exc()
            failed += 1

    print(f"\n=== DONE ===")
    print(f"  OK Processed: {success}")
    print(f"  WARN Skipped (no refs): {skipped}")
    print(f"  FAIL Failed: {failed}")
    print(f"\nSprite sheets written to: {OUTPUT_ROOT}")
    print(f"Intermediates for review:  {INTERMEDIATES}")
    if skipped:
        print(f"\nTo add remaining subjects, drop photos into:")
        for k, v in subjects:
            if not find_reference_images(k, v):
                ref_dir = REFERENCES / v.get('ref_dir', k)
                print(f"  {ref_dir}")

if __name__ == '__main__':
    main()
