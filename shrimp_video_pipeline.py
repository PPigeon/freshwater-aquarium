#!/usr/bin/env python3
"""
shrimp_video_pipeline.py
========================
FMV-quality shrimp animation via real video-capture digitisation.

Instead of elastically deforming a single still photo, this script:
  1. Finds and downloads a free high-quality shrimp swimming video
     (Wikimedia Commons first → yt-dlp YouTube fallback)
  2. Extracts 36+ frames with OpenCV
  3. Runs rembg on each frame
  4. Scores and selects 18 frames covering 3 animation states:
       Row 0  forage  (6 frames) — grazing / substrate behaviour
       Row 1  idle    (6 frames) — resting / neutral pose
       Row 2  swim    (6 frames) — active swimming
  5. Applies the same VGA digitisation pipeline as fmv_pipeline.py
  6. Derives all 10 colour variants via HSV rotation from the red_cherry base
  7. Writes 360×78 sprite sheets to assets/sprites/ — drop-in replacements

Usage:
    py -3.12 shrimp_video_pipeline.py                  # full run
    py -3.12 shrimp_video_pipeline.py --source <url>   # force a specific video URL
    py -3.12 shrimp_video_pipeline.py --extract-only   # save raw + rembg frames, no sprites
    py -3.12 shrimp_video_pipeline.py --variant red_cherry  # base variant only
    py -3.12 shrimp_video_pipeline.py --skip-download  # use cached video in _intermediates/
"""

from __future__ import annotations

import sys, os, io, math, json, argparse, hashlib, time, shutil, warnings
from pathlib import Path

# Force UTF-8 output on Windows (cp1252 chokes on yt-dlp progress characters)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT   = Path(__file__).parent
INTER  = ROOT / '_intermediates' / 'shrimp_video'
OUTPUT = ROOT / 'assets' / 'sprites'
INTER.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)

# ── Import VGA stages from the main pipeline ─────────────────────────────────
sys.path.insert(0, str(ROOT))
from fmv_pipeline import (
    stage5_vga_quantize, stage6_vhs_grade, stage7_bayer_dither,
    stage8_cinepak_blocks, stage9_analog_chain, stage10_chroma_fringe,
    stage11_downscale, stage12_assemble, apply_hue_shift,
    split_alpha, merge_alpha, SHRIMP_VARIANTS, SHRIMP_SYNTH, BAYER8,
)
from rembg import remove, new_session

# ── Config ────────────────────────────────────────────────────────────────────

FRAME_W, FRAME_H = 60, 26          # sprite frame dimensions (must match manifest)
COLS, ROWS       = 6, 3            # sprite sheet grid
FRAMES_PER_ROW   = COLS            # 6 frames per animation state
N_FRAMES_TOTAL   = COLS * ROWS     # 18 frames

# Intermediate scale: 5× the game frame for high-quality rembg + VGA pass
INTER_W = FRAME_W * 5   # 300
INTER_H = FRAME_H * 5   # 130

# How many raw frames to extract from the video (more = better pose selection)
N_EXTRACT = 54

# Wikimedia Commons search queries (tried in order, first usable video wins)
WIKIMEDIA_QUERIES = [
    'Neocaridina davidi cherry shrimp aquarium',
    'cherry shrimp swimming neocaridina',
    'neocaridina shrimp aquarium swim',
    'freshwater shrimp aquarium swimming',
]

# YouTube fallback search terms (requires yt-dlp)
YT_QUERIES = [
    'ytsearch5:cherry shrimp swimming close up aquarium',
    'ytsearch5:neocaridina davidi swimming slow motion',
    'ytsearch5:red cherry shrimp aquarium close up',
]

_rembg_session = None

def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        print('  [rembg] Loading model (birefnet-general)...')
        _rembg_session = new_session('birefnet-general')
        print('  [rembg] Ready.')
    return _rembg_session

# ── Video search and download ─────────────────────────────────────────────────

_WMC_HEADERS = {
    'User-Agent': 'AquariumFMVPipeline/1.0 (research; contact: user@example.com)',
    'Accept': 'application/json',
}


def _wmc_search(query: str) -> list[str]:
    """Search Wikimedia Commons for video files matching query."""
    try:
        import requests
        params = {
            'action': 'query', 'list': 'search',
            'srsearch': query, 'srnamespace': 6,
            'format': 'json', 'srlimit': 20,
        }
        r = requests.get('https://commons.wikimedia.org/w/api.php',
                         params=params, headers=_WMC_HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
        results = data.get('query', {}).get('search', [])
        video_exts = {'.ogv', '.webm', '.mp4'}
        return [x['title'] for x in results
                if any(x['title'].lower().endswith(e) for e in video_exts)]
    except Exception as e:
        print(f'  [WMC] search failed: {e}')
        return []


def _wmc_file_url(title: str) -> str | None:
    """Resolve a Wikimedia Commons File: title to a direct download URL."""
    try:
        import requests
        params = {
            'action': 'query', 'titles': title,
            'prop': 'imageinfo', 'iiprop': 'url|size|mime',
            'format': 'json',
        }
        r = requests.get('https://commons.wikimedia.org/w/api.php',
                         params=params, headers=_WMC_HEADERS, timeout=15)
        r.raise_for_status()
        pages = r.json().get('query', {}).get('pages', {})
        for page in pages.values():
            for info in page.get('imageinfo', []):
                if info.get('mime', '').startswith('video/'):
                    return info['url']
    except Exception as e:
        print(f'  [WMC] URL resolution failed for {title}: {e}')
    return None


def find_wikimedia_video() -> str | None:
    """
    Search Wikimedia Commons and return a yt-dlp-compatible page URL
    (not a direct upload URL — those are 403-blocked without cookies).
    """
    print('[SEARCH] Wikimedia Commons...')
    for q in WIKIMEDIA_QUERIES:
        titles = _wmc_search(q)
        print(f'  query "{q}" -> {len(titles)} video files')
        for title in titles[:6]:
            # Build the wiki page URL; yt-dlp can extract video from Commons pages
            name = title.replace('File:', '').replace(' ', '_')
            page_url = f'https://commons.wikimedia.org/wiki/File:{name}'
            print(f'  -> {title}')
            print(f'    URL: {page_url}')
            return page_url
    return None


def find_youtube_video() -> str | None:
    """Search YouTube via yt-dlp and return the best match URL."""
    try:
        import yt_dlp
    except ImportError:
        print('  [YT] yt-dlp not available')
        return None

    print('[SEARCH] YouTube (yt-dlp)...')
    for query in YT_QUERIES:
        try:
            ydl_opts = {
                'quiet': True, 'no_warnings': True,
                'noprogress': True,
                'extract_flat': True, 'noplaylist': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(query, download=False)
                entries = info.get('entries', [])
                for entry in entries:
                    if not entry:
                        continue
                    # Prefer videos between 20 seconds and 10 minutes
                    dur = entry.get('duration', 0) or 0
                    if 15 < dur < 600:
                        url = f"https://www.youtube.com/watch?v={entry['id']}"
                        print(f'  -> {entry.get("title","?")} ({dur:.0f}s)')
                        print(f'    URL: {url}')
                        return url
        except Exception as e:
            print(f'  [YT] query failed: {e}')
    return None


def download_video(url: str, dest: Path) -> Path | None:
    """
    Download a video using yt-dlp (handles YouTube, Wikimedia Commons pages,
    and most video platforms).  Returns path to the downloaded file or None.
    """
    if dest.exists() and dest.stat().st_size > 50_000:
        print(f'[DOWNLOAD] Using cached: {dest.name}')
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        import yt_dlp
        print(f'[DOWNLOAD] yt-dlp downloading...')
        tmpl = str(dest.with_suffix(''))
        ydl_opts = {
            'format': 'bestvideo[height<=720]/best',
            'outtmpl': tmpl + '.%(ext)s',
            'quiet': True,
            'no_warnings': True,
            'noprogress': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find whatever file yt-dlp wrote (it appends the real extension)
        video_exts = {'.webm', '.mp4', '.ogv', '.mkv', '.avi', '.mov'}
        candidates = [
            f for f in dest.parent.iterdir()
            if f.suffix.lower() in video_exts and f.stat().st_size > 10_000
        ]
        if candidates:
            best = max(candidates, key=lambda f: f.stat().st_mtime)
            print(f'  got: {best.name} ({best.stat().st_size // 1024} KB)')
            if best != dest:
                dest.unlink(missing_ok=True)
                shutil.move(str(best), str(dest))
            return dest
        else:
            print('  [DOWNLOAD] no video file found after yt-dlp run')
    except Exception as e:
        print(f'  [DOWNLOAD] yt-dlp failed: {e}')

    return None


# ── Frame extraction ──────────────────────────────────────────────────────────

def extract_frames(video_path: Path, n: int = N_EXTRACT) -> list[Image.Image]:
    """Extract n evenly-spaced frames from a video file using OpenCV."""
    import cv2
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f'Cannot open video: {video_path}')

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps   = cap.get(cv2.CAP_PROP_FPS) or 25
    print(f'[FRAMES] {video_path.name}: {total} frames @ {fps:.1f} fps')

    frames: list[Image.Image] = []
    for i in range(n):
        idx = int(total * i / n)
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, bgr = cap.read()
        if not ok:
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        frames.append(Image.fromarray(rgb))

    cap.release()
    print(f'  extracted {len(frames)} frames')
    return frames


# ── Frame scoring and rembg ───────────────────────────────────────────────────

def sharpness(img: Image.Image) -> float:
    """Laplacian-variance sharpness score."""
    from scipy.ndimage import laplace
    arr = np.array(img.convert('L'), dtype=np.float32)
    return float(np.var(laplace(arr)))


def subject_fill(alpha: np.ndarray) -> float:
    """Fraction of the frame covered by the detected subject."""
    total = alpha.shape[0] * alpha.shape[1]
    return float((alpha > 20).sum()) / max(1, total)


def remove_bg(img: Image.Image, cache_path: Path | None = None) -> Image.Image:
    """Run rembg; use cached result if available."""
    if cache_path and cache_path.exists():
        return Image.open(cache_path).convert('RGBA')
    session = get_rembg_session()
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    result = remove(
        buf.getvalue(), session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=235,
        alpha_matting_background_threshold=8,
        alpha_matting_erode_size=3,
    )
    out = Image.open(io.BytesIO(result)).convert('RGBA')
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        out.save(cache_path)
    return out


def score_rembg_frame(rgba: Image.Image) -> float:
    """Score quality of a rembg'd frame for sprite suitability."""
    arr   = np.array(rgba)
    alpha = arr[:, :, 3]
    fill  = subject_fill(alpha)
    if fill < 0.03 or fill > 0.85:
        return 0.0   # too empty or full-frame (background not removed)
    # Body aspect ratio: wide = side view = good for shrimp sprite
    rows_filled = np.any(alpha > 20, axis=1)
    cols_filled = np.any(alpha > 20, axis=0)
    if rows_filled.sum() < 2 or cols_filled.sum() < 2:
        return 0.0
    h = float(rows_filled.sum())
    w = float(cols_filled.sum())
    aspect = w / max(h, 1)   # >1 = wider than tall = side view
    aspect_score = min(1.0, max(0.0, (aspect - 0.8) / 1.4))
    # RGB sharpness on the subject area
    rgb  = arr[:, :, :3].astype(np.float32)
    mask = (alpha > 20).astype(np.float32)
    if mask.sum() < 50:
        return 0.0
    grey = (0.299 * rgb[:,:,0] + 0.587 * rgb[:,:,1] + 0.114 * rgb[:,:,2]) * mask
    sharp = float(np.std(grey[alpha > 20]))
    return fill * 3.0 + aspect_score * 2.5 + min(sharp, 40) / 40.0 * 2.0


def classify_pose(rgba: Image.Image) -> str:
    """
    Classify the animation state suggested by this frame's rembg output.
    Returns 'forage', 'idle', or 'swim'.
    """
    arr   = np.array(rgba)
    alpha = arr[:, :, 3]
    ys, _ = np.where(alpha > 20)
    if len(ys) < 20:
        return 'idle'
    cy = float(np.mean(ys))
    h  = float(alpha.shape[0])
    rel = cy / h            # 0=top of frame, 1=bottom
    if rel > 0.60:
        return 'forage'     # low in frame → head-down grazing
    elif rel < 0.42:
        return 'swim'       # high in frame → swimming up
    else:
        return 'idle'


# ── Frame selection ───────────────────────────────────────────────────────────

def select_animation_frames(
    scored: list[tuple[float, str, Image.Image, Image.Image]],
    n_per_state: int = FRAMES_PER_ROW,
) -> dict[str, list[Image.Image]]:
    """
    Select n_per_state frames for each animation state (forage / idle / swim).

    scored: list of (score, pose, raw_img, rembg_img)

    Strategy:
      1. Group frames by classified pose
      2. If any group is short, supplement with temporal-thirds fallback
      3. Within each group, sort by score and pick the top n_per_state
    """
    by_pose: dict[str, list[tuple[float, int, Image.Image, Image.Image]]] = {
        'forage': [], 'idle': [], 'swim': [],
    }
    for idx, (sc, pose, raw, rembg) in enumerate(scored):
        if sc > 0.2:
            by_pose[pose].append((sc, idx, raw, rembg))

    # Sort each group by score descending
    for p in by_pose:
        by_pose[p].sort(key=lambda x: -x[0])

    # Temporal thirds fallback pool (all frames sorted by index)
    n_total = len(scored)
    thirds = {
        'forage': [x for x in scored if x[0] > 0.1][:n_total // 3],
        'idle':   [x for x in scored if x[0] > 0.1][n_total // 3: 2 * n_total // 3],
        'swim':   [x for x in scored if x[0] > 0.1][2 * n_total // 3:],
    }

    result: dict[str, list[Image.Image]] = {}
    for state in ('forage', 'idle', 'swim'):
        pool = [(sc, idx, raw, rb) for sc, idx, raw, rb in by_pose[state]]
        # Supplement with temporal thirds if not enough classified frames
        if len(pool) < n_per_state:
            fallback = [(sc, i, raw, rb)
                        for i, (sc, pose, raw, rb) in enumerate(thirds[state])
                        if (sc, i, raw, rb) not in pool]
            pool.extend(fallback)
            pool.sort(key=lambda x: -x[0])

        # Pick n_per_state with maximum temporal spread to ensure pose diversity
        selected: list[tuple[float, int, Image.Image, Image.Image]] = []
        if len(pool) >= n_per_state:
            # Sort pool by index (temporal order) after score-based filtering
            top = pool[:n_per_state * 3]   # take top-scoring candidates
            top.sort(key=lambda x: x[1])    # sort by temporal index
            step = max(1, len(top) // n_per_state)
            selected = [top[i * step] for i in range(min(n_per_state, len(top)))]
        else:
            selected = pool[:n_per_state]

        # Fill remaining slots by repeating if necessary
        while len(selected) < n_per_state and selected:
            selected.append(selected[len(selected) % len(selected)])

        result[state] = [item[3] for item in selected[:n_per_state]]  # rembg images

    return result


# ── FMV processing ────────────────────────────────────────────────────────────

def process_frame_vga(img_rgba: Image.Image, subject_type: str = 'shrimp') -> Image.Image:
    """
    Apply full VGA digitisation pipeline to a single RGBA intermediate-res frame.
    Returns the processed RGBA frame at game resolution (FRAME_W × FRAME_H).
    """
    img_rgb, alpha = split_alpha(img_rgba)

    img_rgb = stage5_vga_quantize(img_rgb)
    img_rgb = stage6_vhs_grade(img_rgb, subject_type=subject_type)
    img_rgb = stage7_bayer_dither(img_rgb, threshold=10.0)
    img_rgb = stage8_cinepak_blocks(img_rgb)
    img_rgb = stage9_analog_chain(img_rgb)
    result  = stage10_chroma_fringe(img_rgb, alpha)
    result  = stage11_downscale(result, FRAME_W, FRAME_H)

    # Stage 11b: final micro-sharpen
    rgb_s, alpha_s = split_alpha(result)
    rgb_s  = ImageEnhance.Sharpness(rgb_s).enhance(1.55)
    return merge_alpha(rgb_s, alpha_s)


def prepare_frame(rembg_img: Image.Image) -> Image.Image:
    """
    Crop and resize a rembg'd frame to the 5× intermediate resolution.
    Tight-crops around the detected subject with 18% padding, then resizes.
    """
    arr   = np.array(rembg_img)
    alpha = arr[:, :, 3]

    # Find subject bounding box
    rows_on = np.any(alpha > 10, axis=1)
    cols_on = np.any(alpha > 10, axis=0)
    if not rows_on.any() or not cols_on.any():
        return rembg_img.resize((INTER_W, INTER_H), Image.LANCZOS)

    rmin, rmax = np.where(rows_on)[0][[0, -1]]
    cmin, cmax = np.where(cols_on)[0][[0, -1]]

    # Add padding
    H, W = alpha.shape
    pad_v = int((rmax - rmin) * 0.18)
    pad_h = int((cmax - cmin) * 0.18)
    rmin  = max(0, rmin - pad_v)
    rmax  = min(H - 1, rmax + pad_v)
    cmin  = max(0, cmin - pad_h)
    cmax  = min(W - 1, cmax + pad_h)

    cropped = rembg_img.crop((cmin, rmin, cmax + 1, rmax + 1))
    return cropped.resize((INTER_W, INTER_H), Image.LANCZOS)


# ── Colour variant synthesis ──────────────────────────────────────────────────

VARIANT_PARAMS: dict[str, tuple[str, float, float, float]] = {
    v: params for v, params in SHRIMP_SYNTH.items()
}

def apply_variant_shift(processed_frames: list[Image.Image],
                         variant: str) -> list[Image.Image]:
    """Apply HSV shift to a set of processed RGBA frames for a colour variant."""
    if variant not in VARIANT_PARAMS:
        return processed_frames
    _, hue, sat_f, val_f = VARIANT_PARAMS[variant]
    out = []
    for frame in processed_frames:
        shifted = apply_hue_shift(frame, hue, sat_f, val_f)
        # Re-run VGA quantise + dither to lock the variant colours to the VGA grid
        rgb, alpha = split_alpha(shifted)
        rgb = stage5_vga_quantize(rgb)
        rgb = stage7_bayer_dither(rgb, threshold=8.0)
        out.append(merge_alpha(rgb, alpha))
    return out


# ── Sprite sheet assembly ─────────────────────────────────────────────────────

def build_sheet(frame_groups: dict[str, list[Image.Image]]) -> Image.Image:
    """
    Assemble processed frames into a 6×3 sprite sheet (360×78 px).
    Row 0 = forage, Row 1 = idle, Row 2 = swim.
    """
    sheet = Image.new('RGBA', (COLS * FRAME_W, ROWS * FRAME_H), (0, 0, 0, 0))
    for row_idx, state in enumerate(('forage', 'idle', 'swim')):
        frames = frame_groups.get(state, [])
        for col_idx in range(COLS):
            frame = frames[col_idx % len(frames)] if frames else Image.new('RGBA', (FRAME_W, FRAME_H))
            # Centre within cell
            cell = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
            ox = (FRAME_W - frame.width) // 2
            oy = (FRAME_H - frame.height) // 2
            cell.paste(frame, (ox, oy), frame)
            sheet.paste(cell, (col_idx * FRAME_W, row_idx * FRAME_H), cell)
    return sheet


def save_variant_sheets(frame_groups: dict[str, list[Image.Image]],
                         variant: str) -> None:
    """Generate male + female sprite sheets for a given variant."""
    base_frames_flat = (
        frame_groups['forage'] + frame_groups['idle'] + frame_groups['swim']
    )

    # Colour synthesis for non-base variants
    if variant in VARIANT_PARAMS:
        base_frames_flat = apply_variant_shift(base_frames_flat, variant)

    forage = base_frames_flat[:FRAMES_PER_ROW]
    idle   = base_frames_flat[FRAMES_PER_ROW:FRAMES_PER_ROW * 2]
    swim   = base_frames_flat[FRAMES_PER_ROW * 2:]
    groups = {'forage': forage, 'idle': idle, 'swim': swim}

    for sex in ('male', 'female'):
        sheet = build_sheet(groups)
        out_path = OUTPUT / f'{variant}_{sex}.png'
        sheet.save(out_path)
        print(f'  [OUT] {out_path.name}  ({sheet.width}×{sheet.height})')

    # Berried version for red_cherry female
    if variant == 'red_cherry':
        sheet = build_sheet(groups)
        out_path = OUTPUT / 'red_cherry_berried.png'
        sheet.save(out_path)
        print(f'  [OUT] {out_path.name}')


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_video_pipeline(
    source_url: str | None,
    skip_download: bool,
    extract_only: bool,
    target_variants: list[str],
) -> bool:
    """
    Full pipeline: source → download → extract → rembg → score →
    select → VGA → assemble → variants.
    Returns True on success.
    """
    # ── Step 1: Locate video ──────────────────────────────────────────────────
    video_path = INTER / 'shrimp_source.webm'

    if not skip_download or not video_path.exists():
        if source_url:
            url = source_url
        else:
            # YouTube first (Wikimedia Commons blocks automated downloads with 403).
            # The search returns genuinely free aquarium footage.
            url = find_youtube_video()
            if not url:
                print('[SEARCH] YouTube search failed — trying Wikimedia Commons...')
                url = find_wikimedia_video()
            if not url:
                print('[ERROR] Could not find a suitable shrimp video.')
                print('  Specify one manually:  --source <URL>')
                return False

        video_path = download_video(url, video_path)
        if not video_path or not video_path.exists():
            print('[ERROR] Video download failed.')
            return False

    print(f'[VIDEO] Using: {video_path}')

    # ── Step 2: Extract frames ────────────────────────────────────────────────
    try:
        raw_frames = extract_frames(video_path, n=N_EXTRACT)
    except Exception as e:
        print(f'[ERROR] Frame extraction failed: {e}')
        return False

    if len(raw_frames) < 6:
        print(f'[ERROR] Only {len(raw_frames)} frames extracted — video may be corrupt.')
        return False

    # Save raw frames for inspection
    raw_dir = INTER / 'raw_frames'
    raw_dir.mkdir(exist_ok=True)
    for i, f in enumerate(raw_frames):
        f.save(raw_dir / f'frame_{i:03d}.jpg', quality=88)
    print(f'[FRAMES] Saved {len(raw_frames)} raw frames → {raw_dir}')

    if extract_only:
        print('[DONE] extract-only mode — stopping here.')
        return True

    # ── Step 3: rembg each frame ──────────────────────────────────────────────
    print(f'[REMBG] Processing {len(raw_frames)} frames...')
    rembg_dir = INTER / 'rembg_frames'
    rembg_dir.mkdir(exist_ok=True)

    scored: list[tuple[float, str, Image.Image, Image.Image]] = []
    for i, raw in enumerate(raw_frames):
        cache = rembg_dir / f'frame_{i:03d}_nobg.png'
        try:
            rb = remove_bg(raw, cache)
        except Exception as e:
            print(f'  frame {i:03d}: rembg failed ({e}) — skipping')
            continue
        sc   = score_rembg_frame(rb)
        pose = classify_pose(rb)
        scored.append((sc, pose, raw, rb))
        print(f'  frame {i:03d}: score={sc:.2f}  pose={pose}')

    if not scored:
        print('[ERROR] No frames passed quality scoring.')
        return False

    print(f'[SCORE] {len(scored)} frames scored; '
          f'forage={sum(1 for x in scored if x[1]=="forage")} '
          f'idle={sum(1 for x in scored if x[1]=="idle")} '
          f'swim={sum(1 for x in scored if x[1]=="swim")}')

    # ── Step 4: Select 18 frames ──────────────────────────────────────────────
    frame_groups = select_animation_frames(scored, n_per_state=FRAMES_PER_ROW)
    print('[SELECT] Animation frames chosen:')
    for state, frames in frame_groups.items():
        print(f'  {state}: {len(frames)} frames')

    # ── Step 5: VGA digitisation ──────────────────────────────────────────────
    print('[VGA] Digitising frames...')
    processed_dir = INTER / 'processed_frames'
    processed_dir.mkdir(exist_ok=True)

    vga_groups: dict[str, list[Image.Image]] = {}
    for state, frames in frame_groups.items():
        vga_groups[state] = []
        for j, rb in enumerate(frames):
            prepped = prepare_frame(rb)   # crop + resize to 300×130
            vga    = process_frame_vga(prepped, subject_type='shrimp')
            vga_groups[state].append(vga)
            save_path = processed_dir / f'{state}_{j:02d}.png'
            vga.save(save_path)
    print(f'[VGA] Done. Processed frames → {processed_dir}')

    # ── Step 6: Save sprite sheets for all target variants ────────────────────
    print('[SPRITES] Assembling sprite sheets...')
    for variant in target_variants:
        print(f'  [{variant}]')
        save_variant_sheets(vga_groups, variant)

    print('[DONE] Video pipeline complete.')
    return True


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description='FMV shrimp animation from real video footage',
    )
    ap.add_argument('--source', type=str, default=None,
                    help='Explicit video URL to use instead of auto-search')
    ap.add_argument('--skip-download', action='store_true',
                    help='Skip download, use cached video in _intermediates/shrimp_video/')
    ap.add_argument('--extract-only', action='store_true',
                    help='Only extract and rembg frames; do not produce sprites')
    ap.add_argument('--variant', type=str, default=None,
                    help='Produce this variant only (e.g. red_cherry). '
                         'Omit to produce all 10 variants.')
    args = ap.parse_args()

    if args.variant:
        if args.variant not in SHRIMP_VARIANTS:
            print(f'Unknown variant "{args.variant}". '
                  f'Valid: {", ".join(SHRIMP_VARIANTS)}')
            sys.exit(1)
        # Always include base variants needed for synthesis
        targets = [args.variant]
        # If variant needs a base, also process the base first
        if args.variant in SHRIMP_SYNTH:
            base = SHRIMP_SYNTH[args.variant][0]
            targets = [base, args.variant]
    else:
        targets = list(SHRIMP_VARIANTS)

    print('=' * 60)
    print('FMV Shrimp Video Pipeline')
    print(f'Variants: {targets}')
    print('=' * 60)

    ok = run_video_pipeline(
        source_url=args.source,
        skip_download=args.skip_download,
        extract_only=args.extract_only,
        target_variants=targets,
    )
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
