export const DEFAULT_LOCATION = Object.freeze({ lat: 55.7558, lon: 37.6173 });

const copyLocation = (location) => {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new TypeError("Location must contain valid latitude and longitude");
  }
  return Object.freeze({ lat, lon });
};

export const createLocationController = ({
  geolocation,
  setLocation,
  setMap,
  fallback = DEFAULT_LOCATION
}) => {
  const applyLocation = setLocation ?? setMap;
  const fallbackLocation = copyLocation(fallback);

  if (typeof applyLocation !== "function") {
    throw new TypeError("A location update function is required");
  }

  return Object.freeze({
    locate: () => new Promise((resolve) => {
      if (!geolocation) {
        resolve(applyLocation(fallbackLocation));
        return;
      }

      geolocation.getCurrentPosition(
        ({ coords }) => {
          let nextLocation = fallbackLocation;
          try {
            nextLocation = copyLocation({ lat: coords.latitude, lon: coords.longitude });
          } catch {
            // Invalid device coordinates are equivalent to an unavailable location.
          }
          resolve(applyLocation(nextLocation));
        },
        () => resolve(applyLocation(fallbackLocation)),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
      );
    })
  });
};
