// Размеры стеллажа для отрисовки: общие для модели стеллажа и товаров на полках.
import { WAREHOUSE_VIEW } from '../config/warehouse';

export const RACK_POST = 0.06;  // толщина стойки
export const RACK_BOARD = 0.05; // толщина полки

/** Высота полки над полом. Полка 1 — нижняя, остальные равномерно до верха. */
export function shelfY(shelf: number, shelves: number): number {
  const h = WAREHOUSE_VIEW.rackHeight;
  return 0.15 + ((shelf - 1) * (h - 0.25)) / (shelves - 1 || 1);
}

/** Длина стеллажа с небольшим зазором между соседними. */
export function rackWidth(cells: number): number {
  return cells * WAREHOUSE_VIEW.cellSize * 0.92;
}
