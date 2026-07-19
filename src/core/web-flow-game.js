// Cosmic-web "flow" puzzle (stage 6). Rotate filament pieces on a grid until a
// continuous thread connects our galaxy (source, left) to the far node (sink,
// right); when it connects, matter flows through and the level is solved. Three
// levels, graded easy → hard by grid size and number of turns.

const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // N, E, S, W (row, col deltas)
const OPP = [2, 3, 0, 1];
const BASE = Object.freeze({ straight: [1, 3], elbow: [1, 2] });

const LEVELS = Object.freeze([
  { cols: 3, rows: 3, path: [[1, 0], [1, 1], [0, 1], [0, 2]] },
  { cols: 4, rows: 3, path: [[2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 3]] },
  { cols: 4, rows: 4, path: [[3, 0], [2, 0], [2, 1], [3, 1], [3, 2], [2, 2], [1, 2], [1, 3], [0, 3]] }
]);

const rotate = (base, r) => base.map((dir) => (dir + r) % 4);
const sameSet = (a, b) => a.length === b.length && a.every((value) => b.includes(value));
const dirBetween = (r, c, tr, tc) => (tr < r ? 0 : tr > r ? 2 : tc > c ? 1 : 3);
const key = (r, c) => `${r},${c}`;

const pipeSvg = (type) => (type === "straight"
  ? '<svg viewBox="0 0 100 100" class="web-flow__svg"><path d="M2,50 H98" /></svg>'
  : '<svg viewBox="0 0 100 100" class="web-flow__svg"><path d="M98,50 H50 V98" /></svg>');

function buildLevel(def) {
  const cells = new Map();
  def.path.forEach(([r, c], index) => {
    const conns = new Set();
    if (index === 0) conns.add(3); // source from the west
    else { const [pr, pc] = def.path[index - 1]; conns.add(dirBetween(r, c, pr, pc)); }
    if (index === def.path.length - 1) conns.add(1); // sink to the east
    else { const [nr, nc] = def.path[index + 1]; conns.add(dirBetween(r, c, nr, nc)); }

    const required = [...conns];
    const type = OPP[required[0]] === required[1] ? "straight" : "elbow";
    let rotation = 0;
    for (let r2 = 0; r2 < 4; r2 += 1) {
      if (sameSet(rotate(BASE[type], r2), required)) { rotation = r2; break; }
    }
    cells.set(key(r, c), { r, c, type, rotation });
  });

  // Fill every remaining cell with a decoy piece so there are no gaps — the real
  // path is hidden among the noise. Decoys can't block the intended connection.
  for (let r = 0; r < def.rows; r += 1) {
    for (let c = 0; c < def.cols; c += 1) {
      if (cells.has(key(r, c))) continue;
      const type = Math.random() < 0.5 ? "straight" : "elbow";
      cells.set(key(r, c), { r, c, type, rotation: Math.floor(Math.random() * 4) });
    }
  }

  return {
    cols: def.cols,
    rows: def.rows,
    start: def.path[0],
    end: def.path[def.path.length - 1],
    cells
  };
}

function poweredSet(level) {
  const powered = new Set();
  const startCell = level.cells.get(key(...level.start));
  if (!rotate(BASE[startCell.type], startCell.rotation).includes(3)) return powered;

  powered.add(key(...level.start));
  const queue = [level.start];
  while (queue.length) {
    const [r, c] = queue.pop();
    const cell = level.cells.get(key(r, c));
    for (const dir of rotate(BASE[cell.type], cell.rotation)) {
      const [dr, dc] = DIRS[dir];
      const nk = key(r + dr, c + dc);
      const neighbour = level.cells.get(nk);
      if (!neighbour || powered.has(nk)) continue;
      if (rotate(BASE[neighbour.type], neighbour.rotation).includes(OPP[dir])) {
        powered.add(nk);
        queue.push([r + dr, c + dc]);
      }
    }
  }
  return powered;
}

function isSolved(level) {
  const powered = poweredSet(level);
  const endKey = key(...level.end);
  if (!powered.has(endKey)) return false;
  const endCell = level.cells.get(endKey);
  return rotate(BASE[endCell.type], endCell.rotation).includes(1);
}

function scramble(level) {
  do {
    level.cells.forEach((cell) => { cell.rotation = Math.floor(Math.random() * 4); });
  } while (isSolved(level));
}

export function createWebFlowGame({ container, onStart, onLevel, onComplete } = {}) {
  let levelIndex = 0;
  let level = buildLevel(LEVELS[0]);
  let started = false;
  let complete = false;
  let locked = false;
  let active = false;
  let completionTimer = null;
  const tiles = new Map();

  const render = () => {
    const powered = poweredSet(level);
    tiles.forEach((tile, tileKey) => {
      const cell = level.cells.get(tileKey);
      const pipe = tile.querySelector(".web-flow__pipe");
      pipe.style.transform = `rotate(${cell.rotation * 90}deg)`;
      pipe.classList.toggle("lit", powered.has(tileKey));
      tile.disabled = !active || complete || locked;
    });
  };

  const build = () => {
    container.style.setProperty("--flow-cols", String(level.cols));
    container.style.setProperty("--flow-rows", String(level.rows));
    const grid = document.createElement("div");
    grid.className = "web-flow__grid";
    tiles.clear();

    for (let r = 0; r < level.rows; r += 1) {
      for (let c = 0; c < level.cols; c += 1) {
        const cell = level.cells.get(key(r, c));
        if (!cell) {
          const empty = document.createElement("div");
          empty.className = "web-flow__tile web-flow__tile--empty";
          grid.append(empty);
          continue;
        }
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "web-flow__tile";
        if (level.start[0] === r && level.start[1] === c) tile.classList.add("source");
        if (level.end[0] === r && level.end[1] === c) tile.classList.add("sink");
        const pipe = document.createElement("span");
        pipe.className = "web-flow__pipe";
        pipe.innerHTML = pipeSvg(cell.type);
        tile.append(pipe);
        tile.addEventListener("click", (event) => {
          event.stopPropagation();
          rotateTile(key(r, c));
        });
        grid.append(tile);
        tiles.set(key(r, c), tile);
      }
    }
    container.replaceChildren(grid);
    render();
  };

  const loadLevel = (index) => {
    level = buildLevel(LEVELS[index]);
    scramble(level);
    build();
  };

  const settleSolvedLevel = () => {
    if (!active || !locked || completionTimer != null) return;
    completionTimer = window.setTimeout(() => {
      completionTimer = null;
      if (!active || !locked) return;
      container.classList.remove("solved");
      if (levelIndex < LEVELS.length - 1) {
        levelIndex += 1;
        loadLevel(levelIndex);
        locked = false;
        render();
        onLevel?.(levelIndex, LEVELS.length);
      } else {
        complete = true;
        active = false;
        render();
        onComplete?.();
      }
    }, 1000);
  };

  function rotateTile(tileKey) {
    if (!active || complete || locked) return;
    if (!started) { started = true; onStart?.(); }
    const cell = level.cells.get(tileKey);
    cell.rotation = (cell.rotation + 1) % 4;
    render();

    if (!isSolved(level)) return;

    locked = true;
    container.classList.add("solved");
    render();
    settleSolvedLevel();
  }

  loadLevel(0);

  const reset = () => {
    if (!active) return false;
    if (completionTimer != null) window.clearTimeout(completionTimer);
    completionTimer = null;
    container.classList.remove("solved");
    levelIndex = 0;
    complete = false;
    locked = false;
    started = false;
    loadLevel(0);
    return true;
  };

  const setActive = (next) => {
    const shouldActivate = next === true && !complete;
    if (shouldActivate === active) return active;
    if (!shouldActivate && completionTimer != null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }
    active = shouldActivate;
    render();
    if (active && locked) settleSolvedLevel();
    return active;
  };

  return Object.freeze({
    reset,
    setActive,
    get active() { return active; },
    get complete() { return complete; }
  });
}
