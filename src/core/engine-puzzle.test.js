// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createEnginePuzzle } from "./engine-puzzle.js";

describe("engine puzzle access", () => {
  it("keeps tiles disabled and ignores interaction until explicitly activated", () => {
    const boardElement = document.createElement("div");
    const statusElement = document.createElement("p");
    const onSolved = vi.fn();
    const game = createEnginePuzzle({
      boardElement,
      statusElement,
      image: "data:image/svg+xml,test",
      size: 2,
      onSolved
    });
    const tiles = [...boardElement.querySelectorAll("button")];

    expect(tiles.every((tile) => tile.disabled)).toBe(true);
    tiles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    tiles[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tiles.every((tile) => !tile.classList.contains("selected"))).toBe(true);
    expect(onSolved).not.toHaveBeenCalled();

    game.setActive(true);
    expect(tiles.every((tile) => !tile.disabled)).toBe(true);
  });
});
