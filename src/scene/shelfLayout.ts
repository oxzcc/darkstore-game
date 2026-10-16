// Как товар расставлен на полке: только геометрия отрисовки, общая для ShelfGoods (все полки) и RackCloseup (клики вблизи).
// Что лежит на полке, решает не сцена: содержимое приходит из rules (shelfContents — остатки склада).
// Решение автора 16.10 (по концепт-рендеру): товар крупный — до 2 штук в ширину полки, каждая на половину глубины,
// у лицевого края. Одна крупная штука = до shelfItems.perSlot штук на складе (1–5 — одна, 6–10 — две).
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { RACK_BOARD, rackFrontSign, rackWidth, shelfY } from './rackGeometry';

/** Товар одного вида на полке: где стоят его крупные штуки (в координатах стеллажа) и сколько их нарисовано. */
export type ShelfGroup = {
  productId: string;
  qty: number;       // сколько лежит по факту
  shown: number;     // сколько крупных штук нарисовано (не больше shelfItems.slots на всю полку)
  xs: number[];      // центры штук вдоль полки
  zs: number[];      // и поперёк, по одному на каждую штуку из xs
  x0: number;        // левый и правый край группы — для рамки и зоны клика
  x1: number;
};

export type ShelfLayout = {
  y: number;         // верх доски полки — на нём стоят товары
  z: number;         // центр товара поперёк полки (у лицевого края)
  front: 1 | -1;     // лицевая сторона стеллажа (см. rackFrontSign)
  slotWidth: number; // ширина места под одну крупную штуку
  itemDepth: number; // глубина крупной штуки
  groups: ShelfGroup[];
};

export function shelfLayout(rack: Rack, shelf: number, contents: { productId: string; qty: number }[]): ShelfLayout {
  const { slots, perSlot, depthShare } = WAREHOUSE_VIEW.shelfItems;
  const front = rackFrontSign(rack);
  const depth = WAREHOUSE_VIEW.rackDepth;
  const slotWidth = (rackWidth(rack.cells.length) - 0.2) / slots; // между стойками
  const itemDepth = depth * depthShare;
  const z = front * (depth / 2 - itemDepth / 2 - 0.03);

  // сколько крупных штук у каждого товара: по одной на каждые perSlot, пока есть место
  let left = slots;
  const counts = contents.map((c) => {
    const n = Math.min(Math.ceil(c.qty / perSlot), left);
    left -= n;
    return n;
  });

  let i = 0;
  const xAt = (k: number) => (k - (slots - 1) / 2) * slotWidth; // места слева направо
  const groups: ShelfGroup[] = contents.map((c, g) => {
    const xs = Array.from({ length: counts[g] }, () => xAt(i++));
    const zs = xs.map(() => z);
    const x0 = xs.length ? Math.min(...xs) - slotWidth / 2 : 0;
    const x1 = xs.length ? Math.max(...xs) + slotWidth / 2 : 0;
    return { productId: c.productId, qty: c.qty, shown: counts[g], xs, zs, x0, x1 };
  }).filter((g) => g.shown > 0);

  return { y: shelfY(shelf, rack.shelves) + RACK_BOARD / 2, z, front, slotWidth, itemDepth, groups };
}
