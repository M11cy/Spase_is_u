// Finale coupon prize wheel. All slices are the SAME visual size, but the
// outcome is weighted, so the odds differ while the wheel looks even: 10% is
// common, 50% is rare. Muted, calm palette.
// Ten slices (5% steps) — an even count so the two-colour alternation stays
// clean all the way around, at any final rotation. Lower discounts are common,
// higher ones rare.
const SEGMENTS = Object.freeze([
  { value: 5, weight: 17 },
  { value: 10, weight: 16 },
  { value: 15, weight: 14 },
  { value: 20, weight: 12 },
  { value: 25, weight: 11 },
  { value: 30, weight: 9 },
  { value: 35, weight: 7 },
  { value: 40, weight: 6 },
  { value: 45, weight: 5 },
  { value: 50, weight: 3 }
]);

// Two calm, semi-transparent tones (light blue / blue) that alternate per slice.
const SLICE_COLORS = ["rgba(150, 210, 255, 0.34)", "rgba(60, 116, 205, 0.42)"];

export function createCouponWheel({ wheelElement, spinButton, resultElement, onResult } = {}) {
  const count = SEGMENTS.length;
  const slice = 360 / count; // equal-size slices
  const total = SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);

  wheelElement.style.background = `conic-gradient(from 0deg, ${
    SEGMENTS.map((s, i) => `${SLICE_COLORS[i % 2]} ${i * slice}deg ${(i + 1) * slice}deg`).join(", ")
  })`;

  SEGMENTS.forEach((s, i) => {
    const mid = i * slice + slice / 2;
    const label = document.createElement("span");
    label.className = "coupon__label";
    label.textContent = `${s.value}%`;
    label.style.transform = `translate(-50%, -50%) rotate(${mid}deg) translateY(-78px)`;
    wheelElement.append(label);
  });

  const pickWinner = () => {
    let roll = Math.random() * total;
    for (let i = 0; i < count; i += 1) {
      roll -= SEGMENTS[i].weight;
      if (roll < 0) return i;
    }
    return count - 1;
  };

  let spun = false;

  const spin = () => {
    if (spun) return;
    spun = true;
    wheelElement.classList.add("is-spinning");
    if (spinButton) {
      spinButton.disabled = true;
      spinButton.textContent = "Крутится…";
    }

    const winner = pickWinner();
    // Land somewhere inside the winning slice (with a margin from its edges).
    const jitter = (Math.random() - 0.5) * (slice - 26);
    const targetLocal = winner * slice + slice / 2 + jitter;
    const rotation = 360 * 6 + (((360 - targetLocal) % 360) + 360) % 360;
    wheelElement.style.transform = `rotate(${rotation}deg)`;

    window.setTimeout(() => {
      wheelElement.classList.add("done");
      if (spinButton) spinButton.textContent = "Готово!";
      if (resultElement) resultElement.textContent = `Твоя скидка: ${SEGMENTS[winner].value}% 🎉`;
      onResult?.(SEGMENTS[winner].value);
    }, 4600);
  };

  spinButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    spin();
  });
  wheelElement.addEventListener("click", (event) => {
    event.stopPropagation();
    spin();
  });

  return Object.freeze({ get spun() { return spun; } });
}
