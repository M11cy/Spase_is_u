const geometrySignature = (labels, viewport) => [
  viewport.width,
  viewport.height,
  ...labels.map(({ id, anchor, size }) => (
    `${id}:${anchor.x.toFixed(1)}:${anchor.y.toFixed(1)}:${size.width}:${size.height}`
  ))
].join("|");

export const applyLabelPlacements = ({ placements, records, setAccessibility }) => {
  const recordsById = Object.freeze(Object.fromEntries(records.map((record) => [record.id, record])));

  placements.forEach((placement) => {
    const { element, opacity } = recordsById[placement.id];
    const isVisible = !placement.hidden;
    element.classList.toggle("visible", isVisible);
    element.style.opacity = isVisible ? opacity : "0";
    setAccessibility(element, isVisible);

    if (!isVisible) {
      element.style.removeProperty("transform");
      element.style.removeProperty("--anchor-x");
      element.style.removeProperty("--anchor-y");
      return;
    }

    element.style.transform = `translate3d(${placement.x}px, ${placement.y}px, 0)`;
    element.style.setProperty("--anchor-x", `${placement.anchor.x}px`);
    element.style.setProperty("--anchor-y", `${placement.anchor.y}px`);
  });
};

export const createLabelLayoutCoordinator = ({
  layout,
  getViewport,
  padding = 12,
  gap = 6
}) => {
  let measuredVisibility = "";
  let measurementsInvalidated = true;
  let sizes = Object.freeze({});
  let previousGeometry = "";
  let placements = Object.freeze([]);

  const invalidateMeasurements = () => {
    measurementsInvalidated = true;
    previousGeometry = "";
  };

  const update = (records) => {
    const visibility = records.map(({ id }) => id).join("\u0000");
    if (visibility !== measuredVisibility) {
      measuredVisibility = visibility;
      measurementsInvalidated = true;
    }

    if (measurementsInvalidated) {
      sizes = Object.freeze(Object.fromEntries(records.map(({ id, element }) => {
        const bounds = element.getBoundingClientRect();
        return [id, Object.freeze({ width: bounds.width, height: bounds.height })];
      })));
      measurementsInvalidated = false;
    }

    const labels = Object.freeze(records.map(({ id, anchor, priority }) => Object.freeze({
      id,
      anchor,
      size: sizes[id],
      priority
    })));
    const viewport = Object.freeze({ ...getViewport() });
    const nextGeometry = geometrySignature(labels, viewport);
    if (nextGeometry === previousGeometry) return placements;

    previousGeometry = nextGeometry;
    placements = layout({ labels, viewport, padding, gap });
    return placements;
  };

  return Object.freeze({ update, invalidateMeasurements });
};
