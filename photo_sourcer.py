#!/usr/bin/env python3
"""
photo_sourcer.py
Automatic reference photo acquisition pipeline for fmv_pipeline.py.

Three stages for each subject:
  1. SOURCE   - Search DuckDuckGo Images + Wikimedia Commons, download candidates
  2. VALIDATE - Score each for resolution, sharpness, subject fill, exposure, aspect
  3. EDIT     - Normalize exposure, auto-crop to subject, simplify background,
                subject-specific colour/sharpness adjustments

Outputs land in references/{category}/{subject}/ ready for fmv_pipeline.py.

Usage:
    py -3.12 photo_sourcer.py                         all subjects
    py -3.12 photo_sourcer.py --dry                   preview, no downloads
    py -3.12 photo_sourcer.py --category shrimp       shrimp only
    py -3.12 photo_sourcer.py --subject shrimp/red_cherry
    py -3.12 photo_sourcer.py --force                 re-download even if photos exist
    py -3.12 photo_sourcer.py --validate-only         score existing photos
    py -3.12 photo_sourcer.py --report                generate _sourcer_gallery.html
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy.ndimage import laplace as ndimage_laplace

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
REFS = ROOT / 'references'
INT  = ROOT / '_intermediates' / 'sourcer'   # thumbnails + debug output

# ── tuning ────────────────────────────────────────────────────────────────────
CANDIDATES_PER_QUERY = 12   # images fetched per search query
REQUEST_DELAY        = 1.0  # seconds between HTTP requests
DOWNLOAD_TIMEOUT     = 14   # seconds per download attempt
MAX_DL_RETRIES       = 2

PHOTOS_TARGET: dict[str, int] = {   # reference photos to keep per subject
    'shrimp':      4,
    'fish':        3,
    'plants':      2,
    'hardscape':   2,
    'background':  1,
}

MIN_RES: dict[str, tuple[int, int]] = {   # (min_w, min_h) acceptable resolution
    'shrimp':      (300, 180),
    'fish':        (380, 180),
    'plants':      (220, 300),
    'hardscape':   (300, 200),
    'background':  (600, 380),
}

# ── search queries ─────────────────────────────────────────────────────────────
# 3-5 queries per subject, most specific first.
# DuckDuckGo is tried first; Wikimedia Commons is a fallback for plants + hardscape.
QUERIES: dict[str, list[str]] = {

    # ── shrimp: want side-profile macro, good colour, simple background ────────
    'shrimp/red_cherry': [
        'red cherry neocaridina shrimp macro photo side view aquarium',
        'neocaridina davidi red cherry freshwater shrimp close up',
        'cherry shrimp aquarium photography high resolution',
    ],
    'shrimp/blue_dream': [
        'blue dream neocaridina shrimp macro aquarium side view',
        'blue velvet neocaridina shrimp close up freshwater',
        'neocaridina blue shrimp aquarium high resolution',
    ],
    'shrimp/yellow_fire': [
        'yellow fire neocaridina shrimp macro aquarium side view',
        'yellow neocaridina freshwater shrimp close up',
        'golden yellow shrimp aquarium macro photography',
    ],
    'shrimp/black_rose': [
        'black rose neocaridina shrimp aquarium macro side view',
        'black neocaridina freshwater shrimp close up aquarium',
        'dark neocaridina shrimp macro photography',
    ],

    # ── fish ───────────────────────────────────────────────────────────────────
    'fish/neon_tetra': [
        'neon tetra paracheirodon innesi aquarium side view macro photo',
        'neon tetra fish close up freshwater aquarium',
        'neon tetra swimming aquarium photography',
    ],

    # ── plants: full-plant shots preferred, white or dark uniform background ───
    'plants/java_fern': [
        'microsorum pteropus java fern aquarium plant isolated white background',
        'java fern aquatic plant full plant close up',
        'java fern freshwater aquarium plant photograph',
    ],
    'plants/anubias': [
        'anubias barteri aquarium plant isolated white background',
        'anubias nana aquatic plant full photograph',
        'anubias freshwater aquarium plant close up',
    ],
    'plants/vallisneria': [
        'vallisneria spiralis aquarium grass isolated white background',
        'tape grass vallisneria aquatic plant full photo',
        'vallisneria freshwater aquarium plant',
    ],
    'plants/rotala': [
        'rotala rotundifolia aquarium stem plant isolated white background',
        'rotala indica stem plant aquarium close up',
        'rotala freshwater aquarium stem plant photograph',
    ],
    'plants/crypt': [
        'cryptocoryne wendtii aquarium plant isolated white background',
        'cryptocoryne aquatic plant full photograph',
        'crypt wendtii freshwater plant close up',
    ],
    'plants/moss': [
        'java moss taxiphyllum barbieri aquarium clump isolated white background',
        'aquarium moss close up macro freshwater',
        'christmas moss aquarium plant photograph',
    ],
    'plants/buce': [
        'bucephalandra aquarium plant isolated white background close up',
        'bucephalandra kedagang aquatic plant photograph',
        'buce freshwater aquarium plant high resolution',
    ],
    'plants/salvinia': [
        'salvinia natans floating aquatic plant isolated white background',
        'salvinia fern floating plant aquarium close up',
        'floating aquatic fern salvinia photograph',
    ],
    'plants/redroot': [
        'phyllanthus fluitans red root floater aquarium close up',
        'red root floater aquatic plant macro photograph',
        'ludwigia sedoides floating aquarium plant',
    ],
    # New tall plants — full-plant shots on white/dark uniform background
    'plants/amazon_sword': [
        'echinodorus bleheri amazon sword plant aquarium isolated white background',
        'amazon sword echinodorus aquatic plant full plant photograph',
        'echinodorus aquarium plant large leaves high resolution',
    ],
    'plants/cabomba': [
        'cabomba caroliniana aquarium plant isolated white background full plant',
        'cabomba feathery aquatic plant photograph close up',
        'fan wort cabomba freshwater aquarium plant',
    ],
    'plants/ludwigia': [
        'ludwigia repens aquarium stem plant isolated white background red green',
        'ludwigia arcuata stem plant aquarium close up photograph',
        'ludwigia freshwater aquarium plant reddish stems',
    ],

    # ── hardscape: isolated / white-background shots work best ────────────────
    'hardscape/stone_seiryu': [
        'seiryu stone aquascape rock isolated white background photograph',
        'seiryu rock aquarium aquascape high resolution',
        'dragon stone seiryu isolated photograph',
    ],
    'hardscape/stone_dragon': [
        'ohko dragon stone aquarium rock isolated white background',
        'ohko stone aquascape rock close up',
        'dragon stone aquarium isolated photograph',
    ],
    'hardscape/stone_lava': [
        'lava rock aquarium black volcanic stone isolated white background',
        'black lava rock aquascape close up',
        'volcanic basalt aquarium rock isolated',
    ],
    'hardscape/stone_frodo': [
        'frodo stone small aquarium pebble isolated white background',
        'smooth river rock aquarium isolated photograph',
        'small aquarium stone pebble close up',
    ],
    'hardscape/stone_pagoda': [
        'pagoda stone aquarium stacked slate rock isolated white background',
        'layered sedimentary rock aquarium isolated',
        'slate pagoda rock aquascape photograph',
    ],
    'hardscape/wood_manzanita': [
        'manzanita driftwood aquarium isolated white background',
        'manzanita branch driftwood aquascape close up',
        'manzanita wood aquarium isolated high resolution',
    ],
    'hardscape/wood_spider': [
        'spiderwood aquarium driftwood isolated white background',
        'spider wood aquascape driftwood close up',
        'spiderwood freshwater aquarium photograph',
    ],
    'hardscape/wood_malaysian': [
        'malaysian driftwood aquarium isolated white background',
        'bogwood Malaysian driftwood aquascape close up',
        'dark driftwood aquarium isolated photograph',
    ],
    'hardscape/wood_mopani': [
        'mopani wood aquarium driftwood isolated white background',
        'mopani driftwood aquascape close up',
        'mopani two-tone driftwood aquarium',
    ],
    'hardscape/wood_redmoor': [
        'redmoor wood aquarium driftwood isolated white background',
        'redmoor root driftwood aquascape close up',
        'root wood aquarium isolated photograph',
    ],

    # ── background: wide room, dark, moody, Victorian ─────────────────────────
    'background/room': [
        'victorian laboratory interior dark wooden shelves scientific instruments',
        'antique study library dark room interior wooden shelves cabinet',
        '19th century apothecary shop dark interior wooden furniture',
        'victorian natural history cabinet dark wooden display room interior',
        'old science laboratory dark interior vintage equipment shelves',
    ],
}

# Wikimedia Commons is a reliable fallback with excellent botanical + geology coverage.
WIKIMEDIA_QUERIES: dict[str, str] = {
    'plants/java_fern':    'Microsorum pteropus',
    'plants/anubias':      'Anubias barteri aquarium',
    'plants/vallisneria':  'Vallisneria spiralis',
    'plants/rotala':       'Rotala rotundifolia',
    'plants/crypt':        'Cryptocoryne wendtii',
    'plants/moss':         'Taxiphyllum barbieri',
    'plants/buce':         'Bucephalandra aquarium',
    'plants/salvinia':     'Salvinia natans',
    'plants/redroot':      'Phyllanthus fluitans',
    'hardscape/stone_seiryu':   'aquarium seiryu rock aquascape',
    'hardscape/stone_lava':     'basalt lava rock mineral',
    'hardscape/wood_manzanita': 'Manzanita branch',
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def subject_type(ref_dir: str) -> str:
    cat = ref_dir.split('/')[0]
    return cat if cat in PHOTOS_TARGET else 'generic'


HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}


def download_image(url: str) -> Image.Image | None:
    """Fetch URL and decode as RGB PIL Image. Returns None on any failure."""
    for attempt in range(MAX_DL_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
                data = resp.read(20 * 1024 * 1024)   # cap at 20 MB
            img = Image.open(io.BytesIO(data))
            img.load()
            return img.convert('RGB')
        except Exception:
            if attempt < MAX_DL_RETRIES:
                time.sleep(1.5 * (attempt + 1))
    return None


# ─────────────────────────────────────────────────────────────────────────────
# SEARCH  (DuckDuckGo primary, Wikimedia secondary)
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_ddg() -> bool:
    """
    Ensure the 'ddgs' package is installed (the successor to duckduckgo_search).
    Returns True when the package is importable.
    """
    try:
        from ddgs import DDGS  # noqa: F401
        return True
    except ImportError:
        pass
    import subprocess
    print('  Installing ddgs...')
    r = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', 'ddgs', '-q'],
        capture_output=True,
    )
    if r.returncode == 0:
        print('  Installed ddgs.')
        return True
    print('  FAIL: could not install ddgs')
    print('  ', r.stderr.decode(errors='replace'))
    return False


def _ddgs_instance():
    """Return a DDGS context manager from the 'ddgs' package."""
    from ddgs import DDGS
    return DDGS()


def search_ddg(query: str, n: int = CANDIDATES_PER_QUERY) -> list[dict]:
    """DuckDuckGo image search. Returns list of {image, width, height} dicts."""
    import warnings
    for attempt in range(2):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', RuntimeWarning)
                with _ddgs_instance() as ddgs:
                    try:
                        results = list(ddgs.images(
                            query, max_results=n, size='large', type_image='photo',
                        ))
                    except TypeError:
                        results = list(ddgs.images(query, max_results=n))
            if results:
                return results
            # Empty result set — wait and retry once (common rate-limit symptom)
            if attempt == 0:
                time.sleep(4)
        except Exception:
            if attempt == 0:
                time.sleep(5)
    return []


def search_wikimedia(query: str, n: int = 6) -> list[dict]:
    """
    Wikimedia Commons image search via the MediaWiki API.
    Returns same {image, width, height} format as search_ddg.
    """
    try:
        # Step 1: text search in File namespace
        p1 = urllib.parse.urlencode({
            'action': 'query', 'list': 'search',
            'srsearch': query, 'srnamespace': '6',
            'srlimit': str(n * 2), 'format': 'json',
        })
        req1 = urllib.request.Request(
            f'https://commons.wikimedia.org/w/api.php?{p1}',
            headers={'User-Agent': 'FMVSourcer/1.0 (https://github.com/)'},
        )
        with urllib.request.urlopen(req1, timeout=10) as r:
            data1 = json.loads(r.read())

        titles = [s['title'] for s in data1.get('query', {}).get('search', [])]
        if not titles:
            return []

        # Step 2: resolve image URLs
        p2 = urllib.parse.urlencode({
            'action': 'query',
            'titles': '|'.join(titles[:n]),
            'prop': 'imageinfo',
            'iiprop': 'url|size',
            'iiurlwidth': '1200',
            'format': 'json',
        })
        req2 = urllib.request.Request(
            f'https://commons.wikimedia.org/w/api.php?{p2}',
            headers={'User-Agent': 'FMVSourcer/1.0 (https://github.com/)'},
        )
        with urllib.request.urlopen(req2, timeout=10) as r:
            data2 = json.loads(r.read())

        results = []
        for page in data2.get('query', {}).get('pages', {}).values():
            for ii in page.get('imageinfo', []):
                url = ii.get('thumburl') or ii.get('url', '')
                if url and url.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    results.append({
                        'image': url,
                        'width':  ii.get('thumbwidth',  ii.get('width',  0)),
                        'height': ii.get('thumbheight', ii.get('height', 0)),
                        'title': page.get('title', ''),
                    })
        return results

    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2 — VALIDATE / SCORE
# ─────────────────────────────────────────────────────────────────────────────

def _sharpness(gray_arr: np.ndarray) -> float:
    """Laplacian variance sharpness estimate. >120=sharp, <30=blurry."""
    try:
        lap = ndimage_laplace(gray_arr.astype(np.float32))
        return float(np.var(lap))
    except Exception:
        return 50.0   # neutral fallback


def _border_stats(arr: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Sample image border pixels to estimate background colour and uniformity.
    Returns (mean_colour [3,], mean_std).
    """
    border = np.concatenate([
        arr[0,  :].reshape(-1, 3),
        arr[-1, :].reshape(-1, 3),
        arr[:,  0].reshape(-1, 3),
        arr[:, -1].reshape(-1, 3),
    ])
    return border.mean(axis=0), float(border.std(axis=0).mean())


def _subject_fill(arr: np.ndarray, bg_mean: np.ndarray, bg_std: float) -> float:
    """
    Fraction of pixels that differ meaningfully from the sampled background.

    Special case: if fill comes back near-zero AND the image itself has high
    colour variance, the subject likely bleeds to the borders (full-frame shot)
    and the border-sampling assumption is wrong.  Return a moderate fill in
    that case so the score isn't penalised.
    """
    threshold = max(22.0, bg_std * 2.8)
    diff      = np.abs(arr.astype(np.float32) - bg_mean).mean(axis=2)
    fill      = float((diff > threshold).sum()) / (arr.shape[0] * arr.shape[1])

    if fill < 0.04:
        # Check whether the image itself has meaningful variance
        # (would be low only for a truly blank/solid frame)
        global_std = float(arr.astype(np.float32).std())
        if global_std > 30:
            # Full-frame shot: assume reasonable coverage
            return 0.35
    return fill


def score_image(img: Image.Image, st: str) -> dict:
    """
    Score an image for suitability as a reference photo.
    Returns {score, res, sharp, fill, mean_lum, issues}.
    """
    w, h = img.size
    arr  = np.array(img, dtype=np.uint8)
    gray = arr.mean(axis=2)

    score: float = 100.0
    issues: list[str] = []

    # ── resolution ───────────────────────────────────────────────────────────
    min_w, min_h = MIN_RES.get(st, (200, 200))
    if w < min_w or h < min_h:
        ratio  = min(w / min_w, h / min_h)
        score -= 50 * max(0.0, 1.0 - ratio)
        issues.append(f'res {w}x{h}')
    else:
        score += min(18.0, math.log2((w * h) / (min_w * min_h)) * 4)

    # ── sharpness ────────────────────────────────────────────────────────────
    sharp = _sharpness(gray)
    if   sharp < 12:  score -= 45; issues.append(f'blurry({sharp:.0f})')
    elif sharp < 35:  score -= 22; issues.append(f'soft({sharp:.0f})')
    elif sharp > 180: score += 14

    # ── exposure ─────────────────────────────────────────────────────────────
    mean_lum = float(gray.mean())
    if   mean_lum < 12:  score -= 40; issues.append('dark')
    elif mean_lum < 30:  score -= 18; issues.append('dim')
    elif mean_lum > 248: score -= 28; issues.append('blown')
    elif 45 < mean_lum < 215: score += 9

    # ── subject fill ─────────────────────────────────────────────────────────
    if st == 'background':
        fill = 0.5   # not meaningful for room shots
    else:
        bg_mean, bg_std = _border_stats(arr)
        fill = _subject_fill(arr, bg_mean, bg_std)
        if   fill < 0.03: score -= 45; issues.append(f'empty({fill:.2f})')
        elif fill < 0.10: score -= 25; issues.append(f'tiny({fill:.2f})')
        elif fill > 0.18: score += min(18.0, fill * 28)

    # ── aspect ratio ─────────────────────────────────────────────────────────
    pref: dict[str, tuple[float, float]] = {
        'shrimp':      (1.3, 3.5),
        'fish':        (1.3, 3.5),
        'plants':      (0.2, 1.1),
        'hardscape':   (0.5, 2.4),
        'background':  (1.2, 2.2),
    }
    lo, hi = pref.get(st, (0.4, 3.0))
    aspect = w / h
    if   lo <= aspect <= hi: score += 10
    elif aspect < lo / 1.6 or aspect > hi * 1.6:
        score -= 18; issues.append(f'aspect({aspect:.1f})')

    return {
        'score':    round(max(0.0, score), 1),
        'res':      (w, h),
        'sharp':    round(sharp, 1),
        'fill':     round(fill, 3),
        'mean_lum': round(mean_lum, 1),
        'issues':   issues,
    }


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3 — EDIT / PREPROCESS
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_exposure(img: Image.Image) -> Image.Image:
    """
    Per-channel histogram stretch: map p2–p98 to full 0–255 range.
    Corrects under/over-exposed photos without distorting colour balance.
    """
    arr = np.array(img, dtype=np.float32)
    result = np.empty_like(arr)
    for c in range(arr.shape[2]):
        ch       = arr[:, :, c]
        lo, hi   = np.percentile(ch, 2), np.percentile(ch, 98)
        if hi - lo > 8:
            result[:, :, c] = ((ch - lo) / (hi - lo) * 255.0).clip(0, 255)
        else:
            result[:, :, c] = ch
    return Image.fromarray(result.astype(np.uint8), 'RGB')


def _auto_crop(img: Image.Image, st: str, pad: float = 0.13) -> Image.Image:
    """
    Detect subject bounding box against the sampled background colour and
    crop with proportional padding. Skips crop if result gains little area.
    """
    if st == 'background':
        return img

    arr     = np.array(img, dtype=np.float32)
    bg_mean, bg_std = _border_stats(arr.astype(np.uint8))
    thresh  = max(18.0, bg_std * 2.8)
    mask    = np.abs(arr - bg_mean).mean(axis=2) > thresh

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any() or not cols.any():
        return img

    H, W   = arr.shape[:2]
    r0, r1 = int(np.where(rows)[0][0]),  int(np.where(rows)[0][-1])
    c0, c1 = int(np.where(cols)[0][0]),  int(np.where(cols)[0][-1])

    py = max(1, int((r1 - r0) * pad));  r0 = max(0, r0 - py);  r1 = min(H, r1 + py)
    px = max(1, int((c1 - c0) * pad));  c0 = max(0, c0 - px);  c1 = min(W, c1 + px)

    cropped = img.crop((c0, r0, c1, r1))
    # Only accept crop if it meaningfully reduces frame size
    if cropped.width * cropped.height < img.width * img.height * 0.90:
        return cropped
    return img


def _simplify_background(img: Image.Image, st: str) -> Image.Image:
    """
    Blur the background region to remove noise that confuses rembg edge
    detection.  Skips when background is complex (can't reliably detect it).
    """
    if st == 'background':
        return img

    arr     = np.array(img, dtype=np.float32)
    bg_mean, bg_std = _border_stats(arr.astype(np.uint8))

    if bg_std > 38:   # background too textured — don't touch it
        return img

    thresh  = max(22.0, bg_std * 2.8)
    is_bg   = (np.abs(arr - bg_mean).mean(axis=2) <= thresh).astype(np.float32)
    is_bg   = is_bg[:, :, np.newaxis]

    blurred = np.array(img.filter(ImageFilter.GaussianBlur(radius=3)), dtype=np.float32)
    mixed   = arr * (1.0 - is_bg) + blurred * is_bg
    return Image.fromarray(mixed.clip(0, 255).astype(np.uint8), 'RGB')


def _crop_to_aspect(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Crop image to target aspect ratio, biased toward centre-top."""
    w, h   = img.size
    tar_ar = target_w / target_h
    cur_ar = w / h

    if abs(cur_ar - tar_ar) < 0.05:
        return img
    if cur_ar > tar_ar:                          # too wide — crop sides
        new_w = int(h * tar_ar)
        x     = (w - new_w) // 2
        return img.crop((x, 0, x + new_w, h))
    else:                                         # too tall — crop bottom
        new_h = int(w / tar_ar)
        top   = max(0, (h - new_h) // 4)         # keep ceiling/top
        return img.crop((0, top, w, top + new_h))


def preprocess(img: Image.Image, st: str) -> Image.Image:
    """
    Apply subject-appropriate 3-stage edit pipeline:
      a) normalize exposure (histogram stretch)
      b) auto-crop to subject
      c) simplify background + subject-specific colour/sharpness tweaks
    """
    img = img.convert('RGB')

    # a) exposure
    img = _normalize_exposure(img)

    # b) crop
    img = _auto_crop(img, st)

    # c) background cleanup
    img = _simplify_background(img, st)

    # subject-specific finishing
    if st == 'shrimp':
        img = ImageEnhance.Color(img).enhance(1.28)      # lift saturation
        img = ImageEnhance.Sharpness(img).enhance(1.35)  # crisp antennae
        img = ImageEnhance.Contrast(img).enhance(1.08)

    elif st == 'fish':
        img = ImageEnhance.Color(img).enhance(1.18)
        img = ImageEnhance.Sharpness(img).enhance(1.25)

    elif st == 'plants':
        img = ImageEnhance.Color(img).enhance(1.20)      # richer greens
        img = ImageEnhance.Sharpness(img).enhance(1.15)

    elif st == 'hardscape':
        img = ImageEnhance.Contrast(img).enhance(1.18)   # texture pop
        img = ImageEnhance.Sharpness(img).enhance(1.20)

    elif st == 'background':
        # Darken + warm — Victorian interior feel, aquarium will glow over it
        img = ImageEnhance.Brightness(img).enhance(0.76)
        arr = np.array(img, dtype=np.float32)
        arr[:, :, 0] = np.clip(arr[:, :, 0] * 1.07,  0, 255)   # R +7 %
        arr[:, :, 2] = np.clip(arr[:, :, 2] * 0.88,  0, 255)   # B -12 %
        img = Image.fromarray(arr.astype(np.uint8), 'RGB')
        img = _crop_to_aspect(img, 280, 156)

    return img


# ─────────────────────────────────────────────────────────────────────────────
# PER-SUBJECT ORCHESTRATION
# ─────────────────────────────────────────────────────────────────────────────

def source_subject(
    ref_dir: str,
    queries: list[str],
    st: str,
    *,
    force: bool,
    dry: bool,
) -> dict:
    """
    Run the full source → validate → edit pipeline for one reference directory.
    Returns a status report dict.
    """
    out_dir = REFS / ref_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    INT.mkdir(parents=True, exist_ok=True)

    target   = PHOTOS_TARGET.get(st, 2)
    existing = sorted(out_dir.glob('*.jpg')) + sorted(out_dir.glob('*.png'))
    existing = [p for p in existing if not p.name.startswith('_')]

    if existing and not force:
        print(f'  skip  {ref_dir}  ({len(existing)} photos; --force to replace)')
        return {'ref_dir': ref_dir, 'status': 'skipped', 'count': len(existing)}

    if dry:
        print(f'  dry   {ref_dir}')
        return {'ref_dir': ref_dir, 'status': 'dry'}

    print(f'\n--- {ref_dir} ---')

    candidates: list[tuple[dict, Image.Image, str]] = []
    seen_urls:  set[str] = set()
    min_w, min_h = MIN_RES.get(st, (200, 200))

    # ── DuckDuckGo search ─────────────────────────────────────────────────────
    for query in queries:
        if len(candidates) >= target * 3:
            break
        print(f'  [DDG] {query!r}')
        results = search_ddg(query, CANDIDATES_PER_QUERY)
        if not results:
            print('        (no results)')
            continue
        _process_results(results, seen_urls, min_w, min_h, st, candidates, target)

    # ── Wikimedia fallback ────────────────────────────────────────────────────
    wm_query = WIKIMEDIA_QUERIES.get(ref_dir)
    if wm_query and len(candidates) < target:
        print(f'  [WM]  {wm_query!r}')
        wm_results = search_wikimedia(wm_query, 8)
        if wm_results:
            _process_results(wm_results, seen_urls, min_w, min_h, st, candidates, target * 2)
        else:
            print('        (no results)')

    if not candidates:
        print(f'  WARN: no usable photos found for {ref_dir}')
        return {'ref_dir': ref_dir, 'status': 'no_results'}

    # ── rank by score, save top `target` ─────────────────────────────────────
    candidates.sort(key=lambda x: x[0]['score'], reverse=True)
    saved = []
    safe  = ref_dir.replace('/', '_')

    for i, (scored, img_pp, url) in enumerate(candidates[:target]):
        out_path   = out_dir / f'{safe}_{i+1:02d}.jpg'
        thumb_path = INT     / f'{safe}_{i+1:02d}_thumb.jpg'

        img_pp.save(str(out_path), 'JPEG', quality=95)

        thumb = img_pp.copy()
        thumb.thumbnail((300, 300))
        thumb.save(str(thumb_path), 'JPEG', quality=78)

        print(f'  SAVED {out_path.name}  score={scored["score"]}  {img_pp.size}')
        saved.append({
            'path':  str(out_path),
            'score': scored['score'],
            'res':   list(img_pp.size),
            'url':   url,
        })

    return {
        'ref_dir':    ref_dir,
        'status':     'ok',
        'saved':      saved,
        'candidates': len(candidates),
    }


def _process_results(
    results:    list[dict],
    seen_urls:  set[str],
    min_w: int, min_h: int,
    st:         str,
    candidates: list,
    enough:     int,
) -> None:
    """
    Download + score + preprocess a batch of search results, appending
    qualifying entries to `candidates` in-place.
    """
    for r in results:
        if len(candidates) >= enough:
            break

        url = r.get('image') or r.get('url', '')
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        # quick pre-filter by metadata before downloading
        rw, rh = int(r.get('width', 0)), int(r.get('height', 0))
        if rw and rw < min_w // 2:
            continue
        if rh and rh < min_h // 2:
            continue

        sys.stdout.write(f'  dl {url[:68]}')
        sys.stdout.flush()

        img = download_image(url)
        if img is None:
            print('  [fail]')
            time.sleep(0.3)
            continue

        scored = score_image(img, st)
        flag   = 'OK ' if scored['score'] >= 52 else 'LOW'
        iss    = f' [{",".join(scored["issues"])}]' if scored['issues'] else ''
        print(f'  [{flag}] s={scored["score"]} {scored["res"]} '
              f'sh={scored["sharp"]:.0f}{iss}')

        if scored['score'] < 22:
            time.sleep(REQUEST_DELAY)
            continue

        try:
            img_pp = preprocess(img, st)
        except Exception as e:
            img_pp = img
            print(f'  [preprocess warn] {e}')

        candidates.append((scored, img_pp, url))
        time.sleep(REQUEST_DELAY)


# ─────────────────────────────────────────────────────────────────────────────
# HTML GALLERY REPORT
# ─────────────────────────────────────────────────────────────────────────────

def generate_report() -> None:
    """Build _sourcer_gallery.html with embedded thumbnails and score details."""
    entries = []
    for ref_dir in QUERIES:
        st  = subject_type(ref_dir)
        d   = REFS / ref_dir
        for p in sorted(list(d.glob('*.jpg')) + list(d.glob('*.png'))):
            if p.name.startswith('_'):
                continue
            try:
                img  = Image.open(p).convert('RGB')
                sc   = score_image(img, st)
                thumb = img.copy()
                thumb.thumbnail((220, 220))
                buf  = io.BytesIO()
                thumb.save(buf, 'JPEG', quality=72)
                b64  = base64.b64encode(buf.getvalue()).decode()
                entries.append({
                    'ref_dir': ref_dir, 'name': p.name,
                    'b64': b64, **sc,
                })
            except Exception:
                pass

    if not entries:
        print('No photos found. Run photo_sourcer.py first.')
        return

    cards = []
    cur_dir = None
    for e in sorted(entries, key=lambda x: (x['ref_dir'], -x['score'])):
        if e['ref_dir'] != cur_dir:
            cur_dir = e['ref_dir']
            cards.append(f'<h3>{cur_dir}</h3>')
        col   = '#5d5' if e['score'] >= 55 else '#d85' if e['score'] >= 30 else '#d55'
        iss   = ', '.join(e['issues']) or 'ok'
        cards.append(
            f'<div class="c">'
            f'<img src="data:image/jpeg;base64,{e["b64"]}" />'
            f'<div class="i"><b style="color:{col}">{e["score"]}</b> '
            f'{e["name"]}<br/>'
            f'{e["res"][0]}x{e["res"][1]} sharp={e["sharp"]:.0f} fill={e["fill"]:.2f}<br/>'
            f'<span class="iss">{iss}</span></div></div>'
        )

    html = (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"/>'
        '<title>Sourced Photos</title><style>'
        'body{background:#111;color:#bbb;font:11px monospace;margin:1em}'
        '.c{display:inline-block;width:230px;vertical-align:top;margin:3px;'
        'background:#1c1c1c;border:1px solid #333;padding:3px}'
        '.c img{width:100%;height:160px;object-fit:contain;background:#222}'
        '.i{padding:2px 0}.iss{color:#777}'
        'h3{color:#888;margin:1em 0 .3em;border-bottom:1px solid #333}'
        '</style></head><body>'
        f'<h2 style="color:#aaa">Reference Photos  ({len(entries)} total)</h2>'
        + ''.join(cards)
        + '</body></html>'
    )

    out = ROOT / '_sourcer_gallery.html'
    out.write_text(html, encoding='utf-8')
    print(f'Gallery -> {out}')
    print('Open it in a browser to review all sourced photos.')


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATE-ONLY MODE
# ─────────────────────────────────────────────────────────────────────────────

def validate_existing(subject_filter: str | None, category_filter: str | None) -> None:
    """Score and print a report on all reference photos that already exist."""
    print('=== VALIDATION ===')
    total_ok = total_low = total_missing = 0

    for ref_dir in QUERIES:
        if subject_filter   and ref_dir != subject_filter:             continue
        if category_filter  and not ref_dir.startswith(category_filter): continue

        st      = subject_type(ref_dir)
        d       = REFS / ref_dir
        photos  = sorted(list(d.glob('*.jpg')) + list(d.glob('*.png')))
        photos  = [p for p in photos if not p.name.startswith('_')]

        if not photos:
            print(f'  MISS  {ref_dir}')
            total_missing += 1
            continue

        print(f'  {ref_dir}  ({len(photos)} photos)')
        for p in photos:
            try:
                img = Image.open(p).convert('RGB')
                sc  = score_image(img, st)
                ok  = 'OK ' if sc['score'] >= 52 else 'LOW'
                iss = f'  [{", ".join(sc["issues"])}]' if sc["issues"] else ''
                print(f'    [{ok}] {p.name}  score={sc["score"]}  '
                      f'{sc["res"]}  sharp={sc["sharp"]:.0f}{iss}')
                if sc['score'] >= 52:
                    total_ok += 1
                else:
                    total_low += 1
            except Exception as e:
                print(f'    [ERR] {p.name}: {e}')
                total_low += 1

    print(f'\n  ok={total_ok}  low={total_low}  missing={total_missing}')


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description='Auto-source reference photos for fmv_pipeline.py',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument('--dry',           action='store_true', help='Preview; no downloads')
    ap.add_argument('--force',         action='store_true', help='Re-download existing photos')
    ap.add_argument('--category',      type=str, metavar='CAT',
                    help='shrimp / fish / plants / hardscape / background')
    ap.add_argument('--subject',       type=str, metavar='DIR',
                    help='Single subject e.g. shrimp/red_cherry')
    ap.add_argument('--validate-only', action='store_true', dest='validate_only',
                    help='Score existing photos, no downloads')
    ap.add_argument('--report',        action='store_true',
                    help='Generate HTML gallery of all sourced photos')
    args = ap.parse_args()

    if args.report:
        generate_report()
        return

    if args.validate_only:
        validate_existing(args.subject, args.category)
        return

    # ── build work list ───────────────────────────────────────────────────────
    work = dict(QUERIES)
    if args.subject:
        work = {k: v for k, v in work.items() if k == args.subject}
        if not work:
            print(f'Unknown subject: {args.subject!r}')
            print('Known:', ', '.join(QUERIES))
            sys.exit(1)
    elif args.category:
        work = {k: v for k, v in work.items() if k.startswith(args.category)}
        if not work:
            print(f'No subjects under category: {args.category!r}')
            sys.exit(1)

    # ── ensure duckduckgo-search ──────────────────────────────────────────────
    if not args.dry and not _ensure_ddg():
        sys.exit(1)

    print(f'=== photo_sourcer.py  {len(work)} subjects'
          + (' [DRY RUN]' if args.dry else '')
          + (' [FORCE]'   if args.force else '') + ' ===')

    results: list[dict] = []
    for ref_dir, queries in work.items():
        st = subject_type(ref_dir)
        try:
            rep = source_subject(
                ref_dir, queries, st, force=args.force, dry=args.dry,
            )
            results.append(rep)
        except KeyboardInterrupt:
            print('\nInterrupted.')
            break
        except Exception as e:
            print(f'  ERROR {ref_dir}: {e}')
            traceback.print_exc()
            results.append({'ref_dir': ref_dir, 'status': 'error', 'error': str(e)})

    # ── summary ───────────────────────────────────────────────────────────────
    ok_  = [r for r in results if r.get('status') == 'ok']
    skp_ = [r for r in results if r.get('status') == 'skipped']
    err_ = [r for r in results if r.get('status') in ('no_results', 'error')]

    print(f'\n=== DONE  ok={len(ok_)}  skipped={len(skp_)}  failed={len(err_)} ===')
    for r in err_:
        print(f'  FAIL  {r["ref_dir"]}  {r.get("error", r.get("status"))}')

    report_path = ROOT / '_sourcer_report.json'
    report_path.write_text(json.dumps(results, indent=2, default=str), encoding='utf-8')
    print(f'Report -> {report_path}')

    if ok_ and not args.dry:
        print()
        print('Next steps:')
        print('  py -3.12 photo_sourcer.py --report          # visual review gallery')
        print('  py -3.12 fmv_pipeline.py --palette-only     # rebuild shared palette')
        print('  py -3.12 fmv_pipeline.py                    # generate all sprites')


if __name__ == '__main__':
    main()
