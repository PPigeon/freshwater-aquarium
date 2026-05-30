#!/usr/bin/env python3
"""
fmv_textures.py
Generate all background / particle / UI texture assets with authentic
90s VGA aesthetics: 6-bit colour quantization, 8×8 Bayer ordered dithering,
and analogue capture simulation — exactly matching the look produced by
fmv_pipeline.py for creature sprites so everything shares one visual language.

Usage:
    py -3.12 fmv_textures.py              # all textures
    py -3.12 fmv_textures.py substrate    # single texture by name
"""

from __future__ import annotations

import argparse
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT   = Path(__file__).parent
OUT    = ROOT / 'assets' / 'sprites' / 'background'
OUT.mkdir(parents=True, exist_ok=True)

# ── VGA pipeline helpers ──────────────────────────────────────────────────────

def vga_quantize(arr: np.ndarray) -> np.ndarray:
    """Snap each channel to the 64-level (6-bit) VGA hardware grid."""
    q = np.round(arr.astype(np.float32) / 255.0 * 63)
    return (q * (255.0 / 63)).clip(0, 255).astype(np.uint8)


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


def bayer_dither(arr_rgb: np.ndarray, threshold: float = 0.18) -> np.ndarray:
    """
    Apply 8×8 Bayer ordered dithering to an RGB uint8 array.
    threshold controls the dither pattern density (0=none, 0.5=heavy).
    """
    H, W = arr_rgb.shape[:2]
    iy   = np.arange(H) % 8
    ix   = np.arange(W) % 8
    mat  = BAYER8[np.ix_(iy, ix)]           # (H,W) tiled pattern
    f    = arr_rgb.astype(np.float32) / 255.0
    dithered = (f + (mat[:, :, np.newaxis] - 0.5) * threshold * 2).clip(0, 1)
    return (dithered * 255).astype(np.uint8)


def warm_grade(arr_rgb: np.ndarray) -> np.ndarray:
    """Subtle consumer-camcorder warm shift: +3% R, −4% B, −8% saturation."""
    f = arr_rgb.astype(np.float32) / 255.0
    f[:, :, 0] = np.clip(f[:, :, 0] * 1.03, 0, 1)
    f[:, :, 2] = np.clip(f[:, :, 2] * 0.96, 0, 1)
    # desaturate 8 %
    lum = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
    f   = f * 0.92 + lum[:, :, np.newaxis] * 0.08
    return (f.clip(0, 1) * 255).astype(np.uint8)


def fmv_post(img: Image.Image, dither_t: float = 0.18) -> Image.Image:
    """Full VGA post-processing: warm grade → 6-bit quantize → Bayer dither."""
    arr = np.array(img.convert('RGB'), dtype=np.uint8)
    arr = warm_grade(arr)
    arr = vga_quantize(arr)
    arr = bayer_dither(arr, dither_t)
    result = Image.fromarray(arr, 'RGB')
    # Restore alpha channel if present
    if img.mode == 'RGBA':
        result.putalpha(img.split()[3])
    return result


def fmv_post_rgba(img: Image.Image, dither_t: float = 0.16) -> Image.Image:
    """VGA post-processing for RGBA images — only touches the RGB channels."""
    arr  = np.array(img.convert('RGBA'), dtype=np.uint8)
    rgb  = warm_grade(arr[:, :, :3])
    rgb  = vga_quantize(rgb)
    rgb  = bayer_dither(rgb, dither_t)
    arr[:, :, :3] = rgb
    return Image.fromarray(arr, 'RGBA')


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(str(path))
    print(f'  wrote {path}  ({img.size[0]}x{img.size[1]})')


# ─────────────────────────────────────────────────────────────────────────────
# SUBSTRATE — aquasoil (24×24 tileable)
# ─────────────────────────────────────────────────────────────────────────────

def make_substrate() -> None:
    """
    ADA Amazonia-style aquasoil: very dark brown-black granular substrate.
    Generates a tileable 24×24 grain texture then applies full VGA treatment.
    """
    rng  = random.Random(42)
    SIZE = 24

    # Base colours — dark earthy browns / near-blacks
    GRAIN_COLORS = [
        (16,  9,  4),   # very dark brown-black
        (22, 13,  6),   # dark umber
        (28, 17,  8),   # medium-dark brown
        (34, 21, 10),   # warm dark brown
        (20, 11,  5),   # cooler very dark
        (12,  7,  3),   # near black
        (38, 24, 12),   # slightly lighter grain edge
        (24, 15,  7),
    ]

    arr = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)

    # Fill with the darkest tone as base
    arr[:] = GRAIN_COLORS[0]

    # Scatter grain "pebbles" — small ellipses with colour variation
    for _ in range(120):
        cx = rng.uniform(0, SIZE)
        cy = rng.uniform(0, SIZE)
        rx = rng.uniform(0.6, 1.8)
        ry = rng.uniform(0.5, 1.4)
        col = rng.choice(GRAIN_COLORS)

        for dy in range(-3, 4):
            for dx in range(-3, 4):
                px = int(cx + dx) % SIZE
                py = int(cy + dy) % SIZE
                if ((dx / rx) ** 2 + (dy / ry) ** 2) <= 1.0:
                    # Add tiny per-pixel brightness jitter for organic feel
                    jitter = rng.randint(-5, 5)
                    c = tuple(max(0, min(255, v + jitter)) for v in col)
                    arr[py, px] = c

    # Add subtle inter-grain gaps (even darker) for depth
    for _ in range(30):
        gx = rng.randint(0, SIZE - 1)
        gy = rng.randint(0, SIZE - 1)
        arr[gy, gx] = (8, 4, 2)

    img = Image.fromarray(arr, 'RGB')
    img = fmv_post(img, dither_t=0.22)   # slightly heavier dither for texture
    save(img, 'substrate.png')


# ─────────────────────────────────────────────────────────────────────────────
# WATER TILE — deep aquarium water (8×8 tileable)
# ─────────────────────────────────────────────────────────────────────────────

def make_water_tile() -> None:
    """
    Dark deep-water tile. Near-uniform very dark teal-blue with 1-2 pixel
    VGA dither variation so it reads as water without being distracting.
    """
    SIZE = 8
    # ADA tank water: very dark teal-blue, almost black
    BASE = np.array([8, 14, 22], dtype=np.float32)

    rng = random.Random(7)
    arr = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)

    for y in range(SIZE):
        for x in range(SIZE):
            v = BASE + rng.gauss(0, 1.5)
            arr[y, x] = np.clip(v, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr, 'RGB')
    img = fmv_post(img, dither_t=0.08)   # very subtle — water should be calm
    save(img, 'water_tile.png')


# ─────────────────────────────────────────────────────────────────────────────
# CAUSTICS — animated underwater light (32×32, 4-frame strip = 128×32)
# ─────────────────────────────────────────────────────────────────────────────

def _caustic_frame(phase: float, size: int = 32, seed: int = 0) -> np.ndarray:
    """Generate one caustic light frame using Voronoi-ish cell boundaries."""
    rng    = random.Random(seed)
    n_pts  = 14
    pts    = [(rng.uniform(0, size), rng.uniform(0, size)) for _ in range(n_pts)]
    arr    = np.zeros((size, size, 3), dtype=np.float32)
    BASE_COL = np.array([0, 8, 18], dtype=np.float32)    # dark water
    LIGHT    = np.array([80, 160, 200], dtype=np.float32) # caustic highlight

    for y in range(size):
        for x in range(size):
            # Distance to nearest and second-nearest Voronoi point
            # (with phase-shifted positions for animation)
            dists = sorted(
                math.sqrt(
                    (x - (px + math.cos(phase * 2.1 + i) * 1.8)) ** 2 +
                    (y - (py + math.sin(phase * 1.7 + i) * 1.8)) ** 2
                )
                for i, (px, py) in enumerate(pts)
            )
            d1, d2 = dists[0], dists[1]
            # Caustic pattern: bright at Voronoi boundaries (d2-d1 small)
            edge   = max(0.0, 1.0 - (d2 - d1) * 0.8)
            bright = edge ** 2.2
            arr[y, x] = BASE_COL * (1 - bright * 0.6) + LIGHT * bright

    return arr.clip(0, 255).astype(np.uint8)


def make_caustics() -> None:
    """4-frame animated caustic strip (128×32), VGA quantized."""
    FSIZE = 32
    NFRAMES = 4
    strip = Image.new('RGB', (FSIZE * NFRAMES, FSIZE))

    for i in range(NFRAMES):
        phase = (i / NFRAMES) * math.pi * 2
        frame = _caustic_frame(phase, FSIZE, seed=i)
        img   = Image.fromarray(frame, 'RGB')
        strip.paste(img, (i * FSIZE, 0))

    strip = fmv_post(strip, dither_t=0.20)
    save(strip, 'caustics.png')


# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND FILMS — VGA grain / scan overlay (280×156)
# ─────────────────────────────────────────────────────────────────────────────

def make_background_films() -> None:
    """
    Film grain and scanline overlay texture. Rendered as RGBA with most pixels
    partially transparent. The bright specks simulate VGA video digitization
    noise; the horizontal scanline bands simulate CCD row-capture artefacts.
    """
    W, H = 280, 156
    rng  = random.Random(99)

    arr = np.zeros((H, W, 4), dtype=np.uint8)   # RGBA, default transparent

    # Scattered bright grain speckles
    for _ in range(1800):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, H - 1)
        v = rng.randint(160, 255)
        a = rng.randint(18, 55)
        arr[y, x] = (v, v, v, a)

    # Horizontal scanline dimming bands (every 2 rows, very subtle)
    for y in range(0, H, 2):
        for x in range(W):
            if arr[y, x, 3] == 0:
                arr[y, x] = (0, 0, 0, 10)  # subtle row darkening

    # Occasional brighter hot pixels
    for _ in range(80):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, H - 1)
        arr[y, x] = (255, 255, 200, rng.randint(40, 90))

    img = Image.fromarray(arr, 'RGBA')
    save(img, 'background_films.png')


# ─────────────────────────────────────────────────────────────────────────────
# BUBBLE — 3-frame animation (18×6 strip, each frame 6×6)
# ─────────────────────────────────────────────────────────────────────────────

def make_bubble() -> None:
    """Small bubble particle, 3 animation frames (expand + pop)."""
    FSIZE = 6
    strip = Image.new('RGBA', (FSIZE * 3, FSIZE), (0, 0, 0, 0))

    for i, radius in enumerate([1.8, 2.2, 2.4]):
        frame = Image.new('RGBA', (FSIZE, FSIZE), (0, 0, 0, 0))
        arr   = np.zeros((FSIZE, FSIZE, 4), dtype=np.uint8)
        cx, cy = FSIZE / 2, FSIZE / 2

        for y in range(FSIZE):
            for x in range(FSIZE):
                d = math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
                # Ring: bright rim, darker inside
                rim  = max(0, 1 - abs(d - radius) * 2.5)
                glow = max(0, 1 - (d / (radius + 0.5)) ** 2) * 0.25
                t    = max(rim, glow)
                if t > 0.05:
                    # VGA bubble highlight: pale blue-white
                    lum = int(t * 220)
                    a   = int(t * 200)
                    # Highlight spot at top-left of bubble
                    hi = 1 if (x < cx and y < cy and d < radius * 0.55) else 0
                    r  = min(255, lum + hi * 60)
                    g  = min(255, lum + hi * 60 + 8)
                    b  = min(255, lum + hi * 60 + 40)
                    arr[y, x] = (r, g, b, a)

        frame = Image.fromarray(arr, 'RGBA')
        strip.paste(frame, (i * FSIZE, 0))

    # Apply VGA-style post to the RGB channels
    strip = fmv_post_rgba(strip, dither_t=0.12)
    save(strip, 'bubble.png')


# ─────────────────────────────────────────────────────────────────────────────
# MOTE — dust/detritus particle (6×6)
# ─────────────────────────────────────────────────────────────────────────────

def make_mote() -> None:
    """Tiny suspended particle — organic warm off-white dot."""
    SIZE = 6
    arr  = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    cx = cy = SIZE / 2

    for y in range(SIZE):
        for x in range(SIZE):
            d = math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
            t = max(0.0, 1.0 - d / 1.4)
            if t > 0.0:
                lum = int(t ** 0.7 * 200)
                a   = int(t * 160)
                arr[y, x] = (lum, int(lum * 0.95), int(lum * 0.82), a)

    img = Image.fromarray(arr, 'RGBA')
    img = fmv_post_rgba(img, dither_t=0.10)
    save(img, 'mote.png')


# ─────────────────────────────────────────────────────────────────────────────
# FOOD WAFER — algae wafer sinking (12×8 strip, 3 frames of 4×8)
# ─────────────────────────────────────────────────────────────────────────────

def make_food_wafer() -> None:
    """
    Sinking algae wafer: slightly irregular disc, 3 frames show slight wobble.
    """
    FW, FH = 4, 8
    strip  = Image.new('RGBA', (FW * 3, FH), (0, 0, 0, 0))
    rng    = random.Random(55)

    for i in range(3):
        arr  = np.zeros((FH, FW, 4), dtype=np.uint8)
        # Wafer is a slightly oval disc in the lower 5 pixels
        cx = FW / 2 + rng.uniform(-0.2, 0.2)
        cy = FH - 3.0 + rng.uniform(-0.3, 0.3)
        rx, ry = 1.5, 1.0

        for y in range(FH):
            for x in range(FW):
                ex = (x + 0.5 - cx) / rx
                ey = (y + 0.5 - cy) / ry
                d  = math.sqrt(ex ** 2 + ey ** 2)
                if d <= 1.0:
                    t   = 1.0 - d
                    # Algae wafer: dark olive-green
                    r   = int(60  + t * 20)
                    g   = int(80  + t * 30)
                    b   = int(20  + t * 10)
                    a   = int(200 + t * 55)
                    arr[y, x] = (r, g, b, a)

        frame = Image.fromarray(arr, 'RGBA')
        strip.paste(frame, (i * FW, 0))

    strip = fmv_post_rgba(strip, dither_t=0.14)
    save(strip, 'food_wafer.png')


# ─────────────────────────────────────────────────────────────────────────────
# LED FIXTURE — overhead light bar (240×8)
# ─────────────────────────────────────────────────────────────────────────────

def make_led_fixture() -> None:
    """
    Horizontal LED grow-light bar: bright white-blue centre with warm
    amber fall-off at edges. Simulates 6500K full-spectrum planted-tank light.
    """
    W, H = 240, 8
    arr  = np.zeros((H, W, 3), dtype=np.uint8)

    for x in range(W):
        # Multiple LED clusters spaced along the bar
        n_clusters = 8
        brightness = 0.0
        for k in range(n_clusters):
            centre = W * (k + 0.5) / n_clusters
            dist   = abs(x - centre)
            brightness += max(0, 1 - dist / (W / n_clusters * 0.7))

        # Vertical gradient: brightest at bottom of strip (facing downward)
        for y in range(H):
            vy = 1.0 - (y / (H - 1)) * 0.35

            # Core: cool white-blue LED
            lum   = min(1.0, brightness * 0.8) * vy
            warm  = lum * 0.7   # warm fall-off at edges
            cool  = lum         # cool centre
            t_edge = abs(x - W / 2) / (W / 2)
            blend  = t_edge ** 1.6

            r = int(min(255, max(0, cool * 245 + blend * warm * 10)))
            g = int(min(255, max(0, cool * 248 + blend * warm * 5)))
            b = int(min(255, max(0, cool * 255)))
            arr[y, x] = (
                min(255, r),
                min(255, g),
                min(255, b),
            )

    img = Image.fromarray(arr, 'RGB')
    img = fmv_post(img, dither_t=0.10)
    save(img, 'led_fixture.png')


# ─────────────────────────────────────────────────────────────────────────────
# DISPATCH
# ─────────────────────────────────────────────────────────────────────────────

GENERATORS = {
    'substrate':        make_substrate,
    'water_tile':       make_water_tile,
    'caustics':         make_caustics,
    'background_films': make_background_films,
    'bubble':           make_bubble,
    'mote':             make_mote,
    'food_wafer':       make_food_wafer,
    'led_fixture':      make_led_fixture,
}


def main() -> None:
    ap = argparse.ArgumentParser(description='Generate FMV-style background textures')
    ap.add_argument('targets', nargs='*', help='Texture names (default: all)')
    args = ap.parse_args()

    targets = args.targets or list(GENERATORS)
    print(f'=== fmv_textures.py  {len(targets)} textures ===')

    for name in targets:
        if name not in GENERATORS:
            print(f'  UNKNOWN: {name}  (choices: {", ".join(GENERATORS)})')
            continue
        print(f'  [{name}]')
        try:
            GENERATORS[name]()
        except Exception as e:
            import traceback
            print(f'  FAIL: {e}')
            traceback.print_exc()

    print('Done.')


if __name__ == '__main__':
    main()
