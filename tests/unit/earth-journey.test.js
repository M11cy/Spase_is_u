import { describe, expect, it } from "vitest";
import {
  createEarthJourneyCameraPose,
  createEarthJourneyState
} from "../../src/core/earth-journey.js";

const ORBIT_POSE = Object.freeze({
  position: Object.freeze([0, 3.5, 29]),
  target: Object.freeze([4.5, -3.5, 0]),
  fov: 46
});

describe("createEarthJourneyState", () => {
  it("clamps the journey and zooms from the city to the world", () => {
    const before = createEarthJourneyState({ exactStage: -1, reducedMotion: false });
    const middle = createEarthJourneyState({ exactStage: 0.5, reducedMotion: false });
    const after = createEarthJourneyState({ exactStage: 2, reducedMotion: false });

    expect(before.progress).toBe(0);
    expect(before.mapZoom).toBe(15);
    expect(middle.mapZoom).toBeLessThan(15);
    expect(middle.mapZoom).toBeGreaterThan(2.75);
    expect(after.progress).toBe(1);
    expect(after.mapZoom).toBe(2.75);
  });

  it("crossfades the map and globe monotonically in their approved windows", () => {
    const samples = [0, 0.62, 0.7, 0.8, 0.92, 1]
      .map((exactStage) => createEarthJourneyState({ exactStage, reducedMotion: false }));

    expect(samples[0].mapOpacity).toBe(1);
    expect(samples[1].mapOpacity).toBe(1);
    expect(samples.at(-1).mapOpacity).toBe(0);
    expect(samples[0].globePresence).toBe(0);
    expect(samples.at(-1).globePresence).toBe(1);
    expect(samples.every(({ mapOpacity }) => mapOpacity >= 0 && mapOpacity <= 1)).toBe(true);
    expect(samples.every(({ globePresence }) => globePresence >= 0 && globePresence <= 1)).toBe(true);

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].mapOpacity).toBeLessThanOrEqual(samples[index - 1].mapOpacity);
      expect(samples[index].globePresence).toBeGreaterThanOrEqual(samples[index - 1].globePresence);
    }
  });

  it("keeps enough map and globe coverage to avoid a dark handoff frame", () => {
    const samples = Array.from({ length: 101 }, (_, index) => (
      createEarthJourneyState({ exactStage: index / 100, reducedMotion: false })
    ));
    const combinedCoverage = samples.map(({ mapOpacity, globePresence }) => (
      mapOpacity + globePresence
    ));

    expect(Math.min(...combinedCoverage)).toBeGreaterThanOrEqual(1);
    samples
      .filter(({ mapOpacity }) => mapOpacity < 1)
      .forEach(({ globePresence }) => expect(globePresence).toBe(1));
  });

  it("uses fixed spatial stops while retaining the reduced-motion crossfade", () => {
    const beforeStop = createEarthJourneyState({ exactStage: 0.49, reducedMotion: true });
    const afterStop = createEarthJourneyState({ exactStage: 0.75, reducedMotion: true });

    expect(beforeStop.cameraProgress).toBe(0);
    expect(beforeStop.mapZoom).toBe(15);
    expect(afterStop.cameraProgress).toBe(1);
    expect(afterStop.mapZoom).toBe(2.75);
    expect(afterStop.mapOpacity).toBeGreaterThan(0);
    expect(afterStop.mapOpacity).toBeLessThan(1);
    expect(afterStop.globePresence).toBe(1);
  });

  it("returns a frozen deterministic record", () => {
    const input = Object.freeze({ exactStage: 0.75, reducedMotion: false });
    const first = createEarthJourneyState(input);
    const second = createEarthJourneyState(input);

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(input).toEqual({ exactStage: 0.75, reducedMotion: false });
  });
});

describe("createEarthJourneyCameraPose", () => {
  it("moves outward along the orbit ray and lands on the exact orbit pose", () => {
    const earthPosition = Object.freeze([4.5, -3.5, 0]);
    const close = createEarthJourneyCameraPose({
      orbitPose: ORBIT_POSE,
      earthPosition,
      radius: 14,
      progress: 0
    });
    const middle = createEarthJourneyCameraPose({
      orbitPose: ORBIT_POSE,
      earthPosition,
      radius: 14,
      progress: 0.5
    });
    const final = createEarthJourneyCameraPose({
      orbitPose: ORBIT_POSE,
      earthPosition,
      radius: 14,
      progress: 1
    });
    const distanceFromEarth = ({ position }) => Math.hypot(
      position[0] - earthPosition[0],
      position[1] - earthPosition[1],
      position[2] - earthPosition[2]
    );

    expect(distanceFromEarth(close)).toBeCloseTo(14 * 1.08);
    expect(distanceFromEarth(middle)).toBeGreaterThan(distanceFromEarth(close));
    expect(distanceFromEarth(middle)).toBeLessThan(distanceFromEarth(final));
    expect(final).toEqual(ORBIT_POSE);
  });

  it("clamps progress, deep-freezes output and does not mutate inputs", () => {
    const orbitPose = {
      position: [0, 3.5, 29],
      target: [4.5, -3.5, 0],
      fov: 46
    };
    const earthPosition = [4.5, -3.5, 0];
    const orbitSnapshot = structuredClone(orbitPose);
    const earthSnapshot = [...earthPosition];

    const pose = createEarthJourneyCameraPose({
      orbitPose,
      earthPosition,
      radius: 14,
      progress: 4
    });

    expect(pose).toEqual(ORBIT_POSE);
    expect(Object.isFrozen(pose)).toBe(true);
    expect(Object.isFrozen(pose.position)).toBe(true);
    expect(Object.isFrozen(pose.target)).toBe(true);
    expect(orbitPose).toEqual(orbitSnapshot);
    expect(earthPosition).toEqual(earthSnapshot);
  });
});
