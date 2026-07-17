const CITY_ZOOM = 15;
const WORLD_ZOOM = 2.75;
const MAP_FADE_START = 0.62;
const MAP_FADE_END = 0.9;
const REDUCED_MOTION_STOP = 0.5;
const CLOSE_CAMERA_DISTANCE_RATIO = 1.08;

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const smootherStep = (value) => {
  const progress = clamp01(value);
  return progress ** 3 * (progress * (progress * 6 - 15) + 10);
};

const progressBetween = (value, start, end) => smootherStep((value - start) / (end - start));
const lerp = (from, to, progress) => from + (to - from) * progress;
const freezeVector = (values) => Object.freeze([...values]);

export const createEarthJourneyState = ({ exactStage, reducedMotion }) => {
  const progress = clamp01(exactStage);
  const cameraProgress = reducedMotion
    ? Number(progress >= REDUCED_MOTION_STOP)
    : smootherStep(progress);
  const mapOpacity = 1 - progressBetween(progress, MAP_FADE_START, MAP_FADE_END);
  const globePresence = mapOpacity < 1 ? 1 : 0;

  return Object.freeze({
    progress,
    cameraProgress,
    mapZoom: lerp(CITY_ZOOM, WORLD_ZOOM, cameraProgress),
    mapOpacity,
    globePresence
  });
};

export const createEarthJourneyCameraPose = ({ orbitPose, earthPosition, radius, progress }) => {
  const journeyProgress = smootherStep(progress);
  const orbitPosition = [...orbitPose.position];
  const orbitTarget = [...orbitPose.target];
  const earthCenter = [...earthPosition];

  if (journeyProgress === 1) {
    return Object.freeze({
      position: freezeVector(orbitPosition),
      target: freezeVector(orbitTarget),
      fov: orbitPose.fov
    });
  }

  const orbitOffset = orbitPosition.map((value, index) => value - earthCenter[index]);
  const orbitDistance = Math.hypot(...orbitOffset);
  const orbitDirection = orbitDistance > 0
    ? orbitOffset.map((value) => value / orbitDistance)
    : [0, 0, 1];
  const closeDistance = radius * CLOSE_CAMERA_DISTANCE_RATIO;
  const cameraDistance = lerp(closeDistance, orbitDistance, journeyProgress);
  const position = earthCenter.map((value, index) => value + orbitDirection[index] * cameraDistance);
  const target = earthCenter.map((value, index) => lerp(value, orbitTarget[index], journeyProgress));

  return Object.freeze({
    position: freezeVector(position),
    target: freezeVector(target),
    fov: orbitPose.fov
  });
};
