import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  applyCameraPose,
  createEarthCameraPose,
  createScene,
  freezePositionedAnnotation,
  isStaticCameraStop,
  resolveCameraPose
} from "../../src/scene/create-scene.js";
import { STAGES } from "../../src/data/cosmos.js";

const createHarness = () => {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const renderer = {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial()
  );
  const root = new THREE.Group();
  root.add(surface);
  const layer = Object.freeze({
    root,
    interactive: Object.freeze([surface]),
    setPresence: vi.fn(),
    dispose: vi.fn()
  });
  const manager = createScene({
    THREE,
    canvas,
    quality: Object.freeze({ pixelRatio: 1.25 }),
    layers: Object.freeze([Object.freeze({ stage: 1, layer })]),
    rendererFactory: vi.fn(() => renderer)
  });
  return { canvas, layer, manager, renderer };
};

describe("createScene", () => {
  it("clones and freezes positioned annotations deeply", () => {
    const position = [102, 12, -24];
    const annotation = freezePositionedAnnotation({ id: "voyager", position });

    position[0] = 0;
    expect(annotation.position).toEqual([102, 12, -24]);
    expect(Object.isFrozen(annotation)).toBe(true);
    expect(Object.isFrozen(annotation.position)).toBe(true);
  });

  it("snaps settled static stages but preserves camera easing during transitions", () => {
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1200);
    const cameraTarget = new THREE.Vector3();
    const cameraPose = STAGES[1].camera;
    const settledEarth = Object.freeze({
      activeStage: 1,
      layerPresence: Object.freeze([0, 1, 0, 0, 0, 0, 0, 0])
    });

    expect(isStaticCameraStop({ stages: STAGES, stageState: settledEarth })).toBe(true);
    expect(isStaticCameraStop({
      stages: STAGES,
      stageState: { activeStage: 1, layerPresence: [0, 0.8, 0.2] }
    })).toBe(false);
    expect(isStaticCameraStop({
      stages: STAGES,
      stageState: { activeStage: 2, layerPresence: [0, 0, 1] }
    })).toBe(false);

    const interpolatedPose = { position: [1, 2, 3], target: [4, 5, 6], fov: 50 };
    expect(resolveCameraPose({
      stages: STAGES,
      stageState: settledEarth,
      interpolatedPose
    })).toBe(STAGES[1].camera);
    expect(resolveCameraPose({
      stages: STAGES,
      stageState: { activeStage: 1, layerPresence: [0, 0.8, 0.2] },
      interpolatedPose
    })).toBe(interpolatedPose);

    applyCameraPose({ camera, cameraTarget, cameraPose, snap: true });
    expect(camera.position.toArray()).toEqual(cameraPose.position);
    expect(cameraTarget.toArray()).toEqual(cameraPose.target);
    expect(camera.fov).toBe(cameraPose.fov);

    const matrix = camera.matrix.toArray();
    applyCameraPose({ camera, cameraTarget, cameraPose, snap: true });
    expect(camera.matrix.toArray()).toEqual(matrix);
  });

  it.each([
    [1920 / 1080, false],
    [390 / 844, true]
  ])("keeps Earth near 84% viewport width at aspect %s", (aspect, isPortrait) => {
    const pose = createEarthCameraPose({ basePose: STAGES[1].camera, aspect });
    const earth = new THREE.Vector3(4.5, -3.5, 0);
    const cameraPosition = new THREE.Vector3(...pose.position);
    const distance = cameraPosition.distanceTo(earth);
    const angularRadius = Math.asin(14 / distance);
    const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2) * aspect);
    const projectedDiameterFraction = Math.tan(angularRadius) / Math.tan(horizontalFov / 2);

    expect(projectedDiameterFraction).toBeCloseTo(0.84, 4);
    expect(Object.isFrozen(pose)).toBe(true);
    expect(Object.isFrozen(pose.position)).toBe(true);
    expect(Object.isFrozen(pose.target)).toBe(true);
    expect(pose.target[0] > STAGES[1].camera.target[0]).toBe(isPortrait);
  });

  it("applies immutable stage camera state exactly without time-based drift", () => {
    const { layer, manager, renderer } = createHarness();
    const cameraPose = Object.freeze({
      position: Object.freeze([0, 3.5, 29]),
      target: Object.freeze([4.5, -3.5, 0]),
      fov: 46
    });
    const stageState = Object.freeze({
      activeStage: 1,
      layerPresence: Object.freeze([0, 1, 0])
    });

    manager.update({ stageState, cameraPose, viewport: { width: 800, height: 600 } });
    manager.render();
    const camera = renderer.render.mock.calls[0][1];
    const firstMatrix = camera.matrix.toArray();

    manager.update({ stageState, cameraPose, viewport: { width: 800, height: 600 } });
    manager.render();

    expect(camera.position.toArray()).toEqual(cameraPose.position);
    expect(camera.fov).toBe(46);
    expect(camera.matrix.toArray()).toEqual(firstMatrix);
    expect(layer.setPresence).toHaveBeenCalledWith(1);
    expect(cameraPose).toEqual({ position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46 });
  });

  it("owns resize, rendering and idempotent layer/renderer disposal", () => {
    const { layer, manager, renderer } = createHarness();

    expect(Object.isFrozen(manager)).toBe(true);
    expect(manager.canvas).toBeInstanceOf(HTMLCanvasElement);
    manager.resize({ width: 1024, height: 512, pixelRatio: 3 });
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.25);
    expect(renderer.setSize).toHaveBeenLastCalledWith(1024, 512, false);

    manager.update({
      stageState: { activeStage: 1, layerPresence: [0, 1] },
      cameraPose: { position: [0, 0, 10], target: [0, 0, 0], fov: 52 },
      viewport: { width: 1024, height: 512, pixelRatio: 0.75 }
    });
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(0.75);

    manager.dispose();
    manager.dispose();
    expect(layer.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(() => manager.render()).not.toThrow();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("updates interactive mesh world matrices before non-recursive hit testing", () => {
    const { layer, manager } = createHarness();
    const [surface] = layer.interactive;
    surface.position.set(5, 0, -5);
    surface.userData.annotation = Object.freeze({ id: "earth", stage: 1 });
    const update = () => manager.update({
      stageState: { activeStage: 1, layerPresence: [0, 1] },
      cameraPose: { position: [0, 0, 0], target: [0, 0, -1], fov: 52 },
      viewport: { width: 800, height: 600 }
    });

    update();
    expect(manager.hitTest({ clientX: 400, clientY: 300 })).toBeNull();

    surface.position.set(0, 0, -5);
    update();
    expect(manager.hitTest({ clientX: 400, clientY: 300 })).toEqual({ id: "earth", stage: 1 });

    layer.root.visible = false;
    expect(manager.hitTest({ clientX: 400, clientY: 300 })).toBeNull();
  });

  it("adopts existing scene infrastructure and global interactive meshes", () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    const renderer = {
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1200);
    const cameraTarget = new THREE.Vector3();
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial()
    );
    surface.position.set(0, 0, -5);
    surface.userData.annotation = Object.freeze({ id: "legacy", stage: 2 });
    scene.add(surface);

    const manager = createScene({
      THREE,
      canvas,
      quality: { pixelRatio: 1 },
      renderer,
      scene,
      camera,
      cameraTarget,
      interactive: [surface]
    });
    manager.update({
      stageState: { activeStage: 2, layerPresence: [0, 0, 1] },
      cameraPose: { position: [0, 0, 0], target: [0, 0, -1], fov: 52 },
      viewport: { width: 800, height: 600 }
    });
    manager.render();

    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(manager.hitTest({ clientX: 400, clientY: 300 })).toEqual({ id: "legacy", stage: 2 });
    manager.dispose();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });
});
