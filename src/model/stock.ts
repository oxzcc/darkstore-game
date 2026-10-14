// Остаток товара на полке (docs/09-architecture.md, раздел 4.2).
import type { Address } from './address';

export type StockRecord = {
  id: string;
  productId: string;
  address: Address;
  qty: number;            // сколько лежит на полке (учёт и факт не расходятся — решение автора 14.10, docs/10, раздел 11)
  expiresAtShift: number; // номер смены, после которой товар просрочен
};

/** Все остатки склада: словарь по id записи. Партии одного товара с разным сроком — разные записи. */
export type Stock = Record<string, StockRecord>;
