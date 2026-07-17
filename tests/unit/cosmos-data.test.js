import { describe, expect, it } from "vitest";
import {
  ANNOTATIONS,
  COLOR_ROLES,
  OBJECTS,
  SOLAR_PLANETS,
  STAGES
} from "../../src/data/cosmos.js";

const expectDeeplyFrozen = (value) => {
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((nestedValue) => {
    if (nestedValue && typeof nestedValue === "object") {
      expectDeeplyFrozen(nestedValue);
    }
  });
};

describe("cosmos data", () => {
  it("defines the approved eight-stage journey", () => {
    expect(STAGES.map(({ id }) => id)).toEqual([
      "place", "earth", "solar-system", "heliosphere",
      "milky-way", "local-group", "cosmic-web", "unknown"
    ]);
  });

  it("locks the static orbital Earth composition", () => {
    expect(STAGES[1].camera).toEqual({
      position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46
    });
    expect(STAGES[1].motion).toBe("static");
  });

  it("contains exactly eight solar planets", () => {
    expect(SOLAR_PLANETS).toHaveLength(8);
  });

  it("preserves the existing Local Group distance copy", () => {
    expect(STAGES[5].distance).toBe("2.5 млн св. лет");
  });

  it("deeply freezes every exported cosmos value", () => {
    [STAGES, OBJECTS, SOLAR_PLANETS, ANNOTATIONS, COLOR_ROLES]
      .forEach(expectDeeplyFrozen);
  });
});
