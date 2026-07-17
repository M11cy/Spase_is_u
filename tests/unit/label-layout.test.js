import { describe, expect, it } from "vitest";
import { layoutLabels } from "../../src/core/label-layout.js";

const intersects = (left, right, gap) => !(
  left.x + left.width + gap <= right.x
  || right.x + right.width + gap <= left.x
  || left.y + left.height + gap <= right.y
  || right.y + right.height + gap <= left.y
);

describe("label layout", () => {
  it("keeps labels inside the viewport and separates overlaps", () => {
    const labels = [
      { id: "a", anchor: { x: 98, y: 50 }, size: { width: 32, height: 20 }, priority: 2 },
      { id: "b", anchor: { x: 98, y: 50 }, size: { width: 32, height: 20 }, priority: 1 }
    ];

    const placed = layoutLabels({
      labels,
      viewport: { width: 120, height: 100 },
      padding: 8,
      gap: 6
    });

    expect(placed[0].x + placed[0].width).toBeLessThanOrEqual(112);
    expect(Math.abs(placed[0].y - placed[1].y)).toBeGreaterThanOrEqual(26);
    expect(labels[0].anchor).toEqual({ x: 98, y: 50 });
  });

  it("returns a deterministic frozen copy ordered by priority", () => {
    const labels = Object.freeze([
      Object.freeze({
        id: "low",
        anchor: Object.freeze({ x: 20, y: 30 }),
        size: Object.freeze({ width: 24, height: 16 }),
        priority: 1
      }),
      Object.freeze({
        id: "high",
        anchor: Object.freeze({ x: 70, y: 40 }),
        size: Object.freeze({ width: 30, height: 18 }),
        priority: 5
      })
    ]);

    const placed = layoutLabels({ labels, viewport: { width: 160, height: 100 } });

    expect(placed.map(({ id }) => id)).toEqual(["high", "low"]);
    expect(placed).not.toBe(labels);
    expect(Object.isFrozen(placed)).toBe(true);
    expect(placed.every(Object.isFrozen)).toBe(true);
    expect(placed.every(({ anchor }) => Object.isFrozen(anchor))).toBe(true);
    expect(placed[0].anchor).not.toBe(labels[1].anchor);
  });

  it("preserves source order for equal priorities", () => {
    const labels = [
      { id: "first", anchor: { x: 10, y: 10 }, size: { width: 8, height: 8 }, priority: 1 },
      { id: "second", anchor: { x: 40, y: 10 }, size: { width: 8, height: 8 }, priority: 1 }
    ];

    const placed = layoutLabels({ labels, viewport: { width: 80, height: 40 }, padding: 4 });

    expect(placed.map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("pins oversized labels to the viewport origin without negative coordinates", () => {
    const labels = [
      { id: "oversized", anchor: { x: 12, y: 12 }, size: { width: 40, height: 30 }, priority: 1 }
    ];

    const [placed] = layoutLabels({
      labels,
      viewport: { width: 20, height: 16 },
      padding: 12,
      gap: 6
    });

    expect(placed).toMatchObject({ x: 0, y: 0, width: 40, height: 30 });
    expect(labels[0]).toEqual({
      id: "oversized",
      anchor: { x: 12, y: 12 },
      size: { width: 40, height: 30 },
      priority: 1
    });
  });

  it("deterministically separates eight labels clustered at a viewport edge", () => {
    const labels = Array.from({ length: 8 }, (_, index) => ({
      id: `label-${index}`,
      anchor: { x: 132, y: 8 },
      size: { width: 24, height: 16 },
      priority: 8 - index
    }));
    const input = { labels, viewport: { width: 140, height: 100 }, padding: 8, gap: 6 };

    const first = layoutLabels(input);
    const second = layoutLabels(input);
    const visible = first.filter(({ hidden }) => !hidden);

    expect(first).toEqual(second);
    expect(visible).toHaveLength(8);
    visible.forEach((label, index) => {
      visible.slice(index + 1).forEach((other) => {
        expect(intersects(label, other, 6)).toBe(false);
      });
    });
  });

  it("marks lower-priority labels hidden when the viewport cannot fit them", () => {
    const labels = Array.from({ length: 4 }, (_, index) => ({
      id: `label-${index}`,
      anchor: { x: 35, y: 25 },
      size: { width: 24, height: 16 },
      priority: 4 - index
    }));

    const placed = layoutLabels({
      labels,
      viewport: { width: 70, height: 50 },
      padding: 8,
      gap: 6
    });
    const visible = placed.filter(({ hidden }) => !hidden);

    expect(placed.some(({ hidden }) => hidden)).toBe(true);
    visible.forEach((label, index) => {
      visible.slice(index + 1).forEach((other) => {
        expect(intersects(label, other, 6)).toBe(false);
      });
    });
    expect(placed.every(Object.isFrozen)).toBe(true);
  });
});
