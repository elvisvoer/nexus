import "./styles.css";
import { BOARD_SIZE, NexusGame, type Ball, type Cell } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");

app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <h1>Nexus <span>2k</span></h1>
      <div class="score-wrap">
        <div class="score-item">
          <span>Best</span>
          <strong id="high-score">00000000</strong>
        </div>
        <div class="score-item">
          <span>Current</span>
          <strong id="score">00000000</strong>
        </div>
      </div>
    </header>

    <section class="game-layout">
      <div id="board" class="board" role="grid" aria-label="Nexus game board"></div>
      <aside class="controls">
        <button id="start" class="primary">Start</button>
        <div class="next-balls">
          <span class="next-balls-label">Next</span>
          <div
            id="next-balls"
            class="next-balls-preview"
            role="list"
            aria-label="Next three balls"
          ></div>
        </div>
      </aside>
    </section>
  </main>
`;

const game = new NexusGame();
const boardElement = document.querySelector<HTMLDivElement>("#board")!;
const scoreElement = document.querySelector<HTMLElement>("#score")!;
const highScoreElement = document.querySelector<HTMLElement>("#high-score")!;
const startElement = document.querySelector<HTMLButtonElement>("#start")!;
const nextBallsElement = document.querySelector<HTMLDivElement>("#next-balls")!;
const highScoreStorageKey = "nexus-2k-high-score";
let moving = false;
let turn = 0;
let selectionVisible = true;
const clearingCells = new Set<string>();

function loadHighScore(): number {
  const stored = window.localStorage.getItem(highScoreStorageKey);
  if (stored === null) return 0;

  const score = Number(stored);
  if (!Number.isSafeInteger(score) || score < 0) {
    console.error("Ignoring invalid saved high score:", stored);
    return 0;
  }
  return score;
}

let highScore = loadHighScore();

const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

const ballImages = [
  "",
  assetUrl("blue.png"),
  assetUrl("red.png"),
  assetUrl("green.png"),
  assetUrl("yellow.png"),
  assetUrl("purple.png"),
];

const ballNames: Record<Ball, string> = {
  1: "Blue",
  2: "Red",
  3: "Green",
  4: "Yellow",
  5: "Purple",
};
let upcomingBalls: Ball[] = [
  game.randomBall(),
  game.randomBall(),
  game.randomBall(),
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

function renderNextBalls(): void {
  nextBallsElement.replaceChildren(
    ...upcomingBalls.map((ball, index) => {
      const preview = document.createElement("span");
      preview.className = "next-ball";
      preview.style.backgroundImage = `url("${ballImages[ball]}")`;
      preview.setAttribute("role", "listitem");
      preview.setAttribute("aria-label", `${index + 1}: ${ballNames[ball]}`);
      return preview;
    }),
  );
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
      if (clearingCells.has(`${row}:${col}`)) {
        cell.classList.add("clearing");
      }
      cell.setAttribute(
        "aria-label",
        value
          ? `Ball, row ${row + 1}, column ${col + 1}`
          : `Empty, row ${row + 1}, column ${col + 1}`,
      );
    }
  }
  if (game.score > highScore) {
    highScore = game.score;
    window.localStorage.setItem(highScoreStorageKey, String(highScore));
  }
  scoreElement.textContent = game.score.toString().padStart(8, "0");
  highScoreElement.textContent = highScore.toString().padStart(8, "0");
}

function animatePath(path: Cell[], expectedTurn: number): Promise<boolean> {
  return new Promise((resolve) => {
    const original = path[0];
    const ball = game.board[original.row][original.col];
    if (ball === 0) {
      resolve(false);
      return;
    }

    let index = 1;
    game.board[original.row][original.col] = 0;
    render();

    const timer = window.setInterval(() => {
      if (turn !== expectedTurn) {
        window.clearInterval(timer);
        resolve(false);
        return;
      }

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
        resolve(true);
      }
    }, 45);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function clearLinesWithAnimation(
  row: number,
  col: number,
  expectedTurn: number,
): Promise<boolean> {
  const line = game.findLine(row, col);
  if (line.length === 0) return true;

  for (const cell of line) clearingCells.add(`${cell.row}:${cell.col}`);
  render();
  await delay(600);

  if (turn !== expectedTurn) return false;

  game.clearLines(row, col);
  for (const cell of line) clearingCells.delete(`${cell.row}:${cell.col}`);
  render();
  return true;
}

async function addRandomBallsWithAnimation(
  count: number,
  expectedTurn: number,
): Promise<void> {
  moving = true;
  for (let i = 0; i < count; i++) {
    if (turn !== expectedTurn) return;

    const position = game.addRandomBall(upcomingBalls[0]);
    if (!position) break;
    upcomingBalls.shift();
    upcomingBalls.push(game.randomBall());
    renderNextBalls();
    render();
    const completed = await clearLinesWithAnimation(
      position.row,
      position.col,
      expectedTurn,
    );
    if (!completed) return;
  }
  if (turn === expectedTurn) moving = false;
  render();
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
  const completed = await animatePath(path, moveTurn);
  if (!completed || turn !== moveTurn) return;
  game.board[from.row][from.col] = 0;
  game.board[cell.row][cell.col] = ball;
  const cleared = await clearLinesWithAnimation(
    cell.row,
    cell.col,
    moveTurn,
  );
  if (!cleared || turn !== moveTurn) return;
  moving = false;

  window.setTimeout(() => {
    if (!game.started || turn !== moveTurn) return;
    void addRandomBallsWithAnimation(3, moveTurn);
  }, 250);
  render();
}

startElement.addEventListener("click", () => {
  game.start();
  turn++;
  const startTurn = turn;
  upcomingBalls = [game.randomBall(), game.randomBall(), game.randomBall()];
  moving = true;
  clearingCells.clear();
  startElement.textContent = "Restart";
  renderNextBalls();
  render();
  void addRandomBallsWithAnimation(3, startTurn);
});

window.setInterval(() => {
  if (game.selected) {
    selectionVisible = !selectionVisible;
    render();
  }
}, 300);

renderNextBalls();
render();
