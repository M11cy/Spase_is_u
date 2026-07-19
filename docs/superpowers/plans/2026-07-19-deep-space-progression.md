---
title: Реалистичные 3D-сцены и обязательный прогресс — план реализации
date: 2026-07-19
status: ready
tags:
  - project/cosmos
  - plan/tdd
  - design/threejs
aliases:
  - Deep Space Progression Implementation Plan
---

# Реалистичные 3D-сцены и обязательный прогресс Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Удалить «Гелиосферу», закрывать продвижение до завершения каждой из трёх мини-игр и заменить дальние плоские изображения настоящими реалистичными 3D-сценами.

**Architecture:** Порядок этапов и доступ к ним переводятся на идентификаторы и чистый модуль `stage-access`. Три дальние сцены выносятся из `main.js` в одинаковые Three.js-слои, использующие детерминированную генерацию, адаптивный профиль качества и общий параллакс.

**Tech Stack:** JavaScript ES modules, Three.js 0.178, Vite 7, Vitest 4, jsdom 29, Playwright 1.61.

## Global Constraints

- Утверждённое направление: обсерваторная достоверность с натуральными оттенками, реалистичной пылью и сдержанным свечением.
- Дальние остановки используют фиксированную кинематографичную камеру и лёгкий параллакс; свободная орбитальная камера не добавляется.
- `prefers-reduced-motion` отключает параллакс и лишнее движение.
- Маршрут содержит ровно семь этапов: `place`, `earth`, `solar-system`, `milky-way`, `local-group`, `cosmic-web`, `unknown`.
- Все три игровые преграды обязательны: `rocketCaught`, `solarComplete`, `webComplete`.
- Переход назад всегда разрешён.
- Профили качества используют DPR `1.5 / 1.25 / 1.0`, `galaxyPoints` `2600 / 1700 / 900`, `cosmicWebPoints` `9800 / 5200 / 2600`.
- Изменённый код покрывается тестами не ниже 80%.
- Локальная папка не содержит `.git`; команды commit выполнить только после восстановления git metadata.

---

## Карта файлов

| Файл | Ответственность |
|---|---|
| `src/core/stage-access.js` | Идентификаторы этапов, вычисление последнего открытого этапа и ограничение навигации |
| `src/core/stage-access.test.js` | Модульные тесты всех игровых барьеров |
| `src/data/cosmos.js` | Семь этапов и аннотации с вычисленными индексами |
| `src/data/cosmos.test.js` | Проверка отсутствия «Гелиосферы» и корректности индексов |
| `src/scene/layers/deep-space-utils.js` | Seeded random, opacity, параллакс и освобождение ресурсов |
| `src/scene/layers/deep-space-utils.test.js` | Детерминизм и математические ограничения |
| `src/scene/layers/milky-way.js` | Объёмный Млечный Путь и его интерактивные маркеры |
| `src/scene/layers/local-group.js` | Отдельные 3D-галактики Локальной группы |
| `src/scene/layers/cosmic-web.js` | Детерминированный граф узлов и нитей |
| `src/scene/layers/deep-space-layers.test.js` | Контракт, состав, качество и dispose трёх слоёв |
| `src/ui/create-shell.js` | Доступность кнопок этапов и динамический scroll-space |
| `src/ui/create-shell.test.js` | DOM-проверка закрытых этапов |
| `src/main.js` | Связка прогресса, новых слоёв и указателя параллакса |
| `src/styles.css` | Состояние закрытых кнопок и спокойная игровая панель сети |
| `package.json` | Команды unit, coverage и E2E |
| `tests/progression.e2e.spec.js` | Проверка маршрута и блокировок в браузере |
| `playwright.config.js` | Локальный Vite web server для E2E |
| `docs/dev-log.md` | Obsidian-запись о реализации и проверках |

### Task 1: Тестовый контур и чистая модель доступа

**Files:**
- Create: `src/core/stage-access.js`
- Create: `src/core/stage-access.test.js`
- Modify: `package.json:6-12`

**Interfaces:**
- Consumes: `stages: readonly { id: string }[]`, `journeyState: { rocketCaught?: boolean, solarComplete?: boolean, webComplete?: boolean }`.
- Produces: `createStageIndex(stages): Readonly<Record<string, number>>`, `getHighestUnlockedStage({ stages, journeyState })`, `clampStageTarget({ requestedStage, highestUnlockedStage })`, `scrollYForStage({ stage, stageCount, maxScroll })`, `blockReasonForStage({ stages, journeyState })`.

- [ ] **Step 1: Добавить команды Vitest и написать падающие тесты**

```json
"scripts": {
  "dev": "vite --host 127.0.0.1 --port 5173",
  "build": "vite build",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "preview": "vite preview --host 127.0.0.1 --port 5173",
  "serve": "node serve-dist.js",
  "assets:optimize": "node scripts/optimize-assets.mjs"
}
```

```js
import { describe, expect, it } from "vitest";
import {
  blockReasonForStage,
  clampStageTarget,
  createStageIndex,
  getHighestUnlockedStage,
  scrollYForStage
} from "./stage-access.js";

const stages = Object.freeze([
  { id: "place" }, { id: "earth" }, { id: "solar-system" },
  { id: "milky-way" }, { id: "local-group" }, { id: "cosmic-web" }, { id: "unknown" }
]);

describe("stage access", () => {
  it.each([
    [{}, 1],
    [{ rocketCaught: true }, 2],
    [{ rocketCaught: true, solarComplete: true }, 5],
    [{ rocketCaught: true, solarComplete: true, webComplete: true }, 6]
  ])("opens only the route allowed by completed games", (journeyState, expected) => {
    expect(getHighestUnlockedStage({ stages, journeyState })).toBe(expected);
  });

  it("allows backward travel but clamps forward travel", () => {
    expect(clampStageTarget({ requestedStage: 0, highestUnlockedStage: 2 })).toBe(0);
    expect(clampStageTarget({ requestedStage: 6, highestUnlockedStage: 2 })).toBe(2);
  });

  it("maps stage ids and scroll coordinates deterministically", () => {
    expect(createStageIndex(stages)["cosmic-web"]).toBe(5);
    expect(scrollYForStage({ stage: 5, stageCount: 7, maxScroll: 1200 })).toBe(1000);
  });

  it("returns the actionable reason for the active barrier", () => {
    expect(blockReasonForStage({ stages, journeyState: {} })).toContain("ракет");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true } })).toContain("двигател");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true, solarComplete: true } })).toContain("нить");
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npm.cmd test -- src/core/stage-access.test.js`

Expected: FAIL с `Cannot find module './stage-access.js'`.

- [ ] **Step 3: Реализовать чистую модель доступа**

```js
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createStageIndex = (stages) => Object.freeze(
  Object.fromEntries(stages.map(({ id }, index) => [id, index]))
);

export const getHighestUnlockedStage = ({ stages, journeyState }) => {
  const index = createStageIndex(stages);
  if (!journeyState.rocketCaught) return index.earth;
  if (!journeyState.solarComplete) return index["solar-system"];
  if (!journeyState.webComplete) return index["cosmic-web"];
  return stages.length - 1;
};

export const clampStageTarget = ({ requestedStage, highestUnlockedStage }) => (
  clamp(Math.round(requestedStage), 0, highestUnlockedStage)
);

export const scrollYForStage = ({ stage, stageCount, maxScroll }) => (
  stageCount <= 1 ? 0 : maxScroll * (stage / (stageCount - 1))
);

export const blockReasonForStage = ({ stages, journeyState }) => {
  const highest = getHighestUnlockedStage({ stages, journeyState });
  const id = stages[highest]?.id;
  if (id === "earth") return "Сначала поймай ракету у Земли.";
  if (id === "solar-system") return "Сначала собери все детали и восстанови двигатель.";
  if (id === "cosmic-web") return "Сначала соедини космическую нить на всех трёх уровнях.";
  return "";
};
```

- [ ] **Step 4: Подтвердить GREEN и покрытие**

Run: `npm.cmd test -- src/core/stage-access.test.js && npm.cmd run test:coverage -- src/core/stage-access.test.js`

Expected: 4 tests PASS; `stage-access.js` statements/branches/functions/lines ≥ 80%.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add package.json src/core/stage-access.js src/core/stage-access.test.js && git commit -m "feat: gate journey stages by game progress"`.

### Task 2: Семь этапов без «Гелиосферы»

**Files:**
- Create: `src/data/cosmos.test.js`
- Modify: `src/data/cosmos.js:9-288`
- Modify: `src/ui/create-shell.js:1-9,144-147`
- Modify: `src/main.js:28,403-500,1049-1063,1307-1310,1360`
- Modify: `scripts/optimize-assets.mjs:15`
- Modify: `public/space/assets.json:42-50`
- Delete: `src/scene/layers/heliosphere.js`
- Delete: `public/space/voyager-heliosphere.avif`
- Delete: `public/space/voyager-heliosphere.webp`
- Delete: `public/space/voyager-heliosphere.jpg`

**Interfaces:**
- Consumes: `STAGES`, `OBJECTS`, `ANNOTATIONS`.
- Produces: `STAGE_INDEX`, неизменяемый объект `stage id -> index`, и данные без orphan-ссылок.

- [ ] **Step 1: Написать регрессионный тест маршрута**

```js
import { describe, expect, it } from "vitest";
import { ANNOTATIONS, OBJECTS, STAGES, STAGE_INDEX } from "./cosmos.js";

describe("cosmos route", () => {
  it("contains exactly the approved seven stages", () => {
    expect(STAGES.map(({ id }) => id)).toEqual([
      "place", "earth", "solar-system", "milky-way", "local-group", "cosmic-web", "unknown"
    ]);
  });

  it("contains no heliosphere or Voyager data", () => {
    expect(JSON.stringify({ STAGES, OBJECTS, ANNOTATIONS }).toLowerCase()).not.toMatch(/heliosphere|гелиосфер|voyager/);
  });

  it("keeps every annotation inside the route", () => {
    expect(STAGE_INDEX["cosmic-web"]).toBe(5);
    expect([...OBJECTS, ...ANNOTATIONS.galaxy, ...ANNOTATIONS.localGroup]
      .every(({ stage }) => Number.isInteger(stage) && stage >= 0 && stage < STAGES.length)).toBe(true);
  });
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/data/cosmos.test.js`

Expected: FAIL: маршрут содержит `heliosphere`, экспорт `STAGE_INDEX` отсутствует.

- [ ] **Step 3: Перевести данные на вычисляемые индексы и удалить слой**

```js
export const STAGES = deepFreeze([
  { id: "place", label: "Место", distance: "0 км", camera: { position: [0, 7, 20], target: [0, 0, -80], fov: 52 }, motion: "static" },
  { id: "earth", label: "Земля", distance: "6371 км", camera: { position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46 }, motion: "static" },
  { id: "solar-system", label: "Солнечная система", distance: "1 а.е.", camera: { position: [0, 12, 108], target: [8, 0, 0], fov: 48 }, motion: "transition-only" },
  { id: "milky-way", label: "Млечный Путь", distance: "27 000 св. лет", camera: { position: [0, 20, 305], target: [0, 0, -80], fov: 50 }, motion: "static" },
  { id: "local-group", label: "Локальная группа", distance: "2.5 млн св. лет", camera: { position: [0, 23, 405], target: [0, 0, -138], fov: 50 }, motion: "static" },
  { id: "cosmic-web", label: "Космическая сеть", distance: "сотни млн св. лет", camera: { position: [0, 26, 540], target: [0, 0, -235], fov: 52 }, motion: "static" },
  { id: "unknown", label: "?", distance: "? световых лет", camera: { position: [0, 29, 680], target: [0, 0, -340], fov: 52 }, motion: "static" }
]);

export const STAGE_INDEX = Object.freeze(Object.fromEntries(STAGES.map(({ id }, index) => [id, index])));
```

Заменить числовые `stage` у Земли, планет, Млечного Пути, группы, сети и `?` на `STAGE_INDEX["..."]`; удалить два heliosphere-объекта, импорт/создание слоя и Voyager label target; создавать `.scroll-space section` через `stages.map(() => "<section></section>").join("")`.

- [ ] **Step 4: Проверить GREEN, отсутствие ссылок и сборку**

Run: `npm.cmd test -- src/data/cosmos.test.js && rg -n -i "heliosphere|гелиосфер|voyager" src public/space/assets.json scripts/optimize-assets.mjs && npm.cmd run build`

Expected: tests PASS; `rg` не находит совпадений в активном коде/манифесте; Vite build exit 0.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add src/data src/ui/create-shell.js src/main.js src/scene/layers scripts/optimize-assets.mjs public/space && git commit -m "refactor: remove heliosphere from journey"`.

### Task 3: Детерминированные 3D-утилиты

**Files:**
- Create: `src/scene/layers/deep-space-utils.js`
- Create: `src/scene/layers/deep-space-utils.test.js`

**Interfaces:**
- Produces: `createSeededRandom(seed): () => number`, `clampPresence(value): number`, `resolveParallax({ x, y, reducedMotion, tier }): { x, y }`, `disposeObjectTree(root): void`.

- [ ] **Step 1: Написать падающие тесты**

```js
import { describe, expect, it, vi } from "vitest";
import { clampPresence, createSeededRandom, disposeObjectTree, resolveParallax } from "./deep-space-utils.js";

describe("deep space utilities", () => {
  it("repeats the same random sequence for one seed", () => {
    const first = createSeededRandom(1977);
    const second = createSeededRandom(1977);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
  it("clamps presence and parallax", () => {
    expect(clampPresence(3)).toBe(1);
    expect(resolveParallax({ x: 1, y: -1, reducedMotion: false, tier: "high" })).toEqual({ x: 1.6, y: -1.1 });
    expect(resolveParallax({ x: 1, y: 1, reducedMotion: true, tier: "high" })).toEqual({ x: 0, y: 0 });
  });
  it("disposes unique geometries and materials once", () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const root = { traverse: (visit) => [{ geometry, material }, { geometry, material }].forEach(visit), clear: vi.fn() };
    disposeObjectTree(root);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(root.clear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-utils.test.js`

Expected: FAIL с отсутствующим модулем.

- [ ] **Step 3: Реализовать утилиты без мутаций входных данных**

```js
export const clampPresence = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const createSeededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
};

export const resolveParallax = ({ x, y, reducedMotion, tier }) => {
  if (reducedMotion || tier === "economy") return Object.freeze({ x: 0, y: 0 });
  const factor = tier === "high" ? 1 : 0.55;
  return Object.freeze({ x: x * 1.6 * factor, y: y * 1.1 * factor });
};

export const disposeObjectTree = (root) => {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((value) => materials.add(value));
  });
  geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  root.clear();
};
```

- [ ] **Step 4: Подтвердить GREEN**

Run: `npm.cmd test -- src/scene/layers/deep-space-utils.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add src/scene/layers/deep-space-utils* && git commit -m "test: add deterministic deep space utilities"`.

### Task 4: Объёмный Млечный Путь

**Files:**
- Create: `src/scene/layers/milky-way.js`
- Create: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/main.js:1065-1136,1611-1621,1763-1794`

**Interfaces:**
- Consumes: `{ THREE, annotations, quality, glowTexture, createMarker, reducedMotion }`.
- Produces: `{ root, interactive, setPresence, updateParallax, dispose }`.

- [ ] **Step 1: Зафиксировать контракт падающим тестом**

```js
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMilkyWayLayer } from "./milky-way.js";

it("creates a layered volumetric galaxy using the quality point count", () => {
  const layer = createMilkyWayLayer({
    THREE,
    annotations: [],
    quality: { tier: "economy", galaxyPoints: 900 },
    glowTexture: null,
    createMarker: () => new THREE.Sprite(),
    reducedMotion: false
  });
  expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count).toBe(900);
  expect(layer.root.getObjectByName("milky-way-dust")).toBeTruthy();
  expect(layer.root.getObjectByName("milky-way-halo")).toBeTruthy();
  expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
  layer.dispose();
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: FAIL с отсутствующим `milky-way.js`.

- [ ] **Step 3: Реализовать слой**

Создать `Group` в позиции `[0,0,-80]`; детерминированно распределить `quality.galaxyPoints` по четырём логарифмическим рукавам, записать position/color attributes; добавить отдельные `Points` для звёзд, тёмные полупрозрачные `Points` для пыли, тёплый sprite ядра и сферическое гало. Все материалы получают `transparent`, `depthWrite: false`; пыль использует `NormalBlending`, звёзды — `AdditiveBlending`. `setPresence` умножает базовую opacity, `updateParallax` применяет `resolveParallax`, `dispose` вызывает `disposeObjectTree`.

```js
return Object.freeze({
  root,
  interactive: Object.freeze(interactive),
  setPresence,
  updateParallax: ({ x, y }) => {
    const offset = resolveParallax({ x, y, reducedMotion, tier: quality.tier });
    root.position.x = offset.x;
    root.position.y = offset.y;
    return Object.freeze({ x: root.position.x, y: root.position.y });
  },
  dispose: () => disposeObjectTree(root)
});
```

- [ ] **Step 4: Подтвердить GREEN и сборку**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js && npm.cmd run build`

Expected: galaxy test PASS; build exit 0.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add src/scene/layers/milky-way.js src/scene/layers/deep-space-layers.test.js src/main.js && git commit -m "feat: render volumetric Milky Way"`.

### Task 5: Локальная группа из отдельных галактик

**Files:**
- Create: `src/scene/layers/local-group.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/main.js:1138-1202,1622-1627,1763-1794`

**Interfaces:**
- Consumes: `{ THREE, annotations, quality, textureFor, glowTexture, createMarker, reducedMotion }`.
- Produces: стандартный deep-space layer contract.

- [ ] **Step 1: Добавить падающий тест различимых галактик**

```js
import { createLocalGroupLayer } from "./local-group.js";

it("creates named galaxies with distinct depth and aspect", () => {
  const annotations = [
    { id: "group-milky-way", stage: 4, position: [-34, 4, -142], size: 18, image: "/mw.jpg" },
    { id: "group-andromeda", stage: 4, position: [56, 13, -160], size: 24, image: "/a.jpg" },
    { id: "group-triangulum", stage: 4, position: [20, -26, -180], size: 11, image: "/m33.jpg" }
  ];
  const layer = createLocalGroupLayer({
    THREE, annotations, quality: { tier: "high" }, glowTexture: null,
    textureFor: () => null, createMarker: () => new THREE.Sprite(), reducedMotion: false
  });
  const galaxies = annotations.map(({ id }) => layer.root.getObjectByName(id));
  expect(galaxies.every(Boolean)).toBe(true);
  expect(new Set(galaxies.map(({ position }) => position.z)).size).toBe(3);
  expect(galaxies[1].scale.x).not.toBe(galaxies[1].scale.y);
  layer.dispose();
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: FAIL с отсутствующим `local-group.js`.

- [ ] **Step 3: Реализовать слой отдельных галактик**

Для каждой аннотации создать именованную вложенную группу: текстурированный вытянутый sprite-диск, компактное ядро и малое облако звёзд. Использовать `position`, `size`, стабильный наклон из seeded random и разные профили: spiral для Milky Way/Andromeda/M33, irregular для Magellanic Clouds, elliptical для M32. Маркер аннотации остаётся отдельным интерактивным sprite.

```js
const profileFor = (id) => id.includes("m32")
  ? "elliptical"
  : id.includes("magellanic") ? "irregular" : "spiral";
```

`setPresence`, `updateParallax` и `dispose` используют тот же контракт, что и `milky-way.js`.

- [ ] **Step 4: Подтвердить GREEN**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js && npm.cmd run build`

Expected: Milky Way и Local Group tests PASS; build exit 0.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add src/scene/layers/local-group.js src/scene/layers/deep-space-layers.test.js src/main.js && git commit -m "feat: render Local Group in 3D"`.

### Task 6: Связная 3D-космическая сеть

**Files:**
- Create: `src/scene/layers/cosmic-web.js`
- Modify: `src/scene/layers/deep-space-layers.test.js`
- Modify: `src/main.js:1204-1296,1628-1634,1763-1794`

**Interfaces:**
- Consumes: `{ THREE, quality, glowTexture, reducedMotion, seed }`.
- Produces: стандартный deep-space layer contract и `graph: { nodes, edges }` для тестирования.

- [ ] **Step 1: Добавить падающий тест связного воспроизводимого графа**

```js
import { createCosmicWebLayer } from "./cosmic-web.js";

it("builds a deterministic nearest-neighbour web with quality-scaled points", () => {
  const options = { THREE, quality: { tier: "economy", cosmicWebPoints: 2600 }, glowTexture: null, reducedMotion: false, seed: 20260719 };
  const first = createCosmicWebLayer(options);
  const second = createCosmicWebLayer(options);
  expect(first.graph).toEqual(second.graph);
  expect(first.graph.edges.length).toBeGreaterThanOrEqual(first.graph.nodes.length - 1);
  expect(first.root.getObjectByName("cosmic-web-particles").geometry.getAttribute("position").count).toBe(2600);
  expect(first.root.getObjectByName("cosmic-web-filaments")).toBeTruthy();
  first.dispose();
  second.dispose();
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js`

Expected: FAIL с отсутствующим `cosmic-web.js`.

- [ ] **Step 3: Реализовать graph + filaments**

Создать детерминированные узлы внутри объёма `1320 × 760 × 190`. Для гарантированной связности каждый узел после первого соединить с ближайшим узлом среди уже добавленных, затем добавить до двух ближайших рёбер на узел. Нормализовать undirected edge key и построить `LineSegments`. Распределить ровно `quality.cosmicWebPoints` вдоль рёбер с малым гауссовым отклонением, добавить плотные node points и дальний слабый слой. Полноэкранный `cosmic-web-bright.png` не создавать.

```js
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const edges = [...edgeKeys].map((key) => key.split(":").map(Number));
const graph = Object.freeze({
  nodes: Object.freeze(nodes.map((node) => Object.freeze([...node]))),
  edges: Object.freeze(edges.map((edge) => Object.freeze(edge)))
});
```

- [ ] **Step 4: Подтвердить GREEN, детерминизм и сборку**

Run: `npm.cmd test -- src/scene/layers/deep-space-layers.test.js && npm.cmd run build`

Expected: all deep-space layer tests PASS; build exit 0.

- [ ] **Step 5: Зафиксировать checkpoint**

После восстановления `.git`: `git add src/scene/layers/cosmic-web.js src/scene/layers/deep-space-layers.test.js src/main.js && git commit -m "feat: render connected cosmic web"`.

### Task 7: Интеграция прогресса, UI, E2E и журнал

**Files:**
- Create: `src/ui/create-shell.test.js`
- Create: `tests/progression.e2e.spec.js`
- Create: `playwright.config.js`
- Modify: `src/ui/create-shell.js:197-231,259-311`
- Modify: `src/main.js:13-29,95-101,937-969,1502-1640,1829-1838,1916-1922`
- Modify: `src/styles.css:scale-rail,692-792`
- Modify: `docs/dev-log.md`

**Interfaces:**
- Consumes: `getHighestUnlockedStage`, `clampStageTarget`, `scrollYForStage`, `blockReasonForStage`, standard deep-space layer contracts.
- Produces: `shell.setStageAccess({ highestUnlockedStage, reason })` и полностью защищённый маршрут.

- [ ] **Step 1: Написать DOM-тест недоступных кнопок**

```js
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createShell } from "./create-shell.js";

it("disables every stage above the highest unlocked stage", () => {
  document.body.innerHTML = '<div id="app"></div>';
  const stages = ["place", "earth", "solar-system", "milky-way"].map((id) => ({ id, label: id, distance: id }));
  const shell = createShell({ root: document.querySelector("#app"), stages });
  shell.setStageAccess({ highestUnlockedStage: 1, reason: "Сначала поймай ракету." });
  expect(shell.stageButtons.map((button) => button.disabled)).toEqual([false, false, true, true]);
  expect(shell.stageButtons[2].getAttribute("aria-label")).toContain("Сначала поймай ракету");
  shell.dispose();
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm.cmd test -- src/ui/create-shell.test.js`

Expected: FAIL: `shell.setStageAccess is not a function`.

- [ ] **Step 3: Реализовать единый guard во всех каналах**

```js
const setStageAccess = ({ highestUnlockedStage, reason }) => {
  stageButtons.forEach((button, index) => {
    const locked = index > highestUnlockedStage;
    button.disabled = locked;
    button.setAttribute("aria-disabled", String(locked));
    if (locked) button.setAttribute("aria-label", `${button.textContent}. ${reason}`);
    else button.removeAttribute("aria-label");
  });
};
```

В `updateStage()` до `computeStageState()` вычислять `highestUnlockedStage`, максимальный разрешённый `scrollY`, при превышении выполнять мгновенный `window.scrollTo({ top: allowedScrollY, behavior: "auto" })` и показывать `blockReasonForStage`. Клик rail вызывает `clampStageTarget`; `wheel`, `touchmove` и блокирующие клавиши используют тот же guard. После `rocketCaught`, `solarComplete` и `webComplete` немедленно вызывать `syncStageAccess()`.

- [ ] **Step 4: Добавить E2E-конфигурацию и браузерные проверки**

```js
// playwright.config.js
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1440, height: 900 } },
  webServer: { command: "npm.cmd run build && npm.cmd run preview", url: "http://127.0.0.1:4173", reuseExistingServer: true }
});
```

```js
import { expect, test } from "@playwright/test";

test("route has no heliosphere and future stages begin locked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  const navigation = page.getByRole("navigation", { name: "Масштабы" });
  await expect(navigation.getByRole("button", { name: "Гелиосфера" })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: /Система/ })).toBeDisabled();
  await page.keyboard.press("End");
  await expect(page.locator("body")).toHaveAttribute("data-stage", "1");
});

test("deep space stages render WebGL without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("canvas#cosmosCanvas")).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 5: Настроить визуальные состояния и Obsidian-журнал**

```css
.scale-rail button:disabled {
  cursor: not-allowed;
  opacity: .34;
  filter: saturate(.25);
}
.scale-rail button:disabled::after {
  content: "";
  width: 6px;
  height: 6px;
  border: 1px solid currentColor;
  border-radius: 50%;
}
```

Добавить в `docs/dev-log.md` секцию с frontmatter-compatible Obsidian Markdown: дата, удалённый этап, три игровых барьера, новые слои, результаты unit/coverage/build/E2E и ссылки `[[2026-07-19-deep-space-progression-design]]`, `[[2026-07-19-deep-space-progression]]`.

- [ ] **Step 6: Полная проверка**

Run: `npm.cmd test && npm.cmd run test:coverage && npm.cmd run build && npm.cmd run test:e2e`

Expected: unit/integration tests PASS; changed modules coverage ≥ 80%; Vite build exit 0; E2E tests PASS; console errors 0.

- [ ] **Step 7: Визуальная проверка**

Открыть production preview на `1440×900` и mobile viewport, пройти маршрут, сохранить скриншоты «Галактики», «Группы галактик» и «Космической сети», проверить глубину, отсутствие растянутых bitmap-фонов, читаемость подписей, reduced-motion и economy composition.

- [ ] **Step 8: Зафиксировать checkpoint**

После восстановления `.git`: `git add src tests playwright.config.js package.json docs/dev-log.md && git commit -m "feat: complete gated 3D cosmic journey"`.

## Самопроверка плана

> [!success] Покрытие спецификации
> Tasks 1, 2 и 7 реализуют все игровые блокировки и удаление «Гелиосферы». Tasks 3–6 реализуют настоящий 3D, детерминизм, адаптивное качество, параллакс и освобождение ресурсов. Task 7 закрывает доступность, E2E, визуальную проверку и Obsidian-журнал.

> [!warning] Ограничение рабочей копии
> Коммиты перечислены как обязательные checkpoints, но текущая папка не является git-репозиторием. Они выполняются только после появления `.git`; отсутствие git metadata не блокирует тестирование и локальную реализацию.
