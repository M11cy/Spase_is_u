// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createShell, setLabelAccessibility } from "./create-shell.js";

const stages = Object.freeze([
  { id: "place", label: "Место", distance: "0 км" },
  { id: "earth", label: "Земля", distance: "6371 км" },
  { id: "solar-system", label: "Солнечная система", distance: "1 а.е." },
  { id: "milky-way", label: "Млечный Путь", distance: "27 000 св. лет" },
  { id: "local-group", label: "Локальная группа", distance: "2.5 млн св. лет" },
  { id: "cosmic-web", label: "Космическая сеть", distance: "сотни млн св. лет" },
  { id: "unknown", label: "?", distance: "? световых лет" }
]);

describe("createShell stage access", () => {
  afterEach(() => {
    document.body.className = "";
    document.body.replaceChildren();
  });

  it("disables every stage above the highest unlocked stage with an accessible reason", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages });

    shell.setStageAccess({
      highestUnlockedStage: 1,
      reason: "Сначала поймай ракету у Земли."
    });

    expect(shell.stageButtons.map((button) => button.disabled)).toEqual([
      false, false, true, true, true, true, true
    ]);
    expect(shell.stageButtons.map((button) => button.getAttribute("aria-disabled"))).toEqual([
      "false", "false", "true", "true", "true", "true", "true"
    ]);
    expect(shell.stageButtons[2].getAttribute("aria-label")).toContain("Сначала поймай ракету");
    expect(shell.stageButtons[2].title).toContain("Сначала поймай ракету");

    shell.dispose();
  });

  it("fails closed when stage access receives an invalid boundary", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages });

    shell.setStageAccess({ highestUnlockedStage: Number.NaN, reason: "Маршрут закрыт." });

    expect(shell.stageButtons.map((button) => button.disabled)).toEqual([
      false, true, true, true, true, true, true
    ]);

    shell.dispose();
  });

  it("re-enables completed route segments and refreshes the remaining reason", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages });

    shell.setStageAccess({ highestUnlockedStage: 1, reason: "Поймай ракету." });
    shell.setStageAccess({ highestUnlockedStage: 5, reason: "Соедини космическую нить." });

    expect(shell.stageButtons.slice(0, 6).every((button) => !button.disabled)).toBe(true);
    expect(shell.stageButtons[6].disabled).toBe(true);
    expect(shell.stageButtons[6].getAttribute("aria-label")).toContain("Соедини космическую нить");
    expect(shell.stageButtons[1].hasAttribute("aria-label")).toBe(false);

    shell.setStageAccess({ highestUnlockedStage: 6, reason: "" });
    expect(shell.stageButtons.every((button) => !button.disabled)).toBe(true);
    expect(shell.stageButtons.every((button) => !button.hasAttribute("aria-label"))).toBe(true);

    shell.dispose();
  });

  it("toggles the distance scale and stops handling it after disposal", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages });

    shell.distanceSummary.click();
    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("false");
    expect(shell.distanceScale.hidden).toBe(true);
    expect(shell.distanceScale.hasAttribute("data-expanded")).toBe(false);

    shell.distanceSummary.click();
    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("true");
    expect(shell.distanceScale.hidden).toBe(false);
    expect(shell.distanceScale.dataset.expanded).toBe("true");

    shell.dispose();
    shell.distanceSummary.click();
    expect(shell.distanceSummary.getAttribute("aria-expanded")).toBe("true");
  });

  it("exposes a complete distance route to assistive technology while keeping visual markers decorative", () => {
    const routeStages = [
      { id: "custom-stage", label: "<Earth & beyond>", distance: "&lt;1 & 2&gt;" },
      { id: "another-stage", label: "A &amp; B", distance: "<strong>far</strong>" }
    ];
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages: routeStages });
    const routeSummary = shell.root.querySelector("#distanceScaleA11ySummary");
    const expectedRoute = routeStages.map((stage) => `${stage.label}: ${stage.distance}`).join(". ");

    expect(routeSummary).not.toBeNull();
    expect(routeSummary.classList.contains("sr-only")).toBe(true);
    expect(routeSummary.textContent).toBe(expectedRoute);
    expect(shell.distanceScale.getAttribute("aria-describedby"))
      .toBe("distanceScaleA11ySummary");
    expect(shell.distanceMarkers.getAttribute("aria-hidden")).toBe("true");

    shell.dispose();
  });

  it("uses the supplied stage label when a navigation alias is unavailable", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({
      root: document.querySelector("#app"),
      stages: [{ id: "custom-stage", label: "Новый масштаб", distance: "далеко" }]
    });

    expect(shell.stageButtons[0].textContent).toBe("Новый масштаб");
    shell.dispose();
  });

  it("keeps inactive game controls hidden, disabled, and outside the tab order", () => {
    document.body.innerHTML = '<div id="app"></div>';
    const shell = createShell({ root: document.querySelector("#app"), stages });
    const buttons = [
      shell.rocketCatcher,
      shell.enginePuzzleOpen,
      shell.webRunner,
      shell.starMaker
    ];

    buttons.forEach((button) => {
      expect(button.hidden).toBe(true);
      expect(button.disabled).toBe(true);
      expect(button.tabIndex).toBe(-1);
      expect(button.getAttribute("aria-hidden")).toBe("true");
    });
    expect(shell.rocketShip.hidden).toBe(true);
    expect(shell.webFlow.hidden).toBe(true);
    expect(shell.webFlow.hasAttribute("inert")).toBe(true);
    expect(shell.webFlow.getAttribute("aria-hidden")).toBe("true");

    shell.setGameControlAccess({
      rocketActive: true,
      engineActive: true,
      webActive: true,
      finaleActive: true
    });

    buttons.forEach((button) => {
      expect(button.hidden).toBe(false);
      expect(button.disabled).toBe(false);
      expect(button.hasAttribute("tabindex")).toBe(false);
      expect(button.hasAttribute("aria-hidden")).toBe(false);
    });
    expect(shell.rocketShip.hidden).toBe(false);
    expect(shell.webFlow.hidden).toBe(false);
    expect(shell.webFlow.hasAttribute("inert")).toBe(false);
    expect(shell.webFlow.hasAttribute("aria-hidden")).toBe(false);

    shell.dispose();
  });
});

describe("setLabelAccessibility", () => {
  it("removes hidden semantics only while the label is visible", () => {
    const label = document.createElement("button");

    setLabelAccessibility(label, false);
    expect(label.tabIndex).toBe(-1);
    expect(label.getAttribute("aria-hidden")).toBe("true");

    setLabelAccessibility(label, true);
    expect(label.hasAttribute("tabindex")).toBe(false);
    expect(label.hasAttribute("aria-hidden")).toBe(false);
  });
});
