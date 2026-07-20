const PHOTO_REQUESTS = Object.freeze([
  Object.freeze({ key: "milkyWay", fallbackColor: 0x02040a }),
  Object.freeze({ key: "localGroup", fallbackColor: 0x02040a }),
  Object.freeze({ key: "cosmicWeb", fallbackColor: 0x080313 })
]);

const validateBoundary = ({ textureStore, routes, maxAnisotropy, setup }) => {
  const hasValidRoutes = routes && PHOTO_REQUESTS.every(({ key }) => (
    typeof routes[key] === "string" && routes[key].trim().length > 0
  ));

  if (
    typeof textureStore?.load !== "function"
    || !hasValidRoutes
    || !Number.isFinite(maxAnisotropy)
    || maxAnisotropy <= 0
    || typeof setup !== "function"
  ) {
    throw new TypeError("Invalid deep-space photo lifecycle boundary");
  }
};

const createRelease = (handles) => {
  let state = Object.freeze({ released: false });

  return () => {
    if (state.released) return;
    state = Object.freeze({ ...state, released: true });
    handles.forEach(({ release }) => release());
  };
};

const createSetupCleanupRegistry = () => {
  let state = Object.freeze({ active: true, cleanups: Object.freeze([]) });
  const registerCleanup = (cleanup) => {
    if (!state.active || typeof cleanup !== "function") {
      throw new TypeError("Setup cleanup must be a function registered during setup");
    }
    state = Object.freeze({
      ...state,
      cleanups: Object.freeze([...state.cleanups, cleanup])
    });
  };
  const close = ({ run }) => {
    if (!state.active) return;
    const cleanups = state.cleanups;
    state = Object.freeze({ active: false, cleanups: Object.freeze([]) });
    if (!run) return;
    [...cleanups].reverse().forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Continue unwinding the remaining setup resources and preserve the setup error.
      }
    });
  };

  return Object.freeze({ registerCleanup, close });
};

export const setupDeepSpacePhotoLifecycle = async ({
  textureStore,
  routes,
  maxAnisotropy,
  setup
} = {}) => {
  validateBoundary({ textureStore, routes, maxAnisotropy, setup });
  const results = await Promise.allSettled(PHOTO_REQUESTS.map(({ key, fallbackColor }) => (
    Promise.resolve().then(() => textureStore.load(routes[key], fallbackColor))
  )));
  const handles = results.flatMap((result) => (
    result.status === "fulfilled" ? [result.value] : []
  ));
  const release = createRelease(handles);
  const failure = results.find(({ status }) => status === "rejected");

  if (failure) {
    release();
    throw failure.reason;
  }

  const setupCleanupRegistry = createSetupCleanupRegistry();
  try {
    handles.forEach(({ texture }) => {
      texture.anisotropy = maxAnisotropy;
    });
    const textures = Object.freeze(Object.fromEntries(PHOTO_REQUESTS.map(({ key }, index) => (
      [key, handles[index].texture]
    ))));
    const value = await setup(textures, Object.freeze({
      registerCleanup: setupCleanupRegistry.registerCleanup
    }));
    setupCleanupRegistry.close({ run: false });

    return Object.freeze({ value, release });
  } catch (error) {
    setupCleanupRegistry.close({ run: true });
    release();
    throw error;
  }
};
