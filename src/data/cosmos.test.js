import { describe, expect, it } from "vitest";
import { ANNOTATIONS, OBJECTS, STAGES, STAGE_INDEX } from "./cosmos.js";

describe("cosmos route", () => {
  it("contains exactly the approved seven stages", () => {
    expect(STAGES.map(({ id }) => id)).toEqual([
      "place", "earth", "solar-system", "milky-way", "local-group", "cosmic-web", "unknown"
    ]);
  });

  it("contains no heliosphere or Voyager data", () => {
    expect(JSON.stringify({ STAGES, OBJECTS, ANNOTATIONS }).toLowerCase()).not.toMatch(/heliosphere|гелиосфер|voyager/);
  });

  it("keeps every annotation inside the route", () => {
    expect(STAGE_INDEX["cosmic-web"]).toBe(5);
    expect([...OBJECTS, ...ANNOTATIONS.galaxy, ...ANNOTATIONS.localGroup]
      .every(({ stage }) => Number.isInteger(stage) && stage >= 0 && stage < STAGES.length)).toBe(true);
  });
});
