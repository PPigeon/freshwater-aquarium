#!/usr/bin/env python3
"""
Build contact sheets and lightweight visual QA reports for aquarium atlas art.

The tool is intentionally local and deterministic: it inspects committed PNGs,
groups them by review role, writes contact sheets, and flags common art-direction
risks before an agent starts regenerating assets.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from statistics import mean

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "assets" / "sprites"
DEFAULT_OUT = ROOT / "review" / "visual_qa"


GROUPS = {
    "shrimp": [
        ASSET_ROOT / "red_cherry_male.png",
        ASSET_ROOT / "red_cherry_female.png",
        ASSET_ROOT / "red_cherry_berried.png",
    ],
    "fish": [ASSET_ROOT / "background" / "neon_tetra.png"],
    "hardscape": sorted((ASSET_ROOT / "hardscape").glob("*.png")),
    "plants": sorted((ASSET_ROOT / "plants").glob("*.png")),
    "background": [
        ASSET_ROOT / "background" / "water_tile.png",
        ASSET_ROOT / "background" / "substrate.png",
        ASSET_ROOT / "background" / "caustics.png",
        ASSET_ROOT / "background" / "background_films.png",
        ASSET_ROOT / "background" / "room_bg.png",
        ASSET_ROOT / "background" / "led_fixture.png",
    ],
    "particles": [
        ASSET_ROOT / "molt.png",
        ASSET_ROOT / "background" / "bubble.png",
        ASSET_ROOT / "background" / "food_wafer.png",
        ASSET_ROOT / "background" / "mote.png",
    ],
}


@dataclass
class AssetReport:
    group: str
    path: str
    width: int
    height: int
    opaque_ratio: float
    bbox_fill_ratio: float
    transparent_edge_rgb: int
    edge_touch: int
    contrast: float
    color_count: int
    warnings: list[str]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_font(size: int = 11) -> ImageFont.ImageFont:
    try:
      return ImageFont.truetype("arial.ttf", size)
    except Exception:
      return ImageFont.load_default()


def alpha_bbox(alpha: Image.Image) -> tuple[int, int, int, int] | None:
    return alpha.getbbox()


def transparent_edge_rgb_count(img: Image.Image) -> int:
    px = img.load()
    w, h = img.size
    count = 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a != 0 or (r == 0 and g == 0 and b == 0):
                continue
            if (
                px[x - 1, y][3]
                or px[x + 1, y][3]
                or px[x, y - 1][3]
                or px[x, y + 1][3]
            ):
                count += 1
    return count


def edge_touch_count(alpha: Image.Image) -> int:
    w, h = alpha.size
    px = alpha.load()
    count = 0
    for x in range(w):
        if px[x, 0] > 0:
            count += 1
        if px[x, h - 1] > 0:
            count += 1
    for y in range(h):
        if px[0, y] > 0:
            count += 1
        if px[w - 1, y] > 0:
            count += 1
    return count


def color_count(img: Image.Image) -> int:
    rgba = img.convert("RGBA")
    colors = rgba.getcolors(maxcolors=1_000_000) or []
    return sum(1 for _, c in colors if c[3] > 0)


def analyze_asset(path: Path, group: str) -> AssetReport:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    alpha = img.getchannel("A")
    opaque = sum(1 for v in alpha.getdata() if v > 0)
    opaque_ratio = opaque / max(1, w * h)
    bbox = alpha_bbox(alpha)
    bbox_area = 0 if not bbox else max(1, (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))
    bbox_fill_ratio = opaque / max(1, bbox_area)
    rgb_bleed = transparent_edge_rgb_count(img)
    edge_touch = edge_touch_count(alpha)
    luma = ImageStat.Stat(img.convert("L"), mask=alpha).stddev[0] if opaque else 0.0
    colors = color_count(img)

    warnings = []
    if group not in {"background"} and opaque_ratio < 0.015:
        warnings.append("tiny-silhouette")
    if group not in {"background"} and bbox_fill_ratio < 0.10:
        warnings.append("wispy-or-sparse-bbox")
    if rgb_bleed > 6:
        warnings.append("transparent-edge-rgb")
    if group == "hardscape" and edge_touch > max(12, int((w + h) * 0.12)):
        warnings.append("touches-frame-edge")
    if group in {"shrimp", "fish"} and luma < 18:
        warnings.append("low-creature-contrast")
    if group in {"hardscape", "plants"} and colors > 512:
        warnings.append("palette-may-read-photographic")

    return AssetReport(
        group=group,
        path=rel(path),
        width=w,
        height=h,
        opaque_ratio=round(opaque_ratio, 4),
        bbox_fill_ratio=round(bbox_fill_ratio, 4),
        transparent_edge_rgb=rgb_bleed,
        edge_touch=edge_touch,
        contrast=round(luma, 2),
        color_count=colors,
        warnings=warnings,
    )


def apply_shrimp_cohort_checks(reports: list[AssetReport]) -> None:
    target = {
        "assets/sprites/red_cherry_male.png",
        "assets/sprites/red_cherry_female.png",
        "assets/sprites/red_cherry_berried.png",
    }
    by_path = {r.path: r for r in reports if r.path in target}
    if "assets/sprites/red_cherry_male.png" not in by_path:
        return
    male_path = ROOT / "assets" / "sprites" / "red_cherry_male.png"
    male = Image.open(male_path).convert("RGBA").convert("LA")
    for path in ["assets/sprites/red_cherry_female.png", "assets/sprites/red_cherry_berried.png"]:
        report = by_path.get(path)
        if not report:
            continue
        img = Image.open(ROOT / path).convert("RGBA").convert("LA")
        delta = ImageChops.difference(male, img).split()[0]
        mean_diff = ImageStat.Stat(delta).mean[0]
        if mean_diff > 22:
            report.warnings.append("cohort-shape-drift")


def checker_tile(size: int = 8) -> Image.Image:
    tile = Image.new("RGB", (size * 2, size * 2), "#202026")
    d = ImageDraw.Draw(tile)
    d.rectangle((0, 0, size - 1, size - 1), fill="#303038")
    d.rectangle((size, size, size * 2 - 1, size * 2 - 1), fill="#303038")
    return tile


def fit_preview(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    scale = min(max_w / img.width, max_h / img.height)
    scale = max(1, math.floor(scale))
    return img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)


def make_sheet(group: str, paths: list[Path], reports: list[AssetReport], out_dir: Path) -> None:
    if not paths:
        return
    font = load_font(10)
    cell_w, cell_h = 220, 150
    cols = 3 if group in {"hardscape", "plants"} else 4
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "#111116")
    draw = ImageDraw.Draw(sheet)
    checker = checker_tile()
    report_by_path = {r.path: r for r in reports}

    for i, path in enumerate(paths):
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        img = Image.open(path).convert("RGBA")
        preview = fit_preview(img, cell_w - 24, cell_h - 44)
        bg = Image.new("RGB", preview.size, "#202026")
        bg.paste(checker.resize(preview.size, Image.Resampling.NEAREST))
        bg.paste(preview, mask=preview.getchannel("A"))
        px = x + (cell_w - preview.width) // 2
        py = y + 10
        sheet.paste(bg, (px, py))
        r = report_by_path[rel(path)]
        label = path.stem[:26]
        warn = ",".join(r.warnings) if r.warnings else "ok"
        draw.text((x + 8, y + cell_h - 30), label, fill="#d0d0c8", font=font)
        draw.text((x + 8, y + cell_h - 16), warn[:35], fill="#ffb070" if r.warnings else "#72ff9a", font=font)
        draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline="#303038")

    sheet.save(out_dir / f"{group}_contact_sheet.png")


def write_markdown(reports: list[AssetReport], out_dir: Path) -> None:
    by_group = {}
    for r in reports:
        by_group.setdefault(r.group, []).append(r)

    lines = ["# Visual QA Report", ""]
    lines.append("Generated from committed atlas PNGs. Use with screenshot review URLs before accepting new art.")
    lines.append("")
    for group, items in by_group.items():
        warnings = [r for r in items if r.warnings]
        avg_contrast = mean([r.contrast for r in items]) if items else 0
        lines.append(f"## {group.title()}")
        lines.append(f"- Assets: {len(items)}")
        lines.append(f"- Flagged: {len(warnings)}")
        lines.append(f"- Avg contrast: {avg_contrast:.1f}")
        if warnings:
            lines.append("")
            for r in warnings:
                lines.append(f"- `{r.path}`: {', '.join(r.warnings)}")
        lines.append("")

    (out_dir / "visual_qa_report.md").write_text("\n".join(lines), encoding="utf-8")


def run(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    reports: list[AssetReport] = []
    grouped_existing: dict[str, list[Path]] = {}
    for group, paths in GROUPS.items():
        existing = [p for p in paths if p.exists()]
        grouped_existing[group] = existing
        reports.extend([analyze_asset(p, group) for p in existing])

    apply_shrimp_cohort_checks(reports)
    report_by_group: dict[str, list[AssetReport]] = {}
    for r in reports:
        report_by_group.setdefault(r.group, []).append(r)
    for group, existing in grouped_existing.items():
        make_sheet(group, existing, report_by_group.get(group, []), out_dir)

    (out_dir / "visual_qa_report.json").write_text(
        json.dumps([asdict(r) for r in reports], indent=2),
        encoding="utf-8",
    )
    write_markdown(reports, out_dir)
    print(f"Wrote visual QA outputs to {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build aquarium visual QA contact sheets.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory")
    args = parser.parse_args()
    run(args.out)


if __name__ == "__main__":
    main()
