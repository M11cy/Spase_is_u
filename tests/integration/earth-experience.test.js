import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createEarthExperienceController } from "../../src/core/earth-experience.js";

const MOSCOW = Object.freeze({ lat: 55.7558, lon: 37.6173 });
const EARTH_POSITION = Object.freeze([4.5, -3.5, 0]);
const ORBIT_POSE = Object.freeze({
  position: Object.freeze([0, 3.5, 29]),
  target: EARTH_POSITION,
  fov: 46
});

const createStageState = (exactStage) => Object.freeze({
  exactStage,
  activeStage: Math.round(exactStage),
  layerPresence: Object.freeze([0.4, 0.6, 0.8, 0.35, 0.2, 0.1, 0.05, 0]),
  transitionAmount: 0.25
});

const createHarness = () => {
  const map = Object.freeze({
    setLocation: vi.fn((location) => location),
    setJourneyProgress: vi.fn(),
    dispose: vi.fn()
  });
  const earthLayer = Object.freeze({
    setFocus: vi.fn(),
    setPresence: vi.fn(),
    dispose: vi.fn()
  });
  const controller = createEarthExperienceController({
    map,
    earthLayer,
    orbitPose: ORBIT_POSE,
    earthPosition: EARTH_POSITION,
    radius: 14,
    initialLocation: MOSCOW
  });

  return { controller, earthLayer, map };
};

describe("createEarthExperienceController", () => {
  it("shares the immediate fallback location between the map and focused Earth", () => {
    const { controller, earthLayer, map } = createHarness();
    const mapLocation = map.setLocation.mock.calls[0][0];
    const earthLocation = earthLayer.setFocus.mock.calls[0][0];
    const cameraDirection = earthLayer.setFocus.mock.calls[0][1];
    const cameraUp = earthLayer.setFocus.mock.calls[0][2];

    expect(mapLocation).toEqual(MOSCOW);
    expect(earthLocation).toEqual(MOSCOW);
    expect(mapLocation).toBe(earthLocation);
    expect(Object.isFrozen(mapLocation)).toBe(true);
    expect(cameraDirection).toEqual([-4.5, 7, 29]);
    expect(Object.isFrozen(cameraDirection)).toBe(true);
    expect(cameraUp).toEqual([0, 1, 0]);
    expect(Object.isFrozen(cameraUp)).toBe(true);

    const userLocation = { lat: 59.9386, lon: 30.3141 };
    const applied = controller.setLocation(userLocation);
    userLocation.lat = 0;

    expect(applied).toEqual({ lat: 59.9386, lon: 30.3141 });
    expect(Object.isFrozen(applied)).toBe(true);
    expect(map.setLocation).toHaveBeenLastCalledWith(applied);
    expect(earthLayer.setFocus).toHaveBeenLastCalledWith(applied, cameraDirection, cameraUp);
  });

  it("maps monotonic stage-zero scroll to map zoom, Earth presence and camera pose", () => {
    const { controller, earthLayer, map } = createHarness();
    const frames = [0, 0.5, 0.7, 0.85, 1].map((exactStage) => controller.update({
      stageState: createStageState(exactStage),
      reducedMotion: false,
      aspect: 16 / 9
    }));

    expect(frames.map(({ journey }) => journey.mapZoom)).toEqual(
      [...frames].map(({ journey }) => journey.mapZoom).sort((a, b) => b - a)
    );
    expect(map.setJourneyProgress).toHaveBeenCalledTimes(5);
    frames.forEach((frame, index) => {
      expect(map.setJourneyProgress.mock.calls[index][0]).toBe(frame.journey);
      expect(Object.isFrozen(frame)).toBe(true);
      expect(Object.isFrozen(frame.stageState)).toBe(true);
      expect(Object.isFrozen(frame.stageState.layerPresence)).toBe(true);
    });
    expect(earthLayer.setPresence).not.toHaveBeenCalled();
    expect(frames[3].stageState.layerPresence[1]).toBe(frames[3].journey.globePresence);
    expect(frames[3].stageState.layerPresence[2]).toBe(0.8);
    expect(frames[4].cameraPose).toEqual(ORBIT_POSE);
    expect(frames.every(({ transitionEffectsAllowed }) => transitionEffectsAllowed === false)).toBe(true);
  });

  it("returns the exact orbital stop at stage 1 and never introduces frame-time drift", () => {
    const { controller } = createHarness();
    const stageState = createStageState(1);
    const first = controller.update({ stageState, reducedMotion: false, aspect: 16 / 9 });
    const second = controller.update({ stageState, reducedMotion: false, aspect: 16 / 9 });

    expect(first.cameraPose).toEqual(ORBIT_POSE);
    expect(second.cameraPose).toEqual(first.cameraPose);
    expect(first.cameraPose.position).toEqual(ORBIT_POSE.position);
    expect(first.stageState).toBe(stageState);
  });

  it("keeps the selected location on the portrait camera view ray without frame drift", () => {
    const { controller, earthLayer } = createHarness();
    const portraitOrbitPose = Object.freeze({
      position: ORBIT_POSE.position,
      target: Object.freeze([6.25, -3.5, 0]),
      fov: ORBIT_POSE.fov
    });
    const stageState = createStageState(0.82);

    const first = controller.update({
      stageState,
      exactStage: 0.82,
      reducedMotion: false,
      orbitPose: portraitOrbitPose
    });
    const firstDirection = earthLayer.setFocus.mock.calls.at(-1)[1];
    const cameraToTarget = first.cameraPose.target.map((value, index) => (
      value - first.cameraPose.position[index]
    ));
    const rayLength = Math.hypot(...cameraToTarget);
    const viewRay = cameraToTarget.map((value) => value / rayLength);
    const focusedPoint = firstDirection.map((value, index) => (
      EARTH_POSITION[index] + value * 14
    ));
    const cameraToFocus = focusedPoint.map((value, index) => (
      value - first.cameraPose.position[index]
    ));
    const cross = [
      cameraToFocus[1] * viewRay[2] - cameraToFocus[2] * viewRay[1],
      cameraToFocus[2] * viewRay[0] - cameraToFocus[0] * viewRay[2],
      cameraToFocus[0] * viewRay[1] - cameraToFocus[1] * viewRay[0]
    ];

    expect(Math.hypot(...firstDirection)).toBeCloseTo(1, 8);
    expect(Math.hypot(...cross)).toBeCloseTo(0, 8);

    controller.update({
      stageState,
      exactStage: 0.82,
      reducedMotion: false,
      orbitPose: portraitOrbitPose
    });
    expect(earthLayer.setFocus.mock.calls.at(-1)[1]).toEqual(firstDirection);
    expect(first.cameraPose).toBeDefined();
  });

  it("hands stages 2-7 back to the existing pipeline without changing their state or camera", () => {
    const { controller, map } = createHarness();
    const callsBeforeLaterStages = map.setJourneyProgress.mock.calls.length;

    [2, 3, 4, 5, 6, 7].forEach((exactStage) => {
      const stageState = createStageState(exactStage);
      const frame = controller.update({
        stageState,
        reducedMotion: false,
        aspect: 16 / 9
      });

      expect(frame.stageState).toBe(stageState);
      expect(frame.cameraPose).toBeNull();
      expect(frame.journey).toBeNull();
      expect(frame.transitionEffectsAllowed).toBe(true);
    });

    expect(map.setJourneyProgress).toHaveBeenCalledTimes(callsBeforeLaterStages);
  });

  it("turns a failed satellite layer into a visible local orbital fallback", () => {
    const { controller, map } = createHarness();
    const sourceState = createStageState(0);
    const frame = controller.update({
      stageState: sourceState,
      reducedMotion: false,
      aspect: 16 / 9,
      mapUnavailable: true
    });

    expect(frame.journey).toMatchObject({ mapOpacity: 0, globePresence: 1, cameraProgress: 1 });
    expect(frame.cameraPose).toEqual(ORBIT_POSE);
    expect(frame.stageState.layerPresence[1]).toBe(1);
    expect(frame.stageState.layerPresence.slice(2)).toEqual(sourceState.layerPresence.slice(2));
    expect(map.setJourneyProgress).toHaveBeenCalledWith(frame.journey);
  });

  it("uses fixed reduced-motion stops and disposes the owned map exactly once", () => {
    const { controller, earthLayer, map } = createHarness();
    const beforeStop = controller.update({
      stageState: createStageState(0.49),
      reducedMotion: true,
      aspect: 1
    });
    const afterStop = controller.update({
      stageState: createStageState(0.5),
      reducedMotion: true,
      aspect: 1
    });

    expect(beforeStop.journey.cameraProgress).toBe(0);
    expect(afterStop.journey.cameraProgress).toBe(1);

    controller.dispose();
    controller.dispose();
    expect(map.dispose).toHaveBeenCalledOnce();
    expect(earthLayer.dispose).not.toHaveBeenCalled();
    expect(controller.setLocation({ lat: 1, lon: 2 })).toBeUndefined();
    expect(controller.update({ stageState: createStageState(0.5), reducedMotion: false, aspect: 1 })).toBeNull();
  });
});

describe("production Earth experience wiring", () => {
  it("bundles Leaflet locally, selects adaptive textures and removes the obsolete iframe path", () => {
    const mainSource = readFileSync(`${process.cwd()}/src/main.js`, "utf8");

    expect(mainSource).toContain('import * as L from "leaflet"');
    expect(mainSource).toContain('import "leaflet/dist/leaflet.css"');
    expect(mainSource).toContain("createSatelliteMap");
    expect(mainSource).toContain("createEarthExperienceController");
    expect(mainSource).toContain("selectEarthTextureRoutes(quality)");
    expect(mainSource).toContain("journeyTransitionAmount");
    expect(mainSource).not.toContain("mapFrame");
    expect(mainSource).not.toContain("openstreetmap.org/export/embed");
  });

  it("defines a full-bleed satellite handoff, unavailable fallback and reduced-motion stops", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain(".satellite-map");
    expect(styles).toContain(".leaflet-container");
    expect(styles).toContain(".map-reticle");
    expect(styles).toContain('[data-map-state="unavailable"]');
    expect(styles).toContain("--map-mask-radius");
    expect(styles).not.toContain(".map-layer iframe");
    expect(styles).not.toContain("#mapFrame");
    const vignetteRule = styles.match(/\.map-vignette\s*\{[^}]*\}/)?.[0] ?? "";
    expect(vignetteRule).toContain("background: none");
    expect(vignetteRule).toContain("opacity: 0");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.map-layer/);
  });

  it("reveals the globe with an opaque cutout instead of dimming the satellite image", () => {
    const mainSource = readFileSync(`${process.cwd()}/src/main.js`, "utf8");
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const satelliteRule = styles.match(/\.satellite-map\s*\{[^}]*\}/)?.[0] ?? "";
    const canvasRule = styles.match(/#cosmosCanvas\s*\{[^}]*\}/)?.[0] ?? "";
    const mapLayerRule = [...styles.matchAll(/\.map-layer\s*\{[^}]*\}/g)]
      .map(([rule]) => rule)
      .find((rule) => rule.includes("--map-mask-radius")) ?? "";
    const leafletPaneRule = styles.match(/\.satellite-map \.leaflet-pane[\s\S]*?\{[^}]*\}/)?.[0] ?? "";

    expect(mainSource).toContain("const maskRadius = 160 * mapOpacity");
    expect(satelliteRule).not.toContain("opacity:");
    expect(satelliteRule).toContain("brightness(1)");
    expect(leafletPaneRule).not.toContain("opacity:");
    expect(canvasRule).toContain("z-index: 2");
    expect(mapLayerRule).toContain("z-index: 3");
    expect(mapLayerRule).toContain("background: transparent");
  });
});
