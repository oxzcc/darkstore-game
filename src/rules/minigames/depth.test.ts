import { describe, expect, it } from 'vitest';
import type { DepthBoard } from '../../model/tsdGame';
import { DEPTH } from '../../config/calls';
import { createRng } from '../random';
import { bestMoves, createDepthBoard, rowOf, scoreDepth, slideBox, targetAtExit, targetCell } from './depth';

// клетки по рядам: первые три — передний ряд (у прохода), последние три — у задней стенки; -1 — пусто, 0 — нужная коробка; выход — exit
const board = (cells: number[], exit = 0): DepthBoard => ({ cols: 3, rows: 3, cells, boxes: cells.filter((c) => c >= 0).map((c) => `p${c}`), exit });

describe('«Глубина»: ходы', () => {
  it('коробка съезжает в соседнюю пустую клетку; без места рядом — не двигается', () => {
    const b = board([-1, 1, 2, 0, 3, 4, 5, 6, -1]);
    const moved = slideBox(b, 3)!; // нужная — в пустую клетку перед ней
    expect(moved.cells.slice(0, 4)).toEqual([0, 1, 2, -1]);
    expect(slideBox(b, 4)).toBe(null); // вокруг нет пустых
    expect(slideBox(b, 0)).toBe(null); // пустая клетка — двигать нечего
  });

  it('лучшее число ходов: уже на выходе — 0, выход прямо перед ней — 1; выход в другом месте — дольше', () => {
    expect(bestMoves(board([0, 1, 2, -1, 3, 4, 5, 6, -1]))).toBe(0);
    expect(bestMoves(board([-1, 1, 2, 0, 3, 4, 5, 6, -1]))).toBe(1);
    expect(bestMoves(board([0, 1, 2, -1, 3, 4, 5, 6, -1], 2))).toBeGreaterThan(2); // впереди, но не на выходе
    // из заднего ряда — хотя бы 2 хода (два ряда вперёд), а на заставленной полке больше
    expect(bestMoves(board([1, 2, 3, 4, -1, 5, 6, 0, -1]))).toBeGreaterThanOrEqual(3);
  });

  it('раскладка: нужная коробка в заднем ряду, выход — одна клетка переднего ряда, коробок сколько в config, решить можно и не слишком просто', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { board: b, best } = createDepthBoard(createRng(seed), 'milk', ['a', 'b', 'c']);
      expect(rowOf(b, targetCell(b))).toBe(DEPTH.rows - 1);
      expect(b.cells.filter((c) => c >= 0)).toHaveLength(DEPTH.boxes);
      expect(b.boxes[0]).toBe('milk');
      expect(Number.isFinite(best)).toBe(true);
      expect(best).toBeGreaterThanOrEqual(DEPTH.minBest);
      expect(best).toBe(bestMoves(b));
      expect(targetAtExit(b)).toBe(false);
      expect(rowOf(b, b.exit)).toBe(0); // выход — в переднем ряду
    }
  });

  it('одно зерно — одна раскладка', () => {
    expect(createDepthBoard(createRng(7), 'milk', ['a', 'b'])).toEqual(createDepthBoard(createRng(7), 'milk', ['a', 'b']));
  });
});

describe('«Глубина»: оценка', () => {
  it('ходы сверх лучшего: до +2 — идеально, до +6 — с ошибками, больше или не успел — провал', () => {
    expect(scoreDepth(5, 5, false)).toBe('perfect');
    expect(scoreDepth(7, 5, false)).toBe('perfect');
    expect(scoreDepth(8, 5, false)).toBe('withErrors');
    expect(scoreDepth(11, 5, false)).toBe('withErrors');
    expect(scoreDepth(12, 5, false)).toBe('failed');
    expect(scoreDepth(5, 5, true)).toBe('failed');
  });
});
