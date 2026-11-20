export const BOARD_SIZE = 9;
export type Ball = 1 | 2 | 3 | 4 | 5;
export type CellValue = 0 | Ball;

export interface Cell {
  row: number;
  col: number;
}

export class NexusGame {
  board: CellValue[][] = [];
  score = 0;
  started = false;
  selected: Cell | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array<CellValue>(BOARD_SIZE).fill(0),
    );
    this.score = 0;
    this.started = false;
    this.selected = null;
  }

  start(): void {
    this.reset();
    this.started = true;
  }

  at(cell: Cell): CellValue {
    return this.board[cell.row]?.[cell.col] ?? 0;
  }

  freeCells(): Cell[] {
    const cells: Cell[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (this.board[row][col] === 0) cells.push({ row, col });
      }
    }
    return cells;
  }

  addBall(row: number, col: number, ball: Ball): void {
    this.board[row][col] = ball;
  }

  findPath(from: Cell, to: Cell): Cell[] | null {
    if (this.at(to) !== 0) return null;

    const key = (cell: Cell) => `${cell.row}:${cell.col}`;
    const queue: Cell[] = [from];
    const visited = new Set([key(from)]);
    const previous = new Map<string, Cell | null>([[key(from), null]]);
    const directions = [
      { row: -1, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
    ];

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (current.row === to.row && current.col === to.col) break;

      for (const direction of directions) {
        const next = {
          row: current.row + direction.row,
          col: current.col + direction.col,
        };
        const nextKey = key(next);
        if (
          next.row >= 0 &&
          next.row < BOARD_SIZE &&
          next.col >= 0 &&
          next.col < BOARD_SIZE &&
          this.board[next.row][next.col] === 0 &&
          !visited.has(nextKey)
        ) {
          visited.add(nextKey);
          previous.set(nextKey, current);
          queue.push(next);
        }
      }
    }

    if (!visited.has(key(to))) return null;

    const path: Cell[] = [];
    let current: Cell | null = to;
    while (current) {
      path.push(current);
      current = previous.get(key(current)) ?? null;
    }
    return path.reverse();
  }

  move(from: Cell, to: Cell): boolean {
    const path = this.findPath(from, to);
    if (!path) return false;
    const ball = this.board[from.row][from.col];
    if (ball === 0) return false;
    this.board[from.row][from.col] = 0;
    this.board[to.row][to.col] = ball;
    this.selected = null;
    this.clearLines(to.row, to.col);
    return true;
  }

  clearLines(row: number, col: number): number {
    const ball = this.board[row][col];
    if (ball === 0) return 0;

    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ] as const;
    const toClear = new Set<string>();

    for (const [rowStep, colStep] of directions) {
      const line: Cell[] = [{ row, col }];

      for (const sign of [-1, 1] as const) {
        let nextRow = row + rowStep * sign;
        let nextCol = col + colStep * sign;
        while (
          nextRow >= 0 &&
          nextRow < BOARD_SIZE &&
          nextCol >= 0 &&
          nextCol < BOARD_SIZE &&
          this.board[nextRow][nextCol] === ball
        ) {
          line.push({ row: nextRow, col: nextCol });
          nextRow += rowStep * sign;
          nextCol += colStep * sign;
        }
      }

      if (line.length >= 5) {
        for (const cell of line) toClear.add(`${cell.row}:${cell.col}`);
      }
    }

    for (const key of toClear) {
      const [clearedRow, clearedCol] = key.split(":").map(Number);
      this.board[clearedRow][clearedCol] = 0;
    }
    this.score += toClear.size * 5;
    return toClear.size;
  }

  addRandomBalls(count: number): number {
    let added = 0;
    for (let i = 0; i < count; i++) {
      const free = this.freeCells();
      if (free.length === 0) break;
      const position = free[Math.floor(Math.random() * free.length)];
      const ball = (Math.floor(Math.random() * 5) + 1) as Ball;
      this.addBall(position.row, position.col, ball);
      added++;
      this.clearLines(position.row, position.col);
    }
    return added;
  }
}
