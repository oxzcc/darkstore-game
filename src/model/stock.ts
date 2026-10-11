// Остаток товара на полке (docs/09-architecture.md, раздел 4.2).
import type { Address } from './address';

export type StockRecord = {
  id: string;
  productId: string;
  address: Address;
  bookQty: number;        // учётное количество: что думает система
  actualQty: number;      // фактическое количество: что реально на полке
  expiresAtShift: number; // номер смены, после которой товар просрочен
};

/** Все остатки склада: словарь по id записи. Партии одного товара с разным сроком — разные записи. */
export type Stock = Record<string, StockRecord>;
