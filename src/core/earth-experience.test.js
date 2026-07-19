import { describe, expect, it } from "vitest";
import { createEarthExperienceController } from "./earth-experience.js";

const createController = (overrides = {}) => createEarthExperienceController({
  map: {
    setLocation() {},
    setJourneyProgress() {},
    dispose() {}
  },
  earthLayer: { setFocus() {} },
  orbitPose: {
    position: [0, 0, 10],
    target: [0, 0, 0],
    fov: 50
  },
  earthPosition: [0, 0, 0],
  radius: 2,
  earthStage: 1,
  stageCount: 7,
  initialLocation: { lat: 0, lon: 0 },
  ...overrides
});

describe("createEarthExperienceController", () => {
  it.each([undefined, -1, 1.5, Number.NaN])("rejects invalid earthStage %s", (earthStage) => {
    expect(() => createController({ earthStage })).toThrow(TypeError);
  });

  it.each([7, 99])("rejects earthStage outside the route %s", (earthStage) => {
    expect(() => createController({ earthStage })).toThrow(TypeError);
  });

  it.each([undefined, 0, -1, 1.5, Number.NaN])("rejects invalid stageCount %s", (stageCount) => {
    expect(() => createController({ stageCount })).toThrow(TypeError);
  });

  it("uses a custom earthStage for transition boundaries and layer presence", () => {
    const controller = createController({ earthStage: 3 });
    const stageState = Object.freeze({
      exactStage: 2.5,
      layerPresence: Object.freeze([0, 0, 0, 0, 0])
    });

    const frame = controller.update({ stageState, exactStage: 2.5 });

    expect(frame.transitionEffectsAllowed).toBe(false);
    expect(frame.stageState.layerPresence[3]).toBe(1);
    expect(frame.stageState.layerPresence[1]).toBe(0);

    controller.dispose();
  });

  it("returns the untouched stage state after the custom earthStage", () => {
    const controller = createController({ earthStage: 3 });
    const stageState = Object.freeze({
      exactStage: 3.1,
      layerPresence: Object.freeze([0, 0, 0, 0, 0])
    });

    const frame = controller.update({ stageState, exactStage: 3.1 });

    expect(frame).toMatchObject({
      journey: null,
      cameraPose: null,
      stageState,
      transitionEffectsAllowed: true
    });

    controller.dispose();
  });

  it("uses the unavailable-map journey and stops updating after disposal", () => {
    const journeyUpdates = [];
    let disposeCalls = 0;
    const controller = createController({
      earthStage: 3,
      map: {
        setLocation() {},
        setJourneyProgress(journey) {
          journeyUpdates.push(journey);
        },
        dispose() {
          disposeCalls += 1;
        }
      }
    });
    const stageState = Object.freeze({
      exactStage: 2.5,
      layerPresence: Object.freeze([0, 0, 0, 0, 0])
    });

    const frame = controller.update({ stageState, exactStage: 2.5, mapUnavailable: true });

    expect(frame.journey).toMatchObject({ mapOpacity: 0, globePresence: 1 });
    expect(journeyUpdates).toHaveLength(1);

    controller.dispose();

    expect(disposeCalls).toBe(1);
    expect(controller.update({ stageState, exactStage: 2.5 })).toBeNull();
  });
});
