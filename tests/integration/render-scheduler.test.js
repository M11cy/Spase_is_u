import { describe, expect, it, vi } from "vitest";
import { createRenderScheduler } from "../../src/core/render-scheduler.js";

const createDocumentRef = () => {
  const listeners = new Map();

  return {
    hidden: false,
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }),
    dispatchVisibilityChange() {
      listeners.get("visibilitychange")?.();
    }
  };
};

const createHarness = () => {
  const queue = [];
  const documentRef = createDocumentRef();
  const render = vi.fn();
  const cancelFrame = vi.fn();
  const scheduler = createRenderScheduler({
    render,
    requestFrame: (callback) => {
      queue.push(callback);
      return queue.length;
    },
    cancelFrame,
    documentRef
  });

  return { cancelFrame, documentRef, queue, render, scheduler };
};

describe("createRenderScheduler", () => {
  it("renders only invalidated frames", () => {
    const { queue, render, scheduler } = createHarness();

    scheduler.invalidate(2);
    queue.shift()(0);
    queue.shift()(16);

    expect(render).toHaveBeenCalledTimes(2);
    expect(queue).toHaveLength(0);
    scheduler.dispose();
  });

  it("pauses invalidated work while hidden and resumes when visible", () => {
    const { documentRef, queue, render, scheduler } = createHarness();

    documentRef.hidden = true;
    scheduler.invalidate(1);
    expect(queue).toHaveLength(0);

    documentRef.hidden = false;
    documentRef.dispatchVisibilityChange();
    queue.shift()(20);

    expect(render).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it("renders transition frames until the transition stops", () => {
    const { queue, render, scheduler } = createHarness();

    scheduler.startTransition();
    queue.shift()(0);
    queue.shift()(16);
    scheduler.stopTransition();
    queue.shift()(32);

    expect(render).toHaveBeenCalledTimes(2);
    expect(queue).toHaveLength(0);
    scheduler.dispose();
  });

  it("removes visibility handling and cancels pending work on dispose", () => {
    const { cancelFrame, documentRef, scheduler } = createHarness();

    scheduler.invalidate();
    scheduler.dispose();

    expect(documentRef.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(cancelFrame).toHaveBeenCalledWith(1);
  });

  it("does not schedule invalidations or transitions after dispose", () => {
    const { queue, scheduler } = createHarness();

    scheduler.dispose();
    scheduler.invalidate();
    scheduler.startTransition();

    expect(queue).toHaveLength(0);
  });

  it("ignores a stale queued callback after dispose", () => {
    const { queue, render, scheduler } = createHarness();

    scheduler.invalidate();
    const staleCallback = queue.shift();
    scheduler.dispose();
    staleCallback(0);

    expect(render).not.toHaveBeenCalled();
    expect(queue).toHaveLength(0);
  });

  it("does not reschedule when render disposes an active transition", () => {
    const queue = [];
    let scheduler;
    const render = vi.fn(() => scheduler.dispose());
    scheduler = createRenderScheduler({
      render,
      requestFrame: (callback) => {
        queue.push(callback);
        return queue.length;
      },
      cancelFrame: vi.fn(),
      documentRef: createDocumentRef()
    });

    scheduler.startTransition();
    queue.shift()(0);

    expect(render).toHaveBeenCalledOnce();
    expect(queue).toHaveLength(0);
  });

  it("returns an immutable scheduler interface", () => {
    const { scheduler } = createHarness();

    expect(Object.isFrozen(scheduler)).toBe(true);
    scheduler.dispose();
  });
});
