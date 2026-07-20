---
title: Milky Way photographic scale acceptance fix
date: 2026-07-20
tags:
  - development
  - ultra-photographic-space
  - milky-way
  - visual-acceptance
  - tdd
status: complete
---

# Milky Way photographic scale acceptance fix

## Root cause and chosen geometry

The stage-3 camera sits at `[0, 20, 213]`, targets `[0, 0, -80]`, and uses a 50° vertical FOV. Its target distance is `293.6818`, making the 16:9 frustum width at the Milky Way plane approximately `486.9194` world units.

- Previous photo width: `390`, or `80.10%` of the viewport-width frustum.
- Accepted photo width: `500`, or `102.69%` of that frustum.
- Scale factor: `500 / 390 = 1.28205128`.
- The source image has transparent outer margins, so the plane can slightly exceed the frustum while the complete luminous circular disk and halo remain visible.

The measured pre-fix occupied span was `0.47263017`. Linear projection predicted `0.60593612` after scaling; the production result was `0.602803738317757`.

Annotation anchors were scaled by the same factor so they remain attached to the same photographic features:

| Annotation | Before | After |
| --- | --- | --- |
| Galactic center | `[0, 0, 1]` | `[0, 0, 1]` |
| Orion arm | `[54.6, -8.775, 1]` | `[70, -11.25, 1]` |
| Perseus arm | `[-89.7, 10.96875, 1]` | `[-115, 14.0625, 1]` |
| Galactic halo | `[11.7, 70.2, 1]` | `[15, 90, 1]` |

## TDD evidence

> [!failure] RED
> After changing the exact geometry and marker contracts first, `npm.cmd test -- src/scene/layers/deep-space-layers.test.js` failed only the expected two Milky Way tests: the plane still returned `390 × 219.375` instead of `500 × 281.25`, and the first scaled arm marker still returned `[54.6, -8.775, 1]` instead of `[70, -11.25, 1]`. Result: 2 failed, 47 passed.

> [!success] GREEN
> The minimal production change set the plane width to `500` and proportionally remapped the three non-central anchors. The same focused command then passed 49/49 tests.

## Production visual proof

The final proof is the tracked Task7 artifact from a fresh production build. The complete public-control progression solved the rocket catch, all eight planet quizzes, engine assembly, and every later gate before writing the official `1920 × 1080` frame.

![[ultra-photo-artifacts/milky-way.png]]

- Before occupied span: `0.47263017`.
- After occupied span: `0.602803738317757`.
- Absolute gain: `0.130173568317757`.
- Relative gain: `27.54%`.
- Acceptance: greater than `0.58`, below `0.68`, and comfortably above the required `0.5`.
- Canvas backing size: `1920 × 1080` for a `1920 × 1080` viewport.
- Visible annotation bounds: `x = 513.50…1406.21`, `y = 166.16…617.28`.
- Topbar bottom: `66`; bottom navigation top: `1022`.
- Original-pixel inspection confirms the complete bright disk and halo remain visible, the right-side distance rail is clear, and all four labels remain legible and correctly attached to their center/arm/halo features.

## Verification

- Focused: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js` — 49/49 passed.
- Full unit: `npm.cmd test` — 15 files, 187/187 passed.
- Coverage: `npm.cmd run test:coverage` — statements `86.73%`, branches `80.38%`, functions `84.46%`, lines `88.59%`.
- Targeted production Playwright proof — 1/1 passed in 1.5 minutes; occupied span `0.602803738317757`.
- Production build: `npm.cmd run build` — passed.
- Dependency audit: `npm.cmd audit --audit-level=high` — 0 vulnerabilities.
- Patch hygiene: `git diff --check` — passed.
- Independent review: `APPROVED`; reviewer reran the focused 49-test suite and found no correctness, security, regression, clipping, or overlap concerns.

> [!warning] Non-blocking build advisory
> Vite retains the existing warning that the generated JavaScript chunk exceeds `500 kB` after minification. The build succeeds; bundle splitting is outside this visual scale fix.

## Scope preservation

- Master photo assets and texture quality were not changed.
- Task7 owns `tests/progression.e2e.spec.js` and the tracked official `ultra-photo-artifacts/milky-way.png` evidence.
- The report now embeds the official artifact so a clean checkout renders the accepted proof without relying on ignored temporary output.

## Checkpoint

`fix: enlarge photographic milky way`
