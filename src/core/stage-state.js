export const clamp01 = (value) => Math.min(1, Math.max(0, value));

const smootherStep = (value) => {
  const x = clamp01(value);
  return x ** 3 * (x * (x * 6 - 15) + 10);
};

const presenceFor = (index, exactStage) => {
  const distance = Math.abs(index - exactStage);
  if (distance <= 0.2) return 1;
  if (distance >= 0.34) return 0;
  return 1 - smootherStep((distance - 0.2) / 0.14);
};

export const computeStageState = ({ scrollY, scrollHeight, viewportHeight, stageCount, reducedMotion }) => {
  const maxScroll = Math.max(1, scrollHeight - viewportHeight);
  const exactStage = clamp01(scrollY / maxScroll) * (stageCount - 1);
  const activeStage = Math.round(exactStage);
  const distanceFromLayer = Math.abs(exactStage - activeStage);
  return Object.freeze({
    exactStage,
    activeStage,
    layerPresence: Object.freeze(Array.from({ length: stageCount }, (_, index) => presenceFor(index, exactStage))),
    transitionAmount: reducedMotion || distanceFromLayer <= 0.26 ? 0 : smootherStep((distanceFromLayer - 0.26) / 0.24)
  });
};

const lerp = (a, b, mix) => a + (b - a) * mix;

export const interpolateCamera = (from, to, mix) => Object.freeze({
  position: Object.freeze(from.position.map((value, index) => lerp(value, to.position[index], mix))),
  target: Object.freeze(from.target.map((value, index) => lerp(value, to.target[index], mix))),
  fov: lerp(from.fov, to.fov, mix)
});
