---
title: Ultra Task 5 — Oversized Photographic Cosmic Web Report
date: 2026-07-20
tags:
  - development
  - threejs
  - tdd
  - ultra-photographic-space
status: complete
---

# Ultra Task 5 — Oversized Photographic Cosmic Web

Related plan: [[2026-07-20-ultra-photographic-space#Task 5 Replace the Cosmic Web graph with an oversized photographic field|Ultra Photographic Space — Task 5]].

> [!success] Outcome
> The procedural graph, points, bloom nodes, depth particles, and shader tissue were removed from the Cosmic Web layer. The stage now renders two oversized photographic planes backed by the same store-owned texture, with subtle depth separation and no graph metadata.

## TDD evidence

> [!failure] RED
> Before production changes, `npm.cmd test -- src/scene/layers/deep-space-layers.test.js` reported `7 failed | 42 passed`. The first failure was the intended migration signal: `cosmic-web-filaments` was still a `LineSegments` object instead of being absent. Exact-interface tests also rejected the obsolete required `cosmicWebPoints` budget.

> [!success] GREEN
> After replacing the procedural implementation, deleting `cosmic-tissue.js`, and correcting only floating-point assertion precision, the focused contract passed: `2` files, `65/65` tests.

## Delivered contract

- `createCosmicWebLayer({ THREE, texture, quality, reducedMotion })` requires a real Three.js texture and a supported `high | medium | economy` tier.
- The frozen return value contains exactly `{ root, interactive, setPresence, updateParallax, dispose }`; `interactive` is a frozen empty array and `graph` is absent.
- `cosmic-web-photo-primary`: depth `-235`, width `1760`, aspect `16/9`, opacity `0.98`, render order `2`, parallax factor `0.12`.
- `cosmic-web-photo-secondary`: depth `-300`, width `1880`, aspect `16/9`, opacity `0.16`, render order `1`, parallax factor `0.05`.
- The secondary photograph uses a restrained `[7, -4]` local offset, `1.025` scale, and `-0.012` radian rotation so the repeated source is not an obvious duplicate.
- Both materials use `THREE.NormalBlending`; the oversized geometry continues the network beyond the viewport without procedural overlays.
- Presence clamps invalid values closed. Medium parallax retains the shared `0.55` quality scale; economy and reduced-motion modes remain static.
- Disposal is idempotent for both geometry/material trees and never disposes the shared texture.

## Removed dead code

- Deleted `src/scene/layers/cosmic-tissue.js`.
- Removed tissue-specific imports, helpers, tests, metadata assertions, graph topology tests, filament/particle budgets, and bloom expectations.
- A source scan finds no remaining `createCosmicTissue` or `cosmic-tissue` reference under `src/`.

## Coverage-scope extension

> [!note] Why coverage tests expanded
> Removing a very large, highly covered procedural module exposed older uncovered branches elsewhere and reduced the global branch ratio from `80.25%` to `78.61%`, even though `cosmic-web.js` itself was above the required threshold. The task owner explicitly extended ownership to meaningful tests in the ultra-photo pipeline; no additional production module was changed.

Added test evidence:

- Lower device DPR now explicitly caps high, medium, and economy profiles through the existing `Math.min(base.pixelRatio, dpr)` contract.
- Photographic planes ignore presence/parallax updates after disposal while preserving geometry/material single-disposal and texture nonownership.
- Postprocessing fallback disposal is idempotent when composer creation fails.
- The adopted render-pipeline manager ignores render, resize, update, and hit-test work after disposal.
- Invalid resize dimensions retain the last valid canvas size and safely cap pixel ratio.

## Verification

| Gate | Result |
| --- | --- |
| Focused Cosmic Web + photographic plane | `2` files, `65/65` passed |
| Coverage-focused photo pipeline | `4` files, `87/87` passed |
| Full unit suite | `14` files, `174/174` passed |
| Global coverage | statements `86.35%`, branches `80.00%`, functions `83.46%`, lines `88.22%` |
| `cosmic-web.js` coverage | `100%` statements / branches / functions / lines |
| `photographic-plane.js` coverage | `100%` statements / branches / functions / lines |
| Production build | passed |
| Dependency audit | `0 vulnerabilities` |
| Dead-reference scan | passed |
| Diff check | passed |

> [!warning] Build advisory
> Vite retains the existing advisory that the generated JavaScript chunk exceeds `500 kB` after minification. The build succeeds.

## Task 6 handoff

`src/main.js` still constructs the Cosmic Web layer with the retired graph-era inputs until [[2026-07-20-ultra-photographic-space#Task 6 Load photos safely and make finale stars circular|Task 6]] adds `cosmicWebPhotoResource`, passes its texture, and releases the store handle exactly once. This is the planned next task and is the only known integration dependency.
