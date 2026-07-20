---
title: Procedural Cosmic Tissue Correction Implementation Plan
date: 2026-07-20
status: completed
tags:
  - project/cosmos
  - implementation/threejs
  - implementation/tdd
related:
  - "[[2026-07-19-deep-space-visual-overhaul-design#Поправка 2026-07-20 — procedural volumetric cosmic tissue]]"
  - "[[2026-07-19-deep-space-visual-overhaul]]"
  - "[[dev-log]]"
---

# Procedural Cosmic Tissue Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Cosmic Web from a curved graph on black space into a deterministic, continuous volumetric tissue while preserving every graph/progression contract.

**Architecture:** Add a focused `cosmic-tissue.js` factory that renders `3 / 2 / 1` world-space additive shader planes for high/medium/economy. `cosmic-web.js` composes those base-pass layers behind the existing curved graph, delegates presence and depth-weighted parallax, and caps cubic controls by full chord length. Screenshot metrics reject near-black or cold-only fields before original-pixel review.

**Tech Stack:** Three.js 0.178 (`PlaneGeometry`, `Mesh`, `ShaderMaterial`), GLSL cellular/Voronoi + FBM, Vitest 4, Playwright 1.61, Sharp, Obsidian Markdown.

## Global Constraints

- Active route remains exactly `place`, `earth`, `solar-system`, `milky-way`, `local-group`, `cosmic-web`, `unknown`; no progression bypass is allowed.
- Graph nodes remain exactly `120 / 92 / 68`, particles `18000 / 9800 / 5200`, edge records frozen/connected/capped, and graph depth bands remain `3`.
- Every graph edge still renders exactly `10` connected curve segments; tissue adds no graph edge or particle.
- Tissue tier counts are exactly high `3`, medium `2`, economy `1`; quality changes draw cost, not composition or global exposure.
- Tissue is world-space base-pass geometry, never a fullscreen bitmap, postprocess fill, or bloom-only object.
- `prefers-reduced-motion` disables parallax movement only; presence, color and brightness remain unchanged.
- Final Cosmic Web screenshot gates are near-black `<=0.65` desktop / `<=0.72` mobile and warm-magenta-orange `>=0.08` desktop / `>=0.07` mobile, in addition to every existing luminous/purple/grid gate.
- Galaxy and Local Group pixels, UI layout, mobile rail, labels and global renderer exposure must not be changed.
- Each unique geometry and material is disposed exactly once; composer failure continues to use direct base rendering.
- Changed-code coverage remains at least `80%`; unit, coverage, build, full E2E, audit, diff hygiene and original-pixel review are mandatory.

---

### Task 1: Lock the rejected pixels and short-edge behavior in RED

**Files:**
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `tests/progression.e2e.spec.js`

**Interfaces:**
- Consumes: existing `createCosmicWebLayer(input)`, screenshot crop/grid calculation and current fresh PNG route.
- Produces: discriminating RED gates for full-chord curvature, tissue contracts and final pixel density/color.

- [x] **Step 1: Add the short-edge and tissue contract tests**

Add helpers that measure a rendered curve's maximum distance from its direct chord, then add a seed `13` high-tier regression. Use exact object names `cosmic-web-tissue-far`, `cosmic-web-tissue-mid`, `cosmic-web-tissue-near` and metadata key `root.userData.structure.tissue`:

```js
it("bounds short-edge cubic bends by full chord length", () => {
  const layer = createCosmicWeb({
    quality: { tier: "high", cosmicWebPoints: 18000 },
    seed: 13
  });
  const positions = layer.root.getObjectByName("cosmic-web-filaments")
    .geometry.getAttribute("position");
  layer.graph.edges.forEach(([from, to], edgeIndex) => {
    const start = layer.graph.nodes[from];
    const end = layer.graph.nodes[to];
    const chordLength = Math.hypot(...end.map((value, axis) => value - start[axis]));
    const maximumBend = Math.max(...Array.from({ length: 9 }, (_, segmentIndex) => (
      distanceToSegment(pointAt(positions, edgeIndex * 20 + segmentIndex * 2 + 1), start, end)
    )));
    expect(maximumBend).toBeLessThanOrEqual(chordLength * 0.4 + 0.001);
  });
  layer.dispose();
});

it.each([
  ["high", 18000, 3],
  ["medium", 9800, 2],
  ["economy", 5200, 1]
])("creates deterministic %s procedural tissue", (tier, cosmicWebPoints, expectedLayers) => {
  const first = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
  const second = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
  const tissue = first.root.children.filter(({ name }) => name === "cosmic-web-tissue")[0];
  expect(tissue.children).toHaveLength(expectedLayers);
  expect(first.root.userData.structure.tissue).toEqual(second.root.userData.structure.tissue);
  expect(tissue.children.every(({ material }) => (
    material.isShaderMaterial
    && material.blending === THREE.AdditiveBlending
    && material.depthWrite === false
    && material.depthTest === true
    && material.toneMapped === false
  ))).toBe(true);
  first.dispose();
  second.dispose();
});
```

- [x] **Step 2: Add screenshot darkness and warm-tissue metrics**

Inside `screenshotMetrics`, count exact central-crop pixels:

```js
if (luminance <= 10) nearBlackPixels += 1;
const isWarmMagentaOrange = luminance >= 18
  && saturation >= 10
  && red >= 18
  && (
    (blue >= green * 1.25 && red >= green * 1.10)
    || (red >= green * 1.14 && green >= blue * 0.62 && blue >= green * 0.24)
  );
if (isWarmMagentaOrange) warmMagentaOrangePixels += 1;
```

Return both ratios, accept `maximumNearBlackRatio` and `minimumWarmMagentaOrangeRatio` in `captureSettledStage`, and assert them only for Cosmic Web:

```js
// desktop
maximumNearBlackRatio: 0.65,
minimumWarmMagentaOrangeRatio: 0.08

// mobile
maximumNearBlackRatio: 0.72,
minimumWarmMagentaOrangeRatio: 0.07
```

- [x] **Step 3: Run RED unit tests**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "short-edge|procedural tissue"`

Expected: FAIL because seed `13` uses `9 / 4` hard bend minima and there are zero tissue layers/metadata.

- [x] **Step 4: Run the honest pixel RED**

Run: `npm.cmd run test:e2e -- --grep "each real game victory"`

Expected: FAIL on the current fresh Cosmic Web with near-black about `0.9273 / 0.9065` and warm coverage about `0.0352 / 0.0369`; no production code has changed yet.

---

### Task 2: Build the deterministic volumetric tissue unit

**Files:**
- Create: `src/scene/layers/cosmic-tissue.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`

**Interfaces:**
- Produces: `createCosmicTissue({ THREE, tier, seed, volume })` returning frozen `{ root, meshes, metadata, setPresence, setParallax, dispose }`.
- `setPresence(number)` clamps through the caller-provided normalized presence contract.
- `setParallax({ x, y })` applies profile-specific local offsets; it does not modify color/uniform intensity.

- [x] **Step 1: Create immutable tier profiles and input validation**

Use exact tier selection and bounded depths:

```js
const PROFILE_ORDER = Object.freeze({
  high: Object.freeze(["far", "mid", "near"]),
  medium: Object.freeze(["far", "near"]),
  economy: Object.freeze(["mid"])
});
const PROFILES = Object.freeze({
  far: Object.freeze({ depth: -300, parallax: 0.22, opacity: 0.62, salt: 0x243f6a88 }),
  mid: Object.freeze({ depth: -235, parallax: 0.46, opacity: 0.78, salt: 0x85a308d3 }),
  near: Object.freeze({ depth: -170, parallax: 0.74, opacity: 0.58, salt: 0x13198a2e })
});
const TIER_OPACITY_SCALE = Object.freeze({ high: 1, medium: 1.55, economy: 2.35 });
```

`uOpacity` is `profile.opacity * TIER_OPACITY_SCALE[tier]`, keeping total tissue exposure approximately stable as draw count falls. Require `Group`, `PlaneGeometry`, `Mesh`, `ShaderMaterial`, `Color`, and `Vector2`; reject unsupported tiers, unsafe seeds and invalid positive volume dimensions.

- [x] **Step 2: Implement the fixed-cost procedural shaders**

The vertex shader only passes UV. The fragment shader must contain named `fbm`, `cellularRidge`, `fineDust` and palette sentinels so tests distinguish a real tissue shader from a flat color:

```glsl
float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave += 1) {
    value += valueNoise(point) * amplitude;
    point = mat2(1.6, -1.2, 1.2, 1.6) * point + 0.17;
    amplitude *= 0.5;
  }
  return value;
}

float cellularRidge(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  float nearest = 10.0;
  float secondNearest = 10.0;
  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      vec2 neighbor = vec2(float(x), float(y));
      float distanceToCell = length(neighbor + hash22(cell + neighbor) - local);
      if (distanceToCell < nearest) {
        secondNearest = nearest;
        nearest = distanceToCell;
      } else if (distanceToCell < secondNearest) {
        secondNearest = distanceToCell;
      }
    }
  }
  return 1.0 - smoothstep(0.035, 0.24, secondNearest - nearest);
}
```

In `main`, domain-warp `vUv * vec2(6.4, 3.8) + uUvOffset`, combine ridge/body/veil plus high-frequency deterministic dust, and mix exact normalized colors derived from `0x8b5cf6`, `0xd946ef`, `0xf472b6`, `0xf59e42`. Use `uPresence * uOpacity`, edge fade, additive transparency, no time uniform and no exposure/global renderer dependency.

- [x] **Step 3: Create depth-separated meshes and deterministic metadata**

Create one shared `PlaneGeometry(volume.width, volume.height)`, one material per selected profile and a group named `cosmic-web-tissue`. Mesh names are `cosmic-web-tissue-${profile}`; positions are `(0, 0, profile.depth)`, render order is `2`, and no bloom layer is enabled. Each deterministic layer seed is `((seed >>> 0) ^ profile.salt) >>> 0`; seeded offsets are generated once and never animated. Metadata is frozen plain data:

```js
Object.freeze({
  algorithm: "cellular-voronoi-fbm",
  layerCount: selectedProfiles.length,
  profiles: Object.freeze(selectedProfiles.map(({ name, seed, depth, parallax }) => (
    Object.freeze({ name, seed, depth, parallax })
  ))),
  palette: Object.freeze([0x8b5cf6, 0xd946ef, 0xf472b6, 0xf59e42])
});
```

- [x] **Step 4: Implement presence, parallax and idempotent disposal**

`setPresence` updates each `uPresence`; `setParallax` sets local x/y to `offset * profile.parallax`; `dispose` calls `disposeObjectTree(root)` once. The shared geometry must be disposed once even when three meshes reference it.

- [x] **Step 5: Run the tissue unit tests**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js -t "procedural tissue"`

Expected: PASS for deterministic uniforms/metadata, tier counts, base-pass flags, depth separation, distinct parallax and exactly-once disposal.

---

### Task 3: Integrate tissue and cap curved foreground bends

**Files:**
- Modify: `src/scene/layers/cosmic-web.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`

**Interfaces:**
- Consumes: `createCosmicTissue({ THREE, tier, seed, volume })`.
- Preserves: frozen public `{ root, interactive, graph, setPresence, updateParallax, dispose }` from `createCosmicWebLayer`.

- [x] **Step 1: Cap cubic control magnitudes by full chord length**

Replace hard unbounded minima with full-chord caps while retaining organic meaningful bends:

```js
const chordLength = Math.max(0.001, Math.hypot(
  deltaX,
  deltaY,
  end[2] - start[2]
));
const lateralMagnitude = Math.min(
  24,
  chordLength * 0.32,
  Math.max(9, planarLength * 0.16)
);
const verticalMagnitude = Math.min(
  chordLength * 0.2,
  4 + Math.abs(Math.cos(phase)) * 7
);
```

- [x] **Step 2: Compose tissue behind the graph foreground**

Create tissue after graph construction; add `tissue: tissue.metadata` to frozen `root.userData.structure`; add `tissue.root` before the existing five render objects. Keep `depthLayers: 3`, graph arrays and all point counts unchanged.

- [x] **Step 3: Delegate lifecycle without double disposal**

In `setPresence`, call `tissue.setPresence(presence)` before existing material opacity scaling. In `updateParallax`, keep the current returned/root offset and call `tissue.setParallax(offset)`. In `dispose`, call `tissue.dispose()` first so its cleared group is not re-disposed by `disposeObjectTree(root)`.

Update the rendered-volume test to evaluate every geometry vertex in world space so mesh translation is included:

```js
object.updateMatrixWorld(true);
const world = new THREE.Vector3(
  positions.getX(index),
  positions.getY(index),
  positions.getZ(index)
).applyMatrix4(object.matrixWorld);
```

Keep the same published-volume assertions against `world.x`, `world.y`, `world.z`; this strengthens the existing test for every mesh/points/line object rather than special-casing tissue.

- [x] **Step 4: Reduce direct graph-line dominance without hiding topology**

Set `FILAMENT_OPACITY` to high `0.48`, medium `0.44`, economy `0.40`; retain particle/node/hot-node budgets and sizes for the first pixel pass. Further tuning may reduce line opacity but may not increase point budgets, change global exposure or weaken gates.

- [x] **Step 5: Run all Cosmic Web unit contracts**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: all graph budget, seed sweep, curved sampler, tissue, bounds, presence/parallax, performance and disposal tests PASS.

- [x] **Step 6: Commit the tested implementation**

```text
git add src/scene/layers/cosmic-tissue.js src/scene/layers/cosmic-web.js src/scene/layers/deep-space-layers.test.js tests/progression.e2e.spec.js
git commit -m "feat: add procedural cosmic tissue"
```

---

### Task 4: Real-pixel tuning, reviews and final evidence

**Files:**
- Modify when evidence is final: `docs/dev-log.md`
- Modify ignored evidence: `.superpowers/sdd/deep-space-overhaul-report.md`

**Interfaces:**
- Consumes: honest public-UI victory route and six `.superpowers/sdd/task-7-artifacts/*.png` files.
- Produces: root-reviewed original pixels, complete gates and SHA-bearing Obsidian evidence.

- [x] **Step 1: Run the honest-victory GREEN**

Run: `npm.cmd run test:e2e -- --grep "each real game victory"`

Expected: PASS existing luminous/purple/grid/mobile gates plus near-black `<=0.65 / <=0.72` and warm `>=0.08 / >=0.07`; all six screenshots are freshly rewritten.

- [x] **Step 2: Inspect all six original PNGs**

Reject if Cosmic Web is still a regular lattice, if tissue is a flat wash/fullscreen rectangle, if warm variation is absent, if depth layers do not read volumetrically, or if Galaxy/Local/UI changed. Numeric thresholds never override visual rejection.

- [x] **Step 3: Obtain independent reviews**

Request task-scoped shader/security/lifecycle review and root original-pixel review. Fix every Critical/Important finding and repeat affected tests/screenshots; record accepted visual Minor findings honestly.

- [x] **Step 4: Run the complete final gate**

Run `npm.cmd test`, `npm.cmd run test:coverage`, `npm.cmd run build`, `npm.cmd run test:e2e`, `npm.cmd audit --audit-level=high`, `git diff --check`, confirm port `4173` is clear and the tracked worktree is clean after commits.

- [x] **Step 5: Record and commit evidence**

Append Task 5C RED/GREEN values, tier/lifecycle contracts, original-pixel verdict, full gate totals, known chunk advisory and exact SHAs to both Obsidian evidence files. Commit tracked records:

```text
git add docs/dev-log.md docs/superpowers/plans/2026-07-20-procedural-cosmic-tissue.md
git commit -m "docs: record procedural cosmic tissue acceptance"
```

---

## Completion evidence

> [!success] Root original-pixel verdict
> Fresh `1920 x 1080` desktop and `390 x 844` mobile Cosmic Web frames are **ACCEPTED**. The final field reads as dense fine violet-magenta tissue instead of coarse cracked glass; graph nodes and curved foreground strands remain legible, negative space remains, and the compact mobile rail is clean. Galaxy and Local Group desktop/mobile frames remain accepted and unchanged in spirit.

### RED -> GREEN audit

- Initial focused RED: `4` failures. Seed `13` short-edge bend was `6.35349460965352 > 5.229806032267265`; high/medium/economy tissue groups and metadata were absent.
- Initial honest pixel RED: desktop near-black `0.9274802782516864 > 0.65`; warm ratio `0.03516578633839696 < 0.08`.
- Flat-wash candidate was rejected despite passing hard gates: desktop/mobile near-black `0 / 0`, warm `0.98942 / 0.98485`.
- Fine-cell morphology increased the effective cellular field from about `26 x 16` to about `78 x 46`, retained one four-octave FBM call, and kept cellular ridge plus deterministic fine dust.
- Post-parallax bounds RED: high/medium `y=379.99899999999997 > 379.501`; economy `x=659.999 > 659.501`. Padding `0.001 -> 0.5` gave focused GREEN `3/3` across high/medium/economy at pointer extrema using `matrixWorld`.
- Final accepted pixels: desktop near-black `0.6479344173541359`, warm `0.21370170657246793`; mobile near-black `0.6022631578947368`, warm `0.21676315789473685`. These pass the hard gates; the slightly elevated warm ratios are an accepted visual Minor.
- The Web helper now observes public success as either transient `.solved` or the exact active/enabled next-level tile count. It preserves every correct public click, exact `9 -> 12 -> 16` structure, default polling timeout and wrong-click rejection.

### Final verification

- Implementation commit: `12ce002190ec720da2ee2e455f468c404bb53afa` (`feat: add procedural cosmic tissue`).
- Unit: `210/210`, `12/12` files.
- Coverage overall: statements `89.19%`, branches `80.10%`, functions `86.09%`, lines `90.89%`; scene/layers aggregate `97.77% / 92.44% / 97.10% / 98.36%`. The mandatory global `>=80%` branch gate was raised from baseline `611/784` to `628/784` with behavior-focused validation/lifecycle tests only.
- Build: PASS, `50` modules; known production chunk advisory `1009.84 kB` remains non-blocking.
- Audit: `0 vulnerabilities`; `git diff --check`: clean.
- Full E2E: first run `4/5` because one test opened a blank page before app startup; its isolated rerun passed `1/1` in `29.2s`. Unchanged full rerun passed `5/5` in `3.5m`, including victory/pixels and zero console/WebGL errors.
- Independent Task5C spec and quality reviews: **Approved**, Critical `0`, Important `0`. Accepted code Minors: the public tissue factory assumes the current fixed z-volume, and the extrema test samples two separable diagonals rather than all four corners.
- Coverage hardening commit: `6486681` (`test: cover cosmic tissue branch contracts`); independent test re-review: **Approved**, no findings after removing an artificial unreachable-fallback assertion.

![[task-7-artifacts/galaxy.png]]
![[task-7-artifacts/local-group.png]]
![[task-7-artifacts/cosmic-web.png]]
![[task-7-artifacts/galaxy-mobile.png]]
![[task-7-artifacts/local-group-mobile.png]]
![[task-7-artifacts/cosmic-web-mobile.png]]
