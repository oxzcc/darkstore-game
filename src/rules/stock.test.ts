import { describe, expect, it } from 'vitest';
import type { Stock } from '../model/stock';
import { parseAddress } from './address';
import {
  actualQtyAt, addStock, batchId, bookQtyAt, canPlace, hasDiscrepancy, productOnShelf, removeStock, shelfContents,
} from './stock';

const A = parseAddress('1.1.1');
const B = parseAddress('1.1.2');
const milk = { productId: 'milk', address: A, expiresAtShift: 4 };

describe('остатки', () => {
  it('правильная выкладка: учёт и факт совпадают', () => {
    const s = addStock({}, milk, { book: 5, actual: 5 });
    expect(bookQtyAt(s, A)).toBe(5);
    expect(actualQtyAt(s, A)).toBe(5);
    expect(Object.values(s).some(hasDiscrepancy)).toBe(false);
  });

  it('ошибка «не та полка»: по учёту товар на A, по факту на B (02, раздел 8)', () => {
    let s: Stock = {};
    s = addStock(s, milk, { book: 5, actual: 0 });                  // система думает: на A
    s = addStock(s, { ...milk, address: B }, { book: 0, actual: 5 }); // на самом деле: на B
    expect(bookQtyAt(s, A)).toBe(5);
    expect(actualQtyAt(s, A)).toBe(0); // сборщик придёт на A и ничего не найдёт
    expect(bookQtyAt(s, B)).toBe(0);
    expect(actualQtyAt(s, B)).toBe(5);
    expect(Object.values(s).every(hasDiscrepancy)).toBe(true);
  });

  it('ошибка «неверное количество»: в учёте 10, на полке 7', () => {
    const s = addStock({}, milk, { book: 10, actual: 7 });
    expect(bookQtyAt(s, A) - actualQtyAt(s, A)).toBe(3);
  });

  it('та же партия складывается в одну запись, другая партия — отдельная', () => {
    let s = addStock({}, milk, { book: 3, actual: 3 });
    s = addStock(s, milk, { book: 2, actual: 2 });
    s = addStock(s, { ...milk, expiresAtShift: 6 }, { book: 4, actual: 4 });
    expect(Object.keys(s)).toHaveLength(2);
    expect(bookQtyAt(s, A, 'milk')).toBe(9);
  });

  it('взять товар: не ниже нуля, пустая запись исчезает', () => {
    let s = addStock({}, milk, { book: 5, actual: 2 });
    s = removeStock(s, batchId(milk), { book: 3, actual: 3 });
    expect(bookQtyAt(s, A)).toBe(2);
    expect(actualQtyAt(s, A)).toBe(0);
    s = removeStock(s, batchId(milk), { book: 2, actual: 0 });
    expect(Object.keys(s)).toHaveLength(0);
  });

  it('исходные остатки не меняются', () => {
    const s0 = addStock({}, milk, { book: 5, actual: 5 });
    const copy = JSON.stringify(s0);
    addStock(s0, milk, { book: 1, actual: 1 });
    removeStock(s0, batchId(milk), { book: 1, actual: 1 });
    expect(JSON.stringify(s0)).toBe(copy);
  });

  it('на полке один вид товара', () => {
    const s = addStock({}, milk, { book: 5, actual: 5 });
    expect(productOnShelf(s, A)).toBe('milk');
    expect(canPlace(s, 'milk', A)).toBe(true);
    expect(canPlace(s, 'bread', A)).toBe(false);
    expect(canPlace(s, 'bread', B)).toBe(true);
  });

  it('что видно на полке: факт, партии одного товара складываются, пустые не показываются', () => {
    let s: Stock = {};
    s = addStock(s, milk, { book: 3, actual: 3 });
    s = addStock(s, { ...milk, expiresAtShift: 6 }, { book: 2, actual: 4 });
    s = addStock(s, { ...milk, address: B }, { book: 5, actual: 0 }); // только в учёте
    expect(shelfContents(s, A)).toEqual([{ productId: 'milk', qty: 7 }]);
    expect(shelfContents(s, B)).toEqual([]);
  });
});
