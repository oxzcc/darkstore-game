import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from './warehouse';
import { addressKey, allAddresses, formatAddress, isValidAddress, parseAddress, sameAddress } from './address';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

describe('адреса', () => {
  it('разбирает и собирает адрес обратно без потерь', () => {
    expect(parseAddress('3.2.1')).toEqual({ aisle: 3, rack: 2, shelf: 1 });
    for (const a of allAddresses(map)) expect(parseAddress(formatAddress(a))).toEqual(a);
  });

  it('неверные строки дают ошибку', () => {
    for (const bad of ['', '1.1', '1.1.1.1', 'a.b.c', '1-1-1', '0.1.1', '1.1.-1']) {
      expect(() => parseAddress(bad)).toThrow();
    }
  });

  it('проверяет, есть ли полка на складе', () => {
    expect(isValidAddress(map, parseAddress('1.1.1'))).toBe(true);
    expect(isValidAddress(map, parseAddress('3.4.3'))).toBe(true);
    expect(isValidAddress(map, parseAddress('4.1.1'))).toBe(false); // нет 4-й аллеи
    expect(isValidAddress(map, parseAddress('1.5.1'))).toBe(false); // нет 5-го стеллажа
    expect(isValidAddress(map, parseAddress('1.1.4'))).toBe(false); // нет 4-й полки
  });

  it('на складе 36 адресов, все разные', () => {
    const all = allAddresses(map);
    expect(all).toHaveLength(36);
    expect(new Set(all.map(addressKey)).size).toBe(36);
  });

  it('сравнивает адреса', () => {
    expect(sameAddress(parseAddress('2.3.4'), { aisle: 2, rack: 3, shelf: 4 })).toBe(true);
    expect(sameAddress(parseAddress('2.3.4'), parseAddress('2.4.3'))).toBe(false);
  });
});
