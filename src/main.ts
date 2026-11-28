import "./styles.css";
import {
  BOARD_SIZE,
  NexusGame,
  type Ball,
  type Cell,
  type CellValue,
} from "./game";

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
      <div class="board-wrap">
        <div id="board" class="board" role="grid" aria-label="Nexus game board"></div>
        <div id="game-over" class="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title" hidden>
          <div class="game-over-card">
            <span class="game-over-eyebrow">No moves left</span>
            <h2 id="game-over-title">Game Over</h2>
            <p class="game-over-copy">No clear path remains. Ready for another round?</p>
            <div class="game-over-score">
              <span>Final score</span>
              <strong id="final-score">00000000</strong>
            </div>
            <button id="game-over-restart" class="primary">Play again</button>
          </div>
        </div>
      </div>
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
const gameOverElement = document.querySelector<HTMLDivElement>("#game-over")!;
const finalScoreElement = document.querySelector<HTMLElement>("#final-score")!;
const gameOverRestartElement =
  document.querySelector<HTMLButtonElement>("#game-over-restart")!;
const highScoreStorageKey = "nexus-2k-high-score";
const gameStorageKey = "nexus-2k-game";
let moving = false;
let gameOver = false;
let turn = 0;
let selectionVisible = true;
let clearingVisible = true;
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
  assetUrl("bleau.png"),
];

const ballNames: Record<Ball, string> = {
  1: "Blue",
  2: "Red",
  3: "Green",
  4: "Yellow",
  5: "Purple",
  6: "Cyan",
};
let upcomingBalls: Ball[] = [
  game.randomBall(),
  game.randomBall(),
  game.randomBall(),
];

interface SavedGame {
  version: 1;
  board: CellValue[][];
  score: number;
  started: boolean;
  selected: Cell | null;
  upcomingBalls: Ball[];
  gameOver: boolean;
}

function isCell(value: unknown): value is Cell {
  if (typeof value !== "object" || value === null) return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell.row === "number" &&
    Number.isInteger(cell.row) &&
    cell.row >= 0 &&
    cell.row < BOARD_SIZE &&
    typeof cell.col === "number" &&
    Number.isInteger(cell.col) &&
    cell.col >= 0 &&
    cell.col < BOARD_SIZE
  );
}

function isBall(value: unknown): value is Ball {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

function isBoard(value: unknown): value is CellValue[][] {
  return (
    Array.isArray(value) &&
    value.length === BOARD_SIZE &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every((cell) => cell === 0 || isBall(cell)),
    )
  );
}

function isUpcomingBalls(value: unknown): value is Ball[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(isBall)
  );
}

function loadGame(): SavedGame | null {
  try {
    const stored = window.localStorage.getItem(gameStorageKey);
    if (stored === null) return null;
    const saved: unknown = JSON.parse(stored);
    if (typeof saved !== "object" || saved === null) throw new Error("Invalid save");
    const state = saved as Record<string, unknown>;
    const board = state.board;
    const selected = state.selected;
    const score = state.score;
    if (
      state.version !== 1 ||
      !isBoard(board) ||
      typeof score !== "number" ||
      !Number.isSafeInteger(score) ||
      score < 0 ||
      typeof state.started !== "boolean" ||
      (selected !== null && !isCell(selected)) ||
      !isUpcomingBalls(state.upcomingBalls) ||
      typeof state.gameOver !== "boolean"
    ) {
      throw new Error("Invalid save");
    }

    if (selected !== null && board[selected.row][selected.col] === 0) {
      throw new Error("Invalid selection in save");
    }
    return {
      version: 1,
      board,
      score,
      started: state.started,
      selected,
      upcomingBalls: state.upcomingBalls,
      gameOver: state.gameOver,
    };
  } catch (error) {
    console.error("Unable to load saved game:", error);
    return null;
  }
}

function saveGame(): void {
  const state: SavedGame = {
    version: 1,
    board: game.board,
    score: game.score,
    started: game.started,
    selected: game.selected,
    upcomingBalls,
    gameOver,
  };
  try {
    window.localStorage.setItem(gameStorageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to save game:", error);
  }
}

const savedGame = loadGame();
if (savedGame) {
  game.board = savedGame.board;
  game.score = savedGame.score;
  game.started = savedGame.started;
  game.selected = savedGame.selected;
  upcomingBalls = savedGame.upcomingBalls;
  gameOver = savedGame.gameOver;
  startElement.textContent = game.started ? "Restart" : "Start";
  gameOverElement.hidden = !gameOver;
  if (gameOver) {
    finalScoreElement.textContent = game.score.toString().padStart(8, "0");
  }
}

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
      const isSelected =
        game.selected?.row === row && game.selected.col === col;
      const isClearing = clearingCells.has(`${row}:${col}`);

      if (isSelected) cell.classList.add("selected");
      if (
        (isSelected && selectionVisible) ||
        (isClearing && clearingVisible)
      ) {
        cell.style.backgroundImage = `url("${assetUrl("selected.png")}"), ${baseImage}`;
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

function showGameOver(): void {
  gameOver = true;
  finalScoreElement.textContent = game.score.toString().padStart(8, "0");
  gameOverElement.hidden = false;
  gameOverRestartElement.focus();
  saveGame();
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

  clearingVisible = true;
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
  if (turn === expectedTurn) {
    if (!game.hasAvailableMove()) showGameOver();
    saveGame();
  }
}

async function handleCellClick(cell: Cell): Promise<void> {
  if (!game.started || moving || gameOver) return;
  const value = game.at(cell);

  if (value !== 0) {
    game.selected = cell;
    render();
    saveGame();
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
  const lineCompleted = game.findLine(cell.row, cell.col).length > 0;
  const cleared = await clearLinesWithAnimation(
    cell.row,
    cell.col,
    moveTurn,
  );
  if (!cleared || turn !== moveTurn) return;
  moving = false;

  if (!lineCompleted) {
    window.setTimeout(() => {
      if (!game.started || turn !== moveTurn) return;
      void addRandomBallsWithAnimation(3, moveTurn);
    }, 250);
  } else if (!game.hasAvailableMove()) {
    showGameOver();
  }
  render();
  if (lineCompleted) saveGame();
}

function startGame(): void {
  game.start();
  turn++;
  const startTurn = turn;
  gameOver = false;
  gameOverElement.hidden = true;
  startElement.focus();
  upcomingBalls = [game.randomBall(), game.randomBall(), game.randomBall()];
  moving = true;
  clearingCells.clear();
  startElement.textContent = "Restart";
  renderNextBalls();
  render();
  saveGame();
  void addRandomBallsWithAnimation(3, startTurn);
}

startElement.addEventListener("click", startGame);
gameOverRestartElement.addEventListener("click", startGame);

window.setInterval(() => {
  if (game.selected) {
    selectionVisible = !selectionVisible;
    render();
  }
}, 300);

window.setInterval(() => {
  if (clearingCells.size > 0) {
    clearingVisible = !clearingVisible;
    render();
  }
}, 150);

renderNextBalls();
render();
