// Остатки по адресам (docs/03-warehouse-flow.md, раздел 10). Одно количество на запись:
// учёт и факт не расходятся (решение автора 14.10, docs/10, раздел 11).
// Все функции чистые: получают остатки и возвращают новые, старые не меняют.
import type { Address } from '../model/address';
import type { Product } from '../model/product';
import type { Stock, StockRecord } from '../model/stock';
import type { WarehouseMap } from '../model/warehouse';
import { addressKey, isValidAddress, parseAddress, sameAddress } from './address';
import { CAMPAIGN_START_SHIFT } from '../config/initialStock';

/** Партия: какой товар, на какой полке и с каким сроком. Одна партия — одна запись. */
export type Batch = { productId: string; address: Address; expiresAtShift: number };

/** id записи вычисляется из партии, поэтому одна и та же партия всегда попадает в одну запись. */
export function batchId(b: Batch): string {
  return `${b.productId}@${addressKey(b.address)}@${b.expiresAtShift}`;
}

export function recordsAt(stock: Stock, address: Address): StockRecord[] {
  return Object.values(stock).filter((r) => sameAddress(r.address, address));
}

/** Сколько товара по адресу (всего или одного товара). */
export function qtyAt(stock: Stock, address: Address, productId?: string): number {
  return recordsAt(stock, address)
    .filter((r) => !productId || r.productId === productId)
    .reduce((sum, r) => sum + r.qty, 0);
}

/**
 * Партия с expiresAtShift не позже текущей смены истекает сегодня (или уже просрочена) и не продаётся (M7e1).
 * Текущая смена — `state.campaign.shift` (M8a: календарь — номер смены); по умолчанию первая — для тестов.
 */
export function isExpiring(r: StockRecord, shift = CAMPAIGN_START_SHIFT): boolean {
  return r.expiresAtShift <= shift;
}

/** Сколько товара по адресу можно продать: без партий, которые истекают (их ждёт списание). */
export function sellableQtyAt(stock: Stock, address: Address, productId?: string, shift = CAMPAIGN_START_SHIFT): number {
  return recordsAt(stock, address)
    .filter((r) => (!productId || r.productId === productId) && !isExpiring(r, shift))
    .reduce((sum, r) => sum + r.qty, 0);
}

/** Что лежит на полке: товары и количество (партии одного товара складываются). Это рисует сцена. */
export function shelfContents(stock: Stock, address: Address): { productId: string; qty: number }[] {
  const out: { productId: string; qty: number }[] = [];
  for (const r of recordsAt(stock, address)) {
    if (r.qty <= 0) continue;
    const same = out.find((o) => o.productId === r.productId);
    if (same) same.qty += r.qty;
    else out.push({ productId: r.productId, qty: r.qty });
  }
  return out;
}

/** Какой товар лежит на полке. На одной полке — один вид товара (07, раздел 5.3). */
export function productOnShelf(stock: Stock, address: Address): string | null {
  const rec = recordsAt(stock, address).find((r) => r.qty > 0);
  return rec ? rec.productId : null;
}

/** Можно ли положить товар на полку: она пуста или там уже этот товар. */
export function canPlace(stock: Stock, productId: string, address: Address): boolean {
  const current = productOnShelf(stock, address);
  return current === null || current === productId;
}

/** Положить партию: количество прибавляется к записи этой партии. */
export function addStock(stock: Stock, batch: Batch, qty: number): Stock {
  if (qty < 0) throw new Error('addStock: количество не может быть отрицательным');
  const id = batchId(batch);
  const prev = stock[id];
  const record: StockRecord = prev ? { ...prev, qty: prev.qty + qty } : { id, ...batch, qty };
  return { ...stock, [id]: record };
}

/** Взять из записи: не ниже нуля. Пустая запись удаляется. */
export function removeStock(stock: Stock, recordId: string, qty: number): Stock {
  const prev = stock[recordId];
  if (!prev) throw new Error(`removeStock: нет записи ${recordId}`);
  const left = Math.max(0, prev.qty - qty);
  const next = { ...stock };
  if (left === 0) delete next[recordId];
  else next[recordId] = { ...prev, qty: left };
  return next;
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
    stock = addStock(stock, batch, e.qty);
  }
  return stock;
}
