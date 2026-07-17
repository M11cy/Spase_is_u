import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { optimizeAssets } from "../../scripts/optimize-assets.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe("optimizeAssets", () => {
  it("writes only useful modern variants and leaves identical outputs untouched", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cosmos-assets-"));
    temporaryDirectories.push(directory);
    const width = 320;
    const height = 180;
    const pixels = Buffer.alloc(width * height * 3);
    for (let index = 0; index < pixels.length; index += 1) pixels[index] = index % 251;
    const original = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 96 })
      .toBuffer();
    await writeFile(join(directory, "earth.jpg"), original);

    const firstManifest = await optimizeAssets({ directory, sources: ["earth.jpg"] });
    const routes = firstManifest["/space/earth.jpg"];
    const variants = [routes.avif, routes.webp].filter(Boolean);
    expect(variants.length).toBeGreaterThan(0);
    for (const route of variants) {
      const output = await readFile(join(directory, route.split("/").at(-1)));
      expect(output.byteLength).toBeLessThan(original.byteLength);
    }

    const oldTime = new Date("2020-01-01T00:00:00.000Z");
    await Promise.all(variants.map(async (route) => {
      const path = join(directory, route.split("/").at(-1));
      await utimes(path, oldTime, oldTime);
    }));
    await optimizeAssets({ directory, sources: ["earth.jpg"] });
    const mtimes = await Promise.all(variants.map(async (route) => (
      (await stat(join(directory, route.split("/").at(-1)))).mtime.toISOString()
    )));

    expect(mtimes).toEqual(variants.map(() => oldTime.toISOString()));
    expect(JSON.parse(await readFile(join(directory, "assets.json"), "utf8")))
      .toEqual(firstManifest);
  });

  it("honors immutable per-source width and quality records without breaking legacy strings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cosmos-assets-records-"));
    temporaryDirectories.push(directory);
    const pixels = Buffer.alloc(1024 * 512 * 3);
    for (let index = 0; index < pixels.length; index += 1) pixels[index] = index % 251;
    const input = await sharp(pixels, { raw: { width: 1024, height: 512, channels: 3 } })
      .jpeg({ quality: 96 })
      .toBuffer();
    await Promise.all([
      writeFile(join(directory, "high.jpg"), input),
      writeFile(join(directory, "economy.jpg"), input),
      writeFile(join(directory, "legacy.jpg"), input)
    ]);
    const sourceRecord = Object.freeze({ source: "high.jpg", maxWidth: 800, quality: 70 });

    const manifest = await optimizeAssets({
      directory,
      maxWidth: 256,
      sources: Object.freeze([
        sourceRecord,
        Object.freeze({ source: "economy.jpg", maxWidth: 400, quality: 64 }),
        "legacy.jpg"
      ])
    });

    const metadataFor = async (route) => sharp(
      await readFile(join(directory, route.split("/").at(-1)))
    ).metadata();
    expect((await metadataFor(manifest["/space/high.jpg"].avif)).width).toBe(800);
    expect((await metadataFor(manifest["/space/economy.jpg"].webp)).width).toBe(400);
    expect((await metadataFor(manifest["/space/legacy.jpg"].avif)).width).toBe(256);
    expect(sourceRecord).toEqual({ source: "high.jpg", maxWidth: 800, quality: 70 });
    expect(Object.isFrozen(sourceRecord)).toBe(true);
  });

  it("produces deterministic 8K and 4K metadata for bounded Earth fallbacks", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cosmos-earth-sizes-"));
    temporaryDirectories.push(directory);
    const input = await sharp({
      create: {
        width: 8192,
        height: 4096,
        channels: 3,
        background: { r: 18, g: 54, b: 96 }
      }
    }).jpeg({ quality: 90 }).toBuffer();
    await Promise.all([
      writeFile(join(directory, "earth-daymap-8k.jpg"), input),
      writeFile(join(directory, "earth-daymap-4k.jpg"), input)
    ]);

    const sources = Object.freeze([
      Object.freeze({ source: "earth-daymap-8k.jpg", maxWidth: 8192, quality: 70 }),
      Object.freeze({ source: "earth-daymap-4k.jpg", maxWidth: 4096, quality: 70 })
    ]);
    const firstManifest = await optimizeAssets({ directory, sources });
    const firstManifestText = await readFile(join(directory, "assets.json"), "utf8");
    const secondManifest = await optimizeAssets({ directory, sources });

    const highMetadata = await sharp(await readFile(join(
      directory,
      firstManifest["/space/earth-daymap-8k.jpg"].webp.split("/").at(-1)
    ))).metadata();
    const economyMetadata = await sharp(await readFile(join(
      directory,
      firstManifest["/space/earth-daymap-4k.jpg"].webp.split("/").at(-1)
    ))).metadata();
    expect({ width: highMetadata.width, height: highMetadata.height }).toEqual({ width: 8192, height: 4096 });
    expect({ width: economyMetadata.width, height: economyMetadata.height }).toEqual({ width: 4096, height: 2048 });
    expect(secondManifest).toEqual(firstManifest);
    expect(await readFile(join(directory, "assets.json"), "utf8")).toBe(firstManifestText);
  }, 30_000);
});
