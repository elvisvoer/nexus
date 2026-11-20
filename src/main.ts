import "./styles.css";
import { BOARD_SIZE, NexusGame, type Cell } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");

app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <h1>Nexus <span>2k</span></h1>
      <div class="score-wrap">
        <span>Score</span>
        <strong id="score">00000000</strong>
      </div>
    </header>

    <section class="game-layout">
      <div id="board" class="board" role="grid" aria-label="Nexus game board"></div>
      <aside class="controls">
        <button id="start" class="primary">Start</button>
        <div class="legend">
          <span class="legend-dot blue"></span>
          <span class="legend-dot red"></span>
          <span class="legend-dot green"></span>
          <span class="legend-dot yellow"></span>
          <span class="legend-dot purple"></span>
          <p>Align five or more balls</p>
        </div>
      </aside>
    </section>
  </main>
`;

const game = new NexusGame();
const boardElement = document.querySelector<HTMLDivElement>("#board")!;
const scoreElement = document.querySelector<HTMLElement>("#score")!;
const startElement = document.querySelector<HTMLButtonElement>("#start")!;
let moving = false;
let turn = 0;
let selectionVisible = true;

const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

const ballImages = [
  "",
  assetUrl("blue.png"),
  assetUrl("red.png"),
  assetUrl("green.png"),
  assetUrl("yellow.png"),
  assetUrl("purple.png"),
];

const cells: HTMLButtonElement[][] = [];

for (let row = 0; row < BOARD_SIZE; row++) {
  cells[row] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
    cell.addEventListener("click", () => handleCellClick({ row, col }));
    cells[row][col] = cell;
    boardElement.append(cell);
  }
}

function render(): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const value = game.board[row][col];
      const cell = cells[row][col];
      cell.className = "cell";
      const baseImage = value
        ? `url("${ballImages[value]}")`
        : `url("${assetUrl("free.png")}")`;
      cell.style.backgroundImage = baseImage;

      if (
        game.selected?.row === row &&
        game.selected.col === col
      ) {
        cell.classList.add("selected");
        cell.style.backgroundImage = selectionVisible
          ? `url("${assetUrl("selected.png")}"), ${baseImage}`
          : baseImage;
      }
      cell.setAttribute(
        "aria-label",
        value
          ? `Ball, row ${row + 1}, column ${col + 1}`
          : `Empty, row ${row + 1}, column ${col + 1}`,
      );
    }
  }
  scoreElement.textContent = game.score.toString().padStart(8, "0");
}

function animatePath(path: Cell[]): Promise<void> {
  return new Promise((resolve) => {
    const original = path[0];
    const ball = game.board[original.row][original.col];
    if (ball === 0) {
      resolve();
      return;
    }

    let index = 1;
    game.board[original.row][original.col] = 0;
    render();

    const timer = window.setInterval(() => {
      const current = path[index];
      const previous = path[index - 1];
      game.board[current.row][current.col] = ball;
      if (previous.row !== current.row || previous.col !== current.col) {
        game.board[previous.row][previous.col] = 0;
      }
      render();
      index++;

      if (index >= path.length) {
        window.clearInterval(timer);
        resolve();
      }
    }, 45);
  });
}

async function handleCellClick(cell: Cell): Promise<void> {
  if (!game.started || moving) return;
  const value = game.at(cell);

  if (value !== 0) {
    game.selected = cell;
    render();
    return;
  }

  if (!game.selected) return;
  const path = game.findPath(game.selected, cell);
  if (!path) return;

  const from = game.selected;
  const ball = game.at(from);
  game.selected = null;
  moving = true;
  const moveTurn = turn;
  await animatePath(path);
  game.board[from.row][from.col] = 0;
  game.board[cell.row][cell.col] = ball;
  game.clearLines(cell.row, cell.col);
  moving = false;

  window.setTimeout(() => {
    if (!game.started || turn !== moveTurn) return;
    game.addRandomBalls(3);
    render();
  }, 250);
  render();
}

startElement.addEventListener("click", () => {
  game.start();
  turn++;
  game.addRandomBalls(3);
  startElement.textContent = "Restart";
  render();
});

window.setInterval(() => {
  if (game.selected) {
    selectionVisible = !selectionVisible;
    render();
  }
}, 300);

render();
