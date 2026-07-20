import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { createQualityProfile } from "../src/core/quality-profile.js";
import { SOLAR_PLANETS, STAGES } from "../src/data/cosmos.js";

const ARTIFACT_DIRECTORY = ".superpowers/sdd/ultra-photo-artifacts";
const LOCAL_GROUP_LABEL_IDS = Object.freeze([
  "group-milky-way",
  "group-andromeda",
  "group-triangulum",
  "group-lmc",
  "group-smc",
  "group-m32"
]);

const settledFrame = async (page) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
};

const expectNoHorizontalOverflow = async (page) => {
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1
  ))).toBe(true);
};

const expectRailInvariant = async (page, stage) => {
  const rail = page.getByRole("navigation", { name: "Масштабы" });
  await expect(rail.getByRole("button")).toHaveCount(STAGES.length);
  await expect(rail.locator(`button[data-stage="${stage}"]`)).toHaveAttribute("aria-current", "step");
  await expect(rail.locator('button[aria-current="step"]')).toHaveCount(1);
  await expect(page.locator(`#distanceMarkers li[data-stage="${stage}"]`)).toHaveClass(/active/);
};

const selectExpectedHighTierProfile = async (page) => {
  const inputs = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency ?? 4,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  }));
  const profile = createQualityProfile(inputs);
  expect(profile.tier).toBe("high");
  return Object.freeze({ inputs, profile });
};

const expectCanvasDpr = async (page, expectedProfile) => {
  const evidence = await page.locator("canvas#cosmosCanvas").evaluate((canvas) => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight
  }));
  const widthRatio = evidence.canvasWidth / evidence.clientWidth;
  const heightRatio = evidence.canvasHeight / evidence.clientHeight;

  expect(Math.abs(widthRatio - expectedProfile.pixelRatio)).toBeLessThanOrEqual(0.02);
  expect(Math.abs(heightRatio - expectedProfile.pixelRatio)).toBeLessThanOrEqual(0.02);
  return Object.freeze({
    ...evidence,
    expectedPixelRatio: expectedProfile.pixelRatio,
    widthRatio,
    heightRatio
  });
};

const expectLocalGroupAnnotations = async (page) => {
  const visibleLabels = page.locator(".space-label.visible");
  await expect(visibleLabels).toHaveCount(LOCAL_GROUP_LABEL_IDS.length);
  const visibleIds = await visibleLabels.evaluateAll((elements) => (
    elements.map((element) => element.dataset.id).sort()
  ));
  expect(visibleIds).toEqual([...LOCAL_GROUP_LABEL_IDS].sort());

  const label = page.locator('.space-label.visible[data-id="group-andromeda"]');
  await expect(label).toBeVisible();
  const labelText = await label.textContent();
  await label.click();
  await expect(page.locator("#objectPanel")).toBeVisible();
  await expect(page.locator("#panelTitle")).toHaveText(labelText ?? "");
  await page.locator("#closePanel").click();
  await expect(page.locator("#objectPanel")).toHaveAttribute("hidden", "");
  await expect(page.locator("#objectPanel")).not.toHaveClass(/open/);
  await expect.poll(() => page.locator("#objectPanel").evaluate(
    (element) => getComputedStyle(element).opacity
  )).toBe("0");
};

const screenshotMetrics = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  const crop = {
    left: Math.round(metadata.width * 0.08),
    top: Math.round(metadata.height * 0.08),
    width: Math.round(metadata.width * 0.78),
    height: Math.round(metadata.height * 0.74)
  };
  const { data, info } = await sharp(buffer)
    .extract(crop)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const subjectMask = new Uint8Array(info.width * info.height);
  const occupiedColumns = new Uint16Array(info.width);
  const gridColumns = metadata.width > 500 ? 12 : 8;
  const gridRows = metadata.width > 500 ? 8 : 10;
  const gridCellCount = gridColumns * gridRows;
  const purplePixelsByCell = new Uint32Array(gridCellCount);
  const brightPixelsByCell = new Uint32Array(gridCellCount);
  const pixelsByCell = new Uint32Array(gridCellCount);
  let luminousPixels = 0;
  let purpleMagentaPixels = 0;
  let nearBlackPixels = 0;
  let warmMagentaOrangePixels = 0;
  for (let offset = 0, pixel = 0; offset < data.length; offset += info.channels, pixel += 1) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    const x = pixel % info.width;
    const y = (pixel - x) / info.width;
    const gridColumn = Math.min(gridColumns - 1, Math.floor(x * gridColumns / info.width));
    const gridRow = Math.min(gridRows - 1, Math.floor(y * gridRows / info.height));
    const gridCell = gridRow * gridColumns + gridColumn;
    pixelsByCell[gridCell] += 1;
    if (luminance >= 12) luminousPixels += 1;
    if (luminance <= 10) nearBlackPixels += 1;
    const isWarmMagentaOrange = luminance >= 18
      && saturation >= 10
      && red >= 18
      && (
        (blue >= green * 1.25 && red >= green * 1.10)
        || (red >= green * 1.14 && green >= blue * 0.62 && blue >= green * 0.24)
      );
    if (isWarmMagentaOrange) warmMagentaOrangePixels += 1;
    if (red >= 12 && blue >= 18 && red >= green * 1.22 && blue >= green * 1.32) {
      purpleMagentaPixels += 1;
      purplePixelsByCell[gridCell] += 1;
    }
    if (luminance >= 20 && saturation >= 5) {
      subjectMask[pixel] = 1;
      occupiedColumns[pixel % info.width] += 1;
      brightPixelsByCell[gridCell] += 1;
    }
  }
  const pixelCount = info.width * info.height;
  const firstOccupiedColumn = occupiedColumns.findIndex((count) => count >= 2);
  const lastOccupiedColumn = occupiedColumns.findLastIndex((count) => count >= 2);
  let brightComponentCount = 0;
  const stack = [];
  for (let pixel = 0; pixel < subjectMask.length; pixel += 1) {
    if (subjectMask[pixel] !== 1) continue;
    let componentSize = 0;
    subjectMask[pixel] = 2;
    stack.push(pixel);
    while (stack.length > 0) {
      const current = stack.pop();
      componentSize += 1;
      const x = current % info.width;
      const y = (current - x) / info.width;
      for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
        for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
          if (deltaX === 0 && deltaY === 0) continue;
          const nextX = x + deltaX;
          const nextY = y + deltaY;
          if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
          const next = nextY * info.width + nextX;
          if (subjectMask[next] !== 1) continue;
          subjectMask[next] = 2;
          stack.push(next);
        }
      }
    }
    if (componentSize >= 3) brightComponentCount += 1;
  }
  const occupiedGridRatio = (cellCounts) => Array.from(cellCounts)
    .filter((count, index) => count / pixelsByCell[index] >= 0.006)
    .length / gridCellCount;
  return Object.freeze({
    luminousRatio: luminousPixels / pixelCount,
    purpleMagentaRatio: purpleMagentaPixels / pixelCount,
    nearBlackRatio: nearBlackPixels / pixelCount,
    warmMagentaOrangeRatio: warmMagentaOrangePixels / pixelCount,
    purpleGridCoverage: occupiedGridRatio(purplePixelsByCell),
    brightGridCoverage: occupiedGridRatio(brightPixelsByCell),
    occupiedWidthRatio: firstOccupiedColumn < 0
      ? 0
      : (lastOccupiedColumn - firstOccupiedColumn + 1) / info.width,
    brightComponentCount
  });
};

const captureSettledStage = async ({
  page,
  stage,
  path,
  expectPurple = false,
  minimumLuminousRatio = 0.01,
  minimumPurpleRatio = 0.0015,
  minimumPurpleGridCoverage = 0,
  minimumBrightGridCoverage = 0,
  minimumOccupiedWidth = 0,
  minimumBrightComponents = 0,
  maximumNearBlackRatio = 1,
  minimumWarmMagentaOrangeRatio = 0
}) => {
  await expectStage(page, stage);
  await settledFrame(page);
  await expectNoHorizontalOverflow(page);
  await expectRailInvariant(page, stage);
  const screenshot = await page.screenshot({ path: `${ARTIFACT_DIRECTORY}/${path}` });
  const metrics = await screenshotMetrics(screenshot);
  expect(metrics.luminousRatio).toBeGreaterThan(minimumLuminousRatio);
  if (expectPurple) expect(metrics.purpleMagentaRatio).toBeGreaterThanOrEqual(minimumPurpleRatio);
  if (minimumPurpleGridCoverage > 0) {
    expect(metrics.purpleGridCoverage).toBeGreaterThanOrEqual(minimumPurpleGridCoverage);
  }
  if (minimumBrightGridCoverage > 0) {
    expect(metrics.brightGridCoverage).toBeGreaterThanOrEqual(minimumBrightGridCoverage);
  }
  if (minimumOccupiedWidth > 0) {
    expect(metrics.occupiedWidthRatio).toBeGreaterThan(minimumOccupiedWidth);
  }
  if (minimumBrightComponents > 0) {
    expect(metrics.brightComponentCount).toBeGreaterThan(minimumBrightComponents);
  }
  if (maximumNearBlackRatio < 1) {
    expect(metrics.nearBlackRatio).toBeLessThanOrEqual(maximumNearBlackRatio);
  }
  if (minimumWarmMagentaOrangeRatio > 0) {
    expect(metrics.warmMagentaOrangeRatio).toBeGreaterThanOrEqual(
      minimumWarmMagentaOrangeRatio
    );
  }
  return metrics;
};

const startJourney = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  await expect(page.locator("body")).not.toHaveClass(/intro-pending/);
};

const expectStage = async (page, stage) => {
  await expect(page.locator("body")).toHaveAttribute("data-stage", String(stage));
  await expect.poll(() => page.evaluate(({ targetStage, stageCount }) => {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const expectedProgress = targetStage / (stageCount - 1);
    return Math.abs(window.scrollY / maxScroll - expectedProgress);
  }, { targetStage: stage, stageCount: STAGES.length })).toBeLessThan(0.002);
};

const solveEnginePuzzle = async (page) => {
  const tiles = page.locator(".engine-puzzle__tile");
  await expect(tiles).toHaveCount(9);
  let order = await tiles.evaluateAll((elements) => elements.map((element) => {
    const [x, y] = element.style.backgroundPosition.split(" ").map(Number.parseFloat);
    return Math.round(y / 50) * 3 + Math.round(x / 50);
  }));

  for (let target = 0; target < order.length; target += 1) {
    const source = order.indexOf(target);
    if (source === target) continue;
    await tiles.nth(target).click();
    await tiles.nth(source).click();
    order = order.map((piece, index) => (
      index === target ? order[source] : index === source ? order[target] : piece
    ));
  }
};

const webLevels = Object.freeze([
  Object.freeze({ count: 9, path: Object.freeze([[3, 0], [4, 2], [1, 0], [2, 0]]) }),
  Object.freeze({ count: 12, path: Object.freeze([[8, 0], [9, 2], [5, 0], [6, 2], [2, 0], [3, 0]]) }),
  Object.freeze({ count: 16, path: Object.freeze([
    [12, 2], [8, 0], [9, 1], [13, 3], [14, 2], [10, 1], [6, 0], [7, 2], [3, 0]
  ]) })
]);

const solveWebLevel = async (page, definition, { final = false, nextCount = null } = {}) => {
  const flow = page.locator("#webFlow");
  const tiles = flow.locator(".web-flow__tile");
  await expect(tiles).toHaveCount(definition.count);

  for (const [index, targetRotation] of definition.path) {
    const levelState = await flow.evaluate((element, expectedCount) => ({
      solved: element.classList.contains("solved"),
      tileCount: element.querySelectorAll(".web-flow__tile").length,
      expectedCount
    }), definition.count);
    if (levelState.solved || levelState.tileCount !== levelState.expectedCount) break;
    const transform = await tiles.nth(index).locator(".web-flow__pipe").evaluate(
      (element) => element.style.transform
    );
    const degrees = Number.parseInt(transform.match(/-?\d+/)?.[0] ?? "0", 10);
    const currentRotation = ((degrees / 90) % 4 + 4) % 4;
    const clickCount = (targetRotation - currentRotation + 4) % 4;
    for (let click = 0; click < clickCount; click += 1) {
      await tiles.nth(index).click();
      const clickState = await flow.evaluate((element, expectedCount) => ({
        solved: element.classList.contains("solved"),
        tileCount: element.querySelectorAll(".web-flow__tile").length,
        expectedCount
      }), definition.count);
      if (clickState.solved || clickState.tileCount !== clickState.expectedCount) break;
    }
  }

  if (final) {
    await expect(flow).toBeHidden();
    await expect(flow).toHaveAttribute("inert", "");
    await expect(flow).toHaveAttribute("aria-hidden", "true");
  } else {
    await expect.poll(() => flow.evaluate((element, expectedNextCount) => {
      if (element.classList.contains("solved")) return "solved";
      const nextTiles = [...element.querySelectorAll(".web-flow__tile")];
      const active = !element.hidden
        && !element.hasAttribute("inert")
        && element.getAttribute("aria-hidden") !== "true";
      return active
        && nextTiles.length === expectedNextCount
        && nextTiles.every((tile) => !tile.disabled)
        ? "advanced"
        : "incomplete";
    }, nextCount)).toMatch(/^(solved|advanced)$/);
  }
};

const expectInactiveButton = async (locator) => {
  await expect(locator).toBeHidden();
  await expect(locator).toBeDisabled();
  await expect(locator).toHaveAttribute("tabindex", "-1");
  await expect(locator).toHaveAttribute("aria-hidden", "true");
};

test("inactive game controls stay unfocusable and cannot advance progression", async ({ page }) => {
  test.setTimeout(90_000);
  await startJourney(page);
  const navigation = page.getByRole("navigation", { name: "Масштабы" });
  const earthButton = navigation.getByRole("button", { name: "Земля" });
  const systemButton = navigation.getByRole("button", { name: /Система/ });
  const galaxyButton = navigation.getByRole("button", { name: "Галактика" });
  const unknownButton = navigation.locator('button[data-stage="6"]');
  const rocket = page.locator("#rocketCatcher");
  const engine = page.locator("#enginePuzzleOpen");
  const webRunner = page.locator("#webRunner");
  const webFlow = page.locator("#webFlow");

  await expectInactiveButton(rocket);
  await expectInactiveButton(engine);
  await expectInactiveButton(webRunner);
  await expect(webFlow).toBeHidden();
  await expect(webFlow).toHaveAttribute("inert", "");
  await expect(webFlow).toHaveAttribute("aria-hidden", "true");
  await expect(webFlow.locator(".web-flow__tile").first()).toBeDisabled();

  await page.locator("#locateButton").focus();
  const tabStops = [];
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press("Tab");
    tabStops.push(await page.evaluate(() => document.activeElement?.id ?? ""));
  }
  expect(tabStops).not.toContain("rocketCatcher");
  expect(tabStops).not.toContain("enginePuzzleOpen");
  expect(tabStops).not.toContain("webRunner");

  await page.evaluate(() => {
    document.querySelector("#rocketCatcher")?.click();
    document.querySelector("#enginePuzzleOpen")?.click();
    document.querySelector("#webRunner")?.click();
    document.querySelector("#webFlow .web-flow__tile")?.click();
  });
  await expect(systemButton).toBeDisabled();
  await expect(unknownButton).toBeDisabled();
  await expectStage(page, 0);

  await earthButton.click();
  await expectStage(page, 1);
  await expect(page.locator("body")).toHaveClass(/earth-ship-ready/, { timeout: 8_000 });
  await expect(rocket).toBeVisible();
  await expect(rocket).toBeEnabled();
  await expect(rocket).not.toHaveAttribute("tabindex", "-1");
  await expectInactiveButton(engine);
  await expectInactiveButton(webRunner);

  await rocket.click();
  await page.waitForFunction(() => {
    const zone = document.querySelector("#rocketCatcher");
    if (!zone?.classList.contains("armed")) return false;
    zone.click();
    return true;
  }, undefined, { timeout: 4_000 });
  await expect(systemButton).toBeEnabled();
  await expect(rocket).toBeHidden();
  await expect(rocket).toBeDisabled();

  await systemButton.click();
  await expectStage(page, 2);
  await page.evaluate(() => {
    document.querySelector("#enginePuzzleOpen")?.click();
    const tiles = document.querySelectorAll("#enginePuzzleBoard .engine-puzzle__tile");
    tiles[0]?.click();
    tiles[1]?.click();
  });
  await expect(page.locator("#enginePuzzle")).toBeHidden();
  await expect(galaxyButton).toBeDisabled();
  await expect(unknownButton).toBeDisabled();
});

test("future stages stay locked across scroll inputs while backward travel stays available", async ({ page }) => {
  test.setTimeout(90_000);
  await startJourney(page);
  const navigation = page.getByRole("navigation", { name: "Масштабы" });
  const earthButton = navigation.getByRole("button", { name: "Земля" });
  const systemButton = navigation.getByRole("button", { name: /Система/ });

  await expect(navigation.getByRole("button", { name: "Гелиосфера" })).toHaveCount(0);
  await expect(earthButton).toBeEnabled();
  await expect(systemButton).toBeDisabled();
  await expect(systemButton).toHaveAttribute("aria-label", /Сначала поймай ракету/);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expectStage(page, 1);
  await expect(page.locator("#missionStatus")).toContainText("Сначала поймай ракету");

  const zoomWheel = await page.evaluate(() => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: 120
    });
    const allowedDefault = window.dispatchEvent(event);
    return { allowedDefault, defaultPrevented: event.defaultPrevented };
  });
  expect(zoomWheel).toEqual({ allowedDefault: true, defaultPrevented: false });

  await page.keyboard.press("End");
  await expectStage(page, 1);

  await page.evaluate(() => document.activeElement?.blur());
  for (const key of ["PageDown", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await expectStage(page, 1);
  }

  await page.mouse.wheel(0, 100_000);
  await expectStage(page, 1);
  for (let index = 0; index < 12; index += 1) await page.mouse.wheel(0, 80);
  await expectStage(page, 1);

  await systemButton.dispatchEvent("click");
  await expectStage(page, 1);

    await page.mouse.wheel(0, -100_000);
    await expectStage(page, 0);
  await earthButton.click();
  await expectStage(page, 1);

  await expect(page.locator("#missionStatus")).toHaveCount(1);
});

test("touch gestures cannot pass a barrier and do not trap backward travel", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  await startJourney(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(page.locator("canvas#cosmosCanvas")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".superpowers/sdd/task-7-artifacts/mobile-locked-route.png" });
  await page.getByRole("navigation", { name: "Масштабы" })
    .getByRole("button", { name: "Земля" })
    .click();
  await expectStage(page, 1);

  const dispatchTouchScroll = (fromY, toY, defaultScrollY) => page.evaluate(
    ({ from, to, scrollY }) => {
      const touchFor = (clientY) => new Touch({
        identifier: 1,
        target: document.body,
        clientX: 180,
        clientY
      });
      document.body.dispatchEvent(new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [touchFor(from)]
      }));
      const move = new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [touchFor(to)]
      });
      const allowedDefault = document.body.dispatchEvent(move);
      if (allowedDefault) window.scrollBy(0, scrollY);
      document.body.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: []
      }));
      return { allowedDefault, defaultPrevented: move.defaultPrevented };
    },
    { from: fromY, to: toY, scrollY: defaultScrollY }
  );

  const forward = await dispatchTouchScroll(760, 80, 10_000);
  expect(forward).toEqual({ allowedDefault: false, defaultPrevented: true });
  await expectStage(page, 1);

  const pinch = await page.evaluate(() => {
    const touchFor = (identifier, clientX, clientY) => new Touch({
      identifier,
      target: document.body,
      clientX,
      clientY
    });
    document.body.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touchFor(0, 120, 700), touchFor(1, 270, 500)]
    }));
    const event = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touchFor(0, 120, 300), touchFor(1, 270, 650)]
    });
    const allowedDefault = document.body.dispatchEvent(event);
    document.body.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: []
    }));
    return { allowedDefault, defaultPrevented: event.defaultPrevented };
  });
  expect(pinch).toEqual({ allowedDefault: true, defaultPrevented: false });

  const backward = await dispatchTouchScroll(80, 760, -10_000);
  expect(backward).toEqual({ allowedDefault: true, defaultPrevented: false });
  await expectStage(page, 0);

  await context.close();
});

test("each real game victory unlocks the next route immediately", async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => 12
    });
  });
  let errors = [];
  page.on("console", (message) => {
    const screenshotReadbackAdvisory = /GL Driver Message.*Performance.*ReadPixels/i.test(
      message.text()
    );
    if (!screenshotReadbackAdvisory && (
      message.type() === "error" || /webgl|GL Driver Message/i.test(message.text())
    )) {
      errors = [...errors, message.text()];
    }
  });
  page.on("pageerror", (error) => {
    errors = [...errors, error.message];
  });
  await page.setViewportSize({ width: 1112, height: 625 });
  await startJourney(page);
  const selectedQuality = await selectExpectedHighTierProfile(page);

  const navigation = page.getByRole("navigation", { name: "Масштабы" });
  const earthButton = navigation.getByRole("button", { name: "Земля" });
  const systemButton = navigation.getByRole("button", { name: /Система/ });
  const galaxyButton = navigation.getByRole("button", { name: "Галактика" });
  const groupButton = navigation.getByRole("button", { name: "Группа" });
  const webButton = navigation.getByRole("button", { name: "Вселенная" });
  const unknownButton = navigation.locator('button[data-stage="6"]');
  await expect(unknownButton).toHaveText("?");

  await earthButton.click();
  await expectStage(page, 1);
  const catcher = page.locator("#rocketCatcher");
  await expect.poll(() => catcher.evaluate((element) => getComputedStyle(element).pointerEvents), {
    timeout: 8_000
  }).toBe("auto");
  await catcher.click();
  await expect(page.locator("#narrationPanel")).toHaveAttribute("data-cue", "earthRocketPrompt");
  await page.waitForFunction(() => {
    const zone = document.querySelector("#rocketCatcher");
    if (!zone?.classList.contains("armed")) return false;
    zone.click();
    return true;
  }, undefined, { timeout: 4_000 });
  await expect(systemButton).toBeEnabled();
  await expect(galaxyButton).toBeDisabled();

  await systemButton.click();
  await expectStage(page, 2);
  await page.getByRole("button", { name: "Скрыть субтитры" }).click();
  await expect(page.locator("body")).toHaveClass(/subtitles-hidden/);
  for (const planet of SOLAR_PLANETS) {
    const label = page.locator(`.space-label[data-id="solar-${planet.name.toLowerCase()}"]`);
    await expect(label).toHaveClass(/visible/);
    await label.click();
    const options = page.locator("#panelQuiz .panel-quiz__option");
    await expect(options).toHaveCount(planet.quiz.options.length);
    await options.nth(planet.quiz.answer).click();
    await expect(page.locator("#panelQuiz")).toHaveAttribute("data-state", "solved");
    await page.locator("#closePanel").click();
  }

  const engineButton = page.locator("#enginePuzzleOpen");
  await expect.poll(() => engineButton.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("auto");
  await engineButton.click();
  await solveEnginePuzzle(page);
  await expect(webButton).toBeEnabled();
  await expect(unknownButton).toBeDisabled();
  await expect(unknownButton).toHaveAttribute("aria-label", /космическую нить/);
  await expectInactiveButton(engineButton);
  await expectInactiveButton(page.locator("#webRunner"));
  await expect(page.locator("#webFlow")).toBeHidden();
  await expect(page.locator("#webFlow")).toHaveAttribute("inert", "");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await systemButton.click();
  const desktopDprEvidence = await expectCanvasDpr(page, selectedQuality.profile);
  await captureSettledStage({
    page,
    stage: 2,
    path: "solar-system.png"
  });
  await galaxyButton.click();
  await captureSettledStage({
    page,
    stage: 3,
    path: "milky-way.png",
    minimumOccupiedWidth: 0.5
  });
  await groupButton.click();
  await expectLocalGroupAnnotations(page);
  await captureSettledStage({
    page,
    stage: 4,
    path: "local-group.png",
    minimumBrightComponents: 30,
    minimumBrightGridCoverage: 0.42
  });
  await webButton.click();
  await expectStage(page, 5);
  await expect(page.locator("#webRunner")).toBeVisible();
  await expect(page.locator("#webRunner")).toBeEnabled();
  await expect(page.locator("#webFlow")).toBeVisible();
  await expect(page.locator("#webFlow .web-flow__tile").first()).toBeEnabled();
  await page.setViewportSize({ width: 640, height: 360 });

  for (let index = 0; index < webLevels.length; index += 1) {
    await solveWebLevel(page, webLevels[index], {
      final: index === webLevels.length - 1,
      nextCount: webLevels[index + 1]?.count ?? null
    });
    if (index < webLevels.length - 1) {
      await expect(page.locator("#webFlow .web-flow__tile")).toHaveCount(webLevels[index + 1].count, {
        timeout: 3_000
      });
      await expect(page.locator("#webFlow")).not.toHaveClass(/solved/);
    }
  }

  await expect(unknownButton).toBeEnabled({ timeout: 3_000 });
  await expectInactiveButton(page.locator("#webRunner"));
  await expect(page.locator("#webFlow")).toBeHidden();
  await expect(page.locator("#webFlow .web-flow__tile").first()).toBeDisabled();
  await expect.poll(() => page.locator("#webFlow").evaluate(
    (element) => getComputedStyle(element).opacity
  )).toBe("0");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await webButton.click();
  await captureSettledStage({
    page,
    stage: 5,
    path: "cosmic-web.png",
    expectPurple: true,
    minimumLuminousRatio: 0.04,
    minimumPurpleRatio: 0.055,
    minimumPurpleGridCoverage: 0.6,
    maximumNearBlackRatio: 0.65,
    minimumWarmMagentaOrangeRatio: 0.08
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await systemButton.click();
  await captureSettledStage({
    page,
    stage: 2,
    path: "solar-system-mobile.png"
  });
  await galaxyButton.click();
  await captureSettledStage({
    page,
    stage: 3,
    path: "milky-way-mobile.png",
    minimumOccupiedWidth: 0.5
  });
  await groupButton.click();
  await expectLocalGroupAnnotations(page);
  const mobileDprEvidence = await expectCanvasDpr(page, selectedQuality.profile);
  await captureSettledStage({
    page,
    stage: 4,
    path: "local-group-mobile.png",
    minimumBrightComponents: 20,
    minimumBrightGridCoverage: 0.3
  });
  await webButton.click();
  await captureSettledStage({
    page,
    stage: 5,
    path: "cosmic-web-mobile.png",
    expectPurple: true,
    minimumLuminousRatio: 0.025,
    minimumPurpleRatio: 0.035,
    minimumPurpleGridCoverage: 0.4,
    maximumNearBlackRatio: 0.72,
    minimumWarmMagentaOrangeRatio: 0.07
  });
  const mobileDistanceRail = await page.locator("#distanceScale").boundingBox();
  const mobileLabels = page.locator(".space-label.visible");
  await expect(mobileLabels).not.toHaveCount(0);
  expect(mobileDistanceRail).not.toBeNull();
  expect(mobileDistanceRail.width).toBeLessThanOrEqual(220);
  expect(mobileDistanceRail.height).toBeLessThanOrEqual(92);
  expect(Math.abs(
    mobileDistanceRail.x + mobileDistanceRail.width / 2 - 390 / 2
  )).toBeLessThanOrEqual(4);
  expect(mobileDistanceRail.y).toBeGreaterThanOrEqual(48);
  expect(mobileDistanceRail.y + mobileDistanceRail.height).toBeLessThanOrEqual(148);
  for (let index = 0; index < await mobileLabels.count(); index += 1) {
    const labelBounds = await mobileLabels.nth(index).boundingBox();
    expect(labelBounds).not.toBeNull();
    const overlapsRail = !(
      labelBounds.x + labelBounds.width + 6 <= mobileDistanceRail.x
      || labelBounds.x >= mobileDistanceRail.x + mobileDistanceRail.width + 6
      || labelBounds.y + labelBounds.height + 6 <= mobileDistanceRail.y
      || labelBounds.y >= mobileDistanceRail.y + mobileDistanceRail.height + 6
    );
    expect(overlapsRail).toBe(false);
  }
  await unknownButton.click();
  await expectStage(page, 6);
  await page.locator("#starMaker").click();
  await page.locator("#starMaker").click();
  await page.mouse.click(55, 560);
  await expect(page.locator("body")).toHaveClass(/final-star-lit/);
  await expect(page.locator("#personalStars span")).toHaveCount(1);
  await expect(page.locator("#couponModal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${ARTIFACT_DIRECTORY}/unknown-star-mobile.png` });
  await expect(page.locator("#couponModal")).toBeVisible({ timeout: 2_000 });
  await page.locator("#couponClose").click();
  await expect(page.locator("#couponModal")).toBeHidden();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await unknownButton.click();
  await expectStage(page, 6);
  await settledFrame(page);
  await expectCanvasDpr(page, selectedQuality.profile);
  await expect(page.locator("#personalStars span")).toHaveCount(1);
  await expect(page.locator("#couponModal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${ARTIFACT_DIRECTORY}/unknown-star.png` });

  console.info("DPR_EVIDENCE", JSON.stringify({
    selected: selectedQuality,
    desktop: desktopDprEvidence,
    mobile: mobileDprEvidence
  }));
  expect(errors).toEqual([]);
});

test("the WebGL canvas starts without browser console errors", async ({ page }) => {
  let errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors = [...errors, message.text()];
  });

  await startJourney(page);

  await expect(page.locator("canvas#cosmosCanvas")).toBeVisible();
  expect(errors).toEqual([]);
});
