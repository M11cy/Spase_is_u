---
title: Ultra Photographic Space Implementation Plan
date: 2026-07-20
tags:
  - space-site
  - implementation-plan
  - threejs
  - tdd
status: ready
---

# Ultra Photographic Space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three procedural deep-space stages with ultra-resolution photographic compositions, restore six Local Group annotations, make finale stars round, and restore full-resolution rendering.

**Architecture:** A tier-aware asset selector loads local `8K / 4K / 2K` photo families through the existing reference-counted texture store. Focused Three.js layers render those textures on camera-facing planes with subtle parallax; annotations remain separate interactive markers. The base composer renders at full DPR while only the bloom composer is downscaled.

**Tech Stack:** Vite, Three.js 0.178, Vitest, Playwright, Sharp, local AVIF/WebP/JPEG assets, image generation tool.

## Global Constraints

- Master images are at least `7680 px` on the long side; runtime families are `8K / 4K / 2K` for high/medium/economy.
- The Milky Way is one whole photographic galaxy occupying `70–82%` of the safe viewport width; procedural arms are not visible.
- The Local Group is one evenly distributed photographic galaxy field with exactly six interactive annotations: Milky Way, Andromeda, M32, Triangulum, Large Magellanic Cloud, Small Magellanic Cloud.
- The Cosmic Web composition is approximately `1.3×` the viewport, organic, purple/pink/warm, and contains no visible angular procedural tissue or dominant line segments.
- Finale stars are circular; only the question-mark glyph may remain pixel-shaped.
- Base/final rendering uses full `quality.pixelRatio`; only bloom uses `quality.pixelRatio × bloomScale`.
- Target DPR caps are high `2`, medium `1.5`, economy `1.25`, limited by the device DPR.
- Every photo texture uses `SRGBColorSpace` and the renderer's maximum anisotropy.
- Image-load failure falls through local AVIF → WebP → JPEG → deterministic texture fallback.
- Progression and all existing mini-game gates remain unchanged.

## File map

- Create `src/scene/deep-space-assets.js`: pure tier-to-route selection.
- Create `src/scene/deep-space-assets.test.js`: route and immutability contracts.
- Create `src/scene/layers/photographic-plane.js`: shared plane construction, presence and safe parallax math.
- Create `src/scene/layers/photographic-plane.test.js`: aspect, material and disposal contracts.
- Create `scripts/build-deep-space-assets.mjs`: derive `4K` and `2K` JPEGs from generated `8K` masters.
- Modify `scripts/optimize-assets.mjs`: emit AVIF/WebP variants and manifest entries for all nine deep-space JPEGs.
- Modify `src/core/quality-profile.js` and its tests: new DPR caps.
- Modify `src/scene/deep-space-postprocessing.js` and its tests: independent base and bloom DPR.
- Rewrite `src/scene/layers/milky-way.js`: one photographic plane plus existing four stage annotations.
- Rewrite `src/scene/layers/local-group.js`: one photographic field plus six markers.
- Rewrite `src/scene/layers/cosmic-web.js`: photo planes only; retain public layer lifecycle.
- Delete `src/scene/layers/cosmic-tissue.js`: no longer referenced after photographic replacement.
- Modify `src/scene/layers/deep-space-layers.test.js`: photographic stage contracts.
- Modify `src/main.js`: load/release photo textures, add Local Group markers, set anisotropy.
- Modify `src/styles.css`: circular finale stars.
- Modify `tests/progression.e2e.spec.js`: six Local Group labels, full-resolution telemetry, new screenshots.
- Modify `docs/dev-log.md`: Obsidian development and acceptance record.

---

### Task 1: Restore full-resolution render pipeline

**Files:**
- Modify: `src/core/quality-profile.js`
- Modify: `src/core/quality-profile.test.js`
- Modify: `src/scene/deep-space-postprocessing.js`
- Modify: `src/scene/deep-space-postprocessing.test.js`

**Interfaces:**
- Produces: `quality.pixelRatio` capped at `2 / 1.5 / 1.25`.
- Produces: composer method `setPixelRatios({ base, bloom })` used only by `createDeepSpacePostprocessing.resize`.

- [ ] **Step 1: Write failing DPR profile tests**

```js
expect(createQualityProfile({ width: 1920, height: 1080, dpr: 3, cores: 16, reducedMotion: false }).pixelRatio).toBe(2);
expect(createQualityProfile({ width: 900, height: 700, dpr: 3, cores: 8, reducedMotion: false }).pixelRatio).toBe(1.5);
expect(createQualityProfile({ width: 390, height: 844, dpr: 3, cores: 8, reducedMotion: false }).pixelRatio).toBe(1.25);
```

- [ ] **Step 2: Write the failing composer separation test**

```js
pipeline.resize({ width: 1920, height: 1080, pixelRatio: 2 });
expect(bloomComposer.setPixelRatio).toHaveBeenCalledWith(1.5);
expect(finalComposer.setPixelRatio).toHaveBeenCalledWith(2);
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm.cmd test -- src/core/quality-profile.test.js src/scene/deep-space-postprocessing.test.js`

Expected: DPR assertions report `1.5 / 1.25 / 1`; final composer incorrectly reports the bloom-scaled ratio.

- [ ] **Step 4: Implement the new caps and separated composer API**

```js
const PROFILES = Object.freeze({
  high: Object.freeze({ tier: "high", pixelRatio: 2, stars: 5200, cosmicWebPoints: 18000, galaxyPoints: 9000 }),
  medium: Object.freeze({ tier: "medium", pixelRatio: 1.5, stars: 3600, cosmicWebPoints: 9800, galaxyPoints: 5600 }),
  economy: Object.freeze({ tier: "economy", pixelRatio: 1.25, stars: 1800, cosmicWebPoints: 5200, galaxyPoints: 2800 })
});
```

```js
setPixelRatios: ({ base, bloom }) => {
  bloomComposer.setPixelRatio(bloom);
  finalComposer.setPixelRatio(base);
}
```

```js
composer.setPixelRatios({
  base: pixelRatio,
  bloom: pixelRatio * quality.bloomScale
});
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm.cmd test -- src/core/quality-profile.test.js src/scene/deep-space-postprocessing.test.js`

Expected: both test files pass and final composer receives full DPR.

- [ ] **Step 6: Commit**

```powershell
git add src/core/quality-profile.js src/core/quality-profile.test.js src/scene/deep-space-postprocessing.js src/scene/deep-space-postprocessing.test.js
git commit -m "fix: restore full resolution space rendering"
```

### Task 2: Produce and route the ultra-resolution photo families

**Files:**
- Create: `public/space/milky-way-photo-8k.jpg`
- Create: `public/space/milky-way-photo-4k.jpg`
- Create: `public/space/milky-way-photo-2k.jpg`
- Create: `public/space/local-group-photo-8k.jpg`
- Create: `public/space/local-group-photo-4k.jpg`
- Create: `public/space/local-group-photo-2k.jpg`
- Create: `public/space/cosmic-web-photo-8k.jpg`
- Create: `public/space/cosmic-web-photo-4k.jpg`
- Create: `public/space/cosmic-web-photo-2k.jpg`
- Create: `scripts/build-deep-space-assets.mjs`
- Modify: `scripts/optimize-assets.mjs`
- Modify: `public/space/assets.json`
- Create: `src/scene/deep-space-assets.js`
- Create: `src/scene/deep-space-assets.test.js`

**Interfaces:**
- Produces: `selectDeepSpaceTextureRoutes({ tier }): Readonly<{ milkyWay, localGroup, cosmicWeb }>`.

- [ ] **Step 1: Generate the three photographic masters with the image generation tool**

Milky Way prompt, using `public/space/milky-way-realistic.jpg` as the visual reference:

```text
Create an ultra-detailed astrophotographic visualization of the Milky Way seen as one complete face-on spiral galaxy. The entire circular disk must be visible with a bright warm central bulge, blue-white arms, dark dust lanes, subtle red emission nebulae, and a soft extended halo. Center the galaxy in a wide 16:9 black-space frame with enough clean negative space for UI. No labels, no text, no diagrams, no point-cloud rendering, no cropped disk, no edge-on view. Photorealistic observatory-grade space image, crisp fine detail, natural dynamic range.
```

Local Group prompt, using the user's uniform-galaxy screenshot as composition reference:

```text
Create an ultra-detailed wide astrophotographic field of the Local Group on pure black space. Distribute many clearly resolved spiral, elliptical, and irregular galaxies evenly across the whole 16:9 frame. Use varied sizes, rotations, brightness and natural blue-white/warm colors, but avoid clusters, piles, repeated stamps, large empty holes, text and labels. Reserve visible named anchor galaxies near normalized positions: Milky Way (0.36,0.43), Andromeda (0.62,0.39), M32 (0.69,0.33), Triangulum (0.52,0.62), Large Magellanic Cloud (0.29,0.63), Small Magellanic Cloud (0.23,0.54). Photorealistic deep-space survey, crisp, high dynamic range.
```

Cosmic Web prompt, using `public/space/cosmic-web-bright.png` as color reference:

```text
Create an ultra-detailed wide scientific astrophotographic visualization of the cosmic web filling the entire 16:9 frame. Smooth organic violet, magenta and faint warm-gold filaments flow continuously between luminous rounded nodes, with soft gas, depth and fine particulate structure. Make the network broad and immersive with structures continuing beyond every edge. No polygon cells, no Voronoi pattern, no cracked glass, no straight graph edges, no sharp corners, no grid, no text or labels. Photorealistic cosmic-scale matter distribution, crisp 8K detail on deep black-violet space.
```

Save the generated masters under the exact `*-photo-8k.jpg` paths and verify each long side is at least `7680` after high-quality master preparation.

- [ ] **Step 2: Write the failing route-selector test**

```js
expect(selectDeepSpaceTextureRoutes({ tier: "high" })).toEqual({
  milkyWay: "/space/milky-way-photo-8k.jpg",
  localGroup: "/space/local-group-photo-8k.jpg",
  cosmicWeb: "/space/cosmic-web-photo-8k.jpg"
});
expect(selectDeepSpaceTextureRoutes({ tier: "medium" }).cosmicWeb).toBe("/space/cosmic-web-photo-4k.jpg");
expect(selectDeepSpaceTextureRoutes({ tier: "economy" }).localGroup).toBe("/space/local-group-photo-2k.jpg");
expect(() => selectDeepSpaceTextureRoutes({ tier: "ultra" })).toThrow(TypeError);
```

- [ ] **Step 3: Run the selector test and verify RED**

Run: `npm.cmd test -- src/scene/deep-space-assets.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the selector**

```js
const ROUTES = Object.freeze(Object.fromEntries(
  [["high", "8k"], ["medium", "4k"], ["economy", "2k"]].map(([tier, suffix]) => [tier, Object.freeze({
    milkyWay: `/space/milky-way-photo-${suffix}.jpg`,
    localGroup: `/space/local-group-photo-${suffix}.jpg`,
    cosmicWeb: `/space/cosmic-web-photo-${suffix}.jpg`
  })])
));

export const selectDeepSpaceTextureRoutes = (quality = {}) => {
  const routes = ROUTES[quality?.tier];
  if (!routes) throw new TypeError("Deep-space texture routes require a supported tier");
  return routes;
};
```

- [ ] **Step 5: Implement deterministic 4K/2K derivation and optimizer inputs**

`scripts/build-deep-space-assets.mjs` reads each `*-photo-8k.jpg` and writes `4096 × 2304` plus `2048 × 1152` JPEG derivatives using Sharp Lanczos3, `quality: 92`, `chromaSubsampling: "4:4:4"`. Extend `DEFAULT_SOURCES` with all nine names, preserving their native widths, then run:

Run: `node scripts/build-deep-space-assets.mjs`

Run: `npm.cmd run assets:optimize`

Expected: all nine JPEGs exist; AVIF/WebP siblings and manifest entries exist for every route.

- [ ] **Step 6: Validate physical dimensions and routes**

Run:

```powershell
node -e "import('sharp').then(async ({default:s})=>{for(const f of ['milky-way','local-group','cosmic-web'])for(const k of ['8k','4k','2k']){const p=`public/space/${f}-photo-${k}.jpg`;const m=await s(p).metadata();console.log(p,m.width,m.height)}})"
```

Expected: widths are at least `7680`, `4096`, and `2048` respectively; no height is zero.

- [ ] **Step 7: Run tests and commit**

Run: `npm.cmd test -- src/scene/deep-space-assets.test.js`

Expected: PASS.

```powershell
git add public/space scripts/build-deep-space-assets.mjs scripts/optimize-assets.mjs src/scene/deep-space-assets.js src/scene/deep-space-assets.test.js
git commit -m "feat: add ultra photographic space assets"
```

### Task 3: Add the shared photographic-plane primitive

**Files:**
- Create: `src/scene/layers/photographic-plane.js`
- Create: `src/scene/layers/photographic-plane.test.js`

**Interfaces:**
- Consumes: `{ THREE, texture, name, width, aspect, depth, opacity, renderOrder }`.
- Produces: `{ root, mesh, setPresence(value), setParallax(offset, factor), dispose() }`.

- [ ] **Step 1: Write failing lifecycle and material tests**

```js
const plane = createPhotographicPlane({
  THREE,
  texture,
  name: "test-photo",
  width: 400,
  aspect: 16 / 9,
  depth: -80,
  opacity: 0.94,
  renderOrder: 2
});
expect(plane.mesh.geometry.parameters).toMatchObject({ width: 400, height: 225 });
expect(plane.mesh.material.map).toBe(texture);
expect(plane.mesh.material.toneMapped).toBe(false);
plane.setPresence(0.5);
expect(plane.mesh.material.opacity).toBeCloseTo(0.47);
expect(plane.root.visible).toBe(true);
plane.setParallax({ x: 4, y: -2 }, 0.25);
expect(plane.root.position.toArray()).toEqual([1, -0.5, 0]);
plane.dispose();
plane.dispose();
expect(plane.mesh.geometry.dispose).toHaveBeenCalledOnce();
expect(plane.mesh.material.dispose).toHaveBeenCalledOnce();
expect(texture.dispose).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/scene/layers/photographic-plane.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal primitive**

Use `MeshBasicMaterial` with `transparent: true`, `depthWrite: false`, `depthTest: false`, `toneMapped: false`, `NormalBlending`; set `root.position.z = depth`. Clamp presence with `clampPresence`, store immutable `baseOpacity`, and dispose only owned geometry/material because the texture store owns the texture.

- [ ] **Step 4: Run the test and commit**

Run: `npm.cmd test -- src/scene/layers/photographic-plane.test.js`

Expected: PASS.

```powershell
git add src/scene/layers/photographic-plane.js src/scene/layers/photographic-plane.test.js
git commit -m "feat: add photographic space plane primitive"
```

### Task 4: Replace Milky Way and Local Group with photographic compositions

**Files:**
- Modify: `src/scene/layers/milky-way.js`
- Modify: `src/scene/layers/local-group.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/main.js`

**Interfaces:**
- `createMilkyWayLayer({ THREE, texture, annotations, createMarker, quality, reducedMotion })`.
- `createLocalGroupLayer({ THREE, texture, annotations, createMarker, quality, reducedMotion })`.
- Both return the existing frozen layer contract `{ root, interactive, setPresence, updateParallax, dispose }`.

- [ ] **Step 1: Replace procedural expectations with failing photo contracts**

```js
const layer = createMilkyWayLayer({ texture, quality: { tier: "high" } });
expect(layer.root.getObjectByName("milky-way-photo").material.map).toBe(texture);
expect(layer.root.getObjectByName("milky-way-stars")).toBeUndefined();
```

```js
const layer = createLocalGroupLayer({ texture, annotations: localGroupAnnotations, createMarker, quality: { tier: "high" } });
expect(layer.root.getObjectByName("local-group-photo").material.map).toBe(texture);
expect(layer.interactive).toHaveLength(6);
expect(layer.interactive.map(({ userData }) => userData.annotation.id)).toEqual([
  "group-milky-way", "group-andromeda", "group-triangulum", "group-lmc", "group-smc", "group-m32"
]);
expect(layer.root.getObjectByName("local-group-galaxy-field")).toBeUndefined();
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: current procedural point/shader objects violate the photo contracts and Local Group has zero interactive markers.

- [ ] **Step 3: Implement the Milky Way photo layer**

Create one `milky-way-photo` plane at depth `-80`, width `390`, aspect `16/9`, opacity `1`, render order `2`. Keep the four current Milky Way annotation markers and remap them to the photo's visible center/arms without changing annotation data. Use `resolveParallax` with factor `0.18`; reduced motion returns zero movement.

- [ ] **Step 4: Implement the Local Group photo and six marker anchors**

Create one `local-group-photo` plane at depth `-138`, width `780`, aspect `16/9`, opacity `1`, render order `2`. Build exactly one marker per supplied annotation, preserving annotation metadata and making markers interactive. Use the existing annotation positions, which match the generated normalized anchors, and parallax factor `0.12`.

- [ ] **Step 5: Integrate annotations and texture arguments in main**

```js
const { galaxy: rawGalaxyAnnotationSources, localGroup: rawLocalGroupAnnotationSources } = ANNOTATIONS;
const galaxyAnnotationSources = rawGalaxyAnnotationSources.map(withBaseAsset);
const localGroupAnnotationSources = rawLocalGroupAnnotationSources.map(withBaseAsset);
```

Pass `texture`, `annotations`, and `createMarker` into both factories; append both returned interactive collections to the label target flow.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js src/data/cosmos.test.js`

Expected: PASS; exactly six Local Group markers and no procedural galaxy field.

```powershell
git add src/scene/layers/milky-way.js src/scene/layers/local-group.js src/scene/layers/deep-space-layers.test.js src/main.js
git commit -m "feat: render photographic galaxy stages"
```

### Task 5: Replace the Cosmic Web graph with an oversized photographic field

**Files:**
- Modify: `src/scene/layers/cosmic-web.js`
- Delete: `src/scene/layers/cosmic-tissue.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`

**Interfaces:**
- `createCosmicWebLayer({ THREE, texture, quality, reducedMotion })`.
- Returns `{ root, interactive: [], setPresence, updateParallax, dispose }`; graph metadata is intentionally removed.

- [ ] **Step 1: Write the failing photographic Cosmic Web test**

```js
const layer = createCosmicWebLayer({ THREE, texture, quality: { tier: "high" }, reducedMotion: false });
const primary = layer.root.getObjectByName("cosmic-web-photo-primary");
expect(primary.material.map).toBe(texture);
expect(primary.geometry.parameters.width).toBeGreaterThanOrEqual(1700);
expect(layer.root.getObjectByName("cosmic-web-filaments")).toBeUndefined();
expect(layer.root.getObjectByName("cosmic-web-tissue")).toBeUndefined();
expect(layer.interactive).toEqual([]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: current graph, line segments, particles and tissue are still present.

- [ ] **Step 3: Implement two subtle photographic depth planes**

Primary: depth `-235`, width `1760`, aspect `16/9`, opacity `0.98`, parallax factor `0.12`. Secondary: depth `-300`, width `1880`, aspect `16/9`, opacity `0.16`, scale/rotation offset small enough to avoid obvious duplication, parallax factor `0.05`. Both use the same store-owned texture and NormalBlending; no procedural graph objects remain.

- [ ] **Step 4: Remove dead tissue code and update disposal tests**

Delete `cosmic-tissue.js`; remove its branch-specific tests and replace them with idempotent disposal plus texture-nonownership assertions for both photo planes.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js src/scene/layers/photographic-plane.test.js`

Expected: PASS.

```powershell
git add src/scene/layers/cosmic-web.js src/scene/layers/cosmic-tissue.js src/scene/layers/deep-space-layers.test.js
git commit -m "feat: render oversized photographic cosmic web"
```

### Task 6: Load photos safely and make finale stars circular

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `src/ui/create-shell.test.js`

**Interfaces:**
- Consumes: `selectDeepSpaceTextureRoutes(quality)` and `textureStore.load`.
- Preserves: texture-store reference counting; layers never dispose store-owned textures.

- [ ] **Step 1: Write the failing integration contracts**

Assert the shell still includes `.personal-stars`, and add a CSS contract that reads `src/styles.css` and requires the `.personal-stars span` rule to contain `border-radius: 50%`, a `radial-gradient`, and no `image-rendering: pixelated`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/ui/create-shell.test.js`

Expected: circular-star CSS contract fails.

- [ ] **Step 3: Load all three selected photo resources in main**

```js
const deepSpaceRoutes = selectDeepSpaceTextureRoutes(quality);
const [milkyWayPhotoResource, localGroupPhotoResource, cosmicWebPhotoResource] = await Promise.all([
  textureStore.load(publicAsset(deepSpaceRoutes.milkyWay), 0x02040a),
  textureStore.load(publicAsset(deepSpaceRoutes.localGroup), 0x02040a),
  textureStore.load(publicAsset(deepSpaceRoutes.cosmicWeb), 0x080313)
]);
```

Set each texture's anisotropy to `maxAnisotropy`, pass textures to their layers, and call each resource's `release()` exactly once from `disposeExperience`.

- [ ] **Step 4: Replace square star styling**

```css
.personal-stars span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 22%, #dff4ff 36%, rgb(125 211 252 / 0.45) 62%, transparent 74%);
  box-shadow: 0 0 8px rgb(255 255 255 / 0.9), 0 0 24px rgb(130 215 255 / 0.65);
}
```

Keep the existing circular flash pseudo-element and animation, removing only `image-rendering: pixelated`.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm.cmd test -- src/ui/create-shell.test.js src/scene/deep-space-assets.test.js src/scene/layers/deep-space-layers.test.js`

Expected: PASS.

```powershell
git add src/main.js src/styles.css src/ui/create-shell.test.js
git commit -m "fix: load sharp photo layers and round finale stars"
```

### Task 7: Full visual, progression and release verification

**Files:**
- Modify: `tests/progression.e2e.spec.js`
- Modify: `docs/dev-log.md`
- Create/refresh: `.superpowers/sdd/ultra-photo-artifacts/*.png`

**Interfaces:**
- E2E continues through public controls and solves every mini-game honestly.
- Screenshot names: `solar-system.png`, `milky-way.png`, `local-group.png`, `cosmic-web.png`, `unknown-star.png`, plus `*-mobile.png`.

- [ ] **Step 1: Update E2E contracts before production screenshot capture**

Replace the old zero-label Local Group assertion with exactly six visible label IDs. Add browser evaluation that compares `canvas.width / canvas.clientWidth` and `canvas.height / canvas.clientHeight` to the selected high-tier DPR within `0.02`. Keep all progression barriers and real mini-game solves unchanged.

- [ ] **Step 2: Run unit, coverage, build and audit gates**

Run: `npm.cmd test`

Run: `npm.cmd run test:coverage`

Run: `npm.cmd run build`

Run: `npm.cmd audit --audit-level=high`

Expected: all tests pass; statements, branches, functions and lines are each at least `80%`; build passes; audit reports `0 vulnerabilities`.

- [ ] **Step 3: Run the complete production E2E suite**

Run: `npm.cmd run test:e2e`

Expected: `5/5` pass with no console/WebGL errors, no progression bypass and no horizontal overflow.

- [ ] **Step 4: Inspect desktop and mobile pixels at original resolution**

Acceptance checklist:

- Solar System is crisp rather than visibly sub-native.
- Milky Way is one complete photographic disk, not a point spiral.
- Local Group fills the frame evenly and shows exactly six annotations.
- Cosmic Web fills beyond all edges and has smooth organic filaments without angular cells.
- Placed finale star is round before the coupon covers it.
- Mobile keeps the main subject clear of the compact top-center scale rail.

- [ ] **Step 5: Record the result in Obsidian Markdown**

Append to `docs/dev-log.md` a dated section linking `[[2026-07-20-ultra-photographic-space-design]]` and `[[2026-07-20-ultra-photographic-space]]`, with a `[!success]` callout, exact test counts, coverage percentages, image dimensions, pixel-ratio evidence, screenshot embeds and residual risks.

- [ ] **Step 6: Final diff review and commit**

Run: `git diff --check`

Run: `git status --short`

Expected: only intended evidence/docs changes remain; diff check is clean.

```powershell
git add tests/progression.e2e.spec.js docs/dev-log.md .superpowers/sdd/ultra-photo-artifacts
git commit -m "docs: record ultra photographic acceptance"
```
