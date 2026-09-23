# ADR 0003: Ship WebP runtime art, generated from the PNG masters

- **Status:** Accepted, 2026-09-23
- **Code:** `Tools/ArtPipeline/export_runtime_webp.py`, `src/render/assetCatalog.ts`, `Assets/Runtime/`

## Context

The runtime PNGs totalled 48.6 MB. The portal's hard limit is 50 MB per ZIP, the game must be playable within 5 s at 10 Mbps, and MOBILE_PERFORMANCE asks for a small initial download.

## Decision

- `pnpm art:export` converts the PNG masters to WebP (quality 82, exact alpha) in `Assets/Runtime/`, with a `manifest.json` of source hashes.
- Code keeps referring to art by its PNG name. `assetUrl("x.png")` resolves to the bundled `x.webp`, so art authors and code don't need to change.
- A test fails if referenced art is missing, if unused art is bundled, or if a WebP is older than its source.
- Only the first screen blocks boot; everything else loads after play starts (see `Docs/PERFORMANCE_BUDGET.md`).

## Consequences

- 48.6 MB became 7.2 MB, and the ZIP is about 7.5 MB. Time to playable is 1.3 s at 10 Mbps.
- The WebPs are generated but committed, so a build needs no Python. Anyone changing art has to rerun the export; the test catches it if they forget.
- The art stays at 2x resolution. Moving to 1x would halve texture memory, but it needs a visual sign-off first.
