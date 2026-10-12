// Остатки: учётные и фактические количества по адресам (docs/03-warehouse-flow.md, раздел 10).
// Все функции чистые: получают остатки и возвращают новые, старые не меняют.
import type { Address } from '../model/address';
import type { Product } from '../model/product';
import type { Stock, StockRecord } from '../model/stock';
import type { WarehouseMap } from '../model/warehouse';
import { addressKey, isValidAddress, parseAddress, sameAddress } from './address';

/** Партия: какой товар, на какой полке и с каким сроком. Одна партия — одна запись. */
export type Batch = { productId: string; address: Address; expiresAtShift: number };

/** Сколько изменить: в учёте и по факту отдельно. Именно так ошибки создают расхождения. */
export type QtyChange = { book: number; actual: number };

/** id записи вычисляется из партии, поэтому одна и та же партия всегда попадает в одну запись. */
export function batchId(b: Batch): string {
  return `${b.productId}@${addressKey(b.address)}@${b.expiresAtShift}`;
}

export function recordsAt(stock: Stock, address: Address): StockRecord[] {
  return Object.values(stock).filter((r) => sameAddress(r.address, address));
}

/** Сколько товара по адресу по учёту (что покажет ТСД). */
export function bookQtyAt(stock: Stock, address: Address, productId?: string): number {
  return recordsAt(stock, address)
    .filter((r) => !productId || r.productId === productId)
    .reduce((sum, r) => sum + r.bookQty, 0);
}

/** Сколько товара по адресу на самом деле (что увидит сборщик). */
export function actualQtyAt(stock: Stock, address: Address, productId?: string): number {
  return recordsAt(stock, address)
    .filter((r) => !productId || r.productId === productId)
    .reduce((sum, r) => sum + r.actualQty, 0);
}

/** Что реально видно на полке: товары и их фактическое количество (партии одного товара складываются).
 *  Это показывает сцена и вид стеллажа в мини-игре — реальность, а не учёт (06, раздел 15). */
export function shelfContents(stock: Stock, address: Address): { productId: string; qty: number }[] {
  const out: { productId: string; qty: number }[] = [];
  for (const r of recordsAt(stock, address)) {
    if (r.actualQty <= 0) continue;
    const same = out.find((o) => o.productId === r.productId);
    if (same) same.qty += r.actualQty;
    else out.push({ productId: r.productId, qty: r.actualQty });
  }
  return out;
}

/** Какой товар лежит на полке (по учёту или по факту). На одной полке — один вид товара (07, раздел 5.3). */
export function productOnShelf(stock: Stock, address: Address): string | null {
  const rec = recordsAt(stock, address).find((r) => r.bookQty > 0 || r.actualQty > 0);
  return rec ? rec.productId : null;
}

/** Можно ли положить товар на полку: она пуста или там уже этот товар. */
export function canPlace(stock: Stock, productId: string, address: Address): boolean {
  const current = productOnShelf(stock, address);
  return current === null || current === productId;
}

/** Положить партию: учёт и факт увеличиваются отдельно. */
export function addStock(stock: Stock, batch: Batch, change: QtyChange): Stock {
  if (change.book < 0 || change.actual < 0) throw new Error('addStock: количество не может быть отрицательным');
  const id = batchId(batch);
  const prev = stock[id];
  const record: StockRecord = prev
    ? { ...prev, bookQty: prev.bookQty + change.book, actualQty: prev.actualQty + change.actual }
    : { id, ...batch, bookQty: change.book, actualQty: change.actual };
  return { ...stock, [id]: record };
}

/** Взять из записи: учёт и факт уменьшаются отдельно, но не ниже нуля. Пустая запись удаляется. */
export function removeStock(stock: Stock, recordId: string, change: QtyChange): Stock {
  const prev = stock[recordId];
  if (!prev) throw new Error(`removeStock: нет записи ${recordId}`);
  const record = {
    ...prev,
    bookQty: Math.max(0, prev.bookQty - change.book),
    actualQty: Math.max(0, prev.actualQty - change.actual),
  };
  const next = { ...stock };
  if (record.bookQty === 0 && record.actualQty === 0) delete next[recordId];
  else next[recordId] = record;
  return next;
}

/** Учёт и факт по записи расходятся. */
export function hasDiscrepancy(r: StockRecord): boolean {
  return r.bookQty !== r.actualQty;
}

/** Начальный запас из списка в config. Неверный адрес или два товара на одной полке — ошибка. */
export function buildInitialStock(
  entries: { productId: string; address: string; qty: number }[],
  products: Record<string, Product>,
  map: WarehouseMap,
  startShift: number,
): Stock {
  let stock: Stock = {};
  for (const e of entries) {
    const product = products[e.productId];
    if (!product) throw new Error(`Начальный запас: нет товара «${e.productId}»`);
    const address = parseAddress(e.address);
    if (!isValidAddress(map, address)) throw new Error(`Начальный запас: нет полки ${e.address}`);
    if (!canPlace(stock, e.productId, address)) throw new Error(`Начальный запас: полка ${e.address} уже занята`);
    const batch = { productId: e.productId, address, expiresAtShift: startShift + product.shelfLifeShifts };
    stock = addStock(stock, batch, { book: e.qty, actual: e.qty });
  }
  return stock;
}
