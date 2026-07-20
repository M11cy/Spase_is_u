---
title: Cosmic Web Exposure Fix Report
date: 2026-07-20
tags:
  - development
  - cosmic-web
  - systematic-debugging
  - tdd
status: complete
completed: true
---

# Cosmic Web Exposure Fix

Related baseline: [[task-5-report|Ultra Task 5 -- Oversized Photographic Cosmic Web]].

## Goal

Restore a vivid but restrained Cosmic Web exposure without changing the accepted master, derivative assets, geometry, parallax, shared-texture lifecycle, or global scene treatment.

## Scoped plan

- [x] Verify the served image variants retain the bright 8K master luminance and hashes stay unchanged.
- [x] Reproduce the nearly-black stage and isolate canvas rendering from page overlays.
- [x] Confirm the runtime scene fog and Cosmic Web material settings.
- [x] Add a focused regression and observe the expected RED failure.
- [x] Apply the smallest Cosmic Web-only fix and tune bounded opacity candidates from honest production screenshots.
- [x] Inspect fresh proof at original resolution and run focused, full, coverage, build, audit, and diff-hygiene gates.
- [x] Obtain independent code/spec review and prepare a commit containing only the owned files.

## Root cause

> [!bug] Fog, not the photo pipeline
> The accepted image family is bright, but Three r178 creates `MeshBasicMaterial` with `fog: true`. At the Cosmic Web camera, the global `FogExp2(0.0026)` leaves only `1.716651%` primary and `0.842736%` secondary transmittance. The page overlay does not darken the frame; removing all page chrome made the central crop slightly darker.

### Asset boundary

All nine browser-selectable Cosmic Web files were decoded through Sharp, normalized to `1920 x 1080`, and measured with the acceptance thresholds. The ranges were:

| Asset family | Mean luminance | Luminous ratio | Purple ratio | Near-black ratio | Warm ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2K/4K/8K AVIF, WebP, JPEG | `48.6356-49.2475` | `0.982471-0.986226` | `0.971417-0.974516` | `0.003667-0.005589` | `0.905377-0.914026` |

The honest browser route requested `/space/cosmic-web-photo-8k.avif`, received HTTP `200` with `image/avif`, and logged no browser errors. `git diff --quiet HEAD -- public/space/cosmic-web-photo-*` remains clean.

### Runtime boundary

| Setting | Primary | Secondary |
| --- | ---: | ---: |
| Material fog before fix | `true` | `true` |
| Base opacity before fix | `0.98` | `0.16` |
| World depth | `-235` | `-300` |
| Camera distance | `775.436006` | `840.564691` |
| Exp2 transmittance | `0.0171665122` | `0.0084273641` |

The transmittance values use the same shader relation, $e^{-(density \cdot distance)^2}$, with density `0.0026`.

### Page-versus-canvas isolation

| Fresh pre-fix `1920 x 1080` crop | Page | Canvas only |
| --- | ---: | ---: |
| Luminous ratio | `0.0101445231` | `0.0091987481` |
| Purple-magenta ratio | `0.0043779691` | `0.0044021983` |
| Purple grid coverage | `0.1770833333` | `0.1770833333` |
| Near-black ratio | `0.9845359102` | `0.9854758368` |
| Warm-magenta/orange ratio | `0.0001512237` | `0.0001512237` |

The official Task7 frame independently reported `0.009816` luminous coverage. The fresh canvas-only measurement reproduces that underexposure without any DOM overlay.

## TDD record

> [!failure] RED -- fog contract
> `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t createCosmicWebLayer` failed exactly because the primary material returned `fog: true` when the new contract required `false`: `1 failed`, `13 passed`, `35 skipped`.

After both Cosmic Web materials opted out of scene fog, the same focused suite passed: `14 passed`, `35 skipped`.

> [!failure] RED -- calibrated exposure contract
> Updating the expected base/faded opacities first produced the intended two failures: actual `0.98 / 0.16` versus required `0.17 / 0.034`, and actual half-presence `0.49 / 0.08` versus required `0.085 / 0.017`.

After the minimal opacity change, the focused suite returned to `14 passed`.

## Bounded production tuning

Every candidate was applied to the same already-unlocked honest production stage. No asset, geometry, parallax, camera, post-processing, page overlay, or global exposure changed.

| Primary / secondary | Luminous | Purple | Grid | Near-black | Warm |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0.04 / 0.008` | `0.044408` | `0.045893` | `0.562500` | `0.942328` | `0.023311` |
| `0.05 / 0.010` | `0.064452` | `0.101441` | `0.729167` | `0.915708` | `0.034355` |
| `0.06 / 0.012` | `0.087298` | `0.162267` | `0.864583` | `0.887227` | `0.046802` |
| `0.07 / 0.014` | `0.111366` | `0.220026` | `0.958333` | `0.858775` | `0.060280` |
| `0.08 / 0.016` | `0.135209` | `0.272268` | `0.958333` | `0.830690` | `0.075105` |
| `0.10 / 0.020` | `0.181845` | `0.360768` | `0.979167` | `0.778410` | `0.106459` |
| `0.12 / 0.024` | `0.224823` | `0.425646` | `0.989583` | `0.732345` | `0.137782` |
| `0.14 / 0.028` | `0.263708` | `0.476971` | `1.000000` | `0.691074` | `0.168696` |
| `0.16 / 0.032` | `0.298830` | `0.518809` | `1.000000` | `0.653812` | `0.198119` |
| `0.18 / 0.036` | `0.331241` | `0.553875` | `1.000000` | `0.620443` | `0.226051` |
| `0.20 / 0.040` | `0.360705` | `0.584159` | `1.000000` | `0.590799` | `0.251817` |

> [!info] Constraint interaction
> The preferred `0.07-0.18` luminous band and hard `nearBlack <= 0.65` gate cannot both be reached by opacity-only tuning of the accepted image histogram. At `0.10 / 0.020`, luminance is already `0.181845` while near-black remains `0.778410`. The next restrained candidates reduce near-black monotonically, with `0.16 / 0.032` missing the hard gate by `0.003812`. The selected `0.17 / 0.034` interpolation is therefore the smallest pair with a useful near-black margin; it prioritizes all hard gates and the no-wash visual requirement.

## Final implementation

- Both Cosmic Web photo materials explicitly set `fog = false` after creation.
- Primary/secondary base opacities changed from `0.98 / 0.16` to `0.17 / 0.034`.
- Both planes retain the same shared texture, sizes, depths, transforms, render order, Normal blending, presence fade, and parallax factors.
- The accepted master and every Cosmic Web derivative remain unchanged.

### Before and after

| `1920 x 1080` page crop | Fresh before | Final | Required hard gate |
| --- | ---: | ---: | ---: |
| Luminous ratio | `0.0101445231` | `0.3154527271` | robustly above `0.04` |
| Purple-magenta ratio | `0.0043779691` | `0.5370230813` | `>= 0.055` |
| Purple grid coverage | `0.1770833333` | `1.0000000000` | `>= 0.60` |
| Near-black ratio | `0.9845359102` | `0.6364255386` | `<= 0.65` |
| Warm-magenta/orange ratio | `0.0001512237` | `0.2123991772` | `>= 0.08` |

The final canvas-only metrics agree: luminous `0.3152831226`, purple `0.5380574182`, grid `1.0`, near-black `0.6364146772`, and warm `0.2127007892`.

> [!success] Original-pixel visual acceptance
> The final frame has vivid violet/pink strands and rounded warm nodes, smooth non-angular topology, edge-to-edge coverage, preserved black voids, readable labels/rail, and no blown full-frame wash.

![[cosmic-web-exposure-proof/final-0p17-0p034-page.png]]

## Verification

| Gate | Result |
| --- | --- |
| Focused Cosmic Web | `14 passed`, `35 skipped` |
| Full Vitest | `15 files`, `187 passed` |
| Focused `cosmic-web.js` coverage | statements `100%`, branches `100%`, functions `100%`, lines `100%` |
| Full coverage | statements `86.75%`, branches `80.38%`, functions `84.46%`, lines `88.61%` |
| Production build | passed; known Vite chunk-size advisory only |
| Dependency audit | `found 0 vulnerabilities` |
| Honest production route | 8K AVIF served, final screenshot captured, browser errors `[]` |

The project-wide E2E file was intentionally not executed because it writes into the paused Task7-owned `ultra-photo-artifacts` directory. The equivalent real gated route was exercised by the unique ignored proof runner and wrote only under `cosmic-web-exposure-proof`.

> [!success] Independent review
> The read-only reviewer reported no Critical, Important, or Minor findings and approved the scoped implementation, tests, report, and original-pixel proof. The reviewer independently reran the focused suite: `14 passed`, `35 skipped`.

## Residual risk

The final luminous ratio exceeds the preferred `0.18` ceiling because the accepted image histogram makes that preference incompatible with the hard near-black gate under the explicitly constrained opacity-only fix. Original-pixel inspection confirms the resulting frame retains dark depth and is not a wash. The existing production bundle remains above Vite's `500 kB` advisory threshold; this fix does not change that architecture.
