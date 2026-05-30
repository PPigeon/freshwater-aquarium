#!/usr/bin/env python3
"""
aquarium_bg_pipeline.py — Real aquarium room background through FMV pipeline
=============================================================================
Downloads an aquarium fish-room frame from YouTube, digitizes it through
the VGA/Bayer/Cinepak pipeline, and produces a 280×156 room_bg.png.

Unlike sprites, no background-removal step is used — the entire scene is
composited as a dark atmospheric FMV background panel.

Usage:
    py -3.12 aquarium_bg_pipeline.py                        # auto-search
    py -3.12 aquarium_bg_pipeline.py --source <YouTube URL> # specific video
    py -3.12 aquarium_bg_pipeline.py --skip-download        # reuse cached frame
    py -3.12 aquarium_bg_pipeline.py --preview-only         # save preview, no deploy
    py -3.12 aquarium_bg_pipeline.py --variants             # generate dark/mid/light variants
"""

import sys, os, argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

# ── Shared pipeline stages from fmv_pipeline ───────────────────────────────
from fmv_pipeline import (
    stage5_vga_quantize,
    stage6_vhs_grade,
    stage7_bayer_dither,
    stage8_cinepak_blocks,
    stage9_analog_chain,
    BAYER8,
)

PROJECT_ROOT = Path(__file__).parent
INTER_DIR    = PROJECT_ROOT / '_intermediates' / 'aquarium_bg'
OUTPUT_PATH  = PROJECT_ROOT / 'assets' / 'sprites' / 'background' / 'room_bg.png'

GW, GH = 280, 156          # world canvas size
BEZEL_TOP, BEZEL_BOTTOM, BEZEL_SIDE = 10, 4, 3

# ── YouTube sources — fish rooms and aquarium store interiors ───────────────
# These show real aquariums in their natural habitat — shelves of tanks,
# dark substrates, underwater lighting, the aquarist's world.
YT_QUERIES = [
    'ytsearch3:fish room tour aquarium shelves tanks 2023',
    'ytsearch3:planted aquarium fish room setup tour',
    'ytsearch3:aquarium store interior tour tanks',
    'ytsearch3:home fish room tour freshwater aquariums',
]

# Specific videos known to have good room establisher shots
PREFERRED_VIDEOS = [
    # Fish room tours with wide establishing shots showing shelves of tanks
    # (verified available May 2026)
    'https://www.youtube.com/watch?v=xNU_XhKd6P4',   # "Fish Room Tour July 2024"
    'https://www.youtube.com/watch?v=z5ygZDFDBT4',   # "Fish Room Tour Summer 2024"
    'https://www.youtube.com/watch?v=YvGn4upTEIs',   # "Fish Room Tour August 2024"
    'https://www.youtube.com/watch?v=82aXtEsugR0',   # "150 Aquariums Planted Fish Store"
    'https://www.youtube.com/watch?v=PyFn3L-ngfA',   # "Luxury Fish Room Private Tour"
]


def download_video(source_url: str, out_dir: Path) -> Path | None:
    """Download video via yt-dlp to intermediate dir. Returns path or None."""
    try:
        import yt_dlp
    except ImportError:
        print("  ERROR yt-dlp not found. Install with: pip install yt-dlp")
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    out_tmpl = str(out_dir / 'bg_source.%(ext)s')

    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]/best[height<=720]',
        'outtmpl': out_tmpl,
        'quiet': True,
        'noprogress': True,
        'noplaylist': True,
    }

    print(f"  [DOWNLOAD] {source_url}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([source_url])
    except Exception as e:
        print(f"  ERROR download failed: {e}")
        return None

    for ext in ('mp4', 'webm', 'mkv', 'avi', 'mov'):
        p = out_dir / f'bg_source.{ext}'
        if p.exists():
            kb = p.stat().st_size // 1024
            print(f"  got: {p.name} ({kb} KB)")
            return p
    print("  ERROR no video file produced")
    return None


def find_cached_video(out_dir: Path) -> Path | None:
    """Find already-downloaded video in intermediate dir."""
    for ext in ('mp4', 'webm', 'mkv', 'avi', 'mov'):
        p = out_dir / f'bg_source.{ext}'
        if p.exists():
            return p
    return None


def extract_best_frame(video_path: Path, out_dir: Path, n_candidates: int = 30) -> Image.Image:
    """
    Extract the best single frame from a video for use as room background.

    Strategy: sample n_candidates frames spread across the first 20% of the
    video (establishing shots are almost always at the start), score each by
    how much of the frame is occupied by bright indoor lighting (horizontal
    bands = shelving/tank rows), then return the highest-scoring frame.
    """
    try:
        import cv2
    except ImportError:
        print("  ERROR opencv-python not found. Install with: pip install opencv-python")
        sys.exit(1)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"  ERROR cannot open {video_path}")
        sys.exit(1)

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps   = cap.get(cv2.CAP_PROP_FPS) or 30.0
    print(f"  [VIDEO] {video_path.name}: {total} frames @ {fps:.1f}fps")

    # Sample from first 60% — room establishing shots are usually in opening minutes
    sample_end = max(60, int(total * 0.60))
    positions  = [int(i * sample_end / n_candidates) for i in range(n_candidates)]

    best_img, best_score = None, -1.0
    frame_dir = out_dir / 'bg_frames'
    frame_dir.mkdir(exist_ok=True)

    for idx, pos in enumerate(positions):
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        if not ret:
            continue
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)
        score = score_background_frame(img)
        thumb = img.resize((140, 78), Image.LANCZOS)
        thumb.save(frame_dir / f'cand_{idx:03d}_s{score:.2f}.jpg', quality=75)
        if score > best_score:
            best_score = score
            best_img = img
            print(f"    frame {idx:03d} (pos={pos}): score={score:.2f}  <- best so far")
        else:
            print(f"    frame {idx:03d} (pos={pos}): score={score:.2f}")

    cap.release()
    print(f"  [BEST] score={best_score:.2f}")
    return best_img


def score_background_frame(img: Image.Image) -> float:
    """
    Score a candidate frame for quality as a room background.
    Higher = better.

    Criteria:
    - Has content across wide horizontal extent (not a close-up of one thing)
    - Has moderate brightness (not blown out, not completely black)
    - Has horizontal luminance variation (suggests shelving rows / tank layers)
    - Not dominated by a single hue (diverse room content)
    - PENALTY: center region dominated by flesh/skin tones (vlogger selfie shots)
    """
    arr = np.array(img.resize((140, 78), Image.LANCZOS), dtype=np.float32)

    # Brightness in 0-1
    luma = arr.mean(axis=2) / 255.0  # (78, 140)

    # Good brightness range: 0.15 to 0.75 (not black, not overexposed)
    mean_luma = luma.mean()
    brightness_score = 1.0 - abs(mean_luma - 0.35) * 2.0  # peak at 0.35
    brightness_score = max(0.0, brightness_score)

    # Horizontal structure: variance between row-average luminances
    row_means = luma.mean(axis=1)  # 78 values
    horiz_var = float(row_means.std())
    horiz_score = min(1.0, horiz_var * 8.0)

    # Not too uniform (a wall is boring)
    spatial_var = float(luma.std())
    variety_score = min(1.0, spatial_var * 4.0)

    # Hue variety (diverse room > single-color backdrop)
    hsv_arr = np.array(img.resize((70, 39), Image.LANCZOS).convert('HSV'), dtype=np.float32)
    hue_std = float(hsv_arr[:, :, 0].std())
    hue_score = min(1.0, hue_std / 30.0)

    # Skin-tone / vlogger-face penalty:
    # Detect pixels in the center 50% of the frame that match flesh-tone range
    # (R >> B, moderate saturation, mid brightness) — typical camera selfie shot.
    R, G, B = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    H_px, W_px = arr.shape[:2]
    cy0, cy1 = H_px // 4, 3 * H_px // 4
    cx0, cx1 = W_px // 4, 3 * W_px // 4
    center_R = R[cy0:cy1, cx0:cx1]
    center_G = G[cy0:cy1, cx0:cx1]
    center_B = B[cy0:cy1, cx0:cx1]
    # Flesh tone: R > 150, R > G > B, (R-B) > 40
    flesh = (
        (center_R > 150) &
        (center_R > center_G) &
        (center_G >= center_B) &
        ((center_R - center_B) > 40) &
        (center_B < 180)
    )
    flesh_ratio = float(flesh.mean())  # 0 = no flesh tones, 1 = all flesh
    # Penalty scales steeply: 0.1 flesh = -0.5, 0.3 flesh = -3.0
    face_penalty = min(4.0, flesh_ratio * 14.0)

    return (brightness_score * 2.5 + horiz_score * 2.0 +
            variety_score * 1.5 + hue_score * 1.0 - face_penalty)


# ── FMV Digitization for room background ───────────────────────────────────

def fmv_digitize_background(img: Image.Image, brightness: float = 0.52) -> Image.Image:
    """
    Apply full FMV digitization pipeline to a room background image.

    Returns RGB PIL Image at 280×156.

    The process:
    1. Crop to good 16:9 composition (prefer center-weighted, avoid zoomed edges)
    2. Resize to 5x intermediate (1400×780) for quality dithering
    3. VGA 6-bit quantize
    4. Background-specific color grade (dark, slight warm shift)
    5. Bayer 8×8 dithering
    6. Cinepak block simulation
    7. Analog blur/resharpen chain
    8. Downscale to 280×156
    9. Apply dark vignette + tank-window atmospheric gradient
    """
    # Step 1: Smart crop to 280:156 aspect (roughly 16:9)
    src_w, src_h = img.size
    target_ratio = GW / GH  # ~1.795
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Image is wider — crop sides, keep height
        crop_w = int(src_h * target_ratio)
        x0 = (src_w - crop_w) // 2
        img = img.crop((x0, 0, x0 + crop_w, src_h))
    else:
        # Image is taller — crop bottom (room views work better top-aligned)
        crop_h = int(src_w / target_ratio)
        img = img.crop((0, 0, src_w, min(crop_h, src_h)))

    # Step 2: Resize to 5x intermediate for quality dithering grain
    inter_w, inter_h = GW * 5, GH * 5   # 1400 × 780
    img = img.resize((inter_w, inter_h), Image.LANCZOS)

    # Step 3: VGA 6-bit quantize
    img_rgb = stage5_vga_quantize(img.convert('RGB'))

    # Step 4: Background color grade
    # Use a custom background grade with configurable brightness
    img_rgb = _bg_color_grade(img_rgb, brightness=brightness)

    # Step 5: Bayer dithering — slightly reduced threshold for backgrounds
    # (less aggressive dot pattern = more readable room detail at small size)
    img_rgb = stage7_bayer_dither(img_rgb, threshold=7.0)

    # Step 6: Cinepak block simulation — reduced pull so rooms stay readable
    img_rgb = stage8_cinepak_blocks(img_rgb, pull=0.04)

    # Step 7: Analog chain — lighter for backgrounds (no blue-screen fringing)
    arr = np.array(img_rgb, dtype=np.float32)
    # Mild Gaussian (replicating capture bandwidth loss)
    blurred = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGB').filter(
        ImageFilter.GaussianBlur(radius=0.35))
    # Resharpen — produces characteristic digitized-video edge quality
    img_rgb = ImageEnhance.Sharpness(blurred).enhance(1.4)

    # Step 8: Downscale to final 280×156
    img_rgb = img_rgb.resize((GW, GH), Image.LANCZOS)

    # Step 9: Atmospheric finishing — vignette + tank window gradient
    img_rgb = _apply_atmospheric_finish(img_rgb)

    return img_rgb


def _bg_color_grade(img_rgb: Image.Image, brightness: float = 0.52) -> Image.Image:
    """
    Background-specific color grade.
    Simulates the darker, denser look of FMV game background panels
    vs. the lighter/warmer look of foreground sprites.

    brightness: 0.45 = very dark (film noir), 0.65 = brighter/more visible
    """
    arr = np.array(img_rgb, dtype=np.float32) / 255.0

    # Slight warm matrix — aquarium room lighting tends toward warm tungsten
    warm = np.array([
        [1.04, 0.00,  0.00],
        [0.00, 0.99,  0.00],
        [0.00, -0.03, 0.95],
    ])
    arr = np.einsum('...j,kj->...k', arr, warm).clip(0, 1)
    img_w = Image.fromarray((arr * 255).astype(np.uint8), 'RGB')

    # Moderate desaturation (video chroma roll-off)
    img_w = ImageEnhance.Color(img_w).enhance(0.72)
    # Contrast boost (video compression)
    img_w = ImageEnhance.Contrast(img_w).enhance(1.28)
    # Darken to background level
    img_w = ImageEnhance.Brightness(img_w).enhance(brightness)

    return img_w


def _apply_atmospheric_finish(img_rgb: Image.Image) -> Image.Image:
    """
    Add a subtle atmospheric finish:
    1. Corner vignette (darkens edges, focuses on center)
    2. A very faint horizontal scan-line-like pattern (CRT suggestion)
    3. Slight cool shadow in lower half (depth suggestion)
    """
    arr = np.array(img_rgb, dtype=np.float32)
    H, W = arr.shape[:2]

    # Radial vignette — dark corners
    cx, cy = W / 2.0, H / 2.0
    max_r  = ((cx**2 + cy**2) ** 0.5)
    ys, xs = np.mgrid[0:H, 0:W]
    r = ((xs - cx)**2 + (ys - cy)**2) ** 0.5
    # Vignette: 0 at center, ~0.35 at corner
    vign = (r / max_r) ** 2.2 * 0.38
    arr = arr * (1.0 - vign[:, :, np.newaxis])

    # Subtle horizontal scanline suggestion (every other row, -4% brightness)
    arr[0::2, :, :] *= 0.96

    # Cool lower half — slightly more blue-grey at the bottom
    # (visual weight, suggests depth / distance)
    # fade shape: (H, 1) so it broadcasts correctly against (H, W) channel slices
    fade = np.linspace(0, 0.12, H)[:, np.newaxis]     # (H, 1)
    arr[:, :, 0] -= arr[:, :, 0] * fade               # reduce R slightly
    arr[:, :, 2] += (255 - arr[:, :, 2]) * fade * 0.3 # lift B slightly

    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGB')


def generate_variants(base_img: Image.Image, out_dir: Path):
    """Generate dark/mid/light variants of the digitized background."""
    configs = [
        ('dark',  0.40, 6.5),   # (name, brightness, dither_threshold)
        ('mid',   0.52, 7.0),   # default
        ('light', 0.65, 8.0),
    ]
    for name, brightness, threshold in configs:
        src_w, src_h = base_img.size
        target_ratio = GW / GH
        src_ratio = src_w / src_h
        if src_ratio > target_ratio:
            crop_w = int(src_h * target_ratio)
            x0 = (src_w - crop_w) // 2
            cropped = base_img.crop((x0, 0, x0 + crop_w, src_h))
        else:
            crop_h = int(src_w / target_ratio)
            cropped = base_img.crop((0, 0, src_w, min(crop_h, src_h)))

        inter = cropped.resize((GW * 5, GH * 5), Image.LANCZOS)
        rgb   = stage5_vga_quantize(inter.convert('RGB'))
        rgb   = _bg_color_grade(rgb, brightness=brightness)
        rgb   = stage7_bayer_dither(rgb, threshold=threshold)
        rgb   = stage8_cinepak_blocks(rgb, pull=0.04)
        rgb   = ImageEnhance.Sharpness(
                    rgb.filter(ImageFilter.GaussianBlur(radius=0.35))
                ).enhance(1.4)
        rgb   = rgb.resize((GW, GH), Image.LANCZOS)
        rgb   = _apply_atmospheric_finish(rgb)

        out_path = out_dir / f'room_bg_{name}.png'
        rgb.save(out_path)
        print(f"  [VARIANT] {name}: {out_path}")


def try_download_sources(inter_dir: Path) -> Path | None:
    """Try multiple YouTube sources until one downloads successfully."""
    # Try preferred videos first (known good content)
    for url in PREFERRED_VIDEOS:
        print(f"\n[DOWNLOAD] Trying: {url}")
        video = download_video(url, inter_dir)
        if video:
            return video

    # Fallback to keyword search
    for query in YT_QUERIES:
        print(f"\n[DOWNLOAD] Searching: {query}")
        video = download_video(query, inter_dir)
        if video:
            return video

    return None


def main():
    parser = argparse.ArgumentParser(description='Aquarium Room Background FMV Pipeline')
    parser.add_argument('--source',           type=str,  help='YouTube URL or video path')
    parser.add_argument('--skip-download',    action='store_true', help='Use cached video')
    parser.add_argument('--use-cached-frame', action='store_true', help='Skip video extraction; process existing best_frame_raw.jpg directly')
    parser.add_argument('--preview-only',     action='store_true', help='Save preview, skip deploy')
    parser.add_argument('--variants',         action='store_true', help='Generate dark/mid/light variants')
    parser.add_argument('--brightness',       type=float, default=0.52, help='Background brightness 0-1 (default 0.52)')
    parser.add_argument('--frame',            type=int,  default=None, help='Force extraction of this frame index (0-based among candidates)')
    args = parser.parse_args()

    INTER_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print('=' * 60)
    print('FMV Aquarium Background Pipeline')
    print(f'Output: {OUTPUT_PATH}')
    print('=' * 60)

    # ── Acquire video ─────────────────────────────────────────────
    video_path = None

    if args.source and Path(args.source).exists():
        # Local file provided
        video_path = Path(args.source)
        print(f"[SOURCE] Using local file: {video_path}")
    elif args.skip_download:
        video_path = find_cached_video(INTER_DIR)
        if not video_path:
            print("[ERROR] No cached video found. Run without --skip-download first.")
            sys.exit(1)
        print(f"[SOURCE] Using cached: {video_path}")
    elif args.source:
        video_path = download_video(args.source, INTER_DIR)
        if not video_path:
            print("[ERROR] Download failed.")
            sys.exit(1)
    else:
        video_path = find_cached_video(INTER_DIR)
        if video_path:
            print(f"[SOURCE] Using cached: {video_path}")
        else:
            video_path = try_download_sources(INTER_DIR)
            if not video_path:
                print("\n[ERROR] All download attempts failed.")
                print("Provide a video directly: --source <URL or path>")
                sys.exit(1)

    # ── Extract best frame ────────────────────────────────────────
    cached_frame_path = INTER_DIR / 'best_frame_raw.jpg'
    if args.use_cached_frame and cached_frame_path.exists():
        print(f"\n[EXTRACT] Using cached frame: {cached_frame_path}")
        best_frame = Image.open(cached_frame_path).convert('RGB')
    else:
        print(f"\n[EXTRACT] Scanning {video_path.name} for best establishing shot...")
        best_frame = extract_best_frame(video_path, INTER_DIR, n_candidates=30)

    if best_frame is None:
        print("[ERROR] Frame extraction failed — is opencv-python installed?")
        sys.exit(1)

    # Save raw extracted frame for inspection
    raw_path = INTER_DIR / 'best_frame_raw.jpg'
    best_frame.save(raw_path, quality=90)
    print(f"[EXTRACT] Raw frame saved: {raw_path}")

    # ── FMV digitization ──────────────────────────────────────────
    print(f"\n[VGA] Digitizing through FMV pipeline (brightness={args.brightness:.2f})...")
    result = fmv_digitize_background(best_frame, brightness=args.brightness)

    # Save preview (3x scale for easy inspection)
    preview_path = INTER_DIR / 'room_bg_preview.png'
    preview = result.resize((GW * 3, GH * 3), Image.NEAREST)
    preview.save(preview_path)
    print(f"[PREVIEW] {preview_path} ({preview.width}x{preview.height}px — 3x scale)")

    # ── Generate variants ─────────────────────────────────────────
    if args.variants:
        print("\n[VARIANTS] Generating dark/mid/light variants...")
        generate_variants(best_frame, INTER_DIR)

    # ── Deploy ────────────────────────────────────────────────────
    if not args.preview_only:
        result.save(OUTPUT_PATH)
        print(f"\n[DEPLOY] Saved: {OUTPUT_PATH} ({GW}x{GH}px)")
    else:
        print(f"\n[PREVIEW-ONLY] Skipped deploy. Review: {preview_path}")

    print("\n[DONE] Background pipeline complete.")
    print(f"Check preview: {preview_path}")


if __name__ == '__main__':
    main()
