import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIntroController } from "../../src/ui/intro-controller.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  document.body.className = "";
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const createHarness = ({ reducedMotion = false, previousAriaHidden, previousInert = false } = {}) => {
  const root = document.createElement("section");
  const startButton = document.createElement("button");
  const backgroundControl = document.createElement("button");
  backgroundControl.textContent = "Underlying control";
  if (previousAriaHidden !== undefined) backgroundControl.setAttribute("aria-hidden", previousAriaHidden);
  if (previousInert) backgroundControl.setAttribute("inert", "");
  const onStart = vi.fn();
  root.append(startButton);
  document.body.append(root, backgroundControl);
  const controller = createIntroController({ root, startButton, onStart, reducedMotion });
  return { controller, onStart, root, startButton, backgroundControl };
};

describe("createIntroController", () => {
  it("locks scroll and removes underlying sibling controls from keyboard and accessibility access", () => {
    const { onStart, root, startButton, backgroundControl } = createHarness();

    expect(document.body.classList.contains("intro-pending")).toBe(true);
    expect(backgroundControl.hasAttribute("inert")).toBe(true);
    expect(backgroundControl.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(startButton);
    startButton.click();

    expect(root.dataset.state).toBe("leaving");
    expect(document.body.classList.contains("intro-pending")).toBe(false);
    expect(backgroundControl.hasAttribute("inert")).toBe(false);
    expect(backgroundControl.hasAttribute("aria-hidden")).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("is idempotent and hides immediately for reduced motion", () => {
    const { controller, onStart, root } = createHarness({ reducedMotion: true });
    expect(controller.start()).toBe(true);
    expect(controller.start()).toBe(false);
    vi.runAllTimers();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(root.hidden).toBe(true);
  });

  it("keeps the leaving shell mounted for its standard cinematic delay", () => {
    const { controller, root } = createHarness();
    controller.start();
    vi.advanceTimersByTime(899);
    expect(root.hidden).toBe(false);

    vi.advanceTimersByTime(1);
    expect(root.hidden).toBe(true);
  });

  it("removes the event listener safely when disposed", () => {
    const { controller, onStart, startButton } = createHarness();

    controller.dispose();
    controller.dispose();
    startButton.click();

    expect(onStart).not.toHaveBeenCalled();
  });

  it("hides a leaving intro and clears its delayed timer when disposed", () => {
    const { controller, root } = createHarness();

    controller.start();
    controller.dispose();
    vi.runAllTimers();

    expect(root.hidden).toBe(true);
  });

  it("restores exact sibling accessibility state when disposed before start", () => {
    const { controller, backgroundControl } = createHarness({
      previousAriaHidden: "false",
      previousInert: true
    });

    controller.dispose();

    expect(backgroundControl.getAttribute("aria-hidden")).toBe("false");
    expect(backgroundControl.hasAttribute("inert")).toBe(true);
  });
});
