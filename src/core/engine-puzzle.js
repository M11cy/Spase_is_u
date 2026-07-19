// A hand-drawn rocket engine in the project's neon-retro style, used as the
// picture for the assembly puzzle. Distinct regions (chamber, side pipes,
// nozzle, flame, corner stars) keep every 3x3 tile recognisable.
const ENGINE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#0a1330'/><stop offset='1' stop-color='#05070f'/>
    </linearGradient>
    <linearGradient id='cham' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#dfefff'/><stop offset='1' stop-color='#8fb6e6'/>
    </linearGradient>
    <linearGradient id='noz' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#c9d9f0'/><stop offset='1' stop-color='#6f86ad'/>
    </linearGradient>
    <radialGradient id='flame' cx='0.5' cy='0.18' r='0.85'>
      <stop offset='0' stop-color='#fff3b0'/><stop offset='0.5' stop-color='#ffb14f'/>
      <stop offset='1' stop-color='#ff5a3c' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='300' height='300' fill='url(#bg)'/>
  <g fill='#bcd3ff'>
    <circle cx='34' cy='40' r='2'/><circle cx='260' cy='30' r='1.5'/>
    <circle cx='276' cy='120' r='2'/><circle cx='24' cy='150' r='1.5'/>
    <circle cx='40' cy='250' r='1.6'/><circle cx='268' cy='250' r='2'/>
    <circle cx='150' cy='18' r='1.4'/><circle cx='208' cy='70' r='1.2'/>
  </g>
  <ellipse cx='150' cy='158' rx='96' ry='120' fill='#6fc7ff' opacity='0.1'/>
  <rect x='96' y='96' width='12' height='90' rx='6' fill='#3d5a86'/>
  <rect x='192' y='96' width='12' height='90' rx='6' fill='#3d5a86'/>
  <rect x='112' y='58' width='76' height='98' rx='16' fill='url(#cham)' stroke='#6fc7ff' stroke-width='3'/>
  <rect x='124' y='70' width='52' height='10' rx='5' fill='#6fc7ff' opacity='0.6'/>
  <circle cx='150' cy='104' r='16' fill='#0a1330' stroke='#6fc7ff' stroke-width='3'/>
  <circle cx='150' cy='104' r='6' fill='#ffb14f'/>
  <g fill='#ffc46b'>
    <circle cx='120' cy='66' r='3'/><circle cx='180' cy='66' r='3'/>
    <circle cx='120' cy='148' r='3'/><circle cx='180' cy='148' r='3'/>
  </g>
  <path d='M116 156 L184 156 L212 232 L88 232 Z' fill='url(#noz)' stroke='#6fc7ff' stroke-width='3'/>
  <path d='M116 156 L184 156 L178 176 L122 176 Z' fill='#9fb6d8'/>
  <line x1='120' y1='176' x2='104' y2='232' stroke='#41608e' stroke-width='2'/>
  <line x1='150' y1='176' x2='150' y2='232' stroke='#41608e' stroke-width='2'/>
  <line x1='180' y1='176' x2='196' y2='232' stroke='#41608e' stroke-width='2'/>
  <ellipse cx='150' cy='258' rx='42' ry='36' fill='url(#flame)'/>
  <ellipse cx='150' cy='250' rx='18' ry='24' fill='#fff3b0' opacity='0.9'/>
</svg>`;

export const createEngineImageDataUri = () =>
  `data:image/svg+xml,${encodeURIComponent(ENGINE_SVG.replace(/\s+/g, " ").trim())}`;

// Tap-to-swap tile puzzle: tap one tile, then another, and they swap. Solved when
// every tile is back in its home cell. Any permutation is solvable by swaps, so no
// parity/shuffle constraints. Kept forgiving for young players on a whiteboard.
export function createEnginePuzzle({
  boardElement,
  statusElement,
  image,
  size = 3,
  onSolved
} = {}) {
  const count = size * size;
  const denom = Math.max(1, size - 1);
  const backgroundSize = `${size * 100}% ${size * 100}%`;
  let order = Array.from({ length: count }, (_, index) => index);
  let selected = -1;
  let solved = false;
  const tiles = [];

  const positionFor = (piece) => {
    const col = piece % size;
    const row = Math.floor(piece / size);
    return `${(col / denom) * 100}% ${(row / denom) * 100}%`;
  };

  const isSolved = () => order.every((piece, position) => piece === position);

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  const render = () => {
    tiles.forEach((tile, position) => {
      const piece = order[position];
      tile.style.backgroundPosition = positionFor(piece);
      tile.classList.toggle("selected", position === selected);
      tile.classList.toggle("placed", piece === position);
    });
  };

  const onTileClick = (position) => {
    if (solved) return;
    if (selected === -1) {
      selected = position;
      render();
      return;
    }
    if (selected === position) {
      selected = -1;
      render();
      return;
    }

    [order[selected], order[position]] = [order[position], order[selected]];
    selected = -1;
    render();

    if (isSolved()) {
      solved = true;
      setStatus("Двигатель собран!");
      onSolved?.();
      return;
    }
    const placed = order.reduce((sum, piece, pos) => sum + (piece === pos ? 1 : 0), 0);
    setStatus(`На месте: ${placed} из ${count}`);
  };

  const build = () => {
    boardElement.replaceChildren();
    boardElement.style.setProperty("--puzzle-size", String(size));
    tiles.length = 0;
    for (let position = 0; position < count; position += 1) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "engine-puzzle__tile";
      tile.style.backgroundImage = `url("${image}")`;
      tile.style.backgroundSize = backgroundSize;
      tile.addEventListener("click", (event) => {
        event.stopPropagation();
        onTileClick(position);
      });
      boardElement.append(tile);
      tiles.push(tile);
    }
    render();
  };

  const shuffle = () => {
    solved = false;
    selected = -1;
    do {
      for (let i = count - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } while (isSolved());
    setStatus("");
    render();
  };

  build();

  return Object.freeze({
    shuffle,
    render,
    get solved() { return solved; }
  });
}
