import { describe, expect, it } from "vitest";
import {
  blockReasonForStage,
  clampStageTarget,
  createStageIndex,
  getHighestUnlockedStage,
  scrollYForStage
} from "./stage-access.js";

const stages = Object.freeze([
  { id: "place" }, { id: "earth" }, { id: "solar-system" },
  { id: "milky-way" }, { id: "local-group" }, { id: "cosmic-web" }, { id: "unknown" }
]);

describe("stage access", () => {
  it.each([
    [{}, 1],
    [{ rocketCaught: true }, 2],
    [{ rocketCaught: true, solarComplete: true }, 5],
    [{ rocketCaught: true, solarComplete: true, webComplete: true }, 6]
  ])("opens only the route allowed by completed games", (journeyState, expected) => {
    expect(getHighestUnlockedStage({ stages, journeyState })).toBe(expected);
  });

  it("allows backward travel but clamps forward travel", () => {
    expect(clampStageTarget({ requestedStage: 0, highestUnlockedStage: 2 })).toBe(0);
    expect(clampStageTarget({ requestedStage: 6, highestUnlockedStage: 2 })).toBe(2);
  });

  it("maps stage ids and scroll coordinates deterministically", () => {
    expect(createStageIndex(stages)["cosmic-web"]).toBe(5);
    expect(scrollYForStage({ stage: 5, stageCount: 7, maxScroll: 1200 })).toBe(1000);
  });

  it("returns the actionable reason for the active barrier", () => {
    expect(blockReasonForStage({ stages, journeyState: {} })).toContain("ракет");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true } })).toContain("двигател");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true, solarComplete: true } })).toContain("нить");
  });
});
