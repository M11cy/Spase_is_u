---
title: Ultra Task 6 — Safe photo lifecycle and circular finale stars
date: 2026-07-20
tags:
  - development
  - ultra-photographic-space
  - texture-lifecycle
  - tdd
status: complete
---

# Ultra Task 6 — Safe photo lifecycle and circular finale stars

Implemented [[2026-07-20-ultra-photographic-space#Task 6 Load photos safely and make finale stars circular|Ultra Task 6]] from [[task-6-brief]] and the Task 4 handoff in [[progress]].

## Delivered

- `main.js` now acquires Milky Way, Local Group, and Cosmic Web photos through the shared `textureStore` and passes `cosmicWebPhotoTexture` into `createCosmicWebLayer`.
- Exact fallback colors remain `0x02040a`, `0x02040a`, and `0x080313`; every acquired photo texture receives the renderer's `maxAnisotropy`.
- `deep-space-photo-lifecycle.js` uses `Promise.allSettled`, so a sibling rejection cannot leak handles that already fulfilled.
- The frozen lifecycle releases all three handles exactly once, cleans fulfilled handles after any one of the three acquisitions rejects, and cleans all handles when asynchronous layer setup fails.
- `disposeExperience` releases the photo lifecycle before `textureStore.dispose`; existing layer contracts continue to dispose owned geometry/materials without disposing store-owned textures.
- `.personal-stars span` is now an `8 × 8` circular radial light. The pixelated scaling rule was removed while the existing flash pseudo-element and glow animation remain intact.

## TDD evidence

> [!failure] CSS RED
> `npm.cmd test -- src/ui/create-shell.test.js` failed `renders the finale stars as circular radial lights without pixelated scaling`: expected `width: 8px`, received the existing `6px` square/pixelated rule. Result: 1 failed, 8 passed.

> [!failure] Lifecycle RED
> `npm.cmd test -- src/scene/deep-space-photo-lifecycle.test.js` failed 6/6 contracts because `setupDeepSpacePhotoLifecycle` did not exist.

> [!success] GREEN
> The focused integration command passed 4 files and 72 tests, covering exact routes/fallbacks, anisotropy on all handles, exact-once release, partial failure at each acquisition position, late asynchronous setup failure, main wiring, circular CSS, and the existing shared-texture non-disposal layer contracts.

## Verification

- Focused: `npm.cmd test -- src/ui/create-shell.test.js src/scene/deep-space-photo-lifecycle.test.js src/scene/deep-space-assets.test.js src/scene/layers/deep-space-layers.test.js` — 72/72 passed.
- Full unit: `npm.cmd test` — 15 files, 182/182 passed.
- Coverage: `npm.cmd run test:coverage` — statements `86.63%`, branches `80.14%`, functions `84.10%`, lines `88.46%`.
- Production build: `npm.cmd run build` — passed.
- Dependency audit: `npm.cmd audit --audit-level=high` — 0 vulnerabilities.
- Patch hygiene: `git diff --check` — passed.
- Browser smoke: built app loaded at `http://127.0.0.1:5174/`; canvas, intro, Personal Stars container, galaxy annotations, and Cosmic Web annotation were present; browser error log was empty, including no `Cosmic web layer requires a THREE texture` page error.
- Independent review: `APPROVED`; reviewer reran 65 relevant tests with no Critical, Important, or Minor findings.

## Self-review

- The acquisition boundary is focused on the three deep-space photos and does not alter the Earth/solar texture contract.
- Returned state and texture mapping are frozen; the only lifecycle transition replaces the private frozen release state, making repeated public release calls no-ops.
- The setup callback covers construction of all three photo layers, so construction failure cannot strand store references.
- The Cosmic Web layer's existing unit test still proves it never disposes the shared photo texture.

> [!warning] Non-blocking build advisory
> Vite retains the existing warning that the generated JavaScript chunk exceeds `500 kB` after minification. The build succeeds, and bundle splitting is outside this task.

## Checkpoint

`fix: load sharp photo layers and round finale stars`

## External review follow-up — atomic layer construction

> [!failure] Review RED
> The follow-up lifecycle suite failed 5 contracts: invalid boundaries reached `textureStore.load` 42 times, setup had no cleanup registration context, constructor failures at the second and third layers could not dispose previously created layers, and `main.js` registered no layer cleanups.

- The helper now validates its complete boundary before acquisition: `textureStore.load`, exact non-empty Milky Way / Local Group / Cosmic Web route strings, finite positive anisotropy, and the setup function.
- The setup context exposes a frozen `registerCleanup` API. `main.js` registers each layer immediately after construction.
- Setup failure runs registered disposers once in reverse order, then releases all texture handles once. A throwing disposer cannot interrupt the remaining unwind or replace the original setup error.
- Successful setup disarms and drops setup-only cleanup callbacks. Normal `sceneManager.dispose` therefore remains the sole owner of layer disposal, while the photo lifecycle only releases store handles.
- Frozen input routes remain unchanged throughout acquisition and setup.

> [!success] Follow-up GREEN
> Constructor failure at Local Group disposes Milky Way once; constructor failure at Cosmic Web disposes Local Group then Milky Way once each. Both paths release all three photo handles once. A success-path test proves lifecycle release does not invoke layer disposal, and the cleanup-throws test proves reverse order `[2, 1, 0]`, original error preservation, and complete handle cleanup.

### Follow-up verification

- Focused integration: 4 files, 76/76 passed before the final cleanup-throws coverage case; focused helper after review: 12/12 passed.
- Full unit: 15 files, 187/187 passed.
- Coverage: statements `86.73%`, branches `80.38%`, functions `84.46%`, lines `88.59%`; lifecycle helper `96.42% / 92.30% / 100% / 98%`.
- Production build: passed with only the existing large-chunk advisory.
- Dependency audit: 0 vulnerabilities.
- Patch hygiene: `git diff --check` passed.
- Browser smoke: the rebuilt app exposed the complete intro and Cosmic Web DOM, rendered its canvas, and produced an empty browser error log; the missing-texture error was absent.
- Independent re-review: `APPROVED`, no remaining correctness, cleanup, immutability, or coverage findings.

### Follow-up checkpoint

`fix: dispose partial deep-space setup`
