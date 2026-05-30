"""
feedback_loop.py — Screenshot → Critique → Report pipeline for FMV Aquarium.

Usage:
    py -3.12 feedback_loop.py                    # screenshot localhost:5174, run critique, print report
    py -3.12 feedback_loop.py --url <url>         # use a different URL
    py -3.12 feedback_loop.py --wait 3            # wait N seconds after load before screenshot
    py -3.12 feedback_loop.py --model claude-opus-4-5
    py -3.12 feedback_loop.py --image <path>      # skip screenshot, critique an existing image

The script prints the full formatted critique to stdout and saves JSON + text to _feedback/.
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# SCREENSHOT via Playwright
# ---------------------------------------------------------------------------

def capture_screenshot(url: str, wait_ms: int = 2500, width: int = 1400, height: int = 900) -> Path:
    """Launch headless Chromium, load the app, wait for render, save screenshot."""
    from playwright.sync_api import sync_playwright

    out_dir = Path("_feedback")
    out_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"screenshot_{ts}.jpg"

    print(f"  [capture] Opening {url} at {width}×{height} ...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(url, wait_until="networkidle")

        # Extra wait for PixiJS to finish rendering (animations, asset loads)
        page.wait_for_timeout(wait_ms)

        page.screenshot(path=str(out_path), type="jpeg", quality=95, full_page=False)
        browser.close()

    size_kb = out_path.stat().st_size // 1024
    print(f"  [capture] Saved {out_path.name} ({size_kb}KB)")
    return out_path


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="FMV Aquarium feedback loop: screenshot → critique")
    parser.add_argument("--url", default="http://localhost:5174/", help="App URL to screenshot")
    parser.add_argument("--wait", type=int, default=3, help="Extra seconds to wait after page load")
    parser.add_argument("--width", type=int, default=1400, help="Viewport width")
    parser.add_argument("--height", type=int, default=900, help="Viewport height")
    parser.add_argument("--image", type=Path, help="Skip screenshot; critique this existing image")
    parser.add_argument("--model", default="claude-opus-4-5", help="Claude model for critique")
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")
    args = parser.parse_args()

    print("\n  === FMV AQUARIUM - Aesthetic Feedback Pipeline ===\n")

    # Step 1: get image
    if args.image:
        image_path = args.image
        print(f"  [pipeline] Using existing image: {image_path}")
    else:
        image_path = capture_screenshot(
            url=args.url,
            wait_ms=args.wait * 1000,
            width=args.width,
            height=args.height
        )

    # Step 2: run critique
    # Import here so the script can be used for capture-only without anthropic installed
    sys.path.insert(0, str(Path(__file__).parent))
    from aesthetic_critic import run_critique, save_feedback, format_report

    feedback = run_critique(image_path, api_key=args.api_key, model=args.model)

    # Step 3: save + print
    report_path, json_path = save_feedback(feedback, image_path)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_text = format_report(feedback, image_path, ts)
    print(report_text)
    print(f"\n  Report: {report_path}")
    print(f"  JSON:   {json_path}\n")

    return feedback


if __name__ == "__main__":
    main()
