// «Глубина» — игра на ТСД в ситуации «товар в глубине полки» (docs/10-minigames-concept.md, раздел 11.3).
// Полка сверху — сетка; коробки съезжают в пустые клетки, как в пятнашках. Цель — вывести нужную коробку
// на клетку выхода (одна из трёх в переднем ряду) — игра заканчивается сама. Оценка — по ходам сверх лучшего возможного.
// Чистые функции: раскладка, ход, лучшее число ходов (перебор в ширину), оценка.
import type { DepthBoard } from '../../model/tsdGame';
import type { Outcome } from '../../model/task';
import { DEPTH } from '../../config/calls';
import type { Rng } from '../random';

const TARGET = 0;
const EMPTY = -1;

export const rowOf = (b: DepthBoard, cell: number) => Math.floor(cell / b.cols);
export const colOf = (b: DepthBoard, cell: number) => cell % b.cols;

/** Где нужная коробка. */
export const targetCell = (b: DepthBoard) => b.cells.indexOf(TARGET);

/** Нужная коробка на клетке выхода — игра закончена. */
export const targetAtExit = (b: DepthBoard) => targetCell(b) === b.exit;

/** Соседние клетки: сначала ближе к проходу, потом слева, справа, дальше в глубину. */
function neighbours(b: DepthBoard, cell: number): number[] {
  const r = rowOf(b, cell);
  const c = colOf(b, cell);
  const out: number[] = [];
  if (r > 0) out.push(cell - b.cols);
  if (c > 0) out.push(cell - 1);
  if (c < b.cols - 1) out.push(cell + 1);
  if (r < b.rows - 1) out.push(cell + b.cols);
  return out;
}

/** Куда можно сдвинуть коробку из клетки: соседние пустые. Пусто — коробки нет или рядом нет места. */
export function freeNeighbours(b: DepthBoard, cell: number): number[] {
  if (b.cells[cell] === undefined || b.cells[cell] === EMPTY) return [];
  return neighbours(b, cell).filter((n) => b.cells[n] === EMPTY);
}

/** Сдвинуть коробку из клетки в выбранную соседнюю пустую (решение автора 14.10: сначала коробка, потом куда).
 *  Без `to` — в первую подходящую. null — так сдвинуть нельзя. */
export function slideBox(b: DepthBoard, cell: number, to?: number): DepthBoard | null {
  const free = freeNeighbours(b, cell);
  const dest = to === undefined ? free[0] : free.includes(to) ? to : undefined;
  if (dest === undefined) return null;
  const cells = [...b.cells];
  cells[dest] = cells[cell];
  cells[cell] = EMPTY;
  return { ...b, cells };
}

/**
 * Наименьшее число ходов, чтобы нужная коробка оказалась на клетке выхода.
 * Остальные коробки для цели одинаковые, поэтому состояние — это только где нужная и где пусто:
 * на сетке 3 × 3 это пара сотен вариантов, перебор мгновенный. Infinity — нельзя.
 */
export function bestMoves(b: DepthBoard): number {
  const encode = (cells: number[]) => cells.map((x) => (x === TARGET ? 'T' : x === EMPTY ? '.' : 'b')).join('');
  const start = encode(b.cells);
  const done = (s: string) => s.indexOf('T') === b.exit;
  if (done(start)) return 0;
  const seen = new Set([start]);
  let layer = [start];
  for (let d = 1; layer.length > 0; d++) {
    const next: string[] = [];
    for (const s of layer) {
      for (let cell = 0; cell < s.length; cell++) {
        if (s[cell] === '.') continue;
        const to = neighbours(b, cell).filter((n) => s[n] === '.');
        for (const t of to) {
          const arr = s.split('');
          arr[t] = arr[cell];
          arr[cell] = '.';
          const k = arr.join('');
          if (seen.has(k)) continue;
          if (done(k)) return d;
          seen.add(k);
          next.push(k);
        }
      }
    }
    layer = next;
  }
  return Infinity;
}

/**
 * Разложить полку: нужная коробка — в заднем ряду, выход — случайная клетка переднего ряда, пустые клетки — случайно, остальное — другие товары.
 * Слишком простые раскладки (меньше DEPTH.minBest ходов) раздаются заново.
 */
export function createDepthBoard(rng: Rng, productId: string, fillers: string[], cfg = DEPTH): { board: DepthBoard; best: number } {
  const n = cfg.cols * cfg.rows;
  const pick = () => (fillers.length > 0 ? fillers[Math.floor(rng.next() * fillers.length)] : productId);
  let last: { board: DepthBoard; best: number } | null = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const backRow = Array.from({ length: cfg.cols }, (_, i) => (cfg.rows - 1) * cfg.cols + i);
    const target = backRow[Math.floor(rng.next() * backRow.length)];
    const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== target);
    // перемешать остальные клетки; первые (n - boxes) из них — пустые
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const emptyCount = n - cfg.boxes;
    const cells = Array<number>(n).fill(EMPTY);
    cells[target] = TARGET;
    others.slice(emptyCount).forEach((cell, k) => { cells[cell] = k + 1; });
    const boxes = [productId, ...Array.from({ length: cfg.boxes - 1 }, pick)];
    const exit = Math.floor(rng.next() * cfg.cols);
    const board: DepthBoard = { cols: cfg.cols, rows: cfg.rows, cells, boxes, exit };
    const best = bestMoves(board);
    last = { board, best };
    if (Number.isFinite(best) && best >= cfg.minBest) return last;
  }
  return last!;
}

/** Ходов уже больше, чем допускает «с ошибками», — дальше только провал, игра заканчивается сразу (решение автора 14.10). */
export function tooManyMoves(moves: number, best: number, cfg = DEPTH): boolean {
  return moves - best > cfg.withErrorsExtra;
}

/** Исход по ходам: сверх лучшего до perfectExtra — идеально, до withErrorsExtra — с ошибками, иначе (или не успел) — провал. */
export function scoreDepth(moves: number, best: number, timedOut: boolean, cfg = DEPTH): Outcome {
  if (timedOut) return 'failed';
  const extra = moves - best;
  if (extra <= cfg.perfectExtra) return 'perfect';
  if (extra <= cfg.withErrorsExtra) return 'withErrors';
  return 'failed';
}
