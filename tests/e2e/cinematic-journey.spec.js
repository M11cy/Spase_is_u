import { expect, test } from "@playwright/test";

const TRANSPARENT_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X1n1WQAAAABJRU5ErkJggg==",
  "base64"
);

const viewports = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 900 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 })
]);

for (const viewport of viewports) {
  test(`starts with the cinematic Earth and reaches the frozen map on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);

    const consoleErrors = [];
    const pageErrors = [];
    const localFailures = [];
    let tileRequests = 0;

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === "http://127.0.0.1:5173" && response.status() >= 400) {
        localFailures.push(`${response.status()} ${url.pathname}`);
      }
    });
    await page.route("https://server.arcgisonline.com/**", async (route) => {
      tileRequests += 1;
      await route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_TILE });
    });

    await page.goto("/");

    const intro = page.locator("#introLayer");
    const canvas = page.locator("#cosmosCanvas");
    const ship = page.locator("#cinematicShip");
    const startButton = page.locator("#startJourneyButton");
    const mapLayer = page.locator(".map-layer");
    const mapRoot = page.locator("#mapRoot");

    await expect(intro).toBeVisible();
    await expect(startButton).toHaveText("Начать путешествие");
    await expect(page.locator("body")).toHaveClass(/intro-pending/);
    await expect(startButton).toBeFocused();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-earth-presence", /^(?:0\.[1-9]\d*|1(?:\.0+)?)$/);
    await expect(canvas).toHaveAttribute("data-earth-focus-marker-visible", "false");
    expect(await canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
      hasWebGL: Boolean(element.getContext("webgl2") || element.getContext("webgl"))
    }))).toMatchObject({ hasWebGL: true });

    const lockedSiblings = page.locator(".experience > :not(#introLayer)");
    const lockedSiblingCount = await lockedSiblings.count();
    expect(lockedSiblingCount).toBeGreaterThan(1);
    await expect(lockedSiblings.first()).toHaveAttribute("inert", "");
    await expect(lockedSiblings.first()).toHaveAttribute("aria-hidden", "true");
    expect(await lockedSiblings.evaluateAll((elements) => elements.every((element) => (
      element.hasAttribute("inert") && element.getAttribute("aria-hidden") === "true"
    )))).toBe(true);

    await expect(ship).toHaveJSProperty("complete", true);
    expect(await ship.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    const firstShipTransform = await ship.evaluate((element) => getComputedStyle(element).transform);
    const firstEarthRotations = await canvas.evaluate((element) => ({
      surface: Number(element.dataset.earthSurfaceRotation),
      clouds: Number(element.dataset.earthCloudsRotation)
    }));
    await page.waitForTimeout(350);
    const secondShipTransform = await ship.evaluate((element) => getComputedStyle(element).transform);
    const secondEarthRotations = await canvas.evaluate((element) => ({
      surface: Number(element.dataset.earthSurfaceRotation),
      clouds: Number(element.dataset.earthCloudsRotation)
    }));
    expect(secondShipTransform).not.toBe(firstShipTransform);
    expect(Number.isFinite(firstEarthRotations.surface)).toBe(true);
    expect(Number.isFinite(firstEarthRotations.clouds)).toBe(true);
    const surfaceRotationDelta = secondEarthRotations.surface - firstEarthRotations.surface;
    const cloudsRotationDelta = secondEarthRotations.clouds - firstEarthRotations.clouds;
    expect(surfaceRotationDelta).toBeGreaterThan(0);
    expect(cloudsRotationDelta).toBeGreaterThan(surfaceRotationDelta);

    await expect(mapRoot).toHaveAttribute("data-map-state", "ready");
    await page.waitForTimeout(150);
    const settledTileRequests = tileRequests;
    expect(settledTileRequests).toBeGreaterThan(0);
    const initialMapScale = await mapRoot.evaluate((element) => (
      getComputedStyle(element).getPropertyValue("--map-image-scale").trim()
    ));

    await startButton.click();
    await expect(page.locator("body")).not.toHaveClass(/intro-pending/);
    await expect(intro).toBeHidden({ timeout: 2_000 });
    await expect(mapLayer).toBeVisible();
    await expect(mapRoot).toBeVisible();
    expect(await lockedSiblings.evaluateAll((elements) => (
      elements.every((element) => !element.hasAttribute("inert"))
    ))).toBe(true);
    const restoredInteractiveRoots = page.locator([
      ".experience > .map-layer",
      ".experience > #cosmosCanvas",
      ".experience > .topbar",
      ".experience > #narrationPanel",
      ".experience > #subtitleRestore",
      ".experience > #rocketCatcher",
      ".experience > #webRunner",
      ".experience > #starMaker",
      ".experience > #objectPanel",
      ".experience > .scale-rail",
      ".experience > .distance-summary",
      ".experience > #distanceScale",
      ".experience > #unknownLayer"
    ].join(", "));
    expect(await restoredInteractiveRoots.count()).toBe(13);
    expect(await restoredInteractiveRoots.evaluateAll((elements) => elements.every((element) => (
      element.getAttribute("aria-hidden") !== "true"
    )))).toBe(true);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.08));
    await expect.poll(async () => mapRoot.evaluate((element) => (
      getComputedStyle(element).getPropertyValue("--map-image-scale").trim()
    ))).not.toBe(initialMapScale);
    await page.waitForTimeout(400);
    expect(tileRequests).toBe(settledTileRequests);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(localFailures).toEqual([]);
  });
}
