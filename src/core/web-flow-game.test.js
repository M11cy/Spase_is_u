// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebFlowGame } from "./web-flow-game.js";

const firstLevelTargets = Object.freeze([[3, 0], [4, 2], [1, 0], [2, 0]]);

const solveFirstLevel = (container) => {
  const tiles = [...container.querySelectorAll("button")];
  for (const [index, targetRotation] of firstLevelTargets) {
    if (container.classList.contains("solved")) break;
    const pipe = tiles[index].querySelector(".web-flow__pipe");
    const degrees = Number.parseInt(pipe.style.transform.match(/-?\d+/)?.[0] ?? "0", 10);
    const currentRotation = ((degrees / 90) % 4 + 4) % 4;
    const clickCount = (targetRotation - currentRotation + 4) % 4;
    for (let click = 0; click < clickCount; click += 1) {
      tiles[index].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      if (container.classList.contains("solved")) break;
    }
  }
};

describe("cosmic web game access", () => {
  afterEach(() => vi.useRealTimers());

  it("disables tiles and rejects rotation until explicitly activated", () => {
    const container = document.createElement("div");
    const onStart = vi.fn();
    const game = createWebFlowGame({ container, onStart });
    const firstTile = container.querySelector("button");
    const initialTransform = firstTile.querySelector(".web-flow__pipe").style.transform;

    expect(firstTile.disabled).toBe(true);
    firstTile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(firstTile.querySelector(".web-flow__pipe").style.transform).toBe(initialTransform);
    expect(onStart).not.toHaveBeenCalled();

    game.setActive(true);
    expect(firstTile.disabled).toBe(false);
    firstTile.click();
    expect(firstTile.querySelector(".web-flow__pipe").style.transform).not.toBe(initialTransform);
    expect(onStart).toHaveBeenCalledTimes(1);

    game.setActive(false);
    expect(firstTile.disabled).toBe(true);
  });

  it("pauses a solved-level callback while the game is inactive", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const onLevel = vi.fn();
    const onComplete = vi.fn();
    const game = createWebFlowGame({ container, onLevel, onComplete });

    game.setActive(true);
    solveFirstLevel(container);
    expect(container.classList.contains("solved")).toBe(true);

    game.setActive(false);
    vi.advanceTimersByTime(2_000);
    expect(onLevel).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    game.setActive(true);
    vi.advanceTimersByTime(1_000);
    expect(onLevel).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("clears pending solved presentation when the active game is reset", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const onLevel = vi.fn();
    const game = createWebFlowGame({ container, onLevel });

    game.setActive(true);
    solveFirstLevel(container);
    expect(container.classList.contains("solved")).toBe(true);

    expect(game.reset()).toBe(true);
    expect(container.classList.contains("solved")).toBe(false);
    vi.advanceTimersByTime(2_000);
    expect(onLevel).not.toHaveBeenCalled();
    expect(game.complete).toBe(false);
  });
});
