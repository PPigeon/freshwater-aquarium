"""
aesthetic_critic.py — Visual feedback pipeline for the FMV Aquarium project.

Usage:
    py -3.12 aesthetic_critic.py --screenshot <path_or_url>   # critique one image
    py -3.12 aesthetic_critic.py --capture                    # screenshot localhost:5174, then critique
    py -3.12 aesthetic_critic.py --loop                       # capture + critique + print; repeat on keypress

The critic runs as a Claude API call with a hyperanalytical studio-head persona.
Output is both human-readable and machine-parseable JSON saved to _feedback/.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import anthropic

# ---------------------------------------------------------------------------
# PERSONA SYSTEM PROMPT
# ---------------------------------------------------------------------------

STUDIO_HEAD_SYSTEM = """
You are the creative director and lead graphics engineer at a boutique interactive-media studio
that specializes in authentic FMV (Full Motion Video) and digitized-sprite aesthetics from
the 1992–1996 era. Your studio produced games in the tradition of Harvester, Phantasmagoria,
The 7th Guest, and Alone in the Dark. You have a compulsive eye for visual fidelity and you
are ruthlessly analytical — you see every artifact, every scale inconsistency, every lighting
lie, and every palette violation instantly.

Your current assignment: a modern web-based freshwater aquarium simulation that deliberately
replicates the look of a 1993–1995 CD-ROM game. It uses a PixiJS renderer at ~280×156 game
world units scaled ~5× to screen. Assets are processed through an FMV digitization pipeline
(VGA 6-bit quantize → Bayer 8×8 dither → Cinepak block simulation → analog blur/resharpen →
LANCZOS downscale). The target feel is: real-world subjects digitized through period hardware,
uncanny-valley organic textures fighting the digital constraint, warm VGA palette.

DESIGN GOALS (non-negotiable reference points):
1. FMV authenticity — every asset must feel like it was shot on real film/video then digitized,
   not drawn. The Bayer dither pattern should be visible at natural viewing distance. No smooth
   gradients; no clean anti-aliased edges.
2. Aquarium believability — despite the retro processing, the tank must read as a real planted
   aquarium: credible depth, coherent lighting from above, natural substrate texture, believable
   plant masses with correct species proportions.
3. Scale discipline — all assets use pixel-perfect scales (multiples of 0.20 at 5× world scale)
   to avoid subpixel blurring: 0.40 / 0.60 / 0.80 / 1.00 / 1.20 / 1.40. Wrong scale = visible
   blur = visual failure.
4. Lighting coherence — single LED bar across the top of the tank, light falls from above,
   creates a cooler surface, warmer mid column, darker substrate zone. No radial orbs, no point
   lights, no shaft effects competing with the bar.
5. Palette coherence — all sprites share a quantized palette. Colors must feel from the same
   "world" — the warm desaturated VGA quality should unify everything.
6. Composition — tanks should read as curated aquascapes (Iwagumi, Nature style), not random
   object dumps. Focal points clear, depth layers readable, negative space intentional.

YOUR TASK:
Analyze the provided screenshot with extreme precision. You see it as a studio director viewing
a build: look for every problem, every compromise, every success, every failure. Be brutal but
constructive. Prioritize the most visually damaging problems first.

REQUIRED OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no prose before or
after the JSON object:

{
  "overall_score": <integer 1-10>,
  "headline": "<one brutal honest sentence summarizing the build quality>",
  "categories": {
    "fmv_authenticity": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "aquarium_believability": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "scale_proportions": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "lighting_coherence": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "palette_and_color": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "composition": {
      "score": <1-10>,
      "findings": ["<specific observation>", ...]
    },
    "individual_assets": {
      "score": <1-10>,
      "findings": ["<specific observation per visible asset>", ...]
    }
  },
  "critical_fixes": [
    {
      "priority": <1-5, where 1=most urgent>,
      "area": "<system/asset name>",
      "problem": "<precise description>",
      "fix": "<concrete implementation direction>"
    }
  ],
  "strengths": ["<what is genuinely working>", ...],
  "deferred_improvements": ["<non-urgent suggestions>", ...]
}
"""

# ---------------------------------------------------------------------------
# SCREENSHOT CAPTURE
# ---------------------------------------------------------------------------

def capture_screenshot(url: str = "http://localhost:5174/", out_path: Path = None) -> Path:
    """Fetch the app and capture a screenshot using Pillow + a headless approach.

    Since we don't have selenium/playwright here, we use the preview server screenshot
    endpoint indirectly by requesting the page. As a simpler fallback we just grab
    the most recently saved screenshot from the temp dir.
    """
    import urllib.request, urllib.error

    if out_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = Path("_feedback") / f"screenshot_{ts}.jpg"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Try to find an existing screenshot passed via stdin or from a known temp path
    # This script is normally invoked with --screenshot pointing to an already-captured file
    raise RuntimeError(
        "Direct browser capture not available from this script. "
        "Use --screenshot <path> to pass a saved screenshot, or use the "
        "capture_and_critique() function from the feedback loop runner."
    )


# ---------------------------------------------------------------------------
# CORE CRITIQUE
# ---------------------------------------------------------------------------

def encode_image_b64(path: Path) -> tuple[str, str]:
    """Return (base64_data, media_type) for a local image file."""
    suffix = path.suffix.lower()
    media_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}
    media_type = media_map.get(suffix, 'image/jpeg')
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8'), media_type


def run_critique(image_path: Path, api_key: str = None, model: str = "claude-opus-4-5") -> dict:
    """Send screenshot to Claude with studio-head persona and return parsed feedback dict."""
    client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))

    b64, media_type = encode_image_b64(image_path)

    print(f"  [critic] Sending to {model} ({image_path.name}, {image_path.stat().st_size // 1024}KB)...")

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=STUDIO_HEAD_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        }
                    },
                    {
                        "type": "text",
                        "text": (
                            "Critique this build screenshot. Be precise about every visual problem "
                            "you see. Use your studio-director eye — nothing escapes notice. "
                            "Respond only with the JSON format specified in your instructions."
                        )
                    }
                ]
            }
        ]
    )

    raw = response.content[0].text.strip()

    # Strip markdown fences if model added them anyway
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        feedback = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [critic] JSON parse failed: {e}")
        print(f"  [critic] Raw response:\n{raw[:500]}...")
        # Return a minimal dict so the caller can still see the raw text
        feedback = {"parse_error": str(e), "raw": raw}

    return feedback


# ---------------------------------------------------------------------------
# OUTPUT & SAVING
# ---------------------------------------------------------------------------

def save_feedback(feedback: dict, image_path: Path) -> Path:
    """Save feedback JSON and human-readable report to _feedback/."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path("_feedback")
    out_dir.mkdir(exist_ok=True)

    json_path = out_dir / f"feedback_{ts}.json"
    report_path = out_dir / f"report_{ts}.txt"
    latest_path = out_dir / "latest.json"

    with open(json_path, 'w') as f:
        json.dump({"image": str(image_path), "timestamp": ts, "feedback": feedback}, f, indent=2)

    # Also write as latest
    with open(latest_path, 'w') as f:
        json.dump({"image": str(image_path), "timestamp": ts, "feedback": feedback}, f, indent=2)

    # Human-readable report
    report = format_report(feedback, image_path, ts)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    return report_path, json_path


def format_report(feedback: dict, image_path: Path, ts: str) -> str:
    """Format feedback dict as a readable critique report."""
    if "parse_error" in feedback:
        return f"PARSE ERROR: {feedback['parse_error']}\n\nRAW:\n{feedback.get('raw', '')}"

    lines = []
    lines.append("=" * 72)
    lines.append(f"  AESTHETIC CRITIQUE  |  {ts}")
    lines.append(f"  Source: {image_path.name}")
    lines.append("=" * 72)

    score = feedback.get("overall_score", "?")
    headline = feedback.get("headline", "")
    lines.append(f"\n  OVERALL SCORE: {score}/10")
    lines.append(f"  \"{headline}\"")

    lines.append("\n  CATEGORY SCORES")
    lines.append("  " + "-" * 40)
    for cat, data in feedback.get("categories", {}).items():
        cat_label = cat.replace("_", " ").upper()
        s = data.get("score", "?")
        lines.append(f"  {cat_label:<30}  {s}/10")

    lines.append("\n  DETAILED FINDINGS")
    lines.append("  " + "-" * 40)
    for cat, data in feedback.get("categories", {}).items():
        cat_label = cat.replace("_", " ").title()
        lines.append(f"\n  [{cat_label}]")
        for finding in data.get("findings", []):
            lines.append(f"    • {finding}")

    lines.append("\n  CRITICAL FIXES  (priority ordered)")
    lines.append("  " + "-" * 40)
    fixes = sorted(feedback.get("critical_fixes", []), key=lambda x: x.get("priority", 99))
    for fix in fixes:
        p = fix.get("priority", "?")
        area = fix.get("area", "")
        problem = fix.get("problem", "")
        fix_text = fix.get("fix", "")
        lines.append(f"\n  [{p}] {area}")
        lines.append(f"      PROBLEM: {problem}")
        lines.append(f"      FIX:     {fix_text}")

    strengths = feedback.get("strengths", [])
    if strengths:
        lines.append("\n  STRENGTHS")
        lines.append("  " + "-" * 40)
        for s in strengths:
            lines.append(f"    ✓ {s}")

    deferred = feedback.get("deferred_improvements", [])
    if deferred:
        lines.append("\n  DEFERRED IMPROVEMENTS")
        lines.append("  " + "-" * 40)
        for d in deferred:
            lines.append(f"    → {d}")

    lines.append("\n" + "=" * 72)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="FMV Aquarium aesthetic critique pipeline")
    parser.add_argument("--screenshot", "-s", type=Path, help="Path to screenshot image to critique")
    parser.add_argument("--model", default="claude-opus-4-5", help="Claude model to use")
    parser.add_argument("--api-key", help="Anthropic API key (defaults to ANTHROPIC_API_KEY env var)")
    args = parser.parse_args()

    if not args.screenshot:
        parser.error("--screenshot <path> is required. Save a screenshot first, then pass it here.")

    if not args.screenshot.exists():
        parser.error(f"Screenshot not found: {args.screenshot}")

    print(f"\n  FMV Aquarium Aesthetic Critique Pipeline")
    print(f"  Image: {args.screenshot}")
    print(f"  Model: {args.model}")
    print()

    feedback = run_critique(args.screenshot, api_key=args.api_key, model=args.model)
    report_path, json_path = save_feedback(feedback, args.screenshot)

    report_text = format_report(feedback, args.screenshot, datetime.now().strftime("%Y%m%d_%H%M%S"))
    print(report_text)

    print(f"\n  Saved: {report_path}")
    print(f"  JSON:  {json_path}")

    return feedback


if __name__ == "__main__":
    main()
