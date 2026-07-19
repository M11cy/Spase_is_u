// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createRocketCatchGame } from "./earth-rocket-game.js";

const createElements = () => {
  const shipElement = document.createElement("div");
  const zoneElement = document.createElement("button");
  document.body.append(shipElement, zoneElement);
  return { shipElement, zoneElement };
};

describe("rocket catch access", () => {
  it("fails closed while inactive even when reduced motion puts the rocket in the zone", () => {
    const elements = createElements();
    const game = createRocketCatchGame({ ...elements, reducedMotion: true });

    expect(game.attemptCatch()).toBe("inactive");
    expect(game.caught).toBe(false);
    expect(game.misses).toBe(0);
  });

  it("allows the reduced-motion catch only after the game becomes active", () => {
    const elements = createElements();
    const game = createRocketCatchGame({ ...elements, reducedMotion: true });

    game.setActive(true);

    expect(game.attemptCatch()).toBe("caught");
  });
});
