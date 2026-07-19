export const createIntroState = ({ started, elapsed, reducedMotion }) => {
  const time = Math.max(0, Number(elapsed) || 0);
  const motionScale = reducedMotion ? 0.1 : 1;

  return Object.freeze({
    active: !started,
    scrollLocked: !started,
    earthSpin: time * 0.018 * motionScale,
    cloudSpin: time * 0.025 * motionScale,
    shipRoll: Math.sin(time * 0.42) * 2.4 * motionScale,
    shipDrift: Math.sin(time * 0.58) * 10 * motionScale
  });
};
