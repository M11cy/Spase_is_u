export function createIntroController({ root, startButton, onStart, reducedMotion = false }) {
  let started = false;
  let disposed = false;
  let hideTimer;
  const lockedSiblings = [...(root.parentElement?.children ?? [])]
    .filter((element) => element !== root)
    .map((element) => Object.freeze({
      element,
      hadInertAttribute: element.hasAttribute("inert"),
      inert: Boolean(element.inert),
      ariaHidden: element.getAttribute("aria-hidden")
    }));

  const restoreLockedSiblings = () => {
    lockedSiblings.forEach(({ element, hadInertAttribute, inert, ariaHidden }) => {
      element.inert = inert;
      element.toggleAttribute("inert", hadInertAttribute);
      if (ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", ariaHidden);
      }
    });
  };

  const lockSiblings = () => {
    lockedSiblings.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
  };

  const start = () => {
    if (started || disposed) return false;

    started = true;
    root.dataset.state = "leaving";
    document.body.classList.remove("intro-pending");
    restoreLockedSiblings();
    onStart();

    const delay = reducedMotion ? 0 : 900;
    hideTimer = window.setTimeout(() => {
      root.hidden = true;
    }, delay);
    return true;
  };

  const dispose = () => {
    if (disposed) return;

    disposed = true;
    startButton.removeEventListener("click", start);
    if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    document.body.classList.remove("intro-pending");
    restoreLockedSiblings();
    root.hidden = true;
  };

  startButton.addEventListener("click", start);
  document.body.classList.add("intro-pending");
  lockSiblings();
  startButton.focus();

  return Object.freeze({ start, dispose });
}
