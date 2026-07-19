const VERTICAL_STEPS = Object.freeze([0, -1, 1, -2, 2]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const intersects = (candidate, placed, gap) => !(
  candidate.x + candidate.width + gap <= placed.x
  || placed.x + placed.width + gap <= candidate.x
  || candidate.y + candidate.height + gap <= placed.y
  || placed.y + placed.height + gap <= candidate.y
);

const axisGrid = (min, max, unit, origin) => {
  const values = [];
  for (let value = min; value <= max; value += unit) values.push(value);
  if (values.at(-1) !== max) values.push(max);
  return Object.freeze([...new Set(values)].sort((left, right) => (
    Math.abs(left - origin) - Math.abs(right - origin) || left - right
  )));
};

const createCandidates = ({ baseX, baseY, bounds, size, gap }) => {
  const positions = [];
  const keys = new Set();
  const add = (x, y) => {
    const key = `${x}:${y}`;
    if (keys.has(key)) return;
    keys.add(key);
    positions.push(Object.freeze({ x, y }));
  };

  VERTICAL_STEPS.forEach((step) => {
    add(baseX, clamp(baseY + step * (size.height + gap), bounds.minY, bounds.maxY));
  });

  const xPositions = axisGrid(bounds.minX, bounds.maxX, size.width + gap, baseX);
  const yPositions = axisGrid(bounds.minY, bounds.maxY, size.height + gap, baseY);
  xPositions.forEach((x) => yPositions.forEach((y) => add(x, y)));
  return Object.freeze(positions);
};

const createPlacedLabel = (label, position, hidden) => Object.freeze({
  id: label.id,
  x: position.x,
  y: position.y,
  width: label.size.width,
  height: label.size.height,
  hidden,
  anchor: Object.freeze({ ...label.anchor })
});

export const layoutLabels = ({ labels, viewport, padding = 12, gap = 6 }) => {
  const occupied = [];
  const results = [];
  const ordered = labels
    .map((label, index) => Object.freeze({ label, index }))
    .sort((left, right) => right.label.priority - left.label.priority || left.index - right.index)
    .map(({ label }) => label);

  for (const label of ordered) {
    const outerMaxX = Math.max(0, viewport.width - label.size.width);
    const outerMaxY = Math.max(0, viewport.height - label.size.height);
    const minX = Math.min(padding, outerMaxX);
    const minY = Math.min(padding, outerMaxY);
    const bounds = Object.freeze({
      minX,
      minY,
      maxX: Math.max(minX, outerMaxX - padding),
      maxY: Math.max(minY, outerMaxY - padding)
    });
    const baseX = clamp(label.anchor.x, bounds.minX, bounds.maxX);
    const baseY = clamp(label.anchor.y, bounds.minY, bounds.maxY);
    const candidates = createCandidates({ baseX, baseY, bounds, size: label.size, gap });
    const available = candidates.find((candidate) => (
      occupied.every((other) => !intersects(
        { ...candidate, width: label.size.width, height: label.size.height },
        other,
        gap
      ))
    ));
    const placed = createPlacedLabel(label, available ?? candidates[0], !available);

    results.push(placed);
    if (!placed.hidden) occupied.push(placed);
  }

  return Object.freeze([...results]);
};
