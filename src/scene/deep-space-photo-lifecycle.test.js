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
    expect(mainSource).toContain("cosmicWeb: cosmicWebPhotoTexture");
    expect(cosmicWebSetup).toMatch(/texture:\s*cosmicWebPhotoTexture/);
    expect(disposeBody).toContain("deepSpacePhotoLifecycle.release();");
    expect(disposeBody.indexOf("deepSpacePhotoLifecycle.release();"))
      .toBeLessThan(disposeBody.indexOf("textureStore.dispose();"));
  });
});
