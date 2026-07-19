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

  it("rejects routes that do not match the fixed seven-stage journey", () => {
    expect(() => createStageIndex([{ id: "place" }])).toThrow(RangeError);
    expect(() => getHighestUnlockedStage({
      stages: [...stages.slice(0, 6), { id: "cosmic-web" }],
      journeyState: {}
    })).toThrow(RangeError);
    expect(() => createStageIndex(null)).toThrow(TypeError);
  });

  it("never uses non-finite or non-numeric values to open a stage", () => {
    expect(clampStageTarget({ requestedStage: Number.NaN, highestUnlockedStage: 2 })).toBe(0);
    expect(clampStageTarget({ requestedStage: Infinity, highestUnlockedStage: 2 })).toBe(0);
    expect(clampStageTarget({ requestedStage: 6, highestUnlockedStage: Infinity })).toBe(0);
    expect(clampStageTarget({ requestedStage: "6", highestUnlockedStage: 2 })).toBe(0);
  });

  it("returns the actionable reason for the active barrier", () => {
    expect(blockReasonForStage({ stages, journeyState: {} })).toContain("ракет");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true } })).toContain("двигател");
    expect(blockReasonForStage({ stages, journeyState: { rocketCaught: true, solarComplete: true } })).toContain("нить");
  });

  it("returns no blocking reason when every stage is unlocked", () => {
    expect(blockReasonForStage({
      stages,
      journeyState: { rocketCaught: true, solarComplete: true, webComplete: true }
    })).toBe("");
  });
});
