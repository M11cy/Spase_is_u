import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnnotationPanel } from "../../src/ui/annotation-panel.js";
import { createShell, setLabelAccessibility } from "../../src/ui/create-shell.js";
import { DEFAULT_LOCATION, createLocationController } from "../../src/ui/location.js";
import { STAGES } from "../../src/data/cosmos.js";

const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  if (originalGeolocationDescriptor) {
    Object.defineProperty(navigator, "geolocation", originalGeolocationDescriptor);
  } else {
    delete navigator.geolocation;
  }
  vi.restoreAllMocks();
});

describe("createShell", () => {
  it("renders the cinematic intro before the map", () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });

    expect(shell.introLayer.hidden).toBe(false);
    expect(shell.startJourneyButton.textContent).toBe("Начать путешествие");
    expect(shell.cinematicShip.getAttribute("src")).toContain("cinematic-ship.png");
  });

  it("locks the first paint synchronously until the scene is ready", async () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const [mainSource, stylesSource] = await Promise.all([
      readFile("src/main.js", "utf8"),
      readFile("src/styles.css", "utf8")
    ]);

    expect(document.body.classList.contains("intro-pending")).toBe(true);
    expect(shell.startJourneyButton.disabled).toBe(true);
    expect(shell.startJourneyButton.getAttribute("aria-disabled")).toBe("true");
    expect(stylesSource).toMatch(/\.map-layer\s*\{[^}]*--map-opacity:\s*0;/s);
    expect(stylesSource).toContain("body.intro-pending .experience > :not(#introLayer):not(#cosmosCanvas)");
    expect(stylesSource).toContain('url("../public/fonts/press-start-2p.ttf")');
    expect(stylesSource).not.toContain('url("/fonts/');
    expect(mainSource.indexOf("createIntroController({")).toBeLessThan(mainSource.indexOf("await Promise.all(["));
  });

  it("uses a Vite-base-safe cinematic ship URL instead of a root-hardcoded path", async () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const source = await readFile("src/ui/create-shell.js", "utf8");

    expect(shell.cinematicShip.getAttribute("src")).toBe(`${import.meta.env.BASE_URL}space/cinematic-ship.png`);
    expect(source).toContain("import.meta.env.BASE_URL");
    expect(source).not.toContain('src="/space/cinematic-ship.png"');
  });

  it("retains narration and quest controls", () => {
    const root = document.querySelector("#app");
    const shell = createShell({ root, stages: STAGES });

    ["voiceToggle", "subtitleToggle", "rocketCatcher", "webRunner", "starMaker"]
      .forEach((id) => expect(root.querySelector(`#${id}`)).not.toBeNull());
    expect(shell.narrationPanel.id).toBe("narrationPanel");
    expect(shell.narrationText.id).toBe("narrationText");
    expect(shell.missionStatus.id).toBe("missionStatus");
    expect(shell.personalStars.id).toBe("personalStars");
  });

  it("creates semantic stage navigation and exposes the active stage", () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });

    expect(shell.stageButtons).toHaveLength(8);
    expect(shell.navigation.tagName).toBe("NAV");
    expect(shell.labels.getAttribute("aria-hidden")).toBeNull();
    expect(shell.panel.getAttribute("role")).toBe("dialog");
    expect(shell.panel.getAttribute("aria-labelledby")).toBe("panelTitle");
    expect(shell.panel.hidden).toBe(true);
    expect(shell.mapRoot.id).toBe("mapRoot");
    expect(shell.mapRoot.getAttribute("role")).toBe("region");
    expect(shell.mapStatus.getAttribute("role")).toBe("status");
    expect(shell.mapStatus.getAttribute("aria-live")).toBe("polite");
    expect(shell.mapReticle.getAttribute("aria-hidden")).toBe("true");
    expect(shell.mapLayer.querySelector("iframe")).toBeNull();

    const previousSummary = shell.distanceSummary.textContent;
    shell.setActiveStage(1);

    expect(shell.stageButtons[0].getAttribute("aria-current")).toBeNull();
    expect(shell.stageButtons[1].getAttribute("aria-current")).toBe("step");
    expect(shell.stageButtons[1].classList.contains("active")).toBe(true);
    expect(shell.distanceSummary.textContent).not.toBe(previousSummary);
    expect(shell.distanceSummary.textContent).toContain(STAGES[1].label);
    expect(shell.distanceSummary.textContent).toContain(STAGES[1].distance);
  });

  it("does not inspect or request geolocation during shell creation", () => {
    const getCurrentPosition = vi.fn();
    const geolocationGetter = vi.fn(() => ({ getCurrentPosition }));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      get: geolocationGetter
    });

    createShell({ root: document.querySelector("#app"), stages: STAGES });

    expect(geolocationGetter).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("toggles distance-scale state and removes its listener on dispose", () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });

    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("true");
    expect(shell.distanceScale.hidden).toBe(false);

    shell.distanceSummary.click();
    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("false");
    expect(shell.distanceScale.hidden).toBe(true);
    expect(shell.distanceScale.hasAttribute("data-expanded")).toBe(false);

    shell.distanceSummary.click();
    expect(shell.distanceScale.hidden).toBe(false);
    expect(shell.distanceScale.dataset.expanded).toBe("true");

    shell.dispose();
    shell.distanceSummary.click();
    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps visually absent annotation labels out of the accessibility tree and tab order", () => {
    const label = document.createElement("button");

    setLabelAccessibility(label, false);
    expect(label.tabIndex).toBe(-1);
    expect(label.getAttribute("aria-hidden")).toBe("true");

    setLabelAccessibility(label, true);
    expect(label.getAttribute("tabindex")).toBeNull();
    expect(label.getAttribute("aria-hidden")).toBeNull();
  });

  it("uses a stage label when no shortened navigation label is defined", () => {
    const customStage = { ...STAGES[0], id: "custom", label: "Custom stage" };
    const shell = createShell({ root: document.querySelector("#app"), stages: [customStage] });

    expect(shell.stageButtons[0].textContent).toBe("Custom stage");
  });
});

describe("createAnnotationPanel", () => {
  it("moves focus into the panel and returns it on Escape", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const controller = createAnnotationPanel(shell.panelBindings);
    trigger.focus();

    controller.open(
      {
        title: "Земля",
        text: "Дом",
        discovery: "Наш дом",
        distance: "1 а.е.",
        scale: STAGES[1].label,
        stage: 1
      },
      trigger
    );

    expect(shell.panel.hidden).toBe(false);
    expect(shell.panel.classList.contains("open")).toBe(true);
    expect(document.activeElement).toBe(shell.closeButton);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(shell.panel.hidden).toBe(true);
    expect(shell.panel.classList.contains("open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    controller.dispose();
  });

  it("updates content and image state for successive annotations", () => {
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const controller = createAnnotationPanel(shell.panelBindings);

    controller.open({
      title: "Earth",
      text: "Home",
      discovery: "Known",
      distance: "1 au",
      scale: "Planet",
      image: "/space/earth.jpg"
    });

    expect(shell.panelImage.hidden).toBe(false);
    expect(shell.panelImage.getAttribute("src")).toBe("/space/earth.jpg");
    expect(shell.panelImage.alt).toBe("Earth");
    expect(shell.panel.classList.contains("no-image")).toBe(false);
    expect(shell.panelFields.title.textContent).toBe("Earth");
    expect(shell.panelFields.scale.textContent).toBe("Planet");

    controller.open({ title: "Unknown", text: "?", discovery: "?", distance: "?" });

    expect(shell.panelImage.hidden).toBe(true);
    expect(shell.panelImage.hasAttribute("src")).toBe(false);
    expect(shell.panelImage.alt).toBe("");
    expect(shell.panel.classList.contains("no-image")).toBe(true);
    controller.dispose();
  });

  it("closes from its button and disposes document and button listeners", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const controller = createAnnotationPanel(shell.panelBindings);
    controller.open({ title: "Earth" }, trigger);

    shell.closeButton.click();
    expect(shell.panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    controller.open({ title: "Earth" }, trigger);
    controller.dispose();
    expect(shell.panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    controller.open({ title: "Disposed" }, trigger);
    expect(shell.panel.hidden).toBe(true);
    controller.dispose();

    shell.panel.hidden = false;
    shell.closeButton.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(shell.panel.hidden).toBe(false);
  });

  it("ignores unrelated keys and does not focus a detached trigger", () => {
    const detachedTrigger = document.createElement("button");
    const shell = createShell({ root: document.querySelector("#app"), stages: STAGES });
    const controller = createAnnotationPanel(shell.panelBindings);
    controller.open({ title: "Earth" }, detachedTrigger);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(shell.panel.hidden).toBe(false);

    controller.close();
    expect(shell.panel.hidden).toBe(true);
    expect(document.activeElement).not.toBe(detachedTrigger);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    controller.dispose();
  });
});

describe("createLocationController", () => {
  it("exposes an immutable Moscow fallback without requesting geolocation", () => {
    expect(DEFAULT_LOCATION).toEqual({ lat: 55.7558, lon: 37.6173 });
    expect(Object.isFrozen(DEFAULT_LOCATION)).toBe(true);
  });

  it("supports the satellite-map setLocation contract and freezes the applied coordinates", async () => {
    const setLocation = vi.fn((location) => location);
    const controller = createLocationController({ geolocation: undefined, setLocation });

    const result = await controller.locate();

    expect(result).toEqual(DEFAULT_LOCATION);
    expect(Object.isFrozen(result)).toBe(true);
    expect(setLocation).toHaveBeenCalledWith(DEFAULT_LOCATION);
  });

  it("requests coordinates only when locate is called", async () => {
    const getCurrentPosition = vi.fn((onSuccess) => {
      onSuccess({ coords: { latitude: 59.9386, longitude: 30.3141 } });
    });
    const setMap = vi.fn((location) => location);
    const controller = createLocationController({
      geolocation: { getCurrentPosition },
      setMap,
      fallback: { lat: 55.7558, lon: 37.6173 }
    });

    expect(getCurrentPosition).not.toHaveBeenCalled();

    await expect(controller.locate()).resolves.toEqual({ lat: 59.9386, lon: 30.3141 });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
    expect(setMap).toHaveBeenCalledWith({ lat: 59.9386, lon: 30.3141 });
  });

  it.each(["unavailable", "denied"])("uses the fallback when geolocation is %s", async (failure) => {
    const fallback = { lat: 55.7558, lon: 37.6173 };
    const setMap = vi.fn((location) => location);
    const geolocation = failure === "unavailable"
      ? undefined
      : { getCurrentPosition: (_onSuccess, onError) => onError(new Error("denied")) };
    const controller = createLocationController({ geolocation, setMap, fallback });

    await expect(controller.locate()).resolves.toEqual(fallback);
    expect(setMap).toHaveBeenCalledWith(fallback);
  });

  it("uses the fallback when geolocation returns invalid coordinates", async () => {
    const fallback = { lat: 55.7558, lon: 37.6173 };
    const setLocation = vi.fn((location) => location);
    const controller = createLocationController({
      geolocation: {
        getCurrentPosition: (onSuccess) => onSuccess({
          coords: { latitude: Number.NaN, longitude: 300 }
        })
      },
      setLocation,
      fallback
    });

    await expect(controller.locate()).resolves.toEqual(fallback);
    expect(setLocation).toHaveBeenCalledWith(expect.objectContaining(fallback));
  });
});
