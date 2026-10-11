// Размеры стеллажа для отрисовки: общие для модели стеллажа и товаров на полках.
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { cellToWorld } from '../rules/warehouse';

export const RACK_POST = 0.06;  // толщина стойки
export const RACK_BOARD = 0.05; // толщина полки

/** Высота полки над полом. Полка 1 — нижняя, остальные равномерно до верха. */
export function shelfY(shelf: number, shelves: number): number {
  const h = WAREHOUSE_VIEW.rackHeight;
  return 0.15 + ((shelf - 1) * (h - 0.25)) / (shelves - 1 || 1);
}

/** Центр основания стеллажа в координатах сцены (середина его клеток). */
export function rackCenter(r: Rack): [number, number, number] {
  const pts = r.cells.map(cellToWorld);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, 0, pts.reduce((s, p) => s + p[2], 0) / pts.length];
}

/** С какой стороны к стеллажу подходят (единичный вектор по x или z) — оттуда на него и смотрим. */
export function rackFront(r: Rack): [number, number] {
  const a = cellToWorld(r.access);
  const c = cellToWorld(r.cell);
  return r.axis === 'z' ? [Math.sign(a[0] - c[0]) || 1, 0] : [0, Math.sign(a[2] - c[2]) || 1];
}

/** Длина стеллажа с небольшим зазором между соседними. */
export function rackWidth(cells: number): number {
  return cells * WAREHOUSE_VIEW.cellSize * 0.92;
}
