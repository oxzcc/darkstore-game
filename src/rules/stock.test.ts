import { describe, expect, it } from 'vitest';
import type { Stock } from '../model/stock';
import { parseAddress } from './address';
import { addStock, batchId, canPlace, productOnShelf, qtyAt, removeStock, shelfContents } from './stock';

const A = parseAddress('1.1.1');
const B = parseAddress('1.1.2');
const milk = { productId: 'milk', address: A, expiresAtShift: 4 };

describe('остатки', () => {
  it('положить товар на полку', () => {
    const s = addStock({}, milk, 5);
    expect(qtyAt(s, A)).toBe(5);
    expect(qtyAt(s, B)).toBe(0);
  });

  it('та же партия складывается в одну запись, другая партия — отдельная', () => {
    let s = addStock({}, milk, 3);
    s = addStock(s, milk, 2);
    s = addStock(s, { ...milk, expiresAtShift: 6 }, 4);
    expect(Object.keys(s)).toHaveLength(2);
    expect(qtyAt(s, A, 'milk')).toBe(9);
  });

  it('взять товар: не ниже нуля, пустая запись исчезает', () => {
    let s = addStock({}, milk, 5);
    s = removeStock(s, batchId(milk), 3);
    expect(qtyAt(s, A)).toBe(2);
    s = removeStock(s, batchId(milk), 9);
    expect(Object.keys(s)).toHaveLength(0);
  });

  it('отрицательное количество — ошибка', () => {
    expect(() => addStock({}, milk, -1)).toThrow();
  });

  it('исходные остатки не меняются', () => {
    const s0 = addStock({}, milk, 5);
    const copy = JSON.stringify(s0);
    addStock(s0, milk, 1);
    removeStock(s0, batchId(milk), 1);
    expect(JSON.stringify(s0)).toBe(copy);
  });

  it('на полке один вид товара', () => {
    const s = addStock({}, milk, 5);
    expect(productOnShelf(s, A)).toBe('milk');
    expect(canPlace(s, 'milk', A)).toBe(true);
    expect(canPlace(s, 'bread', A)).toBe(false);
    expect(canPlace(s, 'bread', B)).toBe(true);
  });

  it('что видно на полке: партии одного товара складываются, пустые полки пусты', () => {
    let s: Stock = {};
    s = addStock(s, milk, 3);
    s = addStock(s, { ...milk, expiresAtShift: 6 }, 4);
    expect(shelfContents(s, A)).toEqual([{ productId: 'milk', qty: 7 }]);
    expect(shelfContents(s, B)).toEqual([]);
  });
});
