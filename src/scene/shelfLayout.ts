// Как товар расставлен на полке: только геометрия отрисовки, общая для ShelfGoods (все полки) и RackCloseup (клики вблизи).
// Что лежит на полке, решает не сцена: содержимое приходит из rules (shelfContents — фактические остатки).
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { RACK_BOARD, rackFrontSign, rackWidth, shelfY } from './rackGeometry';

/** Товар одного вида на полке: где стоят его штуки (в координатах стеллажа) и сколько их нарисовано. */
export type ShelfGroup = {
  productId: string;
  qty: number;       // сколько лежит по факту
  shown: number;     // сколько нарисовано (не больше shelfItems.max на всю полку)
  xs: number[];      // центры штук вдоль полки
  x0: number;        // левый и правый край группы — для рамки и зоны клика
  x1: number;
};

export type ShelfLayout = {
  y: number;         // верх доски полки — на нём стоят товары
  z: number;         // центр товара поперёк полки (у лицевого края)
  front: 1 | -1;     // лицевая сторона стеллажа (см. rackFrontSign)
  groups: ShelfGroup[];
};

/**
 * Штуки ставятся в один ряд у лицевого края, по центру полки, вплотную: сколько лежит, столько и видно
 * (решение автора 12.10), но не больше shelfItems.max на полку. Разные товары на одной полке (после ошибок) — подряд.
 */
export function shelfLayout(rack: Rack, shelf: number, contents: { productId: string; qty: number }[]): ShelfLayout {
  const { max, size } = WAREHOUSE_VIEW.shelfItems;
  const front = rackFrontSign(rack);
  const depth = WAREHOUSE_VIEW.rackDepth;

  let left = max;
  const counts = contents.map((c) => {
    const shown = Math.min(c.qty, left);
    left -= shown;
    return shown;
  });
  const total = counts.reduce((s, n) => s + n, 0);
  // при полной полке шаг чуть шире штуки, чтобы ряд занял почти всю длину стеллажа
  const step = Math.min(rackWidth(rack.cells.length) / max, size * 1.2);

  let i = 0;
  const groups: ShelfGroup[] = contents.map((c, g) => {
    const xs = Array.from({ length: counts[g] }, () => (i++ - (total - 1) / 2) * step);
    const x0 = xs.length ? xs[0] - step / 2 : 0;
    const x1 = xs.length ? xs[xs.length - 1] + step / 2 : 0;
    return { productId: c.productId, qty: c.qty, shown: counts[g], xs, x0, x1 };
  }).filter((g) => g.shown > 0);

  return {
    y: shelfY(shelf, rack.shelves) + RACK_BOARD / 2,
    z: front * (depth / 2 - size * 0.75),
    front,
    groups,
  };
}
