import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { setupDeepSpacePhotoLifecycle } from "./deep-space-photo-lifecycle.js";

const routes = Object.freeze({
  milkyWay: "/base/space/milky-way-realistic.jpg",
  localGroup: "/base/space/local-group-realistic.jpg",
  cosmicWeb: "/base/space/cosmic-web-realistic.jpg"
});

const createHandle = (name) => ({
  texture: { name, anisotropy: 0 },
  release: vi.fn()
});

const createHarness = ({ rejectedIndex = -1 } = {}) => {
  const handles = [
    createHandle("milky-way"),
    createHandle("local-group"),
    createHandle("cosmic-web")
  ];
  const failure = new Error(`photo-${rejectedIndex}-failed`);
  const load = vi.fn((url) => {
    const index = Object.values(routes).indexOf(url);
    return index === rejectedIndex ? Promise.reject(failure) : Promise.resolve(handles[index]);
  });

  return {
    failure,
    handles,
    textureStore: { load }
  };
};

describe("setupDeepSpacePhotoLifecycle", () => {
  it("loads the three exact selected routes with their fallback colors and configures every texture", async () => {
    expect(setupDeepSpacePhotoLifecycle).toBeTypeOf("function");
    const { handles, textureStore } = createHarness();
    const setup = vi.fn((textures) => ({ textures }));

    const lifecycle = await setupDeepSpacePhotoLifecycle({
      textureStore,
      routes,
      maxAnisotropy: 16,
      setup
    });

    expect(textureStore.load.mock.calls).toEqual([
      [routes.milkyWay, 0x02040a],
      [routes.localGroup, 0x02040a],
      [routes.cosmicWeb, 0x080313]
    ]);
    expect(handles.map(({ texture }) => texture.anisotropy)).toEqual([16, 16, 16]);
    expect(setup).toHaveBeenCalledOnce();
    expect(setup.mock.calls[0][0]).toEqual({
      milkyWay: handles[0].texture,
      localGroup: handles[1].texture,
      cosmicWeb: handles[2].texture
    });
    expect(Object.isFrozen(setup.mock.calls[0][0])).toBe(true);
    expect(lifecycle.value.textures.cosmicWeb).toBe(handles[2].texture);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(routes).toEqual({
      milkyWay: "/base/space/milky-way-realistic.jpg",
      localGroup: "/base/space/local-group-realistic.jpg",
      cosmicWeb: "/base/space/cosmic-web-realistic.jpg"
    });
    expect(Object.isFrozen(routes)).toBe(true);
  });

  it("rejects invalid boundaries before starting any acquisition", async () => {
    const load = vi.fn();
    const validInput = {
      textureStore: { load },
      routes,
      maxAnisotropy: 8,
      setup: vi.fn()
    };
    const invalidInputs = [
      undefined,
      { ...validInput, textureStore: null },
      { ...validInput, textureStore: {} },
      { ...validInput, routes: null },
      ...["milkyWay", "localGroup", "cosmicWeb"].flatMap((key) => [
        { ...validInput, routes: { ...routes, [key]: "" } },
        { ...validInput, routes: { ...routes, [key]: "   " } },
        { ...validInput, routes: { ...routes, [key]: 42 } }
      ]),
      { ...validInput, maxAnisotropy: 0 },
      { ...validInput, maxAnisotropy: -1 },
      { ...validInput, maxAnisotropy: Number.NaN },
      { ...validInput, maxAnisotropy: Number.POSITIVE_INFINITY },
      { ...validInput, setup: null }
    ];

    for (const input of invalidInputs) {
      const operation = input === undefined
        ? setupDeepSpacePhotoLifecycle()
        : setupDeepSpacePhotoLifecycle(input);
      await expect(operation).rejects.toBeInstanceOf(TypeError);
    }

    expect(load).not.toHaveBeenCalled();
  });

  it("releases every acquired handle exactly once", async () => {
    const { handles, textureStore } = createHarness();
    const lifecycle = await setupDeepSpacePhotoLifecycle({
      textureStore,
      routes,
      maxAnisotropy: 8,
      setup: (textures) => textures
    });

    lifecycle.release();
    lifecycle.release();

    handles.forEach(({ release }) => expect(release).toHaveBeenCalledOnce());
  });

  it.each([0, 1, 2])(
    "cleans up fulfilled handles when photo acquisition %i rejects",
    async (rejectedIndex) => {
      const { failure, handles, textureStore } = createHarness({ rejectedIndex });
      const setup = vi.fn();

      await expect(setupDeepSpacePhotoLifecycle({
        textureStore,
        routes,
        maxAnisotropy: 4,
        setup
      })).rejects.toBe(failure);

      expect(textureStore.load).toHaveBeenCalledTimes(3);
      handles.forEach(({ release }, index) => {
        expect(release).toHaveBeenCalledTimes(index === rejectedIndex ? 0 : 1);
      });
      expect(setup).not.toHaveBeenCalled();
    }
  );

  it("cleans up all acquired handles when late asynchronous setup fails", async () => {
    const { handles, textureStore } = createHarness();
    const setupFailure = new Error("cosmic layer setup failed");

    await expect(setupDeepSpacePhotoLifecycle({
      textureStore,
      routes,
      maxAnisotropy: 12,
      setup: async () => {
        throw setupFailure;
      }
    })).rejects.toBe(setupFailure);

    handles.forEach(({ release }) => expect(release).toHaveBeenCalledOnce());
  });

  it.each([1, 2])(
    "disposes registered layers in reverse order when layer construction %i fails",
    async (failedLayerIndex) => {
      const { handles, textureStore } = createHarness();
      const failure = new Error(`layer-${failedLayerIndex}-failed`);
      const disposalOrder = [];
      const createdLayers = [];

      await expect(setupDeepSpacePhotoLifecycle({
        textureStore,
        routes,
        maxAnisotropy: 12,
        setup: (_textures, { registerCleanup }) => {
          for (let index = 0; index < 3; index += 1) {
            if (index === failedLayerIndex) throw failure;
            const layer = {
              dispose: vi.fn(() => disposalOrder.push(index))
            };
            createdLayers.push(layer);
            registerCleanup(layer.dispose);
          }
        }
      })).rejects.toBe(failure);

      expect(disposalOrder).toEqual(createdLayers.map((_, index) => index).reverse());
      createdLayers.forEach(({ dispose }) => expect(dispose).toHaveBeenCalledOnce());
      handles.forEach(({ release }) => expect(release).toHaveBeenCalledOnce());
    }
  );

  it("continues reverse cleanup and preserves the setup error when one cleanup throws", async () => {
    const { handles, textureStore } = createHarness();
    const setupFailure = new Error("late setup failure");
    const cleanupFailure = new Error("layer cleanup failure");
    const cleanupOrder = [];
    const cleanups = [
      vi.fn(() => cleanupOrder.push(0)),
      vi.fn(() => {
        cleanupOrder.push(1);
        throw cleanupFailure;
      }),
      vi.fn(() => cleanupOrder.push(2))
    ];

    await expect(setupDeepSpacePhotoLifecycle({
      textureStore,
      routes,
      maxAnisotropy: 12,
      setup: (_textures, { registerCleanup }) => {
        cleanups.forEach(registerCleanup);
        throw setupFailure;
      }
    })).rejects.toBe(setupFailure);

    expect(cleanupOrder).toEqual([2, 1, 0]);
    cleanups.forEach((cleanup) => expect(cleanup).toHaveBeenCalledOnce());
    handles.forEach(({ release }) => expect(release).toHaveBeenCalledOnce());
  });

  it("disarms registered setup cleanups after success so global disposal stays exact-once", async () => {
    const { textureStore } = createHarness();
    const layer = { dispose: vi.fn() };
    const lifecycle = await setupDeepSpacePhotoLifecycle({
      textureStore,
      routes,
      maxAnisotropy: 12,
      setup: (_textures, { registerCleanup }) => {
        registerCleanup(layer.dispose);
        return layer;
      }
    });

    lifecycle.release();
    lifecycle.release();
    expect(layer.dispose).not.toHaveBeenCalled();

    lifecycle.value.dispose();
    expect(layer.dispose).toHaveBeenCalledOnce();
  });
});

describe("deep-space photo main integration", () => {
  it("constructs all three photo layers inside the safe setup boundary and releases it before the store", () => {
    const mainSource = readFileSync(resolve(process.cwd(), "src/main.js"), "utf8");
    const disposeBody = mainSource.match(
      /function disposeExperience\(\) \{([\s\S]*?)\n\}/
    )?.[1] ?? "";
    const cosmicWebSetup = mainSource.match(
      /const cosmicWebLayer = createCosmicWebLayer\(\{([\s\S]*?)\n\s*\}\);/
    )?.[1] ?? "";

    expect(mainSource).toContain(
      'import { setupDeepSpacePhotoLifecycle } from "./scene/deep-space-photo-lifecycle.js";'
    );
    expect(mainSource).toContain(
      "const deepSpacePhotoLifecycle = await setupDeepSpacePhotoLifecycle({"
    );
    expect(mainSource).toContain("}, { registerCleanup }) => {");
    expect(mainSource.match(/registerCleanup\(\(\) => \w+Layer\.dispose\(\)\);/g))
      .toHaveLength(3);
    expect(mainSource).toContain("cosmicWeb: cosmicWebPhotoTexture");
    expect(cosmicWebSetup).toMatch(/texture:\s*cosmicWebPhotoTexture/);
    expect(disposeBody).toContain("deepSpacePhotoLifecycle.release();");
    expect(disposeBody.indexOf("deepSpacePhotoLifecycle.release();"))
      .toBeLessThan(disposeBody.indexOf("textureStore.dispose();"));
  });
});
