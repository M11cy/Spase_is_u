import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { STAGE_INDEX } from "../../data/cosmos.js";
import { createSolarSystemLayer } from "./solar-system.js";

describe("createSolarSystemLayer", () => {
  it.each([undefined, -1, 1.5, Number.NaN])("rejects invalid stage %s", (stage) => {
    expect(() => createSolarSystemLayer({ THREE, stage, stageCount: 7, planets: [] })).toThrow(TypeError);
  });

  it.each([7, 99])("rejects stage outside the route %s", (stage) => {
    expect(() => createSolarSystemLayer({ THREE, stage, stageCount: 7, planets: [] })).toThrow(TypeError);
  });

  it.each([undefined, 0, -1, 1.5, Number.NaN])("rejects invalid stageCount %s", (stageCount) => {
    expect(() => createSolarSystemLayer({ THREE, stage: 0, stageCount, planets: [] })).toThrow(TypeError);
  });

  it("assigns the caller-provided route stage to each planet annotation", () => {
    const layer = createSolarSystemLayer({
      THREE,
      stage: STAGE_INDEX["local-group"],
      stageCount: 7,
      planets: [{
        name: "Test",
        title: "Test planet",
        radius: 1,
        size: 1,
        color: 0xffffff,
        angle: 0,
        text: "Test",
        discovery: "Test",
        distance: "Test"
      }]
    });

    expect(layer.interactive[0].userData.annotation.stage).toBe(STAGE_INDEX["local-group"]);

    layer.dispose();
  });
});
