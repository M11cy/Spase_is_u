const EMPTY_MANIFEST = Object.freeze({});
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const ROUTE_ORIGIN = "https://texture-route.invalid";

const uniqueStrings = (values) => Object.freeze([
  ...new Set(values.filter((value) => typeof value === "string" && value.length > 0))
]);

const loadTexture = (loader, url) => {
  if (typeof loader.loadAsync === "function") return loader.loadAsync(url);
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
};

const colorBytes = (fallbackColor) => {
  const color = Number.isInteger(fallbackColor) ? fallbackColor : 0x07101f;
  return new Uint8Array([
    (color >> 16) & 0xff,
    (color >> 8) & 0xff,
    color & 0xff,
    0xff
  ]);
};

const createFallbackTexture = (THREE, fallbackColor) => {
  const texture = new THREE.DataTexture(colorBytes(fallbackColor), 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const runtimeRoute = (url) => {
  if (typeof url !== "string" || url.length === 0) return null;
  try {
    if (url.startsWith("//")) {
      const parsed = new URL(`https:${url}`);
      return { kind: "protocol-relative", parsed, pathname: parsed.pathname };
    }
    if (URL_SCHEME.test(url)) {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return { kind: "absolute", parsed, pathname: parsed.pathname };
    }
    const parsed = new URL(url, `${ROUTE_ORIGIN}/`);
    const kind = url.startsWith("/") ? "root" : url.startsWith("./") ? "dot" : "relative";
    return { kind, parsed, pathname: parsed.pathname };
  } catch {
    return null;
  }
};

const findManifestRoute = (manifest, sourceUrl) => {
  if (manifest[sourceUrl]) return { key: sourceUrl, variants: manifest[sourceUrl] };
  const route = runtimeRoute(sourceUrl);
  if (!route) return null;
  if (route.kind === "absolute" || route.kind === "protocol-relative") return null;
  const key = Object.keys(manifest)
    .filter((candidate) => candidate.startsWith("/") && route.pathname.endsWith(candidate))
    .sort((left, right) => right.length - left.length)[0];
  return key ? { key, route, variants: manifest[key] } : null;
};

const variantRoute = (value, manifestKey) => {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value.startsWith("//") || URL_SCHEME.test(value)) return value;
  try {
    return new URL(value, `${ROUTE_ORIGIN}${manifestKey}`).pathname;
  } catch {
    return value;
  }
};

const runtimeVariantUrl = (value, match, sourceUrl) => {
  if (!match || typeof value !== "string" || value.length === 0) return value;
  if (value.startsWith("//") || URL_SCHEME.test(value)) return value;
  const route = match.route ?? runtimeRoute(sourceUrl);
  if (!route || !route.pathname.endsWith(match.key)) return value;
  const prefix = route.pathname.slice(0, -match.key.length);
  const pathname = `${prefix}${variantRoute(value, match.key)}`;
  if (route.kind === "absolute") {
    const resolved = new URL(route.parsed.href);
    resolved.pathname = pathname;
    resolved.search = "";
    resolved.hash = "";
    return resolved.href;
  }
  if (route.kind === "protocol-relative") return `//${route.parsed.host}${pathname}`;
  if (route.kind === "dot") return `.${pathname}`;
  if (route.kind === "relative") return pathname.replace(/^\//, "");
  return pathname;
};

export const createTextureStore = ({
  THREE,
  loader,
  fetcher = globalThis.fetch?.bind(globalThis),
  manifestUrl = "/space/assets.json"
}) => {
  const records = new Map();
  let disposed = false;
  const manifestPromise = (async () => {
    if (!fetcher) return EMPTY_MANIFEST;
    try {
      const response = await fetcher(manifestUrl);
      if (!response?.ok) return EMPTY_MANIFEST;
      const manifest = await response.json();
      return manifest && typeof manifest === "object" ? manifest : EMPTY_MANIFEST;
    } catch {
      return EMPTY_MANIFEST;
    }
  })();

  const loadFirstAvailable = async (url, fallbackColor) => {
    const manifest = await manifestPromise;
    if (disposed) throw new Error("Texture store has been disposed");
    const match = findManifestRoute(manifest, url);
    const variants = match?.variants ?? EMPTY_MANIFEST;
    const candidates = uniqueStrings([
      runtimeVariantUrl(variants.avif, match, url),
      runtimeVariantUrl(variants.webp, match, url),
      runtimeVariantUrl(variants.fallback, match, url),
      url
    ]);
    for (const candidate of candidates) {
      if (disposed) throw new Error("Texture store has been disposed");
      try {
        const texture = await loadTexture(loader, candidate);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      } catch {
        // Try the next local representation before using the deterministic pixel fallback.
      }
    }
    if (disposed) throw new Error("Texture store has been disposed");
    return createFallbackTexture(THREE, fallbackColor);
  };

  const releaseRecord = (url, record) => {
    if (record.references <= 0) return;
    record.references -= 1;
    if (record.references > 0 || record.released) return;
    record.released = true;
    records.delete(url);
    if (record.texture) record.texture.dispose();
  };

  const load = (url, fallbackColor = 0x07101f) => {
    if (disposed) return Promise.reject(new Error("Texture store has been disposed"));
    let record = records.get(url);
    if (!record) {
      record = {
        references: 0,
        released: false,
        texture: null,
        promise: null
      };
      record.promise = loadFirstAvailable(url, fallbackColor).then((texture) => {
        record.texture = texture;
        if (record.released || disposed) {
          texture.dispose();
          record.texture = null;
        }
        return texture;
      });
      records.set(url, record);
    }
    record.references += 1;

    return record.promise.then((texture) => {
      if (disposed || record.released) throw new Error("Texture store has been disposed");
      let released = false;
      return Object.freeze({
        texture,
        release: () => {
          if (released) return;
          released = true;
          releaseRecord(url, record);
        }
      });
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    records.forEach((record) => {
      record.references = 0;
      record.released = true;
      if (record.texture) {
        record.texture.dispose();
        record.texture = null;
      }
    });
    records.clear();
  };

  return Object.freeze({ load, dispose });
};
