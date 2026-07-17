const setText = (element, value) => {
  element.textContent = value ?? "";
};

export function createAnnotationPanel({ panel, closeButton, fields }) {
  const documentRef = panel.ownerDocument;
  let trigger = null;
  let disposed = false;

  const close = () => {
    if (panel.hidden) return;

    panel.hidden = true;
    panel.classList.remove("open");
    const returnTarget = trigger;
    trigger = null;
    if (returnTarget?.isConnected) returnTarget.focus();
  };

  const onCloseClick = (event) => {
    event.stopPropagation();
    close();
  };

  const onKeyDown = (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  closeButton.addEventListener("click", onCloseClick);
  documentRef.addEventListener("keydown", onKeyDown);

  const open = (data, source = documentRef.activeElement) => {
    if (disposed) return;

    trigger = source;
    panel.hidden = false;
    panel.classList.add("open");
    panel.classList.toggle("no-image", !data.image);

    fields.image.hidden = !data.image;
    if (data.image) {
      fields.image.src = data.image;
      fields.image.alt = data.title ?? "";
    } else {
      fields.image.removeAttribute("src");
      fields.image.alt = "";
    }

    setText(fields.scale, data.scale);
    setText(fields.title, data.title);
    setText(fields.text, data.text);
    setText(fields.discovery, data.discovery);
    setText(fields.distance, data.distance);
    closeButton.focus();
  };

  const dispose = () => {
    if (disposed) return;
    close();
    closeButton.removeEventListener("click", onCloseClick);
    documentRef.removeEventListener("keydown", onKeyDown);
    disposed = true;
  };

  return Object.freeze({ open, close, dispose });
}
