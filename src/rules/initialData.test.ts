// Проверка стартовых данных из config: если в них ошибка, тест покажет, где именно.
import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { PRODUCTS } from '../config/products';
import { CAMPAIGN_START_SHIFT, INITIAL_STOCK } from '../config/initialStock';
import { STAT_SCALE, STARTING_PICKERS } from '../config/pickers';
import { buildWarehouseMap } from './warehouse';
import { parseAddress } from './address';
import { buildInitialStock, qtyAt } from './stock';
import { createPickers } from './pickers';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

describe('начальный запас', () => {
  const stock = buildInitialStock(INITIAL_STOCK, PRODUCTS, map, CAMPAIGN_START_SHIFT);

  it('строится без ошибок: адреса есть, на полке по одному товару', () => {
    expect(Object.keys(stock)).toHaveLength(INITIAL_STOCK.length);
  });

  it('каждый товар каталога есть на складе', () => {
    const stocked = new Set(Object.values(stock).map((r) => r.productId));
    for (const id of Object.keys(PRODUCTS)) expect(stocked.has(id)).toBe(true);
  });

  it('срок = смена старта + срок товара', () => {
    for (const r of Object.values(stock)) {
      expect(r.expiresAtShift).toBe(CAMPAIGN_START_SHIFT + PRODUCTS[r.productId].shelfLifeShifts);
    }
    expect(qtyAt(stock, parseAddress('1.1.1'))).toBe(8);
    expect(qtyAt(stock, parseAddress('1.1.2'))).toBe(0);
  });

  it('ошибка в данных ловится', () => {
    expect(() => buildInitialStock([{ productId: 'milk', address: '9.9.9', qty: 1 }], PRODUCTS, map, 1)).toThrow();
    expect(() => buildInitialStock([{ productId: 'nope', address: '1.1.1', qty: 1 }], PRODUCTS, map, 1)).toThrow();
    expect(() =>
      buildInitialStock(
        [{ productId: 'milk', address: '1.1.1', qty: 1 }, { productId: 'bread', address: '1.1.1', qty: 1 }],
        PRODUCTS, map, 1,
      ),
    ).toThrow();
  });
});

describe('стартовые сборщики', () => {
  const pickers = createPickers(STARTING_PICKERS, map);

  it('трое, свободны, без усталости, стоят в зоне отдыха на разных клетках', () => {
    const list = Object.values(pickers);
    expect(list.map((p) => p.name)).toEqual(['Лаки', 'Коржик', 'Буран']);
    const rest = map.zones.find((z) => z.type === 'rest')!;
    for (const p of list) {
      expect(p.state).toBe('idle');
      expect(p.stats.fatigue).toBe(0);
      expect(p.position.x).toBeGreaterThanOrEqual(rest.from.x);
      expect(p.position.x).toBeLessThanOrEqual(rest.to.x);
      expect(p.position.z).toBeGreaterThanOrEqual(rest.from.z);
      expect(p.position.z).toBeLessThanOrEqual(rest.to.z);
    }
    expect(new Set(list.map((p) => `${p.position.x},${p.position.z}`)).size).toBe(3);
  });

  it('характеристики в шкале, цвета разные, специализации по 4 типам', () => {
    const list = Object.values(pickers);
    for (const p of list) {
      for (const v of [p.stats.speed, p.stats.accuracy]) {
        expect(v).toBeGreaterThanOrEqual(STAT_SCALE.min);
        expect(v).toBeLessThanOrEqual(STAT_SCALE.max);
      }
      expect(Object.keys(p.specialization).sort()).toEqual(['order', 'putaway', 'receiving', 'writeoff']);
    }
    expect(new Set(list.map((p) => p.color)).size).toBe(3);
  });
});
