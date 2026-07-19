const TAU = Math.PI * 2;

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const defaultViewport = () => ({ width: window.innerWidth, height: window.innerHeight });

// Figure-eight amplitudes and catch radius, scaled to the viewport so the path
// fills large interactive-board screens as well as laptops.
const layoutFor = ({ width, height }) => ({
  ampX: clamp(width * 0.24, 130, 320),
  ampY: clamp(height * 0.24, 120, 230),
  zoneRadius: clamp(Math.min(width, height) * 0.11, 70, 120)
});

// Stage-1 timing minigame, tuned for interactive whiteboards. The rocket flies a
// figure-eight (Gerono lemniscate) that crosses a fixed catch zone over Earth;
// the player taps the zone — a big, stationary target — while the rocket is
// inside it. Every miss widens the zone and slows the rocket so it never becomes
// impossible. Motion is driven here in JS so a tap can be judged against the zone.
export function createRocketCatchGame({
  shipElement,
  zoneElement,
  reducedMotion = false,
  getViewport = defaultViewport,
  period = 2.4, // seconds per full figure-eight loop (lower = faster)
  initialT = 0
} = {}) {
  const baseSpeed = TAU / period; // rad/s
  let t = initialT;
  let active = false;
  let caught = false;
  let misses = 0;
  let inZone = false;
  zoneElement.disabled = true;

  const speed = () => baseSpeed * Math.max(1 - misses * 0.07, 0.6);
  const zoneScale = () => 1 + Math.min(misses * 0.14, 0.7);

  const render = () => {
    const { ampX, ampY, zoneRadius } = layoutFor(getViewport());
    const px = reducedMotion ? 0 : ampX * Math.sin(t);
    const py = reducedMotion ? 0 : ampY * Math.sin(t) * Math.cos(t);
    const facing = reducedMotion ? 0 : Math.atan2(ampY * Math.cos(2 * t), ampX * Math.cos(t));
    shipElement.style.transform =
      `translate(-50%, -50%) translate(${px.toFixed(2)}px, ${py.toFixed(2)}px) rotate(${facing.toFixed(4)}rad)`;

    const catchRadius = zoneRadius * zoneScale();
    zoneElement.style.setProperty("--zone-size", `${Math.round(catchRadius * 2)}px`);
    inZone = Math.hypot(px, py) <= catchRadius;
    zoneElement.classList.toggle("armed", active && inZone && !caught);
  };

  const setActive = (next) => {
    const value = Boolean(next) && !caught;
    if (value === active) return;
    active = value;
    zoneElement.disabled = !active;
    if (active) render();
    else zoneElement.classList.remove("armed");
  };

  const update = ({ delta = 0, active: shouldBeActive } = {}) => {
    if (shouldBeActive !== undefined) setActive(shouldBeActive);
    if (!active || caught) return;
    if (!reducedMotion) t = (t + speed() * delta) % TAU;
    render();
  };

  const attemptCatch = () => {
    if (caught) return "caught";
    if (!active) return "inactive";
    if (reducedMotion || inZone) return "caught";
    misses += 1;
    return "miss";
  };

  const flashMiss = () => {
    zoneElement.classList.remove("miss");
    void zoneElement.offsetWidth; // restart the flash animation
    zoneElement.classList.add("miss");
  };

  const setCaught = () => {
    caught = true;
    active = false;
    zoneElement.disabled = true;
    zoneElement.classList.remove("armed", "miss");
  };

  const reset = () => {
    caught = false;
    misses = 0;
    inZone = false;
    t = initialT;
    active = false;
    zoneElement.disabled = true;
  };

  return Object.freeze({
    update,
    attemptCatch,
    flashMiss,
    setCaught,
    setActive,
    reset,
    get inZone() { return inZone; },
    get caught() { return caught; },
    get misses() { return misses; }
  });
}
