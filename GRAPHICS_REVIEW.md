# Graphics Review Loop

The app's art direction is a 90s FMV/VGA aquarium diorama. Use this loop for
agentic iteration before accepting regenerated sprites or composition changes.

## Standard Review URLs
Run the app locally, then capture these URLs at desktop and mobile viewports:

```text
http://localhost:5174/?review=iwagumi&seed=11&editor=0
http://localhost:5174/?review=nature&seed=12&editor=0
http://localhost:5174/?review=review_empty&seed=13&editor=0
http://localhost:5174/?review=review_dense&seed=14&editor=0
http://localhost:5174/?review=nature&lighting=night&seed=15&editor=0
http://localhost:5174/?review=review_fauna&seed=16&editor=0&zoom=1.55&panX=-120&panY=-35
```

Query parameters:
- `review`: loads a deterministic review scape without changing saved scapes.
- `seed`: stabilizes fauna and particle randomization for before/after review.
- `editor=0`: keeps the tank unobstructed by the toolbox.
- `lighting=night`: forces night review mode.
- `zoom`, `panX`, `panY`: frame close-up review shots.

## Agent Roles
- Reviewer agent: capture screenshots, compare against the style bible, and call
  out mood/readability regressions.
- Asset agent: open `/tools/visual_qa.html` in the same local server, or run
  `python tools/visual_qa.py` when Python/Pillow are installed. Inspect contact
  sheets and flag alpha bleed, weak silhouettes, palette drift, and tiny fauna.
- Pipeline agent: make small changes to the FMV/post pipeline, regenerate only
  targeted art, then rerun visual QA.
- Composition agent: adjust `src/scapes.js` only after screenshot evidence shows
  scale, hierarchy, or negative-space problems.

## Human Review Gate
Present three variants when changing art:
- Conservative: minimal pipeline or scale movement.
- Stronger FMV: more VGA/capture character and harder mixed-media unification.
- Cleaner pixel: less analog noise and stronger silhouette polish.

Keep the winner's settings and note the reason in the commit or PR summary.
