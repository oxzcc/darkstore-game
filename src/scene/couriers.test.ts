// Пакеты и курьеры (W8a): расписание считается из закрытых заказов и времени, без своего состояния.
import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { DECOR } from '../config/decor';
import { buildWarehouseMap } from '../rules/warehouse';
import { bagGoneAt, bagOnTable, courierAt, planCouriers, type PackedOrder } from './couriers';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const order = (taskId: string, at: number, x = 7, qty = 2): PackedOrder =>
  ({ taskId, at, cell: { x, z: 11 }, items: [{ productId: 'milk', qty }] });

describe('пакеты и курьеры', () => {
  it('пакет стоит на столе с момента фасовки, пока курьер его не возьмёт', () => {
    const [p] = planCouriers([order('t1', 10)], map);
    expect(bagOnTable(p, 9.9)).toBe(0);
    expect(bagOnTable(p, 10)).toBeGreaterThan(0);
    expect(bagOnTable(p, 10 + DECOR.bags.popSeconds)).toBe(1);
    expect(bagOnTable(p, bagGoneAt(p) - 0.01)).toBe(1);
    expect(bagOnTable(p, bagGoneAt(p))).toBe(0);
  });

  it('курьер приезжает после фасовки, доходит до стола и уезжает; этапы идут по порядку', () => {
    const [p] = planCouriers([order('t1', 10)], map);
    const ts = [p.at, p.tStart, p.tParked, p.tOff, p.tAtTable, p.tTaken, p.tAtBike, p.tOn, p.tEnd];
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    expect(p.tStart - p.at).toBeGreaterThanOrEqual(DECOR.couriers.waitFrom);
    expect(p.tStart - p.at).toBeLessThanOrEqual(DECOR.couriers.waitTo);
    expect(courierAt(p, p.tStart - 0.01)).toBe(null);
    expect(courierAt(p, p.tEnd)).toBe(null);
    expect(courierAt(p, (p.tStart + p.tParked) / 2)!.dog.action).toBe('ride');
    // у стола — напротив пакета, внутри склада
    const atTable = courierAt(p, (p.tAtTable + p.tTaken) / 2)!;
    expect(atTable.dog.action).toBe('take');
    expect(Math.abs(atTable.dog.pos[0] - p.bags[0].pos[0])).toBeLessThan(0.01);
    expect(atTable.dog.pos[0]).toBeLessThan(map.width);
    // назад несёт пакет
    expect(courierAt(p, (p.tTaken + p.tAtBike) / 2)!.dog.carrying).toBe(true);
  });

  it('пакет встаёт на стол, у которого фасовали', () => {
    const left = planCouriers([order('a', 1, 7)], map)[0];
    const right = planCouriers([order('b', 1, 12)], map)[0];
    expect(left.bags[0].pos[0]).toBeLessThan(9);
    expect(right.bags[0].pos[0]).toBeGreaterThan(11);
  });

  it('большой заказ — два пакета; на одном столе пакеты не встают друг на друга', () => {
    const [big] = planCouriers([order('a', 1, 7, 5)], map);
    expect(big.bags).toHaveLength(2);
    const [p1, p2] = planCouriers([order('a', 1), order('b', 2)], map);
    expect(p1.bags[0].slot).not.toBe(p2.bags[0].slot);
    // первый пакет забрали — его место снова свободно
    const [, late] = planCouriers([order('a', 1), order('c', bagGoneAt(p1) + 1)], map);
    expect(late.bags[0].slot).toBe(p1.bags[0].slot);
  });

  it('старое сохранение без клетки — пакет всё равно на столе', () => {
    const [p] = planCouriers([{ ...order('x', 3), cell: null }], map);
    expect(p.bags).toHaveLength(1);
  });

  it('курьеры по очереди встают на разные места парковки', () => {
    const [a, b] = planCouriers([order('a', 1), order('b', 2)], map);
    expect(a.stallX).not.toBe(b.stallX);
  });
});
