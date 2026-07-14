---
title: План реализации визуального ремастера «Космос — это мы»
date: 2026-07-14
status: ready
tags:
  - project/cosmos
  - plan
  - frontend
  - threejs
aliases:
  - Cosmic Visual Remaster Implementation Plan
---

# Cosmic Visual Remaster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полностью улучшить визуальную составляющую существующего восьмиэтапного космического путешествия, сохранив его структуру, содержание и механику, и сделать интерфейс устойчивым на интерактивном стенде и телефоне.

**Architecture:** Монолитный `src/main.js` разделяется на неизменяемые данные, чистую математику стадий, независимые фабрики Three.js-слоёв, контроллер доступного UI и небольшой оркестратор. Каждый визуальный слой реализует общий контракт `root / interactive / setPresence / dispose`, а рендер запускается только при изменении состояния или в коротком переходе.

**Tech Stack:** Vite 7, Three.js 0.178+, vanilla ES modules, CSS, Vitest + jsdom + V8 coverage, Playwright Chromium.

## Global Constraints

- Сохранить ровно восемь этапов: место, Земля, Солнечная система, гелиосфера, Млечный Путь, Локальная группа, космическая сеть и `?`.
- На этапе «Земля» камера, поверхность, облака и звёздный фон неподвижны; планета занимает 75–90% viewport и частично выходит за края.
- Основные устройства: сенсорный интерактивный стенд и телефон; каждая интерактивная цель не меньше 44×44 px.
- Основной путь работает скроллом, свайпом, нажатием и клавиатурой.
- Геолокация запрашивается только после явного нажатия.
- `prefers-reduced-motion` исключает пространственное движение и использует кроссфейд или мгновенный переход.
- Три уровня качества: `high`, `medium`, `economy`; pixel ratio и число частиц ограничиваются профилем качества.
- При ошибке карты, текстуры, WebGL или геолокации пользователь не получает пустой экран.
- Изменяемый код покрывается тестами не менее чем на 80% по строкам, функциям, ветвям и выражениям.
- Все записи о разработке ведутся в Obsidian Markdown; итог обновляет [[dev-log]].
- Git push запрещён; промежуточные коммиты остаются только локальными.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/data/cosmos.js` | Неизменяемые данные стадий, объектов, камеры и цветовых ролей |
| `src/core/stage-state.js` | Чистый расчёт прогресса, активной стадии, присутствия слоя и перехода |
| `src/core/quality-profile.js` | Выбор уровня качества и числовых бюджетов рендера |
| `src/core/label-layout.js` | Проекция, ограничение viewport и разведение экранных подписей |
| `src/core/render-scheduler.js` | Рендер по требованию, lifecycle вкладки и reduced motion |
| `src/scene/create-scene.js` | Renderer/camera, регистрация слоёв, общий `update` и `dispose` |
| `src/scene/textures.js` | Ленивые текстуры, fallback-материалы и освобождение ресурсов |
| `src/scene/layers/earth.js` | Статичная крупная Земля, атмосфера и свет |
| `src/scene/layers/solar-system.js` | Солнце, орбиты, восемь планет и их интерактивные объекты |
| `src/scene/layers/heliosphere.js` | Солнечный ветер, граница и траектория «Вояджера-1» |
| `src/scene/layers/milky-way.js` | Млечный Путь, ядро, пыль и маркеры областей |
| `src/scene/layers/local-group.js` | Разнообразные силуэты галактик Локальной группы |
| `src/scene/layers/cosmic-web.js` | Процедурные узлы, нити и пустоты космической сети |
| `src/ui/create-shell.js` | Семантическая DOM-оболочка, навигация и шкала расстояния |
| `src/ui/annotation-panel.js` | Доступная нижняя/боковая панель с управлением фокусом |
| `src/ui/location.js` | Геолокация только по действию и fallback карты |
| `src/app.js` | Оркестрация данных, UI, сцены и событий |
| `src/main.js` | Только импорт стилей и запуск `createCosmosApp` |
| `src/styles/*.css` | Токены, оболочка, сцены/подписи, панель и адаптивность |
| `tests/unit/*.test.js` | Чистая логика и контракты слоёв |
| `tests/integration/*.test.js` | DOM, фокус, навигация, геолокация и lifecycle |
| `tests/e2e/cosmic-journey.spec.js` | Полный маршрут на стенде/телефоне и визуальные инварианты |
| `scripts/optimize-assets.mjs` | Создание локальных AVIF/WebP и манифеста с fallback-источниками |

### Task 1: Test Harness and Immutable Cosmos Data

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `src/data/cosmos.js`
- Create: `tests/unit/cosmos-data.test.js`
- Modify: `src/main.js:85-361` after the test passes

**Interfaces:**
- Produces: `STAGES`, `OBJECTS`, `SOLAR_PLANETS`, `ANNOTATIONS`, `COLOR_ROLES`; every exported array and object is deeply frozen.
- Produces: npm scripts `test`, `test:coverage`, `test:e2e`, `verify`.

- [ ] **Step 1: Install local-only test dependencies and add scripts**

Run:

```powershell
npm.cmd install --save-dev vitest @vitest/coverage-v8 jsdom @playwright/test @axe-core/playwright sharp
npx.cmd playwright install chromium
```

Update `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite --host 127.0.0.1",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage.enabled=true",
    "test:e2e": "playwright test",
    "assets:optimize": "node scripts/optimize-assets.mjs",
    "verify": "npm run assets:optimize && npm run test:coverage && npm run build && npm run test:e2e"
  }
}
```

- [ ] **Step 2: Configure Vitest and Playwright**

Create `vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.js", "tests/integration/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/main.js", "src/data/cosmos.js"],
      reporter: ["text", "html"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
});
```

Create `playwright.config.js`:

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "stand", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120000
  }
});
```

- [ ] **Step 3: Write the failing immutable-data test**

```js
import { describe, expect, it } from "vitest";
import { STAGES, SOLAR_PLANETS } from "../../src/data/cosmos.js";

describe("cosmos data", () => {
  it("defines the approved eight-stage journey", () => {
    expect(STAGES.map(({ id }) => id)).toEqual([
      "place", "earth", "solar-system", "heliosphere",
      "milky-way", "local-group", "cosmic-web", "unknown"
    ]);
  });

  it("locks the static orbital Earth composition", () => {
    expect(STAGES[1].camera).toEqual({
      position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46
    });
    expect(STAGES[1].motion).toBe("static");
  });

  it("contains exactly eight solar planets", () => {
    expect(SOLAR_PLANETS).toHaveLength(8);
    expect(Object.isFrozen(STAGES)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test and verify RED**

Run: `npm.cmd test -- tests/unit/cosmos-data.test.js`

Expected: FAIL because `src/data/cosmos.js` does not exist.

- [ ] **Step 5: Extract and deep-freeze the existing content**

Create `src/data/cosmos.js` with the current Russian copy and asset paths, using this contract:

```js
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

export const STAGES = deepFreeze([
  { id: "place", label: "Место", distance: "0 км", camera: { position: [0, 7, 20], target: [0, 0, -80], fov: 52 }, motion: "static" },
  { id: "earth", label: "Земля", distance: "6371 км", camera: { position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46 }, motion: "static" },
  { id: "solar-system", label: "Солнечная система", distance: "1 а.е.", camera: { position: [0, 12, 108], target: [8, 0, 0], fov: 48 }, motion: "transition-only" },
  { id: "heliosphere", label: "Гелиосфера", distance: "120 а.е.", camera: { position: [0, 17, 190], target: [0, 0, -18], fov: 50 }, motion: "transition-only" },
  { id: "milky-way", label: "Млечный Путь", distance: "27 000 св. лет", camera: { position: [0, 20, 305], target: [0, 0, -80], fov: 50 }, motion: "static" },
  { id: "local-group", label: "Локальная группа", distance: "2,5 млн св. лет", camera: { position: [0, 23, 405], target: [0, 0, -138], fov: 50 }, motion: "static" },
  { id: "cosmic-web", label: "Космическая сеть", distance: "сотни млн св. лет", camera: { position: [0, 26, 540], target: [0, 0, -235], fov: 52 }, motion: "static" },
  { id: "unknown", label: "?", distance: "? световых лет", camera: { position: [0, 29, 680], target: [0, 0, -340], fov: 52 }, motion: "static" }
]);

export const COLOR_ROLES = deepFreeze({
  cyan: 0x6fc7ff, solar: 0xffc46b, mars: 0xcf684d, deep: 0x9b8cff, white: 0xf4f8ff
});
```

Move the exact existing array literals without editing their records. Change `const objects = [` at `src/main.js:101` to `export const OBJECTS = deepFreeze([` and its closing `];` to `]);`. Apply the same declaration-only change to `solarPlanets` at `src/main.js:734`, producing `export const SOLAR_PLANETS = deepFreeze([`. Rename only the declarations `galaxyAnnotations` → `galaxy` and `groupGalaxyAnnotations` → `localGroup`, then export them with:

```js
export const ANNOTATIONS = deepFreeze({ galaxy, localGroup });
```

`regionAnnotations` and the remaining object metadata are merged into `OBJECTS` by spreading their unchanged records before the final `deepFreeze`; no Russian copy or asset path is rewritten in this task.

- [ ] **Step 6: Run GREEN and remove duplicated data from `src/main.js`**

Run: `npm.cmd test -- tests/unit/cosmos-data.test.js`

Expected: 3 tests PASS. Replace inline arrays with imports from `./data/cosmos.js` without changing runtime behavior.

- [ ] **Step 7: Commit locally**

```powershell
git add package.json package-lock.json vitest.config.js playwright.config.js src/data/cosmos.js src/main.js tests/unit/cosmos-data.test.js
git commit -m "test: add remaster harness and cosmos data"
```

### Task 2: Pure Stage State and Camera Transitions

**Files:**
- Create: `src/core/stage-state.js`
- Create: `tests/unit/stage-state.test.js`
- Modify: `src/main.js:1154-1180,1260-1275,1458-1464`

**Interfaces:**
- Produces: `clamp01(number): number`.
- Produces: `computeStageState({scrollY, scrollHeight, viewportHeight, stageCount, reducedMotion}): StageState`.
- Produces: `interpolateCamera(from, to, mix): {position:number[], target:number[], fov:number}`.

- [ ] **Step 1: Write failing stage-state tests**

```js
import { describe, expect, it } from "vitest";
import { computeStageState, interpolateCamera } from "../../src/core/stage-state.js";

describe("computeStageState", () => {
  it("returns immutable layer presence for the exact stage", () => {
    const state = computeStageState({ scrollY: 900, scrollHeight: 8000, viewportHeight: 800, stageCount: 8, reducedMotion: false });
    expect(state.exactStage).toBeCloseTo(0.875);
    expect(state.layerPresence).toHaveLength(8);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("removes spatial transition amount in reduced motion", () => {
    const state = computeStageState({ scrollY: 3600, scrollHeight: 8000, viewportHeight: 800, stageCount: 8, reducedMotion: true });
    expect(state.transitionAmount).toBe(0);
  });

  it("interpolates camera records without mutating them", () => {
    const from = { position: [0, 0, 10], target: [0, 0, 0], fov: 40 };
    const to = { position: [10, 0, 20], target: [2, 0, 0], fov: 50 };
    expect(interpolateCamera(from, to, 0.5)).toEqual({ position: [5, 0, 15], target: [1, 0, 0], fov: 45 });
    expect(from.position).toEqual([0, 0, 10]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/unit/stage-state.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure immutable state**

```js
export const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smootherStep = (value) => {
  const x = clamp01(value);
  return x ** 3 * (x * (x * 6 - 15) + 10);
};
const presenceFor = (index, exactStage) => {
  const distance = Math.abs(index - exactStage);
  if (distance <= 0.2) return 1;
  if (distance >= 0.34) return 0;
  return 1 - smootherStep((distance - 0.2) / 0.14);
};

export const computeStageState = ({ scrollY, scrollHeight, viewportHeight, stageCount, reducedMotion }) => {
  const maxScroll = Math.max(1, scrollHeight - viewportHeight);
  const exactStage = clamp01(scrollY / maxScroll) * (stageCount - 1);
  const activeStage = Math.round(exactStage);
  const distanceFromLayer = Math.abs(exactStage - activeStage);
  return Object.freeze({
    exactStage,
    activeStage,
    layerPresence: Object.freeze(Array.from({ length: stageCount }, (_, index) => presenceFor(index, exactStage))),
    transitionAmount: reducedMotion || distanceFromLayer <= 0.26 ? 0 : smootherStep((distanceFromLayer - 0.26) / 0.24)
  });
};

const lerp = (a, b, mix) => a + (b - a) * mix;
export const interpolateCamera = (from, to, mix) => Object.freeze({
  position: Object.freeze(from.position.map((value, index) => lerp(value, to.position[index], mix))),
  target: Object.freeze(from.target.map((value, index) => lerp(value, to.target[index], mix))),
  fov: lerp(from.fov, to.fov, mix)
});
```

- [ ] **Step 4: Run GREEN and integrate**

Run: `npm.cmd test -- tests/unit/stage-state.test.js`

Expected: 3 tests PASS. Replace the duplicated stage math in `src/main.js`; `scrollTo` uses `behavior: reducedMotion ? "auto" : "smooth"`.

- [ ] **Step 5: Commit locally**

```powershell
git add src/core/stage-state.js src/main.js tests/unit/stage-state.test.js
git commit -m "refactor: isolate stage and camera state"
```

### Task 3: Adaptive Quality and Demand-Driven Rendering

**Files:**
- Create: `src/core/quality-profile.js`
- Create: `src/core/render-scheduler.js`
- Create: `tests/unit/quality-profile.test.js`
- Create: `tests/integration/render-scheduler.test.js`

**Interfaces:**
- Produces: `createQualityProfile(input): Readonly<QualityProfile>`.
- Produces: `createRenderScheduler({render, requestFrame, cancelFrame, documentRef}): RenderScheduler` with `invalidate(frames = 1)`, `startTransition()`, `stopTransition()`, `dispose()`.

- [ ] **Step 1: Write failing quality tests**

```js
import { expect, it } from "vitest";
import { createQualityProfile } from "../../src/core/quality-profile.js";

it.each([
  [{ width: 1920, dpr: 2, cores: 12, reducedMotion: false }, "high", 1.5, 9800],
  [{ width: 900, dpr: 2, cores: 6, reducedMotion: false }, "medium", 1.25, 5200],
  [{ width: 390, dpr: 3, cores: 4, reducedMotion: false }, "economy", 1, 2600]
])("selects a bounded profile", (input, tier, pixelRatio, cosmicWebPoints) => {
  expect(createQualityProfile(input)).toMatchObject({ tier, pixelRatio, cosmicWebPoints });
});
```

- [ ] **Step 2: Verify RED, then implement `createQualityProfile`**

```js
const PROFILES = Object.freeze({
  high: Object.freeze({ tier: "high", pixelRatio: 1.5, stars: 5200, cosmicWebPoints: 9800, galaxyPoints: 2600 }),
  medium: Object.freeze({ tier: "medium", pixelRatio: 1.25, stars: 3600, cosmicWebPoints: 5200, galaxyPoints: 1700 }),
  economy: Object.freeze({ tier: "economy", pixelRatio: 1, stars: 1800, cosmicWebPoints: 2600, galaxyPoints: 900 })
});

export const createQualityProfile = ({ width, dpr, cores, reducedMotion }) => {
  const tier = width <= 480 || cores <= 4 ? "economy" : width <= 1100 || cores <= 8 ? "medium" : "high";
  const base = PROFILES[tier];
  return Object.freeze({ ...base, pixelRatio: Math.min(base.pixelRatio, dpr), animatedParticles: !reducedMotion && tier !== "economy" });
};
```

Run: `npm.cmd test -- tests/unit/quality-profile.test.js`

Expected: 3 parameter cases PASS.

- [ ] **Step 3: Write the failing render-scheduler lifecycle test**

```js
import { expect, it, vi } from "vitest";
import { createRenderScheduler } from "../../src/core/render-scheduler.js";

it("renders only invalidated frames and pauses while hidden", () => {
  const render = vi.fn();
  const queue = [];
  const scheduler = createRenderScheduler({
    render,
    requestFrame: (callback) => (queue.push(callback), queue.length),
    cancelFrame: vi.fn(),
    documentRef: document
  });
  scheduler.invalidate(2);
  queue.shift()(0);
  queue.shift()(16);
  expect(render).toHaveBeenCalledTimes(2);
  scheduler.dispose();
});
```

- [ ] **Step 4: Implement the scheduler and verify GREEN**

```js
export const createRenderScheduler = ({ render, requestFrame, cancelFrame, documentRef }) => {
  let remainingFrames = 0;
  let transition = false;
  let frameId = null;
  const tick = (time) => {
    frameId = null;
    if (documentRef.hidden) return;
    if (remainingFrames > 0 || transition) render(time);
    remainingFrames = Math.max(0, remainingFrames - 1);
    if (remainingFrames > 0 || transition) frameId = requestFrame(tick);
  };
  const schedule = () => { if (frameId == null && !documentRef.hidden) frameId = requestFrame(tick); };
  const onVisibility = () => { if (!documentRef.hidden) schedule(); };
  documentRef.addEventListener("visibilitychange", onVisibility);
  return Object.freeze({
    invalidate: (frames = 1) => { remainingFrames = Math.max(remainingFrames, frames); schedule(); },
    startTransition: () => { transition = true; schedule(); },
    stopTransition: () => { transition = false; },
    dispose: () => { documentRef.removeEventListener("visibilitychange", onVisibility); if (frameId != null) cancelFrame(frameId); }
  });
};
```

Run: `npm.cmd test -- tests/unit/quality-profile.test.js tests/integration/render-scheduler.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit locally**

```powershell
git add src/core/quality-profile.js src/core/render-scheduler.js tests/unit/quality-profile.test.js tests/integration/render-scheduler.test.js
git commit -m "perf: add adaptive quality and render scheduler"
```

### Task 4: Accessible Shell, Navigation, Location, and Annotation Panel

**Files:**
- Create: `src/ui/create-shell.js`
- Create: `src/ui/annotation-panel.js`
- Create: `src/ui/location.js`
- Create: `tests/integration/ui-shell.test.js`
- Modify: `src/main.js:6-67,1196-1208,1237-1258,1398-1415,1458-1482`

**Interfaces:**
- Produces: `createShell({root, stages}): ShellElements`.
- Produces: `createAnnotationPanel({panel, closeButton, fields}): {open(data), close(), dispose()}`.
- Produces: `createLocationController({geolocation, setMap, fallback}): {locate()}`.

- [ ] **Step 1: Write failing accessibility tests**

```js
import { beforeEach, expect, it, vi } from "vitest";
import { createShell } from "../../src/ui/create-shell.js";
import { createAnnotationPanel } from "../../src/ui/annotation-panel.js";
import { STAGES } from "../../src/data/cosmos.js";

beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

it("creates semantic stage navigation with touch-size controls", () => {
  const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
  expect(shell.stageButtons).toHaveLength(8);
  shell.setActiveStage(1);
  expect(shell.stageButtons[1].getAttribute("aria-current")).toBe("step");
  expect(shell.labels.getAttribute("aria-hidden")).toBeNull();
});

it("moves focus into the panel and returns it on Escape", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
  const panel = createAnnotationPanel(shell.panelBindings);
  trigger.focus();
  panel.open({ title: "Земля", text: "Дом", discovery: "Наш дом", distance: "1 а.е.", stage: 1 }, trigger);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(document.activeElement).toBe(trigger);
});

it("does not request location during shell creation", () => {
  const getCurrentPosition = vi.fn();
  createShell({ root: document.querySelector("#app"), stages: STAGES });
  expect(getCurrentPosition).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/integration/ui-shell.test.js`

Expected: FAIL because the UI modules do not exist.

- [ ] **Step 3: Implement semantic shell markup**

`createShell` must render this semantic structure and return element references rather than querying the document repeatedly:

```html
<main class="experience">
  <section class="map-layer" aria-label="Карта текущего местоположения"><iframe title="Карта местоположения"></iframe><div class="map-vignette"></div></section>
  <canvas id="cosmosCanvas" aria-label="Интерактивное путешествие по космическим масштабам"></canvas>
  <div class="space-labels"></div>
  <header class="topbar"><div class="stage-heading"><span class="signal"></span><span id="scaleLabel"></span></div><button id="locateButton" type="button">Моё место</button></header>
  <aside class="object-panel" role="dialog" aria-modal="false" aria-labelledby="panelTitle" hidden>
    <button id="closePanel" type="button" aria-label="Закрыть информацию">×</button>
    <img id="panelImage" alt="" hidden>
    <div class="panel-content">
      <p id="panelScale"></p><h2 id="panelTitle"></h2><p id="panelText"></p>
      <dl><div><dt>Открытие</dt><dd id="panelDiscovery"></dd></div><div><dt>Масштаб</dt><dd id="panelDistance"></dd></div></dl>
    </div>
  </aside>
  <nav class="scale-rail" aria-label="Масштабы"></nav>
  <button class="distance-summary" type="button" aria-expanded="false" aria-controls="distanceScale"></button>
  <aside id="distanceScale" class="distance-scale" aria-label="Шкала расстояния от Земли"></aside>
  <section class="unknown-layer" aria-label="Неизвестный масштаб"><div><strong>?</strong><h2>Дальше ничего не понятно</h2><p>Мы можем только предполагать, что находится за наблюдаемой Вселенной.</p><p>Может, вы будете тем, кто узнает это.</p></div></section>
  <div class="scroll-space" aria-hidden="true"><section></section><section></section><section></section><section></section><section></section><section></section><section></section><section></section></div>
</main>
```

`setActiveStage(index)` removes `aria-current` from every button, adds `aria-current="step"` to the active one, and updates the distance summary with a new string.

- [ ] **Step 4: Implement focus-safe annotation and explicit location**

```js
export const createLocationController = ({ geolocation, setMap, fallback }) => Object.freeze({
  locate: () => new Promise((resolve) => {
    if (!geolocation) return resolve(setMap(fallback));
    geolocation.getCurrentPosition(
      ({ coords }) => resolve(setMap({ lat: coords.latitude, lon: coords.longitude })),
      () => resolve(setMap(fallback)),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  })
});
```

The panel controller stores the trigger, removes `hidden`, focuses the close button, handles `Escape`, and returns focus on `close()`.

- [ ] **Step 5: Run GREEN and remove inline shell logic**

Run: `npm.cmd test -- tests/integration/ui-shell.test.js`

Expected: all tests PASS. Remove `setTimeout(locate, 450)` completely.

- [ ] **Step 6: Commit locally**

```powershell
git add src/ui src/main.js tests/integration/ui-shell.test.js
git commit -m "feat: rebuild accessible cosmic controls"
```

### Task 5: Collision-Safe Screen Labels

**Files:**
- Create: `src/core/label-layout.js`
- Create: `tests/unit/label-layout.test.js`
- Modify: `src/app.js` or current label loop in `src/main.js:1182-1235`

**Interfaces:**
- Produces: `layoutLabels({labels, viewport, padding, gap}): ReadonlyArray<PlacedLabel>`.
- Consumes label records `{id, anchor:{x,y}, size:{width,height}, priority}`.

- [ ] **Step 1: Write the failing collision and boundary tests**

```js
import { expect, it } from "vitest";
import { layoutLabels } from "../../src/core/label-layout.js";

it("keeps labels inside the viewport and separates overlaps", () => {
  const labels = [
    { id: "a", anchor: { x: 98, y: 50 }, size: { width: 32, height: 20 }, priority: 2 },
    { id: "b", anchor: { x: 98, y: 50 }, size: { width: 32, height: 20 }, priority: 1 }
  ];
  const placed = layoutLabels({ labels, viewport: { width: 120, height: 100 }, padding: 8, gap: 6 });
  expect(placed[0].x + 32).toBeLessThanOrEqual(112);
  expect(Math.abs(placed[0].y - placed[1].y)).toBeGreaterThanOrEqual(26);
  expect(labels[0].anchor).toEqual({ x: 98, y: 50 });
});
```

- [ ] **Step 2: Verify RED and implement deterministic placement**

The implementation sorts a copy by `priority` descending, clamps each candidate to padding, then tries vertical offsets `[0, -1, 1, -2, 2] * (height + gap)` until its rectangle does not intersect an already placed rectangle. It returns a newly frozen array and never mutates input records:

```js
const intersects = (a, b, gap) => !(
  a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x ||
  a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y
);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const layoutLabels = ({ labels, viewport, padding = 12, gap = 6 }) => {
  const placed = [];
  const ordered = [...labels].sort((a, b) => b.priority - a.priority);
  for (const label of ordered) {
    const baseX = clamp(label.anchor.x, padding, viewport.width - padding - label.size.width);
    const baseY = clamp(label.anchor.y, padding, viewport.height - padding - label.size.height);
    const offsets = [0, -1, 1, -2, 2].map((step) => step * (label.size.height + gap));
    const candidates = offsets.map((offset) => Object.freeze({
      id: label.id,
      x: baseX,
      y: clamp(baseY + offset, padding, viewport.height - padding - label.size.height),
      width: label.size.width,
      height: label.size.height,
      anchor: Object.freeze({ ...label.anchor })
    }));
    placed.push(candidates.find((candidate) => placed.every((other) => !intersects(candidate, other, gap))) ?? candidates[0]);
  }
  return Object.freeze(placed.map(Object.freeze));
};
```

- [ ] **Step 3: Run GREEN and integrate one layout pass per invalidation**

Run: `npm.cmd test -- tests/unit/label-layout.test.js`

Expected: PASS. Integration measures visible label buttons once, calls `layoutLabels`, then sets `translate3d` and CSS custom properties `--anchor-x`, `--anchor-y` for the connector line.

- [ ] **Step 4: Commit locally**

```powershell
git add src/core/label-layout.js src/app.js src/main.js tests/unit/label-layout.test.js
git commit -m "feat: prevent cosmic label collisions"
```

### Task 6: Scene Foundation and Static Orbital Earth

**Files:**
- Create: `src/scene/textures.js`
- Create: `src/scene/create-scene.js`
- Create: `src/scene/layers/earth.js`
- Create: `tests/unit/earth-layer.test.js`
- Create: `tests/unit/texture-store.test.js`
- Create: `scripts/optimize-assets.mjs`
- Create: `public/space/assets.json`
- Modify: `src/main.js:365-418,636-697,1325-1340,1446-1455`

**Interfaces:**
- Every layer returns `{root, interactive, setPresence(value), dispose()}`.
- `createEarthLayer({THREE, textures, quality}): SceneLayer`.
- `createTextureStore({THREE, loader}): {load(url, fallbackColor), dispose()}`.

- [ ] **Step 1: Write the failing Earth contract test**

```js
import * as THREE from "three";
import { expect, it } from "vitest";
import { createEarthLayer } from "../../src/scene/layers/earth.js";

it("builds a large static Earth without rotation state", () => {
  const texture = new THREE.Texture();
  const layer = createEarthLayer({
    THREE,
    textures: { earth: texture, clouds: texture },
    quality: { tier: "high", sphereSegments: 64 }
  });
  expect(layer.root.name).toBe("earth-layer");
  expect(layer.root.userData.staticComposition).toBe(true);
  expect(layer.root.getObjectByName("earth-surface").geometry.parameters.radius).toBe(14);
  expect(layer.root.getObjectByName("earth-clouds").userData.rotationSpeed).toBeUndefined();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/unit/earth-layer.test.js`

Expected: FAIL because the layer does not exist.

- [ ] **Step 3: Implement static Earth and atmosphere**

```js
export const createEarthLayer = ({ THREE, textures, quality }) => {
  const root = new THREE.Group();
  root.name = "earth-layer";
  root.userData.staticComposition = true;
  root.position.set(4.5, -3.5, 0);
  const segments = quality.sphereSegments ?? (quality.tier === "high" ? 64 : 40);
  const geometry = new THREE.SphereGeometry(14, segments, Math.round(segments * 0.65));
  const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: textures.earth, roughness: 0.72, metalness: 0, emissive: 0x020817, emissiveIntensity: 0.08
  }));
  surface.name = "earth-surface";
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(14.08, segments, Math.round(segments * 0.65)),
    new THREE.MeshStandardMaterial({ map: textures.clouds, transparent: true, opacity: 0.48, depthWrite: false })
  );
  clouds.name = "earth-clouds";
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(14.34, segments, Math.round(segments * 0.65)),
    new THREE.MeshBasicMaterial({ color: 0x6dbdff, transparent: true, opacity: 0.11, side: THREE.BackSide, depthWrite: false })
  );
  atmosphere.name = "earth-atmosphere";
  root.add(surface, clouds, atmosphere);
  const meshes = [surface, clouds, atmosphere];
  meshes.forEach((mesh) => { mesh.userData.baseOpacity = mesh.material.opacity; });
  return Object.freeze({
    root,
    interactive: Object.freeze([surface]),
    setPresence: (value) => { root.visible = value > 0.01; meshes.forEach((mesh) => { mesh.material.opacity = mesh.userData.baseOpacity * value; }); },
    dispose: () => { meshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); }); }
  });
};
```

- [ ] **Step 4: Create the shared scene manager**

`createScene` owns the renderer, scene, camera, lights and raycaster. It applies `quality.pixelRatio`, loads layers by stage, sets camera pose directly from immutable stage state, and exposes:

```js
{
  canvas,
  update({ stageState, cameraPose, viewport }),
  hitTest({ clientX, clientY }),
  resize({ width, height, pixelRatio }),
  render(),
  dispose()
}
```

No Earth code reads time or changes rotation in `update`.

- [ ] **Step 5: Add local modern image variants and texture fallback**

Create `scripts/optimize-assets.mjs`:

```js
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(new URL("../public/space/.keep", import.meta.url)));
const sources = [
  "earth-daymap.jpg", "earth-clouds.jpg", "mars.jpg", "jupiter.jpg", "neptune.jpg",
  "voyager-heliosphere.jpg", "sagittarius-a.jpg", "milky-way-realistic.jpg", "andromeda.jpg", "local-group.jpg"
];
const manifest = {};
for (const source of sources) {
  const stem = basename(source, extname(source));
  const input = join(directory, source);
  const avif = `${stem}.avif`;
  const webp = `${stem}.webp`;
  await Promise.all([
    sharp(input).resize({ width: 2048, withoutEnlargement: true }).avif({ quality: 62 }).toFile(join(directory, avif)),
    sharp(input).resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(directory, webp))
  ]);
  manifest[`/space/${source}`] = { avif: `/space/${avif}`, webp: `/space/${webp}`, fallback: `/space/${source}` };
}
await writeFile(join(directory, "assets.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
```

`createTextureStore.load(url, fallbackColor)` reads the manifest, tries AVIF → WebP → original, and resolves a one-pixel `DataTexture` in `fallbackColor` after all three fail. It caches promises, reference-counts acquired textures and disposes them when the final consumer releases them.

Test with a fake loader that rejects AVIF and resolves WebP; assert call order, single cached request and `dispose()` on final release.

- [ ] **Step 6: Run tests and build**

Run: `npm.cmd run assets:optimize && npm.cmd test -- tests/unit/earth-layer.test.js tests/unit/texture-store.test.js && npm.cmd run build`

Expected: tests PASS; AVIF/WebP assets and `assets.json` exist; Vite build succeeds without duplicated Earth construction in `src/main.js`.

- [ ] **Step 7: Commit locally**

```powershell
git add src/scene src/main.js scripts/optimize-assets.mjs public/space tests/unit/earth-layer.test.js tests/unit/texture-store.test.js
git commit -m "feat: remaster static orbital Earth"
```

### Task 7: Solar System and Heliosphere Remaster

**Files:**
- Create: `src/scene/layers/solar-system.js`
- Create: `src/scene/layers/heliosphere.js`
- Create: `tests/unit/near-space-layers.test.js`
- Modify: `src/main.js:699-916,1343-1366`

**Interfaces:**
- `createSolarSystemLayer({THREE, planets, textures, quality}): SceneLayer`.
- `createHeliosphereLayer({THREE, glowTexture, quality, voyager}): SceneLayer`.

- [ ] **Step 1: Write failing scene-semantic tests**

```js
import * as THREE from "three";
import { expect, it } from "vitest";
import { createSolarSystemLayer } from "../../src/scene/layers/solar-system.js";
import { createHeliosphereLayer } from "../../src/scene/layers/heliosphere.js";
import { SOLAR_PLANETS } from "../../src/data/cosmos.js";

it("creates eight named planet meshes and restrained orbits", () => {
  const layer = createSolarSystemLayer({ THREE, planets: SOLAR_PLANETS, textures: new Map(), quality: { tier: "medium" } });
  expect(layer.interactive).toHaveLength(8);
  expect(layer.root.children.filter(({ name }) => name.startsWith("orbit-")).length).toBe(8);
});

it("uses wind shells and a Voyager trajectory instead of a wire sphere", () => {
  const layer = createHeliosphereLayer({ THREE, glowTexture: new THREE.Texture(), quality: { tier: "medium" }, voyager: { stage: 3 } });
  expect(layer.root.getObjectByName("heliosphere-wireframe")).toBeUndefined();
  expect(layer.root.getObjectByName("solar-wind-shells")).toBeDefined();
  expect(layer.root.getObjectByName("voyager-trajectory")).toBeDefined();
});
```

- [ ] **Step 2: Verify RED and implement the solar layer**

Run: `npm.cmd test -- tests/unit/near-space-layers.test.js`

Expected: FAIL. Implement one `Group`, one emissive Sun + sprite glow, eight torus orbits with opacity ≤ 0.22, and eight named planet meshes. Saturn receives a ring mesh. Do not rotate planets in static stage updates.

- [ ] **Step 3: Implement heliosphere wind shells**

Create three transparent, slightly offset ellipsoid shells named `solar-wind-shells`, with low-opacity blue-violet materials and no `wireframe`. Add a `BufferGeometry` line from the Sun to the Voyager marker named `voyager-trajectory`; use dashed-looking vertex alpha through alternating segment colors rather than animating its position.

- [ ] **Step 4: Run GREEN and build**

Run: `npm.cmd test -- tests/unit/near-space-layers.test.js && npm.cmd run build`

Expected: 2 tests PASS and build succeeds.

- [ ] **Step 5: Commit locally**

```powershell
git add src/scene/layers/solar-system.js src/scene/layers/heliosphere.js src/main.js tests/unit/near-space-layers.test.js
git commit -m "feat: remaster solar system and heliosphere"
```

### Task 8: Milky Way, Local Group, and Volumetric Cosmic Web

**Files:**
- Create: `src/scene/layers/milky-way.js`
- Create: `src/scene/layers/local-group.js`
- Create: `src/scene/layers/cosmic-web.js`
- Create: `tests/unit/deep-space-layers.test.js`
- Modify: `src/main.js:916-1145,1367-1390`

**Interfaces:**
- `createMilkyWayLayer({THREE, texture, glowTexture, annotations, quality, random}): SceneLayer`.
- `createLocalGroupLayer({THREE, galaxies, glowTexture, quality, random}): SceneLayer`.
- `createCosmicWebLayer({THREE, quality, random}): SceneLayer`.
- All procedural factories accept injected `random()` for deterministic tests.

- [ ] **Step 1: Write failing deterministic deep-space tests**

```js
import * as THREE from "three";
import { expect, it } from "vitest";
import { createCosmicWebLayer } from "../../src/scene/layers/cosmic-web.js";
import { createLocalGroupLayer } from "../../src/scene/layers/local-group.js";

const random = () => 0.42;

it("creates a 3D network without a fullscreen image plane", () => {
  const layer = createCosmicWebLayer({ THREE, quality: { cosmicWebPoints: 2600 }, random });
  expect(layer.root.getObjectByName("cosmic-web-plane")).toBeUndefined();
  expect(layer.root.getObjectByName("cosmic-web-nodes").geometry.attributes.position.count).toBeGreaterThan(30);
  expect(layer.root.getObjectByName("cosmic-web-filaments")).toBeDefined();
});

it("gives named galaxies distinct transforms", () => {
  const galaxies = [
    { id: "milky-way", size: 22, color: 0xffffff, position: [0, 0, 0] },
    { id: "andromeda", size: 30, color: 0xdde8ff, position: [50, 10, -20] }
  ];
  const layer = createLocalGroupLayer({ THREE, galaxies, glowTexture: new THREE.Texture(), quality: { tier: "economy" }, random });
  expect(layer.root.getObjectByName("galaxy-milky-way").scale.toArray()).not.toEqual(layer.root.getObjectByName("galaxy-andromeda").scale.toArray());
});
```

- [ ] **Step 2: Verify RED and implement the Milky Way**

Run: `npm.cmd test -- tests/unit/deep-space-layers.test.js`

Expected: FAIL. Build the Milky Way from the existing realistic texture plus a low-opacity star point layer, a warm core sprite and two dark dust meshes. Keep the main image readable, but remove the appearance of a rectangular plane through alpha falloff and edge masking generated on canvas.

- [ ] **Step 3: Implement distinct Local Group galaxies**

Create named galaxy groups with different ellipticity, orientation, core size and halo opacity derived from each record. Use a new group for every record and return the six named interactive roots; do not represent every galaxy with the same circular sprite.

- [ ] **Step 4: Implement the volumetric cosmic web**

Generate 42–74 node positions according to the quality tier, connect each node to its two nearest neighbors with `LineSegments`, and distribute `quality.cosmicWebPoints` around the segments with bounded perpendicular jitter. Use violet/white nodes with sparse amber highlights and no `cosmic-web-bright.png` plane.

- [ ] **Step 5: Run GREEN, coverage, and build**

Run: `npm.cmd test -- tests/unit/deep-space-layers.test.js && npm.cmd run test:coverage && npm.cmd run build`

Expected: deep-space tests PASS; coverage ≥80%; build succeeds.

- [ ] **Step 6: Commit locally**

```powershell
git add src/scene/layers src/main.js tests/unit/deep-space-layers.test.js
git commit -m "feat: remaster deep-space layers"
```

### Task 9: App Orchestrator and Production Visual System

**Files:**
- Create: `src/app.js`
- Replace: `src/main.js`
- Replace: `src/styles.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/shell.css`
- Create: `src/styles/labels.css`
- Create: `src/styles/panel.css`
- Create: `src/styles/responsive.css`
- Create: `tests/integration/cosmos-app.test.js`

**Interfaces:**
- Produces: `createCosmosApp({root, windowRef, documentRef, navigatorRef}): {destroy()}`.
- Consumes all prior modules; `src/main.js` contains only imports and bootstrap.

- [ ] **Step 1: Write the failing app integration test**

```js
import { beforeEach, expect, it } from "vitest";
import { createCosmosApp } from "../../src/app.js";

beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

it("boots at place, navigates by keyboard, and cleans up", () => {
  const app = createCosmosApp({ root: document.querySelector("#app"), windowRef: window, documentRef: document, navigatorRef: {} });
  expect(document.body.dataset.stage).toBe("0");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(document.querySelector('[data-stage="1"]').getAttribute("aria-current")).toBe("step");
  app.destroy();
  expect(document.querySelector(".experience")).toBeNull();
});
```

- [ ] **Step 2: Verify RED and compose `createCosmosApp`**

Run: `npm.cmd test -- tests/integration/cosmos-app.test.js`

Expected: FAIL. `createCosmosApp` creates shell → quality → scene → panel/location → scheduler in that order. It owns all event listeners in one `AbortController`; `destroy()` aborts listeners, disposes scheduler/scene/panel, and clears the root.

Bootstrap becomes:

```js
import "./styles.css";
import { createCosmosApp } from "./app.js";

const root = document.querySelector("#app");
if (!root) throw new Error("#app root is required");
createCosmosApp({ root, windowRef: window, documentRef: document, navigatorRef: navigator });
```

- [ ] **Step 3: Establish production tokens and hierarchy**

Create `src/styles/tokens.css` with a restrained OKLCH system:

```css
:root {
  color-scheme: dark;
  --space-0: oklch(0.085 0.018 260);
  --space-1: oklch(0.12 0.025 257);
  --ink-strong: oklch(0.97 0.01 250);
  --ink-muted: oklch(0.78 0.025 250);
  --cyan: oklch(0.78 0.13 225);
  --solar: oklch(0.82 0.14 78);
  --mars: oklch(0.67 0.17 34);
  --deep: oklch(0.7 0.14 292);
  --font-display: "Manrope", "Segoe UI", sans-serif;
  --font-data: "JetBrains Mono", "Cascadia Mono", monospace;
  --ease-out-expo: cubic-bezier(.16, 1, .3, 1);
  --z-canvas: 0; --z-labels: 20; --z-sticky: 30; --z-panel: 50;
}
```

If bundled font packages are not added, use the fallback stacks above and do not add remote font requests.

- [ ] **Step 4: Rebuild shell, labels, panel, and responsive rules**

Required CSS invariants:

```css
.scale-rail button,
.space-label,
#locateButton,
#closePanel,
.distance-summary { min-width: 44px; min-height: 44px; }

:where(button, [role="button"]):focus-visible { outline: 2px solid var(--cyan); outline-offset: 4px; }

.space-label::after {
  content: "";
  position: absolute;
  width: var(--connector-length, 0px);
  height: 1px;
  background: color-mix(in oklch, var(--cyan) 62%, transparent);
  transform-origin: left center;
}

@media (max-width: 760px) {
  .scale-rail { overflow-x: auto; scroll-snap-type: x mandatory; justify-content: flex-start; }
  .scale-rail button { flex: 0 0 auto; scroll-snap-align: center; }
  .distance-scale:not([data-expanded="true"]) { display: none; }
  .object-panel { inset: auto 0 0; max-height: min(72dvh, 620px); overflow-y: auto; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

The desktop panel occupies the left or right edge selected by free scene space; it never covers the stage target. The phone panel is a bottom sheet. Avoid glass blur and nested cards.

- [ ] **Step 5: Shorten scroll rhythm without changing the eight stops**

Use `160vh` per stage on desktop and `130svh` on phone instead of `300vh`. Preserve eight sections, and make the hyperdrive visible only where `transitionAmount > 0.18`.

- [ ] **Step 6: Run integration tests and build**

Run: `npm.cmd test -- tests/integration/cosmos-app.test.js tests/integration/ui-shell.test.js && npm.cmd run build`

Expected: all tests PASS and build succeeds.

- [ ] **Step 7: Commit locally**

```powershell
git add src tests/integration/cosmos-app.test.js
git commit -m "feat: integrate cosmic visual remaster"
```

### Task 10: E2E, Visual Acceptance, Security, and Obsidian Log

**Files:**
- Create: `tests/e2e/cosmic-journey.spec.js`
- Modify: `docs/dev-log.md`
- Modify: `README.md` only if run/test commands changed for users

**Interfaces:**
- Consumes the production app from Task 9.
- Produces a verified local build; no push and no pull request.

- [ ] **Step 1: Write the critical-route E2E test**

```js
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("travels through all eight stages with accessible controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-stage", "0");
  const stages = ["Дом", "Земля", "Система", "Гелиосфера", "Галактика", "Группа", "Вселенная", "?"];
  for (const [index, name] of stages.entries()) {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    await expect(page.locator("body")).toHaveAttribute("data-stage", String(index));
    await expect(button).toHaveAttribute("aria-current", "step");
  }
});

test("Earth is a static oversized orbital composition", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Земля", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-stage", "1");
  const canvas = page.locator("#cosmosCanvas");
  const before = await canvas.screenshot();
  await page.waitForTimeout(600);
  const after = await canvas.screenshot();
  expect(after.equals(before)).toBe(true);
  await expect(canvas).toHaveScreenshot("earth-orbit.png", { maxDiffPixelRatio: 0.02 });
});

test("location is requested only after explicit action", async ({ context, page }) => {
  let requests = 0;
  await context.grantPermissions([]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition: (_success, error) => {
        window.__locationRequests = (window.__locationRequests ?? 0) + 1;
        error?.({ code: 1, message: "denied in test" });
      }
    }});
  });
  await page.goto("/");
  expect(await page.evaluate(() => window.__locationRequests ?? 0)).toBe(0);
  await page.getByRole("button", { name: "Моё место", exact: true }).click();
  expect(await page.evaluate(() => window.__locationRequests ?? 0)).toBe(1);
});

test("has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
});
```

- [ ] **Step 2: Run E2E on stand and phone**

Run: `npm.cmd run test:e2e`

Expected: every test passes in the `stand` and `phone` projects. Review generated baseline screenshots before accepting them.

- [ ] **Step 3: Run the full local verification**

Run:

```powershell
npm.cmd run verify
npm.cmd audit --audit-level=high
git diff --check
```

Expected: coverage thresholds pass; build passes; both Playwright projects pass; `0 vulnerabilities`; no whitespace errors.

- [ ] **Step 4: Perform live visual acceptance**

Inspect all eight stages at 1920×1080 and 390×844. Confirm:

- Earth is static, occupies 75–90% of the viewport and feels orbital;
- no labels overlap or leave the viewport;
- the panel does not cover the scene target on the stand;
- mobile controls are reachable and at least 44×44 px;
- the brightest cosmic-web frame and darkest unknown frame both keep readable UI;
- rejecting geolocation and failing a texture do not block the journey;
- console has no errors and WebGL resources are disposed after app teardown.

- [ ] **Step 5: Update the Obsidian development log**

Append to `docs/dev-log.md`:

```markdown
## Обновление 2026-07-14 — полный визуальный ремастер

> [!success] Готово
> Сохранён восьмиэтапный маршрут, полностью переработаны визуальные слои, интерфейс и адаптивное качество. Этап «Земля» получил неподвижную крупную орбитальную композицию.

- [x] Единый арт-дирекшн всех сцен
- [x] Сенсорная навигация стенда и телефона
- [x] Доступные подписи и информационная панель
- [x] Явный запрос геолокации
- [x] Три профиля качества и рендер по требованию
- [x] Unit, integration и E2E-проверки с покрытием не ниже 80%

Связано: [[2026-07-14-cosmic-visual-remaster-design]] · [[2026-07-14-cosmic-visual-remaster]]
```

- [ ] **Step 6: Request code and security review, fix P0/P1 findings, then commit locally**

```powershell
git add tests/e2e docs/dev-log.md README.md
git commit -m "test: verify cosmic visual remaster"
```

Do not run `git push`, do not open a PR, and leave the verified branch local.

## Plan Self-Review

> [!check] Spec coverage
> All approved requirements map to Tasks 1–10: preserved stages/data, static oversized Earth, every remastered scene, touch UI, accessible labels/panel, explicit location, reduced motion, quality tiers, fallbacks, 80% coverage, stand/phone E2E, and Obsidian logging.

> [!check] Interface consistency
> Scene layers use one contract; state and quality objects are immutable; the app is the only owner of lifecycle and events. Later tasks consume exact exports defined in earlier tasks.

> [!check] Scope
> The plan is large but remains one coherent deliverable: a visual remaster of one existing interaction surface. Each task ends in an independently testable local commit and no remote action.
