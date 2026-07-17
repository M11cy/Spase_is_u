export const createRenderScheduler = ({ render, requestFrame, cancelFrame, documentRef }) => {
  let remainingFrames = 0;
  let transition = false;
  let frameId = null;
  let disposed = false;

  const tick = (time) => {
    if (disposed) return;
    frameId = null;
    if (documentRef.hidden) return;

    if (remainingFrames > 0 || transition) render(time);
    if (disposed) return;
    remainingFrames = Math.max(0, remainingFrames - 1);
    if (remainingFrames > 0 || transition) schedule();
  };

  const schedule = () => {
    if (!disposed && frameId == null && !documentRef.hidden) frameId = requestFrame(tick);
  };

  const onVisibility = () => {
    if (!disposed && !documentRef.hidden) schedule();
  };

  documentRef.addEventListener("visibilitychange", onVisibility);

  return Object.freeze({
    invalidate: (frames = 1) => {
      if (disposed) return;
      remainingFrames = Math.max(remainingFrames, frames);
      schedule();
    },
    startTransition: () => {
      if (disposed) return;
      transition = true;
      schedule();
    },
    stopTransition: () => {
      if (disposed) return;
      transition = false;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      remainingFrames = 0;
      transition = false;
      documentRef.removeEventListener("visibilitychange", onVisibility);
      if (frameId != null) {
        cancelFrame(frameId);
        frameId = null;
      }
    }
  });
};
