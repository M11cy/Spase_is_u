---
title: План переноса 3D-сцен и кинематографичного вступления
date: 2026-07-17
tags:
  - development
  - implementation-plan
  - threejs
  - tdd
status: active
---

# Cinematic Scene Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести модульный визуальный ремастер в `Spase_is_u-main`, добавить вступительную сцену с вращающейся Землёй и кораблём и убрать подгрузку тайлов карты во время отдаления, не меняя озвучку и квестовую логику.

**Architecture:** Визуальные модули и ассеты берутся из подтверждённого рабочего снимка `C:\Users\M1CY\Desktop\Сай\.worktrees\cosmic-visual-remaster`. Целевой `main.js` объединяет новые scene/core/ui-контракты с существующими narration/quest hooks; карта остаётся на одном загруженном zoom и масштабирует зафиксированный tile-pane как цельный слой.

**Tech Stack:** Vite 7, Three.js 0.178, Leaflet 1.9, Vitest 4, Playwright 1.61, vanilla JavaScript/CSS.

## Global Constraints

- Не заменять озвучку, субтитры, тексты, квестовые состояния и идентификаторы целевой версии.
- Не изменять `public/voice/**`, `public/fonts/**`, `serve-dist.js`, `vite.config.js`, `OPEN_SITE.bat` и серверные bat-файлы.
- Не вызывать `Leaflet.map.setZoom()` во время перехода карта → Земля.
- Сохранять `publicAsset()` для runtime-путей целевого Vite `BASE_URL`.
- Все новые функции создаются через RED → GREEN → REFACTOR; покрытие добавленных модулей не ниже 80%.
- Целевая папка не является Git-репозиторием: шаги коммита заменяются свежим diff/хеш-чекпоинтом; Git не инициализировать без отдельного запроса пользователя.
- Записи разработки оформлять как Obsidian Markdown.

---

## File Map

- `src/main.js` — интеграция визуальных модулей с неизменными narration/quest hooks.
- `src/ui/create-shell.js` — DOM визуального shell, вступления и сохранённых элементов озвучки/мини-игр.
- `src/ui/intro-controller.js` — одноразовый переход «вступление → карта» и блокировка скролла.
- `src/core/intro-state.js` — чистое вычисление состояния вступления и reduced-motion.
- `src/core/earth-journey.js` — визуальное состояние карта → Земля.
- `src/map/satellite-map.js` — карта с фиксированным zoom и transform единого tile-pane.
- `src/scene/layers/earth.js` — Земля, облака, атмосфера и независимое медленное вращение.
- `src/scene/**`, `src/core/**`, `src/data/**`, `src/ui/**` — подтверждённые модули ремастера.
- `public/space/cinematic-ship.png` — прозрачный детализированный корабль для 2.5D-композиции.
- `src/styles.css` — селективное объединение сцены, вступления, карты и сохранённых voice/quest стилей.
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**` — модульные, контрактные и браузерные проверки.

### Task 1: Зафиксировать контракт актуальной версии

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `tests/integration/voice-quest-contract.test.js`

**Interfaces:**
- Consumes: существующие `src/main.js`, `src/styles.css`, `public/voice/**`.
- Produces: `VOICE_CUES`, `QUEST_HOOKS`, `QUEST_CONTROLS` как тестовые списки неизменяемых точек.

- [x] **Step 1: Добавить характеристический тест до переноса**

```js
import { readFile, access } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const VOICE_CUES = Object.freeze([
  "homeStart", "homeZoom", "earthArrival", "earthRocketPrompt",
  "earthRocketCaught", "earthDeparture", "solarArrival", "solarBroken",
  "solarQuest", "solarComplete", "solarDeparture", "milkyWay",
  "milkyWayDeparture", "localGroup", "localGroupDeparture",
  "universeArrival", "universeQuest", "universeFall", "universeComplete",
  "unknownTransition", "finalOne", "finalTwo", "finalStar"
]);
const QUEST_HOOKS = Object.freeze([
  "handleNarrationFromStage", "handlePanelNarration", "promptRocketCatch",
  "catchRocket", "collectSolarArtifact", "runWebPath", "slipFromWebPath",
  "createPersonalStar", "advanceFinale"
]);
const QUEST_CONTROLS = Object.freeze([
  "narrationPanel", "voiceToggle", "subtitleToggle", "rocketCatcher",
  "webRunner", "starMaker", "personalStars"
]);

describe("voice and quest preservation contract", () => {
  test("keeps every narration cue and quest hook", async () => {
    const source = await readFile("src/main.js", "utf8");
    VOICE_CUES.forEach((id) => expect(source).toContain(id));
    QUEST_HOOKS.forEach((name) => expect(source).toContain(name));
    QUEST_CONTROLS.forEach((id) => expect(source).toContain(id));
  });

  test("keeps all referenced voice files", async () => {
    const source = await readFile("src/main.js", "utf8");
    const files = [...source.matchAll(/voice\/([a-z0-9-]+\.mp3)/g)].map(([, file]) => file);
    expect(files.length).toBe(23);
    await Promise.all(files.map((file) => access(`public/voice/${file}`)));
  });
});
```

- [x] **Step 2: Установить тестовые зависимости без удаления `serve`**

Run: `npm install --save leaflet && npm install --save-dev vitest@^4.1.10 @vitest/coverage-v8@^4.1.10 jsdom@^29.1.1 @playwright/test@^1.61.1 @axe-core/playwright@^4.12.1`

Expected: `package.json` сохраняет scripts `dev`, `build`, `preview`, `serve` и получает `test`, `test:coverage`, `test:e2e`.

- [x] **Step 3: Запустить характеристический тест**

Run: `npm test -- tests/integration/voice-quest-contract.test.js`

Expected: PASS для текущей версии до визуального переноса.

- [x] **Step 4: Сохранить исходные хеши защищённых файлов**

Run: `Get-FileHash public\voice\* | Sort-Object Path | ConvertTo-Json | Set-Content -Encoding utf8 $env:TEMP\spase-voice-hashes.json`

Expected: JSON содержит 23 записи и используется только для финальной проверки.

### Task 2: Перенести модульное ядро визуального ремастера

**Files:**
- Create: `src/core/**`, `src/data/**`, `src/map/**`, `src/scene/**`, `src/ui/annotation-panel.js`, `src/ui/label-layout-coordinator.js`, `src/ui/location.js`
- Create: optimized files under `public/space/**`
- Create: corresponding `tests/unit/**` and `tests/integration/**`

**Interfaces:**
- Consumes: Three.js, Leaflet, `STAGES`, `OBJECTS`, `SOLAR_PLANETS`, `ANNOTATIONS`.
- Produces: `createScene`, `createEarthLayer`, `createSolarSystemLayer`, `createHeliosphereLayer`, `createEarthExperienceController`, `createSatelliteMap`.

- [x] **Step 1: Скопировать тесты ремастера до production-модулей**

```powershell
$source = 'C:\Users\M1CY\Desktop\Сай\.worktrees\cosmic-visual-remaster'
Copy-Item "$source\tests\unit" tests -Recurse -Force
Copy-Item "$source\tests\integration\earth-experience.test.js" tests\integration -Force
Copy-Item "$source\tests\integration\label-layout-coordinator.test.js" tests\integration -Force
Copy-Item "$source\tests\integration\render-scheduler.test.js" tests\integration -Force
Copy-Item "$source\tests\integration\satellite-map.test.js" tests\integration -Force
Copy-Item "$source\tests\integration\ui-shell.test.js" tests\integration -Force
```

- [x] **Step 2: Подтвердить RED**

Run: `npm test -- tests/unit tests/integration/earth-experience.test.js`

Expected: FAIL с `Cannot find module ../../src/core/...`.

- [x] **Step 3: Скопировать production-модули и runtime-ассеты**

```powershell
$source = 'C:\Users\M1CY\Desktop\Сай\.worktrees\cosmic-visual-remaster'
Copy-Item "$source\src\core" src -Recurse -Force
Copy-Item "$source\src\data" src -Recurse -Force
Copy-Item "$source\src\map" src -Recurse -Force
Copy-Item "$source\src\scene" src -Recurse -Force
Copy-Item "$source\src\ui\annotation-panel.js" src\ui -Force
Copy-Item "$source\src\ui\label-layout-coordinator.js" src\ui -Force
Copy-Item "$source\src\ui\location.js" src\ui -Force
Copy-Item "$source\public\space\*.avif" public\space -Force
Copy-Item "$source\public\space\*.webp" public\space -Force
Copy-Item "$source\public\space\earth-*-4k.jpg" public\space -Force
Copy-Item "$source\public\space\earth-*-8k.jpg" public\space -Force
Copy-Item "$source\public\space\assets.json" public\space -Force
```

- [x] **Step 4: Подтвердить GREEN для визуального ядра**

Run: `npm test -- tests/unit tests/integration/earth-experience.test.js tests/integration/label-layout-coordinator.test.js tests/integration/render-scheduler.test.js`

Expected: все выбранные suites PASS.

### Task 3: Сделать карту единым неподгружаемым слоем

**Files:**
- Modify: `tests/integration/satellite-map.test.js`
- Modify: `src/map/satellite-map.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `setJourneyProgress({ mapZoom, progress })`.
- Produces: controller `{ setLocation, setJourneyProgress, dispose }`, где journey меняет `--map-image-scale`, но не Leaflet zoom.

- [x] **Step 1: Написать failing test запрета повторной загрузки**

```js
test("scales the loaded tile pane without changing leaflet zoom", () => {
  const controller = createSatelliteMap({ L, root, initialLocation });
  controller.setJourneyProgress({ mapZoom: 9, progress: 0.5 });
  controller.setJourneyProgress({ mapZoom: 3, progress: 0.9 });
  expect(map.setZoom).not.toHaveBeenCalled();
  expect(root.style.getPropertyValue("--map-image-scale")).not.toBe("");
});
```

- [x] **Step 2: Подтвердить RED**

Run: `npm test -- tests/integration/satellite-map.test.js`

Expected: FAIL, потому что текущий controller вызывает `map.setZoom`.

- [x] **Step 3: Реализовать transform-only journey**

```js
const resolveImageScale = (mapZoom) => {
  const progress = clamp((CITY_ZOOM - mapZoom) / (CITY_ZOOM - ORBIT_ZOOM), 0, 1);
  return 1 - progress * 0.34;
};

const setJourneyProgress = (journeyProgress) => {
  if (disposed) return undefined;
  const nextZoom = resolveZoom(journeyProgress);
  currentZoom = nextZoom;
  root.style.setProperty("--map-image-scale", String(resolveImageScale(nextZoom)));
  root.dataset.journeyProgress = String(journeyProgress?.progress ?? 0);
  return currentZoom;
};
```

Leaflet сохраняет исходный zoom 15; `setLocation` использует константу `CITY_ZOOM` и не переносит `currentZoom` в `map.setView`.

- [x] **Step 4: Подтвердить GREEN**

Run: `npm test -- tests/integration/satellite-map.test.js`

Expected: PASS; `setZoom` имеет 0 вызовов после создания карты.

### Task 4: Добавить состояние вступления и вращение Земли

**Files:**
- Create: `tests/unit/intro-state.test.js`
- Create: `src/core/intro-state.js`
- Modify: `tests/unit/earth-layer.test.js`
- Modify: `src/scene/layers/earth.js`

**Interfaces:**
- Produces: `createIntroState({ started, elapsed, reducedMotion })`.
- Produces: `earthLayer.updateMotion({ delta, introActive })`.

- [x] **Step 1: Написать failing tests**

```js
test("keeps the journey locked until start", () => {
  expect(createIntroState({ started: false, elapsed: 0, reducedMotion: false })).toEqual(
    expect.objectContaining({ active: true, scrollLocked: true, earthSpin: 0 })
  );
});

test("reduces motion without stopping the scene", () => {
  const state = createIntroState({ started: false, elapsed: 10, reducedMotion: true });
  expect(state.earthSpin).toBeGreaterThan(0);
  expect(state.earthSpin).toBeLessThan(0.02);
});

test("rotates surface and clouds independently", () => {
  earthLayer.updateMotion({ delta: 1, introActive: true });
  expect(surface.rotation.y).not.toBe(clouds.rotation.y);
});
```

- [x] **Step 2: Подтвердить RED**

Run: `npm test -- tests/unit/intro-state.test.js tests/unit/earth-layer.test.js`

Expected: FAIL из-за отсутствующих exports.

- [x] **Step 3: Реализовать чистое состояние и motion API**

```js
export const createIntroState = ({ started, elapsed, reducedMotion }) => {
  const time = Math.max(0, Number(elapsed) || 0);
  const motionScale = reducedMotion ? 0.12 : 1;
  return Object.freeze({
    active: !started,
    scrollLocked: !started,
    earthSpin: time * 0.018 * motionScale,
    cloudSpin: time * 0.025 * motionScale,
    shipRoll: Math.sin(time * 0.42) * 2.4 * motionScale,
    shipDrift: Math.sin(time * 0.58) * 10 * motionScale
  });
};
```

`updateMotion` применяет приращения к `surface.rotation.y` и `clouds.rotation.y`, проверяет finite `delta` и прекращает работу после `dispose()`.

- [x] **Step 4: Подтвердить GREEN**

Run: `npm test -- tests/unit/intro-state.test.js tests/unit/earth-layer.test.js`

Expected: PASS.

### Task 5: Собрать shell вступления и сохранить voice/quest controls

**Files:**
- Modify: `tests/integration/ui-shell.test.js`
- Modify: `src/ui/create-shell.js`
- Create: `tests/integration/intro-controller.test.js`
- Create: `src/ui/intro-controller.js`
- Create: `public/space/cinematic-ship.png`
- Modify: `src/styles.css`

**Interfaces:**
- Produces shell bindings: `introLayer`, `startJourneyButton`, `cinematicShip`, `narrationPanel`, `voiceToggle`, `subtitleToggle`, `rocketCatcher`, `webRunner`, `starMaker`, `personalStars`.
- Produces `createIntroController({ root, startButton, onStart, reducedMotion })`.

- [x] **Step 1: Написать failing UI tests**

```js
test("renders the cinematic intro before the map", () => {
  const shell = createShell({ root, stages });
  expect(shell.introLayer.hidden).toBe(false);
  expect(shell.startJourneyButton.textContent).toBe("Начать путешествие");
  expect(shell.cinematicShip.getAttribute("src")).toContain("cinematic-ship.png");
});

test("retains narration and quest controls", () => {
  const shell = createShell({ root, stages });
  ["voiceToggle", "subtitleToggle", "rocketCatcher", "webRunner", "starMaker"]
    .forEach((id) => expect(root.querySelector(`#${id}`)).not.toBeNull());
});
```

- [x] **Step 2: Подтвердить RED**

Run: `npm test -- tests/integration/ui-shell.test.js tests/integration/intro-controller.test.js`

Expected: FAIL из-за отсутствующих intro bindings и target controls.

- [x] **Step 3: Создать прозрачный корабль по референсу**

Использовать image generation с предоставленным референсом: один фотореалистичный тёмный научно-фантастический корабль, вид 3/4 сверху, изолированный на прозрачном фоне, без Земли, звёзд, текста и теней за пределами корпуса. Сохранить результат как `public/space/cinematic-ship.png` и проверить alpha channel.

- [x] **Step 4: Реализовать shell и controller**

```js
export function createIntroController({ root, startButton, onStart, reducedMotion }) {
  let started = false;
  const start = () => {
    if (started) return false;
    started = true;
    root.dataset.state = "leaving";
    document.body.classList.remove("intro-pending");
    onStart();
    const delay = reducedMotion ? 0 : 900;
    window.setTimeout(() => { root.hidden = true; }, delay);
    return true;
  };
  startButton.addEventListener("click", start);
  document.body.classList.add("intro-pending");
  return Object.freeze({ start, dispose: () => startButton.removeEventListener("click", start) });
}
```

- [x] **Step 5: Подтвердить GREEN**

Run: `npm test -- tests/integration/ui-shell.test.js tests/integration/intro-controller.test.js`

Expected: PASS.

### Task 6: Интегрировать remaster main с неизменной историей

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `tests/integration/voice-quest-contract.test.js`

**Interfaces:**
- Consumes: все shell bindings, scene controllers и target narration/quest functions.
- Produces: единый lifecycle `start → map → Earth → remaining stages`.

- [x] **Step 1: Расширить контрактный тест call-site проверками**

```js
test("keeps story hooks connected to remastered events", async () => {
  const source = await readFile("src/main.js", "utf8");
  expect(source).toMatch(/updateStage[\s\S]*handleNarrationFromStage/);
  expect(source).toMatch(/openPanel[\s\S]*handlePanelNarration/);
  expect(source).toContain("collectSolarArtifact(data)");
  expect(source).toContain("slipFromWebPath()");
});
```

- [x] **Step 2: Подтвердить RED на временной remaster-интеграции**

Скопировать рабочий `src/main.js` ремастера во временный `$env:TEMP\remaster-main.js`, выполнить семантическое сравнение и убедиться, что тест против него падает из-за отсутствия story hooks. Целевой `src/main.js` до готового merge не заменять.

- [x] **Step 3: Выполнить семантический merge**

Взять import/setup/update/render/dispose поток из remaster snapshot. Перенести из target без изменения cue ids, cue text, audio paths и условий функций блоки `narrationCues`, `journeyState`, narration helpers, quest helpers и event listeners. Обязательные call sites:

```js
function updateStage() {
  // remaster stage/camera/scene update
  handleNarrationFromStage(exactStage, previousStage);
  updateMissionForStage();
}

function openPanel(data, trigger) {
  markUserInteraction();
  annotationPanel.open({ ...data, scale: stages[data.stage].label }, trigger);
  handlePanelNarration(data);
}
```

`onClick(event)` сохраняет исключения `.narration-panel, .rocket-catcher, .web-runner, .star-maker, .cinematic-intro`; raycast работает только после начала путешествия. `disposeExperience()` освобождает scene, map, intro, narration audio и listeners ровно один раз.

- [x] **Step 4: Объединить CSS селективно**

Основой служит remaster CSS; из target дословно сохраняются блоки `.narration-*`, `.voice-toggle`, `.subtitle-*`, `.mission-status`, `.rocket-catcher`, `.web-runner`, `.star-maker`, `.personal-stars` и их keyframes. Добавляются `.cinematic-intro`, `.cinematic-ship`, `.journey-start`, `.intro-pending` и transform переменная карты.

- [x] **Step 5: Запустить защитные и модульные тесты**

Run: `npm test`

Expected: все suites PASS; voice contract находит 23 cues/files и все quest hooks.

### Task 7: Проверить путь пользователя в браузере

**Files:**
- Create: `tests/e2e/cinematic-journey.spec.js`
- Modify: `docs/dev-log.md`

**Interfaces:**
- Consumes: собранное приложение.
- Produces: проверенный пользовательский путь и Obsidian-запись результатов.

- [x] **Step 1: Написать failing E2E до финальной полировки**

```js
test("starts with cinematic Earth and reaches the frozen map", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cinematic-intro")).toBeVisible();
  await expect(page.locator("#startJourneyButton")).toHaveText("Начать путешествие");
  await expect(page.locator("body")).toHaveClass(/intro-pending/);
  await page.locator("#startJourneyButton").click();
  await expect(page.locator(".map-layer")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.08));
  await expect(page.locator("#mapRoot")).toHaveCSS("--map-image-scale", /.+/);
});
```

- [x] **Step 2: Запустить E2E и устранить только наблюдаемые дефекты**

Run: `npm run test:e2e -- tests/e2e/cinematic-journey.spec.js`

Expected: PASS на desktop 1440×900 и mobile 390×844; нет console errors и 404.

- [x] **Step 3: Выполнить полную проверку**

Run: `npm run test:coverage && npm run build && npm run test:e2e`

Expected: exit 0; покрытие добавленных модулей ≥80%; Vite build завершается; все E2E PASS.

- [x] **Step 4: Проверить неизменность защищённых ресурсов**

Run: сравнить свежий `Get-FileHash public\voice\*` с `$env:TEMP\spase-voice-hashes.json`; выполнить `git diff --no-index` для target server/config файлов против сохранённого списка хешей.

Expected: voice/font/server/config hashes не изменились.

- [x] **Step 5: Записать результат в Obsidian Markdown**

Добавить в `docs/dev-log.md` дату, изменённые визуальные компоненты, команды проверки, количество тестов и известные ограничения без дублирования спецификации.
