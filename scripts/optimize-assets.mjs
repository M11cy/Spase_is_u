import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({ source: "earth-daymap-8k.jpg", maxWidth: 8192, quality: 78 }),
  Object.freeze({ source: "earth-daymap-4k.jpg", maxWidth: 4096, quality: 78 }),
  Object.freeze({ source: "earth-clouds-4k.jpg", maxWidth: 4096, quality: 76 }),
  "earth-daymap.jpg",
  "earth-clouds.jpg",
  "mars.jpg",
  "jupiter.jpg",
  "neptune.jpg",
  "sagittarius-a.jpg",
  "milky-way-realistic.jpg",
  "andromeda.jpg",
  "local-group.jpg"
]);

const boundedQuality = (value, fallback) => (
  Number.isFinite(value) ? Math.min(100, Math.max(1, Math.round(value))) : fallback
);

const normalizeSource = (entry, defaultMaxWidth) => {
  if (typeof entry === "string") {
    return Object.freeze({
      source: entry,
      maxWidth: defaultMaxWidth,
      avifQuality: 62,
      webpQuality: 78
    });
  }
  if (!entry || typeof entry.source !== "string" || entry.source.length === 0) {
    throw new TypeError("Asset sources must be filenames or source records");
  }
  const sourceMaxWidth = Number.isFinite(entry.maxWidth) && entry.maxWidth > 0
    ? Math.round(entry.maxWidth)
    : defaultMaxWidth;
  return Object.freeze({
    source: entry.source,
    maxWidth: sourceMaxWidth,
    avifQuality: boundedQuality(entry.quality, 62),
    webpQuality: boundedQuality(entry.quality, 78)
  });
};

const readExisting = async (path) => {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const writeIfChanged = async (path, data) => {
  const existing = await readExisting(path);
  if (existing?.equals(data)) return false;
  await writeFile(path, data);
  return true;
};

const removeIfPresent = async (path) => {
  await rm(path, { force: true });
};

const createVariant = async ({ input, output, sourceSize, transform }) => {
  const data = await transform(sharp(input, { limitInputPixels: 80_000_000 }))
    .toBuffer();
  if (data.byteLength >= sourceSize) {
    await removeIfPresent(output);
    return false;
  }
  await writeIfChanged(output, data);
  return true;
};

export const optimizeAssets = async ({
  directory,
  sources = DEFAULT_SOURCES,
  maxWidth = 2048
}) => {
  const manifest = {};
  for (const entry of sources) {
    const { source, maxWidth: sourceMaxWidth, avifQuality, webpQuality } = normalizeSource(entry, maxWidth);
    const stem = basename(source, extname(source));
    const input = join(directory, source);
    const sourceData = await readFile(input);
    const avifName = `${stem}.avif`;
    const webpName = `${stem}.webp`;
    const resize = (pipeline) => pipeline.resize({ width: sourceMaxWidth, withoutEnlargement: true });
    const [hasAvif, hasWebp] = await Promise.all([
      createVariant({
        input,
        output: join(directory, avifName),
        sourceSize: sourceData.byteLength,
        transform: (pipeline) => resize(pipeline).avif({ quality: avifQuality, effort: 5 })
      }),
      createVariant({
        input,
        output: join(directory, webpName),
        sourceSize: sourceData.byteLength,
        transform: (pipeline) => resize(pipeline).webp({ quality: webpQuality, effort: 4 })
      })
    ]);
    manifest[`/space/${source}`] = {
      ...(hasAvif ? { avif: `/space/${avifName}` } : {}),
      ...(hasWebp ? { webp: `/space/${webpName}` } : {}),
      fallback: `/space/${source}`
    };
  }

  const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeIfChanged(join(directory, "assets.json"), manifestData);
  return manifest;
};

const modulePath = import.meta.url.startsWith("file:") ? fileURLToPath(import.meta.url) : null;
const isDirectRun = modulePath
  && process.argv[1]
  && resolve(process.argv[1]) === modulePath;

if (isDirectRun) {
  const defaultDirectory = dirname(fileURLToPath(new URL("../public/space/.keep", import.meta.url)));
  await optimizeAssets({ directory: defaultDirectory });
}
