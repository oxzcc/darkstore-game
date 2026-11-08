// Как товар расставлен на полке: только геометрия отрисовки, общая для ShelfGoods (все полки) и RackCloseup (клики вблизи).
// Что лежит на полке, решает не сцена: содержимое приходит из rules (shelfContents — остатки склада).
// G1a (решение автора 07.11, вариант «а»): сколько лежит — столько штук и видно (до shelfItems.max), каждая отдельно.
// Места: perRow вдоль полки × rows поперёк; сначала заполняется передний ряд слева направо, потом задний.
// Каждая штука чуть сдвинута и повёрнута (jitter) — одинаково при каждой загрузке: «случайность» от адреса и места.
import type { Address } from '../model/address';
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { RACK_BOARD, rackFrontSign, rackWidth, shelfY } from './rackGeometry';

/** Товар одного вида на полке: где стоят его штуки (в координатах стеллажа) и сколько их нарисовано. */
export type ShelfGroup = {
  productId: string;
  qty: number;       // сколько лежит по факту
  shown: number;     // сколько штук нарисовано (не больше shelfItems.max на всю полку)
  xs: number[];      // центры штук вдоль полки
  zs: number[];      // и поперёк, по одному на каждую штуку из xs
  turns: number[];   // поворот каждой штуки вокруг вертикали, рад (небрежность)
  x0: number;        // левый и правый край группы — для рамки и зоны клика
  x1: number;
};

export type ShelfLayout = {
  y: number;         // верх доски полки — на нём стоят товары
  front: 1 | -1;     // лицевая сторона стеллажа (см. rackFrontSign)
  slotWidth: number; // ширина места под одну штуку вдоль полки
  groups: ShelfGroup[];
};

/** Число от 0 до 1 по адресу и номеру места: одинаковое при каждой загрузке. */
function noise(address: Address, slot: number, salt: number): number {
  let h = (address.aisle * 73856093) ^ (address.rack * 19349663) ^ (address.shelf * 83492791) ^ ((slot + 1) * 2654435761) ^ (salt * 97);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shelfLayout(rack: Rack, address: Address, contents: { productId: string; qty: number }[]): ShelfLayout {
  const { max, rows, perRow, rowFromFront, jitter } = WAREHOUSE_VIEW.shelfItems;
  const front = rackFrontSign(rack);
  const depth = WAREHOUSE_VIEW.rackDepth;
  const slotWidth = (rackWidth(rack.cells.length) - 0.2) / perRow; // между стойками
  const places = Math.min(max, rows * perRow);
  const turn = (jitter.turnDeg * Math.PI) / 180;

  let slot = 0;
  const groups: ShelfGroup[] = contents.map((c) => {
    const n = Math.max(0, Math.min(c.qty, places - slot));
    const xs: number[] = [];
    const zs: number[] = [];
    const turns: number[] = [];
    for (let k = 0; k < n; k++, slot++) {
      const row = Math.floor(slot / perRow);
      const col = slot % perRow;
      const along = (col - (perRow - 1) / 2) * slotWidth;
      const fromFront = rowFromFront[Math.min(row, rowFromFront.length - 1)];
      xs.push(along + (noise(address, slot, 1) - 0.5) * 2 * jitter.shift);
      zs.push(front * (depth / 2 - fromFront) + (noise(address, slot, 2) - 0.5) * 2 * jitter.shift);
      turns.push((noise(address, slot, 3) - 0.5) * 2 * turn);
    }
    const x0 = xs.length ? Math.min(...xs) - slotWidth / 2 : 0;
    const x1 = xs.length ? Math.max(...xs) + slotWidth / 2 : 0;
    return { productId: c.productId, qty: c.qty, shown: n, xs, zs, turns, x0, x1 };
  }).filter((g) => g.shown > 0);

  return { y: shelfY(address.shelf, rack.shelves) + RACK_BOARD / 2, front, slotWidth, groups };
}
