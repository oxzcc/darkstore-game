// Как товар расставлен на полке: только геометрия отрисовки, общая для ShelfGoods (все полки) и RackCloseup (клики вблизи).
// Что лежит на полке, решает не сцена: содержимое приходит из rules (shelfContents — остатки склада).
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { RACK_BOARD, rackFrontSign, rackWidth, shelfY } from './rackGeometry';

/** Товар одного вида на полке: где стоят его штуки (в координатах стеллажа) и сколько их нарисовано. */
export type ShelfGroup = {
  productId: string;
  qty: number;       // сколько лежит по факту
  shown: number;     // сколько нарисовано (не больше shelfItems.max на всю полку)
  xs: number[];      // центры штук вдоль полки
  zs: number[];      // и поперёк (передний или задний ряд), по одному на каждую штуку из xs
  x0: number;        // левый и правый край группы — для рамки и зоны клика
  x1: number;
};

export type ShelfLayout = {
  y: number;         // верх доски полки — на нём стоят товары
  z: number;         // центр переднего ряда поперёк полки (у лицевого края)
  front: 1 | -1;     // лицевая сторона стеллажа (см. rackFrontSign)
  groups: ShelfGroup[];
};

/**
 * Штуки ставятся рядами (shelfItems.rows) по центру полки, вплотную: сначала передний ряд у лицевого края, потом задний.
 * Сколько лежит, столько и видно (решение автора 12.10), но не больше shelfItems.max на полку.
 * Разные товары на одной полке (после ошибок) — подряд.
 */
export function shelfLayout(rack: Rack, shelf: number, contents: { productId: string; qty: number }[]): ShelfLayout {
  const { max, size, rows } = WAREHOUSE_VIEW.shelfItems;
  const perRow = Math.ceil(max / rows);
  const front = rackFrontSign(rack);
  const depth = WAREHOUSE_VIEW.rackDepth;

  let left = max;
  const counts = contents.map((c) => {
    const shown = Math.min(c.qty, left);
    left -= shown;
    return shown;
  });
  const total = counts.reduce((s, n) => s + n, 0);
  // при полном ряде шаг чуть шире штуки, чтобы ряд занял почти всю длину стеллажа
  const step = Math.min(rackWidth(rack.cells.length) / perRow, size * 1.2);
  const frontZ = front * (depth / 2 - size * 0.6);
  const rowZ = (row: number) => frontZ - front * row * size * 1.15;

  // i-я штука на полке: ряд и место в ряду (каждый ряд — по центру)
  const place = (i: number): [number, number] => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, total - row * perRow);
    return [(i - row * perRow - (inRow - 1) / 2) * step, rowZ(row)];
  };

  let i = 0;
  const groups: ShelfGroup[] = contents.map((c, g) => {
    const spots = Array.from({ length: counts[g] }, () => place(i++));
    const xs = spots.map((s) => s[0]);
    const zs = spots.map((s) => s[1]);
    const x0 = xs.length ? Math.min(...xs) - step / 2 : 0;
    const x1 = xs.length ? Math.max(...xs) + step / 2 : 0;
    return { productId: c.productId, qty: c.qty, shown: counts[g], xs, zs, x0, x1 };
  }).filter((g) => g.shown > 0);

  return {
    y: shelfY(shelf, rack.shelves) + RACK_BOARD / 2,
    z: frontZ,
    front,
    groups,
  };
}
