import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildDeepSpaceAssets } from "../../scripts/build-deep-space-assets.mjs";
import { optimizeAssets } from "../../scripts/optimize-assets.mjs";
import { selectDeepSpaceTextureRoutes } from "./deep-space-assets.js";

const DEFAULT_SOURCE_NAMES = Object.freeze([
  "earth-daymap-8k.jpg",
  "earth-daymap-4k.jpg",
  "earth-clouds-4k.jpg",
  "earth-daymap.jpg",
  "earth-clouds.jpg",
  "mars.jpg",
  "jupiter.jpg",
  "neptune.jpg",
  "sagittarius-a.jpg",
  "milky-way-realistic.jpg",
  "andromeda.jpg",
  "local-group.jpg",
  ...["milky-way", "local-group", "cosmic-web"].flatMap((family) => (
    ["8k", "4k", "2k"].map((tier) => `${family}-photo-${tier}.jpg`)
  ))
]);

describe("selectDeepSpaceTextureRoutes", () => {
  it("maps every supported quality tier to its photographic texture family", () => {
    expect(selectDeepSpaceTextureRoutes({ tier: "high" })).toEqual({
      milkyWay: "/space/milky-way-photo-8k.jpg",
      localGroup: "/space/local-group-photo-8k.jpg",
      cosmicWeb: "/space/cosmic-web-photo-8k.jpg"
    });
    expect(selectDeepSpaceTextureRoutes({ tier: "medium" }).cosmicWeb)
      .toBe("/space/cosmic-web-photo-4k.jpg");
    expect(selectDeepSpaceTextureRoutes({ tier: "economy" }).localGroup)
      .toBe("/space/local-group-photo-2k.jpg");
    expect(Object.isFrozen(selectDeepSpaceTextureRoutes({ tier: "high" }))).toBe(true);
  });

  it("rejects unsupported quality tiers", () => {
    expect(() => selectDeepSpaceTextureRoutes({ tier: "ultra" })).toThrow(TypeError);
  });
});

describe("buildDeepSpaceAssets", () => {
  it("creates exact-size deterministic JPEG derivatives", async () => {
    const directory = await mkdtemp(join(tmpdir(), "deep-space-assets-"));
    try {
      await sharp({
        create: {
          width: 32,
          height: 18,
          channels: 3,
          background: { r: 84, g: 38, b: 126 }
        }
      }).jpeg().toFile(join(directory, "sample-photo-8k.jpg"));
      const options = Object.freeze({
        directory,
        masters: Object.freeze(["sample-photo-8k.jpg"]),
        derivatives: Object.freeze([
          Object.freeze({ suffix: "4k", width: 16, height: 9 }),
          Object.freeze({ suffix: "2k", width: 8, height: 4 })
        ])
      });

      await buildDeepSpaceAssets(options);
      const first4k = await readFile(join(directory, "sample-photo-4k.jpg"));
      const first2k = await readFile(join(directory, "sample-photo-2k.jpg"));
      await buildDeepSpaceAssets(options);

      await expect(sharp(first4k).metadata()).resolves.toMatchObject({ width: 16, height: 9 });
      await expect(sharp(first2k).metadata()).resolves.toMatchObject({ width: 8, height: 4 });
      expect(await readFile(join(directory, "sample-photo-4k.jpg"))).toEqual(first4k);
      expect(await readFile(join(directory, "sample-photo-2k.jpg"))).toEqual(first2k);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects master paths that can escape the asset directory", async () => {
    await expect(buildDeepSpaceAssets({
      directory: "safe",
      masters: ["../unsafe-photo-8k.jpg"]
    })).rejects.toThrow(TypeError);
  });

  it("rejects duplicate output routes before starting Sharp jobs", async () => {
    await expect(buildDeepSpaceAssets({
      directory: "safe",
      masters: ["sample-photo-8k.jpg", "sample-photo-8k.jpg"]
    })).rejects.toThrow(TypeError);
  });

  it("rejects derivative routes that overwrite a master", async () => {
    await expect(buildDeepSpaceAssets({
      directory: "safe",
      masters: ["sample-photo-8k.jpg"],
      derivatives: [{ suffix: "8k", width: 32, height: 18 }]
    })).rejects.toThrow(TypeError);
  });
});

describe("optimizeAssets deep-space defaults", () => {
  it("creates optimized siblings and manifest entries for all nine routes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "deep-space-optimize-"));
    try {
      const jpeg = await sharp({
        create: {
          width: 32,
          height: 18,
          channels: 3,
          background: { r: 84, g: 38, b: 126 }
        }
      }).jpeg({ quality: 100 }).toBuffer();
      const oversizedJpeg = Buffer.concat([jpeg, Buffer.alloc(8192)]);
      await Promise.all(DEFAULT_SOURCE_NAMES.map((name) => (
        writeFile(join(directory, name), oversizedJpeg)
      )));

      const manifest = await optimizeAssets({ directory, maxWidth: 32 });

      for (const family of ["milky-way", "local-group", "cosmic-web"]) {
        for (const tier of ["8k", "4k", "2k"]) {
          const route = `/space/${family}-photo-${tier}.jpg`;
          const stem = `${family}-photo-${tier}`;
          expect(manifest[route]).toEqual({
            avif: `/space/${stem}.avif`,
            webp: `/space/${stem}.webp`,
            fallback: route
          });
          await expect(readFile(join(directory, `${stem}.avif`))).resolves.toBeTruthy();
          await expect(readFile(join(directory, `${stem}.webp`))).resolves.toBeTruthy();
        }
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
