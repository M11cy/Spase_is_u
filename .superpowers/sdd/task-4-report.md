---
title: Ultra Task 4 — Photographic Galaxy Stages Report
date: 2026-07-20
tags:
  - development
  - threejs
  - tdd
  - ultra-photographic-space
status: complete
---

# Ultra Task 4 — Photographic Galaxy Stages

Related plan: [[2026-07-20-ultra-photographic-space]].

> [!success] Outcome
> The visible procedural Milky Way and Local Group fields were replaced by texture-required photographic planes while preserving the frozen layer lifecycle contract. Milky Way retains four annotations; Local Group now exposes exactly six interactive annotations in source order.

## TDD evidence

> [!failure] RED
> After replacing the active procedural expectations, `npm.cmd test -- src/scene/layers/deep-space-layers.test.js` reported `20 failed | 76 passed`. The failures showed that `milky-way-photo` and `local-group-photo` did not exist, Milky Way markers still used procedural projection, Local Group still returned a procedural `catalog` with zero markers, and `main.js` lacked both photographic integrations.

> [!success] GREEN
> `npm.cmd test -- src/scene/layers/deep-space-layers.test.js src/data/cosmos.test.js` passed `101/101` after implementation and the coverage boundary case.

## Delivered contracts

- Milky Way: one `milky-way-photo` plane, depth `-80`, width `390`, aspect `16/9`, opacity `1`, render order `2`, parallax factor `0.18`.
- Local Group: one `local-group-photo` plane, depth `-138`, width `780`, aspect `16/9`, opacity `1`, render order `2`, parallax factor `0.12`.
- Both layers return exactly the frozen `{ root, interactive, setPresence, updateParallax, dispose }` contract.
- Both delegate the owned mesh lifecycle to `createPhotographicPlane`; marker resources are disposed idempotently, while store-owned photo and glow textures are never disposed by a layer.
- Economy tier and reduced motion both resolve to zero movement.
- `main.js` maps both annotation collections through `withBaseAsset`, contributes both interactive collections to labels/hit testing, loads two photos through the existing `textureStore`, applies renderer anisotropy, and releases each handle exactly once.

## Exact marker mapping

Milky Way coordinates are local to the `390 × 219.375` photo plane:

| ID | Normalized photo anchor | Local marker `[x, y, z]` |
| --- | --- | --- |
| `galactic-center` | `(0.50, 0.50)` | `[0, 0, 1]` |
| `orion-arm` | `(0.64, 0.54)` | `[54.6, -8.775, 1]` |
| `perseus-arm` | `(0.27, 0.45)` | `[-89.7, 10.96875, 1]` |
| `galactic-halo` | `(0.53, 0.18)` | `[11.7, 70.2, 1]` |

Local Group markers preserve the supplied annotation `x/y` anchors; `z` is translated relative to the plane depth so the world-space annotation position remains unchanged:

| ID | Normalized photo position | Local marker `[x, y, z]` |
| --- | --- | --- |
| `group-milky-way` | `(0.3821, 0.4635)` | `[-92, 16, 10]` |
| `group-andromeda` | `(0.6513, 0.4316)` | `[118, 30, 4]` |
| `group-triangulum` | `(0.5231, 0.6413)` | `[18, -62, 6]` |
| `group-lmc` | `(0.3013, 0.6231)` | `[-155, -54, 8]` |
| `group-smc` | `(0.2372, 0.5365)` | `[-205, -16, 2]` |
| `group-m32` | `(0.7115, 0.3678)` | `[165, 58, 6]` |

The interactive order is exactly `group-milky-way`, `group-andromeda`, `group-triangulum`, `group-lmc`, `group-smc`, `group-m32`. Every frozen annotation copy retains all source metadata and adds only `object3D`.

## Verification

| Gate | Result |
| --- | --- |
| Focused layers + cosmos | `2` files, `101/101` passed |
| Full unit suite | `14` files, `218/218` passed |
| Coverage | statements `88.24%`, branches `80.25%`, functions `86.26%`, lines `90.16%` |
| Production build | passed |
| Dependency audit | `0 vulnerabilities` |
| Diff check | passed |

> [!warning] Build advisory
> Vite still reports the existing advisory that the generated JavaScript chunk exceeds `500 kB` after minification. The build succeeds.

> [!success] Independent review
> The Task 4 reviewer returned `APPROVED` with no Critical, Important, or Minor findings after re-running the focused suite, build, and diff check.

## Task 6 handoff

The existing deep-space route selector is now resolved once and both galaxy photo handles share the current Earth/solar `Promise.all`, anisotropy pass, and disposal path. [[2026-07-20-ultra-photographic-space#Task 6 Load photos safely and make finale stars circular|Task 6]] should add `cosmicWebPhotoResource` to this same flow and pass its texture to the Cosmic Web layer; no additional loader or store is needed.
