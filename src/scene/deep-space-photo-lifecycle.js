const PHOTO_REQUESTS = Object.freeze([
  Object.freeze({ key: "milkyWay", fallbackColor: 0x02040a }),
  Object.freeze({ key: "localGroup", fallbackColor: 0x02040a }),
  Object.freeze({ key: "cosmicWeb", fallbackColor: 0x080313 })
]);

const createRelease = (handles) => {
  let state = Object.freeze({ released: false });

  return () => {
    if (state.released) return;
    state = Object.freeze({ ...state, released: true });
    handles.forEach(({ release }) => release());
  };
};

export const setupDeepSpacePhotoLifecycle = async ({
  textureStore,
  routes,
  maxAnisotropy,
  setup
}) => {
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

  try {
    handles.forEach(({ texture }) => {
      texture.anisotropy = maxAnisotropy;
    });
    const textures = Object.freeze(Object.fromEntries(PHOTO_REQUESTS.map(({ key }, index) => (
      [key, handles[index].texture]
    ))));
    const value = await setup(textures);

    return Object.freeze({ value, release });
  } catch (error) {
    release();
    throw error;
  }
};
