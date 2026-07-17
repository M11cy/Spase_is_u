import { expect, it, vi } from "vitest";
import {
  applyLabelPlacements,
  createLabelLayoutCoordinator
} from "../../src/ui/label-layout-coordinator.js";
import { setLabelAccessibility } from "../../src/ui/create-shell.js";

const createElement = (width, height) => ({
  getBoundingClientRect: vi.fn(() => ({ width, height }))
});

const placeAll = vi.fn(({ labels }) => Object.freeze(labels.map((label) => Object.freeze({
  id: label.id,
  x: label.anchor.x,
  y: label.anchor.y,
  width: label.size.width,
  height: label.size.height,
  hidden: false,
  anchor: Object.freeze({ ...label.anchor })
}))));

it("measures only on invalidation and lays out only when geometry changes", () => {
  const firstElement = createElement(30, 18);
  const secondElement = createElement(40, 20);
  const coordinator = createLabelLayoutCoordinator({
    layout: placeAll,
    getViewport: () => ({ width: 160, height: 100 }),
    padding: 8,
    gap: 6
  });
  const records = [
    { id: "first", element: firstElement, anchor: { x: 20, y: 30 }, priority: 2 },
    { id: "second", element: secondElement, anchor: { x: 80, y: 50 }, priority: 1 }
  ];

  const initial = coordinator.update(records);
  const cached = coordinator.update(records);

  expect(cached).toBe(initial);
  expect(firstElement.getBoundingClientRect).toHaveBeenCalledTimes(1);
  expect(secondElement.getBoundingClientRect).toHaveBeenCalledTimes(1);
  expect(placeAll).toHaveBeenCalledTimes(1);

  coordinator.update([
    { ...records[0], anchor: { x: 21, y: 30 } },
    records[1]
  ]);
  expect(placeAll).toHaveBeenCalledTimes(2);
  expect(firstElement.getBoundingClientRect).toHaveBeenCalledTimes(1);

  coordinator.invalidateMeasurements();
  coordinator.update(records);
  expect(firstElement.getBoundingClientRect).toHaveBeenCalledTimes(2);
  expect(secondElement.getBoundingClientRect).toHaveBeenCalledTimes(2);
  expect(placeAll).toHaveBeenCalledTimes(3);
});

it("remeasures when the visible label set changes", () => {
  const firstElement = createElement(30, 18);
  const secondElement = createElement(40, 20);
  const coordinator = createLabelLayoutCoordinator({
    layout: placeAll,
    getViewport: () => ({ width: 160, height: 100 })
  });
  const records = [
    { id: "first", element: firstElement, anchor: { x: 20, y: 30 }, priority: 2 },
    { id: "second", element: secondElement, anchor: { x: 80, y: 50 }, priority: 1 }
  ];

  coordinator.update(records);
  coordinator.update(records.slice(0, 1));

  expect(firstElement.getBoundingClientRect).toHaveBeenCalledTimes(2);
  expect(secondElement.getBoundingClientRect).toHaveBeenCalledTimes(1);
});

it("suppresses an unplaced label accessibly and restores it on the next placement", () => {
  const element = document.createElement("button");
  element.classList.add("visible");
  element.style.opacity = "0.8";
  element.style.transform = "translate3d(10px, 20px, 0)";
  element.style.setProperty("--anchor-x", "8px");
  element.style.setProperty("--anchor-y", "18px");
  const records = [{ id: "label", element, opacity: "0.8" }];

  applyLabelPlacements({
    placements: [{ id: "label", hidden: true }],
    records,
    setAccessibility: setLabelAccessibility
  });

  expect(element.classList.contains("visible")).toBe(false);
  expect(element.style.opacity).toBe("0");
  expect(element.style.transform).toBe("");
  expect(element.style.getPropertyValue("--anchor-x")).toBe("");
  expect(element.tabIndex).toBe(-1);
  expect(element.getAttribute("aria-hidden")).toBe("true");

  applyLabelPlacements({
    placements: [{
      id: "label",
      x: 24,
      y: 30,
      hidden: false,
      anchor: { x: 20, y: 26 }
    }],
    records,
    setAccessibility: setLabelAccessibility
  });

  expect(element.classList.contains("visible")).toBe(true);
  expect(element.style.opacity).toBe("0.8");
  expect(element.style.transform).toBe("translate3d(24px, 30px, 0)");
  expect(element.style.getPropertyValue("--anchor-x")).toBe("20px");
  expect(element.tabIndex).toBe(0);
  expect(element.hasAttribute("aria-hidden")).toBe(false);
});
