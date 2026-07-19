import { expect, test } from "@playwright/test";
import { SOLAR_PLANETS, STAGES } from "../src/data/cosmos.js";

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

const solveWebLevel = async (page, definition) => {
  const flow = page.locator("#webFlow");
  const tiles = flow.locator(".web-flow__tile");
  await expect(tiles).toHaveCount(definition.count);

  for (const [index, targetRotation] of definition.path) {
    if (await flow.evaluate((element) => element.classList.contains("solved"))) break;
    const transform = await tiles.nth(index).locator(".web-flow__pipe").evaluate(
      (element) => element.style.transform
    );
    const degrees = Number.parseInt(transform.match(/-?\d+/)?.[0] ?? "0", 10);
    const currentRotation = ((degrees / 90) % 4 + 4) % 4;
    const clickCount = (targetRotation - currentRotation + 4) % 4;
    for (let click = 0; click < clickCount; click += 1) {
      await tiles.nth(index).click();
      if (await flow.evaluate((element) => element.classList.contains("solved"))) break;
    }
  }

  await expect(flow).toHaveClass(/solved/);
};

test("future stages stay locked across scroll inputs while backward travel stays available", async ({ page }) => {
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

  await page.keyboard.press("Home");
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
  test.setTimeout(90_000);
  let errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors = [...errors, message.text()];
  });
  await startJourney(page);

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

  await galaxyButton.click();
  await expectStage(page, 3);
  await page.screenshot({ path: ".superpowers/sdd/task-7-artifacts/galaxy.png" });
  await groupButton.click();
  await expectStage(page, 4);
  await page.screenshot({ path: ".superpowers/sdd/task-7-artifacts/local-group.png" });
  await webButton.click();
  await expectStage(page, 5);

  for (let index = 0; index < webLevels.length; index += 1) {
    await solveWebLevel(page, webLevels[index]);
    if (index < webLevels.length - 1) {
      await expect(page.locator("#webFlow .web-flow__tile")).toHaveCount(webLevels[index + 1].count, {
        timeout: 3_000
      });
      await expect(page.locator("#webFlow")).not.toHaveClass(/solved/);
    }
  }

  await expect(unknownButton).toBeEnabled({ timeout: 3_000 });
  await expect.poll(() => page.locator("#webFlow").evaluate(
    (element) => getComputedStyle(element).opacity
  )).toBe("0");
  await page.screenshot({ path: ".superpowers/sdd/task-7-artifacts/cosmic-web.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await webButton.click();
  await expectStage(page, 5);
  await page.screenshot({ path: ".superpowers/sdd/task-7-artifacts/cosmic-web-mobile.png" });
  await unknownButton.click();
  await expectStage(page, 6);
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
