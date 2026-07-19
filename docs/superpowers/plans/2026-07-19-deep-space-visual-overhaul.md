---
title: Deep Space Visual Overhaul Implementation Plan
date: 2026-07-19
status: ready
tags:
  - project/cosmos
  - implementation/threejs
  - implementation/tdd
related:
  - "[[2026-07-19-deep-space-visual-overhaul-design]]"
  - "[[2026-07-19-deep-space-progression]]"
  - "[[dev-log]]"
---

# Deep Space Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the underexposed deep-space stops with a bright face-on Milky Way, a label-free 200–300 galaxy deep field, and a vivid purple volumetric Cosmic Web using adaptive shader effects and bloom.

**Architecture:** Keep each visual stop in its existing deterministic Three.js layer, add a focused postprocessing adapter behind `createScene`, and move quality budgets into the existing immutable quality profile. The Local Group becomes a batched shader-driven deep field with no interactive markers; Milky Way and Cosmic Web keep their layer contracts and receive brighter geometry/materials. Postprocessing must fail closed to the existing direct renderer.

**Tech Stack:** Vite 7, Three.js 0.178, Three.js addons (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`), Vitest 4, Playwright 1.61, Obsidian Markdown.

## Global Constraints

- Active route remains exactly `place`, `earth`, `solar-system`, `milky-way`, `local-group`, `cosmic-web`, `unknown`.
- Existing Earth, Solar System, and Cosmic Web progression gates must remain impossible to bypass.
- High profile uses shader-driven detail and bloom; medium/economy reduce budgets without changing composition or exposure.
- `prefers-reduced-motion` disables motion, not brightness.
- Local Group renders 200–300 galaxies on high and exposes no annotations, markers, or click targets.
- No stretched fullscreen bitmap may become a primary scene.
- Every owned geometry, material, render target, and generated texture is disposed exactly once.
- Changed-code coverage remains at least 80%; full unit, build, E2E, audit, and visual inspection are required.

---

### Task 1: Adaptive deep-space render pipeline

**Files:**
- Create: `src/scene/deep-space-postprocessing.js`
- Create: `src/scene/deep-space-postprocessing.test.js`
- Create: `src/core/quality-profile.test.js`
- Modify: `src/core/quality-profile.js`
- Modify: `src/scene/create-scene.js`
- Test: `src/scene/deep-space-postprocessing.test.js`

**Interfaces:**
- Produces: `createDeepSpacePostprocessing({ renderer, scene, camera, quality, reducedMotion, factories })` returning frozen `{ active, render(), resize({ width, height, pixelRatio }), dispose() }`.
- Produces quality fields: `bloomEnabled`, `bloomStrength`, `bloomRadius`, `bloomThreshold`, `bloomScale`, `localGroupGalaxies`.
- `createScene` accepts optional `renderPipeline`; when present, `render`, `resize`, and `dispose` delegate to it, otherwise behavior remains `renderer.render(scene, camera)`.

- [ ] **Step 1: Write failing quality and pipeline contract tests**

```js
it("keeps high bloom while reduced motion only disables movement", () => {
  const profile = createQualityProfile({ width: 1920, height: 1080, dpr: 2, cores: 12, reducedMotion: true });
  expect(profile).toMatchObject({
    tier: "high",
    bloomEnabled: true,
    bloomStrength: 1.18,
    bloomScale: 0.75,
    localGroupGalaxies: 260
  });
});

it("falls back to the direct renderer when composer creation fails", () => {
  const renderer = { render: vi.fn() };
  const pipeline = createDeepSpacePostprocessing({
    renderer,
    scene: {},
    camera: {},
    quality: { bloomEnabled: true },
    reducedMotion: false,
    factories: { createComposer: () => { throw new Error("unsupported"); } }
  });
  pipeline.render();
  expect(pipeline.active).toBe(false);
  expect(renderer.render).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run RED tests**

Run: `npm.cmd test -- src/core/quality-profile.test.js src/scene/deep-space-postprocessing.test.js`

Expected: FAIL because the new quality fields and pipeline module do not exist.

- [ ] **Step 3: Add immutable budgets and a fail-safe composer adapter**

```js
const DEEP_SPACE = Object.freeze({
  high: Object.freeze({ bloomEnabled: true, bloomStrength: 1.18, bloomRadius: 0.72, bloomThreshold: 0.48, bloomScale: 0.75, localGroupGalaxies: 260 }),
  medium: Object.freeze({ bloomEnabled: true, bloomStrength: 0.92, bloomRadius: 0.58, bloomThreshold: 0.52, bloomScale: 0.5, localGroupGalaxies: 160 }),
  economy: Object.freeze({ bloomEnabled: false, bloomStrength: 0, bloomRadius: 0, bloomThreshold: 1, bloomScale: 0.5, localGroupGalaxies: 90 })
});

export const createDeepSpacePostprocessing = (input = {}) => {
  const { renderer, scene, camera, quality = {}, factories = defaultFactories } = input;
  let composer = null;
  try {
    if (quality.bloomEnabled) composer = factories.createComposer({ renderer, scene, camera, quality });
  } catch {
    composer = null;
  }
  let disposed = false;
  return Object.freeze({
    active: Boolean(composer),
    render: () => !disposed && (composer ? composer.render() : renderer.render(scene, camera)),
    resize: ({ width, height, pixelRatio }) => {
      if (!disposed && composer) {
        composer.setPixelRatio(pixelRatio * quality.bloomScale);
        composer.setSize(width, height);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      composer?.dispose();
    }
  });
};
```

- [ ] **Step 4: Wire the pipeline behind `createScene` and verify lifecycle**

Add tests asserting one `render`, resize propagation, one `dispose`, and unchanged direct-render fallback.

Run: `npm.cmd test -- src/core/quality-profile.test.js src/scene/deep-space-postprocessing.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/quality-profile.js src/core/quality-profile.test.js src/scene/create-scene.js src/scene/deep-space-postprocessing.js src/scene/deep-space-postprocessing.test.js
git commit -m "feat: add adaptive deep-space bloom pipeline"
```

### Task 2: Large face-on Milky Way

**Files:**
- Modify: `src/scene/layers/milky-way.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/core/quality-profile.js`
- Modify: `src/data/cosmos.js` only if the settled camera pose needs framing adjustment

**Interfaces:**
- Keeps `createMilkyWayLayer({ THREE, annotations, quality, glowTexture, createMarker, reducedMotion })`.
- Adds immutable `root.userData.composition` with `{ inclinationDegrees, diameter, armCount, dustLanes }`.
- Keeps `interactive`, `setPresence`, `updateParallax`, and idempotent `dispose`.

- [ ] **Step 1: Write failing composition tests**

```js
it("presents a large four-arm disc toward the camera", () => {
  const layer = createMilkyWay({ quality: { tier: "high", galaxyPoints: 9000 } });
  expect(layer.root.userData.composition).toEqual(expect.objectContaining({
    inclinationDegrees: 20,
    diameter: 210,
    armCount: 4,
    dustLanes: 2
  }));
  expect(layer.root.rotation.x).toBeCloseTo(-Math.PI / 2 + Math.PI / 9, 4);
  expect(layer.root.scale.x).toBeGreaterThanOrEqual(1.5);
});
```

- [ ] **Step 2: Run RED test**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "large four-arm disc"`

Expected: FAIL on missing composition and wrong orientation.

- [ ] **Step 3: Rebuild the spatial distribution and materials**

Use an `x/y` logarithmic spiral with `z` thickness, deterministic arm clumps, a warm core, two offset dark dust bands, a sparse halo, and high/medium/economy budgets of `9000/5600/2800` points. Set the root to a 20° cinematic inclination and scale the disc to fill roughly 70% of the settled desktop frame.

```js
const INCLINATION = Math.PI / 9;
root.rotation.x = -Math.PI / 2 + INCLINATION;
root.rotation.z = -0.16;
root.scale.setScalar(1.62);
root.userData.composition = Object.freeze({
  inclinationDegrees: 20,
  diameter: 210,
  armCount: 4,
  dustLanes: 2
});
```

- [ ] **Step 4: Keep annotations outside the bright core**

Project existing marker positions from the same face-on coordinate system and test that no marker lies within the protected core radius.

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: all Milky Way and existing deep-space tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/quality-profile.js src/scene/layers/milky-way.js src/scene/layers/deep-space-layers.test.js src/data/cosmos.js
git commit -m "feat: render a bright face-on Milky Way"
```

### Task 3: Label-free shader deep field

**Files:**
- Rewrite: `src/scene/layers/local-group.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces `createLocalGroupLayer({ THREE, quality, glowTexture, reducedMotion, seed })`.
- Returns frozen `catalog` metadata with deterministic `{ id, profile, position, size, rotation, temperature }` records.
- Returns `interactive: Object.freeze([])` unconditionally.
- Keeps `setPresence`, `updateParallax`, and idempotent `dispose`.

- [ ] **Step 1: Write failing deep-field tests**

```js
it.each([
  ["high", 260],
  ["medium", 160],
  ["economy", 90]
])("renders a deterministic %s deep field without annotations", (tier, count) => {
  const layer = createLocalGroup({ quality: { tier, localGroupGalaxies: count }, seed: 20610422 });
  expect(layer.catalog).toHaveLength(count);
  expect(new Set(layer.catalog.map(({ profile }) => profile))).toEqual(new Set(["spiral", "elliptical", "irregular"]));
  expect(layer.interactive).toEqual([]);
  expect(layer.root.getObjectByName("local-group-markers")).toBeUndefined();
});
```

- [ ] **Step 2: Run RED test**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "deep field without annotations"`

Expected: FAIL because the layer still derives six galaxies and markers from annotations.

- [ ] **Step 3: Generate and batch 3D galaxy records**

Generate 10–15 hero records and the remaining distant records from a seeded RNG. Preserve broad empty regions by sampling deterministic clusters instead of a uniform screen fill. Batch the catalog into three profile geometries and render each with a `ShaderMaterial` point-sprite fragment that produces soft elliptical, spiral, or irregular light profiles.

```js
const GALAXIES_PER_TIER = Object.freeze({ high: 260, medium: 160, economy: 90 });
const HEROES_PER_TIER = Object.freeze({ high: 14, medium: 11, economy: 8 });

const catalog = Object.freeze(Array.from({ length: quality.localGroupGalaxies }, (_, index) => Object.freeze({
  id: `deep-field-${index}`,
  profile: PROFILE_ORDER[index % PROFILE_ORDER.length],
  position: Object.freeze(sampleClusteredPosition(random, index)),
  size: index < HEROES_PER_TIER[quality.tier] ? 18 + random() * 22 : 2.4 + random() * 8.5,
  rotation: random() * Math.PI * 2,
  temperature: index % 7 === 0 ? "warm" : "cool"
})));
```

- [ ] **Step 4: Remove annotation and texture-loading integration**

Delete `groupGalaxyAnnotations` from the active annotation list, stop loading Local Group bitmap sources in `main.js`, and instantiate the layer with `seed: 20610422`. Keep the narration panel for the stage.

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js src/data/cosmos.test.js`

Expected: PASS and no Local Group interactive marker.

- [ ] **Step 5: Commit**

```bash
git add src/scene/layers/local-group.js src/scene/layers/deep-space-layers.test.js src/main.js
git commit -m "feat: fill the Local Group with shader galaxies"
```

### Task 4: Vivid purple volumetric Cosmic Web

**Files:**
- Modify: `src/scene/layers/cosmic-web.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/core/quality-profile.js`

**Interfaces:**
- Keeps `createCosmicWebLayer({ THREE, quality, glowTexture, reducedMotion, seed })`.
- Extends `root.userData.structure` with immutable `palette`, `nodeBudget`, `hotNodeCount`, and `depthLayers`.
- Graph remains frozen, deterministic, normalized, and connected.

- [ ] **Step 1: Write failing palette/density tests**

```js
it("uses a bright purple-magenta network with golden hot nodes", () => {
  const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 }, seed: 20260719 });
  expect(layer.root.userData.structure).toMatchObject({
    palette: [0x8b5cf6, 0xd946ef, 0xf472b6, 0xfbbf24],
    nodeBudget: 120,
    hotNodeCount: 12,
    depthLayers: 3
  });
  expect(layer.root.getObjectByName("cosmic-web-filaments").material.opacity).toBeGreaterThanOrEqual(0.48);
});
```

- [ ] **Step 2: Run RED test**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "bright purple-magenta"`

Expected: FAIL on palette, node budget, and opacity.

- [ ] **Step 3: Increase deterministic density and luminous hierarchy**

Use node budgets `120/92/68`, filament particle budgets `18000/9800/5200`, three depth layers, violet base filaments, magenta cluster particles, pink intersections, and 10% golden hot nodes. Raise base visibility before bloom so the economy fallback remains readable.

```js
const PALETTE = Object.freeze([0x8b5cf6, 0xd946ef, 0xf472b6, 0xfbbf24]);
const NODE_BUDGET = Object.freeze({ high: 120, medium: 92, economy: 68 });
const HOT_NODE_RATIO = 0.1;
const FILAMENT_OPACITY = Object.freeze({ high: 0.58, medium: 0.52, economy: 0.48 });
```

- [ ] **Step 4: Verify graph invariants and reduced/economy readability**

Test exact point budgets, graph connectivity, palette coverage, minimum economy opacity, parallax disabling under reduced motion, and idempotent disposal.

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/quality-profile.js src/scene/layers/cosmic-web.js src/scene/layers/deep-space-layers.test.js
git commit -m "feat: illuminate the volumetric cosmic web"
```

### Task 5: Integration, visual evidence, and regression gate

**Files:**
- Modify: `src/main.js`
- Modify: `src/scene/create-scene.js`
- Modify: `tests/progression.e2e.spec.js`
- Modify: `docs/dev-log.md`
- Create: `.superpowers/sdd/deep-space-overhaul-report.md` (ignored local execution evidence)
- Update intentional screenshots under `.superpowers/sdd/task-7-artifacts/` (ignored local visual evidence)

**Interfaces:**
- `main.js` creates one deep-space postprocessing adapter and passes it to `createScene`.
- `sceneManager.render()` remains the sole frame render call.
- Existing progression E2E helpers remain public-UI-only and gain settled visual assertions.

- [ ] **Step 1: Add failing integration and screenshot assertions**

Extend the real-game Playwright journey to capture settled stages at `1920×1080` and `390×844`. Assert Local Group has no visible `.space-label`, no horizontal overflow exists, WebGL console errors remain zero, and stage rail/progression invariants remain unchanged.

```js
await expect(page.locator("body")).toHaveAttribute("data-stage", "local-group");
await expect(page.locator('.space-label[data-stage="4"]')).toHaveCount(0);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
```

- [ ] **Step 2: Run RED integration test**

Run: `npm.cmd run test:e2e -- --grep "each real game victory"`

Expected: FAIL until marker removal, postprocessing integration, and revised evidence hooks are complete.

- [ ] **Step 3: Wire postprocessing and tune settled exposure**

Instantiate the adapter after renderer/scene/camera creation, set `renderer.outputColorSpace = THREE.SRGBColorSpace`, use `THREE.ACESFilmicToneMapping`, and set a tested exposure shared by all three stops. Pass the adapter to `createScene`; resize/dispose remains owned by the scene manager.

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;
const renderPipeline = createDeepSpacePostprocessing({ renderer, scene, camera, quality, reducedMotion });
```

- [ ] **Step 4: Run the complete verification loop**

Run in order:

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd run test:e2e
npm.cmd audit --audit-level=high
git diff --check
```

Expected: all tests PASS, changed-code coverage ≥80%, E2E progression `5/5` or greater, audit reports `0 vulnerabilities`, and only the known Vite chunk-size advisory may remain.

- [ ] **Step 5: Inspect real pixels and record Obsidian evidence**

Inspect all six desktop/mobile screenshots at original resolution. Reject the result if the Milky Way is edge-on or occupies less than half the usable width, if fewer than dozens of Local Group galaxies are visible, if any Local Group annotation remains, or if the Cosmic Web reads as black instead of purple-magenta.

Append a dated Obsidian section to `docs/dev-log.md` with RED→GREEN evidence, quality budgets, screenshots, test totals, coverage, performance/fallback notes, and final commit SHA.

- [ ] **Step 6: Review and commit**

Request independent code/spec/security/visual review, fix all Critical/Important findings, rerun affected gates, then commit:

```bash
git add src tests package.json package-lock.json docs/dev-log.md
git commit -m "feat: deliver luminous deep-space observatory scenes"
```

### Task 5A: Strict topology and mobile-composition correction

**Files:**
- Modify: `src/scene/layers/cosmic-web.js`
- Modify: `src/scene/layers/local-group.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/styles.css`
- Modify: `tests/progression.e2e.spec.js`
- Modify: `docs/dev-log.md`
- Modify ignored evidence: `.superpowers/sdd/deep-space-overhaul-report.md`

**Interfaces:**
- Existing `createCosmicWebLayer(input)` and `createLocalGroupLayer(input)` signatures remain unchanged.
- `screenshotMetrics(buffer)` additionally returns `purpleGridCoverage` and `brightGridCoverage` measured over fixed central grids.
- `#distanceScale` keeps every scale marker and its active state in the DOM; CSS alone compacts mobile presentation.

- [x] **Step 1: Add and run RED pixel/layout gates**

Add fixed-cell coverage to the honest-victory E2E path and require Cosmic Web `purpleGridCoverage >= 0.60` desktop and `>= 0.40` mobile. Require Local Group bright-grid coverage to materially exceed the rejected baseline. Assert the mobile rail is compact, top-centred, and does not occupy the right subject region.

Run: `npm.cmd run test:e2e -- --grep "each real game victory"`

Expected: FAIL on the rejected screenshots/composition before production changes.

- [x] **Step 2: Add and run RED projected-topology tests**

Sample each Cosmic Web edge in settled-camera NDC space and assert broad grid coverage while retaining graph connectivity, deterministic records, exact budgets, three depth bands, and volume bounds. Project Local Group records into NDC grid cells and assert broader vertical/central clustered coverage with explicit empty cells.

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: FAIL because the current 12 Cosmic islands and seven Local Group clusters leave too many cells empty.

- [x] **Step 3: Implement the minimal topology and rail correction**

Use staggered deterministic anchors, bounded nearest-neighbour plus inter-anchor links, and uniform/multi-strand particle sampling. Expand Local Group to primary/satellite clusters without uniform noise. In `@media (max-width: 760px)`, move the distance scale to a compact top-center safe area and render only `.active`, `.active + li`, and `li:has(+ .active)` markers visually.

- [x] **Step 4: Verify GREEN and regenerate evidence**

Run the focused unit test, then the honest-victory E2E. Inspect all six new PNGs at original pixels and reject black/sparse/cropped results even if numeric thresholds pass.

- [x] **Step 5: Run full gates and independent review**

Run `npm.cmd test`, `npm.cmd run test:coverage`, `npm.cmd run build`, `npm.cmd run test:e2e`, `npm.cmd audit --audit-level=high`, and `git diff --check`. Request independent visual and code review; fix every Critical/Important finding.

- [x] **Step 6: Record and commit**

Append exact before/after grid, luminance, purple, Local Group and rail metrics to the Obsidian journal/report. Commit code/tests, then the SHA-bearing evidence update.

### Task 5B: Organic curved filaments and accessible compact rail

**Files:**
- Modify: `src/scene/layers/cosmic-web.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/ui/create-shell.js`
- Modify: `src/ui/create-shell.test.js`
- Modify: `src/styles.css`
- Modify: `docs/dev-log.md`
- Modify ignored evidence: `.superpowers/sdd/deep-space-overhaul-report.md`

**Interfaces:**
- `createCosmicWebLayer(input)` and its frozen graph records remain unchanged.
- One internal cubic sampler consumes `{ start, end, edgeIndex, progress }` and returns a bounded `[x, y, z]`; filaments and particles share it.
- `#distanceScale` gains `aria-describedby="distanceScaleA11ySummary"`; the summary contains every supplied stage label and distance while the compact visual list remains `aria-hidden="true"`.

- [ ] **Step 1: Add and verify RED geometry tests**

Assert that each filament edge produces ten connected segments, at least `75%` of meaningful edges have an intermediate point more than `1` world unit from the direct chord, the curve endpoint records still match graph endpoints, and high/medium/economy rendered coordinates remain finite and bounded.

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "curved organic filament"`

Expected: FAIL because the current filament geometry stores one collinear segment per graph edge.

- [ ] **Step 2: Add and verify RED accessibility test**

Assert a visually-hidden summary contains every `${stage.label}: ${stage.distance}`, the aside references its id, and the compact marker list is `aria-hidden`.

Run: `npm.cmd test -- src/ui/create-shell.test.js -t "complete distance route"`

Expected: FAIL because the current compact marker list removes inactive values from the accessibility tree without a replacement summary.

- [ ] **Step 3: Implement the shared bounded cubic sampler**

Derive two stable perpendicular/vertical control offsets from `edgeIndex`, clamp control points within an inset volume, emit ten LineSegments segments per graph edge, and sample the exact existing point budget on the same curve before strand/jitter offsets. Mix pink into the existing violet/magenta particle colors and reduce sprite size only enough to create fine texture while keeping current pixel gates.

- [ ] **Step 4: Implement the accessible rail summary**

Create `#distanceScaleA11ySummary` with class `sr-only`, set the aside relationship, set `aria-hidden="true"` on the visual `<ol>`, and add a reusable clipping-only `.sr-only` rule that does not affect layout.

- [ ] **Step 5: Verify focused GREEN and performance contracts**

Run both focused suites, then the full deep-space layer suite. Confirm exact nodes/edges/particles, three depth bands, seed cap sweep behavior, idempotent disposal and all-tier bounds remain green.

- [ ] **Step 6: Regenerate and inspect real pixels**

Run the honest victory E2E, inspect all six original PNGs, and reject the result if long straight triangulation remains prominent, fine particulate texture disappears, or existing luminous/purple/grid/mobile-rail gates regress.

- [ ] **Step 7: Run full gates, reviews and record evidence**

Run unit, coverage, build, full E2E, audit and diff hygiene. Obtain root visual acceptance, append exact metrics/SHAs to Obsidian evidence, then commit implementation and documentation.
