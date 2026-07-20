---
title: Ultra Task 3 — Photographic Plane Report
date: 2026-07-20
tags:
  - space-site
  - threejs
  - tdd
  - ultra-photographic-space
status: complete
---

# Ultra Task 3 — Photographic Plane Report

Related plan: [[2026-07-20-ultra-photographic-space]].

> [!success] TDD evidence
> RED was captured with `npm.cmd test -- src/scene/layers/photographic-plane.test.js`: Vitest could not resolve `./photographic-plane.js` because the module did not yet exist. GREEN then passed `12/12` focused tests after the primitive was added.

## Delivered contract

- `createPhotographicPlane` consumes the specified Three.js dependencies and returns frozen `{ root, mesh, setPresence, setParallax, dispose }`.
- The mesh uses `MeshBasicMaterial` with a shared texture, NormalBlending, transparency, disabled depth write/test, and disabled tone mapping.
- Presence clamps through the shared utility and applies against an immutable base opacity.
- Parallax changes only root `x`/`y`; its supplied `z` depth remains intact.
- Disposal is idempotent and releases only the plane geometry/material. The store-owned texture is never disposed.

## Verification

- Focused unit test: `12/12` passed.
- Full unit suite: `14` files and `232/232` tests passed.
- Coverage: statements `89.30%`, branches `81.00%`, functions `87.00%`, lines `90.99%`; the new plane file has `95.55%` branch coverage.
- Production build: passed. Vite reported its existing advisory that the generated JavaScript chunk exceeds `500 kB` after minification.
- `git diff --check`: passed before staging; staged diff check follows before commit.

## Residual concern

The implementation preserves `root.position.z = depth` during parallax. This follows the explicit task contract; it differs from the plan's sample expectation ending in `z = 0` after a parallax call.

## Review remediation

> [!success] Validation hardening
> The review found that the texture boundary accepted arbitrary objects. RED was reproduced with both `{}` and a resource-style wrapper `{ texture: new THREE.Texture(), release() {} }`; both reached `MeshBasicMaterial` instead of failing fast. The boundary now requires `texture.isTexture === true`.

- Invalid base opacities below `0` and above `1` are covered explicitly; only runtime presence is clamped.
- GREEN: focused `16/16`; full unit suite `236/236`.
- Coverage remains statements `89.30%`, branches `81.00%`, functions `87.00%`, lines `90.99%`.
- Build passed with the same Vite chunk-size advisory noted above.
