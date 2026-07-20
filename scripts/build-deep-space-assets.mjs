import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DEFAULT_MASTERS = Object.freeze([
  "milky-way-photo-8k.jpg",
  "local-group-photo-8k.jpg",
  "cosmic-web-photo-8k.jpg"
]);

const DEFAULT_DERIVATIVES = Object.freeze([
  Object.freeze({ suffix: "4k", width: 4096, height: 2304 }),
  Object.freeze({ suffix: "2k", width: 2048, height: 1152 })
]);

const MASTER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*-8k\.jpg$/u;
const SUFFIX_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

const validateInputs = ({ directory, masters, derivatives }) => {
  if (typeof directory !== "string" || directory.length === 0) {
    throw new TypeError("Deep-space asset directory must be a non-empty path");
  }
  if (!Array.isArray(masters) || masters.some((name) => (
    typeof name !== "string" || !MASTER_NAME_PATTERN.test(name)
  ))) {
    throw new TypeError("Deep-space masters must be 8K JPEG filenames");
  }
  if (!Array.isArray(derivatives) || derivatives.some(({ suffix, width, height } = {}) => (
    typeof suffix !== "string"
      || !SUFFIX_PATTERN.test(suffix)
      || !Number.isInteger(width)
      || width <= 0
      || !Number.isInteger(height)
      || height <= 0
  ))) {
    throw new TypeError("Deep-space derivatives require a suffix and positive dimensions");
  }
  const outputNames = masters.flatMap((master) => derivatives.map(({ suffix }) => (
    master.replace(/-8k\.jpg$/u, `-${suffix}.jpg`)
  )));
  if (new Set(outputNames).size !== outputNames.length
    || outputNames.some((name) => masters.includes(name))) {
    throw new TypeError("Deep-space derivative output names must be unique and distinct from masters");
  }
};

const deriveAsset = async ({ directory, master, derivative }) => {
  const outputName = master.replace(/-8k\.jpg$/u, `-${derivative.suffix}.jpg`);
  await sharp(join(directory, master), { limitInputPixels: 80_000_000 })
    .resize({
      width: derivative.width,
      height: derivative.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(join(directory, outputName));
  return outputName;
};

export const buildDeepSpaceAssets = async ({
  directory,
  masters = DEFAULT_MASTERS,
  derivatives = DEFAULT_DERIVATIVES
}) => {
  validateInputs({ directory, masters, derivatives });
  const jobs = masters.flatMap((master) => derivatives.map((derivative) => (
    deriveAsset({ directory, master, derivative })
  )));
  return Object.freeze(await Promise.all(jobs));
};

const modulePath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === modulePath;

if (isDirectRun) {
  const directory = dirname(fileURLToPath(new URL("../public/space/.keep", import.meta.url)));
  await buildDeepSpaceAssets({ directory });
}
