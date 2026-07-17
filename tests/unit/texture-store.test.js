import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTextureStore } from "../../src/scene/textures.js";

const manifest = Object.freeze({
  "/space/earth-daymap.jpg": Object.freeze({
    avif: "/space/earth-daymap.avif",
    webp: "/space/earth-daymap.webp",
    fallback: "/space/earth-daymap.jpg"
  })
});

const createFetcher = () => vi.fn(async () => ({
  ok: true,
  json: async () => manifest
}));

describe("createTextureStore", () => {
  it.each([
    ["./space/earth-daymap.jpg", "./space/earth-daymap.avif"],
    ["/sub/app/space/earth-daymap.jpg", "/sub/app/space/earth-daymap.avif"]
  ])("maps manifest variants onto the runtime base for %s", async (sourceUrl, expectedVariantUrl) => {
    const texture = new THREE.Texture();
    const loader = { loadAsync: vi.fn(async () => texture) };
    const store = createTextureStore({ THREE, loader, fetcher: createFetcher() });

    const acquisition = await store.load(sourceUrl);

    expect(loader.loadAsync).toHaveBeenCalledWith(expectedVariantUrl);
    acquisition.release();
  });

  it("does not apply local manifest routes to an absolute external URL", async () => {
    const sourceUrl = "https://cdn.example/sub/app/space/earth-daymap.jpg";
    const texture = new THREE.Texture();
    const loader = { loadAsync: vi.fn(async () => texture) };
    const store = createTextureStore({ THREE, loader, fetcher: createFetcher() });

    const acquisition = await store.load(sourceUrl);

    expect(loader.loadAsync).toHaveBeenCalledOnce();
    expect(loader.loadAsync).toHaveBeenCalledWith(sourceUrl);
    acquisition.release();
  });

  it("leaves data URLs untouched when no manifest route can apply", async () => {
    const sourceUrl = "data:image/png;base64,AAAA";
    const texture = new THREE.Texture();
    const loader = { loadAsync: vi.fn(async () => texture) };
    const store = createTextureStore({ THREE, loader, fetcher: createFetcher() });

    const acquisition = await store.load(sourceUrl);

    expect(loader.loadAsync).toHaveBeenCalledOnce();
    expect(loader.loadAsync).toHaveBeenCalledWith(sourceUrl);
    acquisition.release();
  });

  it("tries AVIF then WebP, shares the pending load and disposes on final release", async () => {
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, "dispose");
    const loader = {
      loadAsync: vi.fn(async (url) => {
        if (url.endsWith(".avif")) throw new Error("unsupported AVIF");
        return texture;
      })
    };
    const fetcher = createFetcher();
    const store = createTextureStore({ THREE, loader, fetcher });

    const [first, second] = await Promise.all([
      store.load("/space/earth-daymap.jpg", 0x102030),
      store.load("/space/earth-daymap.jpg", 0x102030)
    ]);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(loader.loadAsync.mock.calls.map(([url]) => url)).toEqual([
      "/space/earth-daymap.avif",
      "/space/earth-daymap.webp"
    ]);
    expect(first.texture).toBe(texture);
    expect(second.texture).toBe(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(Object.isFrozen(first)).toBe(true);

    first.release();
    first.release();
    expect(dispose).not.toHaveBeenCalled();
    second.release();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("falls through to the original before creating a one-pixel color texture", async () => {
    const loader = { loadAsync: vi.fn(async () => { throw new Error("decode failed"); }) };
    const store = createTextureStore({ THREE, loader, fetcher: createFetcher() });

    const acquisition = await store.load("/space/earth-daymap.jpg", 0x123456);

    expect(loader.loadAsync.mock.calls.map(([url]) => url)).toEqual([
      "/space/earth-daymap.avif",
      "/space/earth-daymap.webp",
      "/space/earth-daymap.jpg"
    ]);
    expect(acquisition.texture).toBeInstanceOf(THREE.DataTexture);
    expect([...acquisition.texture.image.data]).toEqual([0x12, 0x34, 0x56, 0xff]);
    expect(acquisition.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(acquisition.texture.version).toBeGreaterThan(0);
    acquisition.release();
  });

  it("uses the original when the manifest is unavailable and makes disposal terminal", async () => {
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, "dispose");
    const loader = { loadAsync: vi.fn(async () => texture) };
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    const store = createTextureStore({ THREE, loader, fetcher });

    const acquisition = await store.load("/space/custom.jpg", 0x000000);
    expect(loader.loadAsync).toHaveBeenCalledWith("/space/custom.jpg");

    store.dispose();
    store.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    acquisition.release();
    await expect(store.load("/space/other.jpg", 0xffffff))
      .rejects.toThrow("Texture store has been disposed");
  });

  it("disposes a texture that finishes loading after terminal store disposal", async () => {
    let finishLoading;
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, "dispose");
    const loader = {
      loadAsync: vi.fn(() => new Promise((resolve) => {
        finishLoading = () => resolve(texture);
      }))
    };
    const store = createTextureStore({
      THREE,
      loader,
      fetcher: vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    });

    const pending = store.load("/space/pending.jpg", 0x000000);
    await vi.waitFor(() => expect(finishLoading).toBeTypeOf("function"));
    store.dispose();
    finishLoading();

    await expect(pending).rejects.toThrow("Texture store has been disposed");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("does not try another fallback candidate after terminal disposal", async () => {
    let rejectFirstCandidate;
    const loader = {
      loadAsync: vi.fn(() => {
        if (rejectFirstCandidate) return Promise.reject(new Error("unexpected fallback"));
        return new Promise((resolve, reject) => {
          rejectFirstCandidate = reject;
        });
      })
    };
    const store = createTextureStore({ THREE, loader, fetcher: createFetcher() });

    const pending = store.load("/space/earth-daymap.jpg", 0x000000);
    await vi.waitFor(() => expect(rejectFirstCandidate).toBeTypeOf("function"));
    store.dispose();
    rejectFirstCandidate(new Error("unsupported AVIF"));

    await expect(pending).rejects.toThrow("Texture store has been disposed");
    expect(loader.loadAsync).toHaveBeenCalledOnce();
  });
});
