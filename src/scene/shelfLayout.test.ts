import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT, WAREHOUSE_VIEW } from '../config/warehouse';
import { PUTAWAY } from '../config/balance';
import { buildWarehouseMap } from '../rules/warehouse';
import { shelfLayout } from './shelfLayout';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const rack = map.racks[0];
const at = { aisle: rack.aisle, rack: rack.rack, shelf: 1 };
const { max, perRow } = WAREHOUSE_VIEW.shelfItems;

describe('товар на полке (G1a)', () => {
  it('сколько лежит — столько штук и видно', () => {
    for (const qty of [1, 4, 7, 10]) {
      const l = shelfLayout(rack, at, [{ productId: 'milk', qty }]);
      expect(l.groups[0].shown).toBe(qty);
      expect(l.groups[0].xs).toHaveLength(qty);
      expect(l.groups[0].zs).toHaveLength(qty);
      expect(l.groups[0].turns).toHaveLength(qty);
    }
  });

  it('больше вместимости не рисуется; вместимость не меньше, чем кладёт выкладка', () => {
    expect(max).toBeGreaterThanOrEqual(PUTAWAY.shelfCapacity);
    const l = shelfLayout(rack, at, [{ productId: 'milk', qty: 6 }, { productId: 'milk', qty: 9 }]);
    expect(l.groups.reduce((s, g) => s + g.shown, 0)).toBe(max);
  });

  it('сначала заполняется передний ряд', () => {
    const l = shelfLayout(rack, at, [{ productId: 'milk', qty: perRow + 1 }]);
    const zs = l.groups[0].zs;
    const towardFront = (z: number) => z * l.front; // больше — ближе к лицу
    const frontRow = zs.slice(0, perRow).map(towardFront);
    expect(Math.min(...frontRow)).toBeGreaterThan(towardFront(zs[perRow]));
  });

  it('раскладка одинаковая при каждом вызове и разная на разных полках', () => {
    const a = shelfLayout(rack, at, [{ productId: 'milk', qty: 5 }]);
    const b = shelfLayout(rack, at, [{ productId: 'milk', qty: 5 }]);
    const c = shelfLayout(rack, { ...at, shelf: 2 }, [{ productId: 'milk', qty: 5 }]);
    expect(b.groups[0].turns).toEqual(a.groups[0].turns);
    expect(c.groups[0].turns).not.toEqual(a.groups[0].turns);
  });

  it('зона клика накрывает все штуки товара', () => {
    const g = shelfLayout(rack, at, [{ productId: 'milk', qty: 8 }]).groups[0];
    for (const x of g.xs) {
      expect(x).toBeGreaterThan(g.x0);
      expect(x).toBeLessThan(g.x1);
    }
  });
});
