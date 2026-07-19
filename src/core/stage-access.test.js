import { describe, expect, it } from "vitest";
import {
  blockReasonForStage,
  clampStageTarget,
  createStageIndex,
  getHighestUnlockedStage,
  scrollYForStage
} from "./stage-access.js";
import * as stageAccess from "./stage-access.js";

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

  it("fails closed for absent or non-boolean journey progress", () => {
    expect(getHighestUnlockedStage({ stages, journeyState: null })).toBe(1);
    expect(getHighestUnlockedStage({
      stages,
      journeyState: { rocketCaught: "true", solarComplete: "true", webComplete: "true" }
    })).toBe(1);
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

describe("game access preconditions", () => {
  const requiredArtifacts = new Set(["earth", "mars"]);
  const completeArtifacts = new Set(["earth", "mars"]);

  it("opens the engine only on the active Solar stage with every required artifact", () => {
    const input = {
      journeyStarted: true,
      activeStage: 2,
      solarStage: 2,
      solarComplete: false,
      artifactIds: completeArtifacts,
      requiredArtifactIds: requiredArtifacts
    };

    expect(stageAccess.isEngineGameAvailable?.(input)).toBe(true);
    expect(stageAccess.isEngineGameAvailable?.({ ...input, activeStage: 1 })).toBe(false);
    expect(stageAccess.isEngineGameAvailable?.({
      ...input,
      artifactIds: new Set(["earth"])
    })).toBe(false);
    expect(stageAccess.isEngineGameAvailable?.({
      ...input,
      artifactIds: new Set(["earth", "mars", "forged"])
    })).toBe(false);
  });

  it("opens the Web game only while its unlocked stage is active", () => {
    const input = {
      journeyStarted: true,
      activeStage: 5,
      webStage: 5,
      highestUnlockedStage: 5,
      solarComplete: true,
      webComplete: false
    };

    expect(stageAccess.isWebGameAvailable?.(input)).toBe(true);
    expect(stageAccess.isWebGameAvailable?.({ ...input, activeStage: 4 })).toBe(false);
    expect(stageAccess.isWebGameAvailable?.({ ...input, highestUnlockedStage: 4 })).toBe(false);
    expect(stageAccess.isWebGameAvailable?.({ ...input, solarComplete: "true" })).toBe(false);
  });

  it("requires the active Earth stage and legitimate ready state for rocket input", () => {
    const input = {
      journeyStarted: true,
      activeStage: 1,
      earthStage: 1,
      earthShipReady: true,
      rocketCaught: false
    };

    expect(stageAccess.isRocketGameAvailable?.(input)).toBe(true);
    expect(stageAccess.isRocketGameAvailable?.({ ...input, activeStage: 0 })).toBe(false);
    expect(stageAccess.isRocketGameAvailable?.({ ...input, earthShipReady: false })).toBe(false);
    expect(stageAccess.isRocketGameAvailable?.({ ...input, journeyStarted: 1 })).toBe(false);
  });

  it("accepts quiz artifacts and finale input only on their legitimate active stages", () => {
    const solarInput = {
      journeyStarted: true,
      activeStage: 2,
      solarStage: 2,
      solarComplete: false
    };
    const finaleInput = {
      journeyStarted: true,
      activeStage: 6,
      finaleStage: 6,
      webComplete: true
    };

    expect(stageAccess.isSolarCollectionAvailable?.(solarInput)).toBe(true);
    expect(stageAccess.isSolarCollectionAvailable?.({ ...solarInput, activeStage: 1 })).toBe(false);
    expect(stageAccess.isFinaleGameAvailable?.(finaleInput)).toBe(true);
    expect(stageAccess.isFinaleGameAvailable?.({ ...finaleInput, webComplete: false })).toBe(false);
  });
});
