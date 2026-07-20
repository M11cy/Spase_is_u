import { Layers, Object3D } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScene } from "./create-scene.js";
import {
  BLOOM_SCENE_LAYER,
  createDeepSpacePostprocessing,
  enableDeepSpaceBloom
} from "./deep-space-postprocessing.js";

const addonRecords = vi.hoisted(() => ({
  blooms: [],
  composers: [],
  compositeMaterials: [],
  failBloomCreation: false,
  failOutputCreation: false,
  failShaderCreation: false,
  outputPasses: [],
  renderPasses: [],
  shaderPasses: []
}));

vi.mock("three/addons/postprocessing/EffectComposer.js", () => ({
  EffectComposer: class {
    constructor(renderer) {
      this.renderer = renderer;
      this.addPass = vi.fn();
      this.dispose = vi.fn();
      this.render = vi.fn();
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.renderTarget2 = { texture: {} };
      addonRecords.composers.push(this);
    }
  }
}));

vi.mock("three/addons/postprocessing/ShaderPass.js", () => ({
  ShaderPass: class {
    constructor(material, textureID) {
      material.dispose = vi.fn(material.dispose.bind(material));
      addonRecords.compositeMaterials.push(material);
      if (addonRecords.failShaderCreation) throw new Error("composite unsupported");
      this.material = material;
      this.textureID = textureID;
      this.dispose = vi.fn(() => material.dispose());
      addonRecords.shaderPasses.push(this);
    }
  }
}));

vi.mock("three/addons/postprocessing/OutputPass.js", () => ({
  OutputPass: class {
    constructor() {
      if (addonRecords.failOutputCreation) throw new Error("output unsupported");
      this.dispose = vi.fn();
      addonRecords.outputPasses.push(this);
    }
  }
}));

vi.mock("three/addons/postprocessing/RenderPass.js", () => ({
  RenderPass: class {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;
      addonRecords.renderPasses.push(this);
    }
  }
}));

vi.mock("three/addons/postprocessing/UnrealBloomPass.js", () => ({
  UnrealBloomPass: class {
    constructor(resolution, strength, radius, threshold) {
      if (addonRecords.failBloomCreation) throw new Error("bloom unsupported");
      this.resolution = resolution;
      this.strength = strength;
      this.radius = radius;
      this.threshold = threshold;
      this.dispose = vi.fn();
      addonRecords.blooms.push(this);
    }
  }
}));

beforeEach(() => {
  addonRecords.blooms.splice(0);
  addonRecords.composers.splice(0);
  addonRecords.compositeMaterials.splice(0);
  addonRecords.outputPasses.splice(0);
  addonRecords.renderPasses.splice(0);
  addonRecords.shaderPasses.splice(0);
  addonRecords.failBloomCreation = false;
  addonRecords.failOutputCreation = false;
  addonRecords.failShaderCreation = false;
});

const createComposer = () => ({
  render: vi.fn(),
  setPixelRatios: vi.fn(),
  setSize: vi.fn(),
  dispose: vi.fn()
});

describe("createDeepSpacePostprocessing", () => {
  it("marks bloom objects on a stable additive layer without removing the base layer", () => {
    const object = new Object3D();

    const marked = enableDeepSpaceBloom(object);

    expect(BLOOM_SCENE_LAYER).toBe(1);
    expect(marked).toBe(object);
    expect(object.layers.isEnabled(0)).toBe(true);
    expect(object.layers.isEnabled(BLOOM_SCENE_LAYER)).toBe(true);
  });

  it("builds and owns separate bloom and additive-composite composers", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = { layers: new Layers() };
    const originalCameraMask = camera.layers.mask;
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality: {
        bloomEnabled: true,
        bloomStrength: 1.18,
        bloomRadius: 0.72,
        bloomThreshold: 0.48,
        bloomScale: 0.75
      },
      reducedMotion: false
    });
    const [bloomComposer, finalComposer] = addonRecords.composers.slice(-2);
    const bloom = addonRecords.blooms.at(-1);
    const [bloomRenderPass, baseRenderPass] = addonRecords.renderPasses.slice(-2);
    const compositePass = addonRecords.shaderPasses.at(-1);
    const compositeMaterial = addonRecords.compositeMaterials.at(-1);
    const outputPass = addonRecords.outputPasses.at(-1);
    const renderMasks = [];
    bloomComposer.render.mockImplementation(() => renderMasks.push(camera.layers.mask));
    finalComposer.render.mockImplementation(() => renderMasks.push(camera.layers.mask));

    pipeline.render();
    pipeline.resize({ width: 1600, height: 900, pixelRatio: 2 });
    pipeline.dispose();
    pipeline.dispose();

    expect(pipeline.active).toBe(true);
    expect(bloomRenderPass).toMatchObject({ scene, camera });
    expect(baseRenderPass).toMatchObject({ scene, camera });
    expect(bloom).toMatchObject({
      resolution: { x: 1, y: 1 },
      strength: 1.18,
      radius: 0.72,
      threshold: 0.48
    });
    expect(bloomComposer.renderToScreen).toBe(false);
    expect(bloomComposer.addPass).toHaveBeenNthCalledWith(1, bloomRenderPass);
    expect(bloomComposer.addPass).toHaveBeenNthCalledWith(2, bloom);
    expect(finalComposer.addPass).toHaveBeenNthCalledWith(1, baseRenderPass);
    expect(finalComposer.addPass).toHaveBeenNthCalledWith(2, compositePass);
    expect(finalComposer.addPass).toHaveBeenNthCalledWith(3, outputPass);
    expect(compositePass.textureID).toBe("baseTexture");
    expect(compositePass.material.uniforms.bloomTexture.value)
      .toBe(bloomComposer.renderTarget2.texture);
    expect(compositePass.material.fragmentShader).toContain("baseTexture");
    expect(compositePass.material.fragmentShader).toContain("bloomTexture");
    expect(renderMasks).toEqual([2, originalCameraMask]);
    expect(camera.layers.mask).toBe(originalCameraMask);
    expect(bloomComposer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(finalComposer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(bloomComposer.setSize).toHaveBeenCalledWith(1600, 900);
    expect(finalComposer.setSize).toHaveBeenCalledWith(1600, 900);
    expect(bloom.dispose).toHaveBeenCalledOnce();
    expect(compositePass.dispose).toHaveBeenCalledOnce();
    expect(compositeMaterial.dispose).toHaveBeenCalledOnce();
    expect(outputPass.dispose).toHaveBeenCalledOnce();
    expect(bloomComposer.dispose).toHaveBeenCalledOnce();
    expect(finalComposer.dispose).toHaveBeenCalledOnce();
  });

  it("restores the camera mask and permanently falls back when selective rendering fails", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = { layers: new Layers() };
    camera.layers.enable(3);
    const originalCameraMask = camera.layers.mask;
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality: {
        bloomEnabled: true,
        bloomStrength: 1.18,
        bloomRadius: 0.72,
        bloomThreshold: 0.48,
        bloomScale: 0.75
      },
      reducedMotion: false
    });
    const [bloomComposer, finalComposer] = addonRecords.composers.slice(-2);
    bloomComposer.render.mockImplementationOnce(() => {
      throw new Error("context lost");
    });

    pipeline.render();
    pipeline.render();
    pipeline.dispose();
    pipeline.dispose();

    expect(camera.layers.mask).toBe(originalCameraMask);
    expect(finalComposer.render).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenNthCalledWith(1, scene, camera);
    expect(pipeline.active).toBe(false);
    expect(bloomComposer.dispose).toHaveBeenCalledOnce();
    expect(finalComposer.dispose).toHaveBeenCalledOnce();
  });

  it("creates a frozen active pipeline and delegates the complete composer lifecycle", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = {};
    const quality = Object.freeze({
      bloomEnabled: true,
      bloomStrength: 1.18,
      bloomRadius: 0.72,
      bloomThreshold: 0.48,
      bloomScale: 0.75
    });
    const composer = createComposer();
    const composerFactory = vi.fn(() => composer);
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality,
      reducedMotion: true,
      factories: { createComposer: composerFactory }
    });

    pipeline.render();
    pipeline.resize({ width: 1920, height: 1080, pixelRatio: 2 });
    pipeline.dispose();
    pipeline.dispose();
    pipeline.render();
    pipeline.resize({ width: 390, height: 844, pixelRatio: 3 });

    expect(Object.isFrozen(pipeline)).toBe(true);
    expect(pipeline.active).toBe(true);
    expect(composerFactory).toHaveBeenCalledWith({ renderer, scene, camera, quality });
    expect(composer.render).toHaveBeenCalledOnce();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(composer.setPixelRatios).toHaveBeenCalledOnce();
    expect(composer.setPixelRatios).toHaveBeenCalledWith({ base: 2, bloom: 1.5 });
    expect(composer.setSize).toHaveBeenCalledOnce();
    expect(composer.setSize).toHaveBeenCalledWith(1920, 1080);
    expect(composer.dispose).toHaveBeenCalledOnce();
  });

  it("falls back to the direct renderer when composer creation fails", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = {};
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality: { bloomEnabled: true },
      reducedMotion: false,
      factories: {
        createComposer: () => {
          throw new Error("unsupported");
        }
      }
    });

    pipeline.render();
    pipeline.dispose();
    pipeline.dispose();

    expect(pipeline.active).toBe(false);
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it("releases partial default resources before falling back", () => {
    const renderer = { render: vi.fn() };
    addonRecords.failBloomCreation = true;

    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene: {},
      camera: {},
      quality: {
        bloomEnabled: true,
        bloomStrength: 1.18,
        bloomRadius: 0.72,
        bloomThreshold: 0.48,
        bloomScale: 0.75
      },
      reducedMotion: false
    });
    addonRecords.failBloomCreation = false;
    const partialComposer = addonRecords.composers.at(-1);

    pipeline.render();

    expect(pipeline.active).toBe(false);
    expect(partialComposer.dispose).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledOnce();
  });

  it("releases both composer branches when late selective setup fails", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = { layers: new Layers() };
    addonRecords.failShaderCreation = true;

    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality: {
        bloomEnabled: true,
        bloomStrength: 1.18,
        bloomRadius: 0.72,
        bloomThreshold: 0.48,
        bloomScale: 0.75
      },
      reducedMotion: false
    });
    addonRecords.failShaderCreation = false;
    const [bloomComposer, finalComposer] = addonRecords.composers;
    const bloom = addonRecords.blooms[0];
    const compositeMaterial = addonRecords.compositeMaterials[0];

    pipeline.render();

    expect(pipeline.active).toBe(false);
    expect(bloom.dispose).toHaveBeenCalledOnce();
    expect(bloomComposer.dispose).toHaveBeenCalledOnce();
    expect(finalComposer.dispose).toHaveBeenCalledOnce();
    expect(compositeMaterial.dispose).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it("releases transferred composite ownership when output setup fails", () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = { layers: new Layers() };
    addonRecords.failOutputCreation = true;

    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene,
      camera,
      quality: {
        bloomEnabled: true,
        bloomStrength: 1.18,
        bloomRadius: 0.72,
        bloomThreshold: 0.48,
        bloomScale: 0.75
      },
      reducedMotion: false
    });
    addonRecords.failOutputCreation = false;
    const [bloomComposer, finalComposer] = addonRecords.composers;
    const bloom = addonRecords.blooms[0];
    const compositePass = addonRecords.shaderPasses[0];
    const compositeMaterial = addonRecords.compositeMaterials[0];

    pipeline.render();

    expect(pipeline.active).toBe(false);
    expect(compositePass.dispose).toHaveBeenCalledOnce();
    expect(compositeMaterial.dispose).toHaveBeenCalledOnce();
    expect(bloom.dispose).toHaveBeenCalledOnce();
    expect(bloomComposer.dispose).toHaveBeenCalledOnce();
    expect(finalComposer.dispose).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it("uses direct rendering without creating a composer when bloom is disabled", () => {
    const renderer = { render: vi.fn() };
    const composerFactory = vi.fn();
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene: {},
      camera: {},
      quality: { bloomEnabled: false },
      reducedMotion: false,
      factories: { createComposer: composerFactory }
    });

    pipeline.render();

    expect(pipeline.active).toBe(false);
    expect(composerFactory).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledOnce();
  });

  it("fails closed to direct rendering when composer resize becomes unsupported", () => {
    const renderer = { render: vi.fn() };
    const composer = createComposer();
    composer.setSize.mockImplementationOnce(() => {
      throw new Error("resize unsupported");
    });
    const pipeline = createDeepSpacePostprocessing({
      renderer,
      scene: {},
      camera: {},
      quality: { bloomEnabled: true, bloomScale: 0.5 },
      reducedMotion: false,
      factories: { createComposer: () => composer }
    });

    expect(() => pipeline.resize({ width: 800, height: 600, pixelRatio: 2 })).not.toThrow();
    pipeline.render();

    expect(pipeline.active).toBe(false);
    expect(composer.dispose).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledOnce();
  });
});

const createSceneHarness = ({ renderPipeline } = {}) => {
  const canvas = {
    clientWidth: 320,
    clientHeight: 180,
    getBoundingClientRect: () => ({ width: 320, height: 180, left: 0, top: 0 })
  };
  const renderer = {
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    dispose: vi.fn()
  };
  const scene = {
    add: vi.fn(),
    clear: vi.fn(),
    updateMatrixWorld: vi.fn()
  };
  const camera = {
    aspect: 1,
    updateProjectionMatrix: vi.fn()
  };
  const manager = createScene({
    THREE: {},
    canvas,
    quality: { pixelRatio: 1.5 },
    renderer,
    scene,
    camera,
    cameraTarget: {},
    raycaster: {},
    pointer: {},
    renderPipeline
  });

  return { camera, manager, renderer };
};

describe("createScene render pipeline lifecycle", () => {
  it("delegates render, resize, and idempotent disposal to an adopted pipeline", () => {
    const renderPipeline = {
      render: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn()
    };
    const { camera, manager, renderer } = createSceneHarness({ renderPipeline });
    renderPipeline.resize.mockClear();

    manager.render();
    manager.resize({ width: 800, height: 600, pixelRatio: 1.25 });
    manager.dispose();
    manager.dispose();
    manager.render();
    manager.resize({ width: 640, height: 360, pixelRatio: 1 });
    manager.update({});

    expect(renderPipeline.render).toHaveBeenCalledOnce();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderPipeline.resize).toHaveBeenCalledOnce();
    expect(renderPipeline.resize).toHaveBeenCalledWith({
      width: 800,
      height: 600,
      pixelRatio: 1.25
    });
    expect(renderer.setSize).toHaveBeenLastCalledWith(800, 600, false);
    expect(camera.aspect).toBe(800 / 600);
    expect(renderPipeline.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(manager.hitTest({ clientX: 0, clientY: 0 })).toBeNull();
  });

  it("retains the last valid canvas size when resize dimensions are invalid", () => {
    const { camera, manager, renderer } = createSceneHarness();
    renderer.setPixelRatio.mockClear();
    renderer.setSize.mockClear();
    camera.updateProjectionMatrix.mockClear();

    manager.resize({ width: 0, height: Number.NaN, pixelRatio: 0 });

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.setSize).toHaveBeenCalledWith(320, 180, false);
    expect(camera.aspect).toBe(320 / 180);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledOnce();

    manager.dispose();
  });

  it("preserves direct renderer fallback when no pipeline is supplied", () => {
    const { manager, renderer } = createSceneHarness();

    manager.render();
    manager.dispose();

    expect(renderer.render).toHaveBeenCalledOnce();
  });
});
