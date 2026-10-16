// Фон (W8c): машины, птицы, бабочки — чистые функции времени.
import { describe, expect, it } from 'vitest';
import { DECOR } from '../config/decor';
import { birdsAt, butterfliesAt, carsAt } from './life';

describe('машины', () => {
  it('едут в своих полосах и не наезжают друг на друга', () => {
    let seen = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const cars = carsAt(t);
      seen += cars.length;
      DECOR.life.cars.lanes.forEach((lane) => {
        const xs = cars.filter((c) => c.pos[2] === lane.z).map((c) => c.pos[0]).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(4);
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(Math.min(lane.from, lane.to) - 0.01);
          expect(x).toBeLessThanOrEqual(Math.max(lane.from, lane.to) + 0.01);
        }
      });
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('одно и то же время — одна и та же картина (на паузе стоят)', () => {
    expect(carsAt(123.4)).toEqual(carsAt(123.4));
  });
});

describe('птицы и бабочки', () => {
  it('стая появляется по расписанию и улетает', () => {
    const B = DECOR.life.birds;
    expect(birdsAt(1, [7, 6]).length).toBeGreaterThanOrEqual(B.count[0]);
    expect(birdsAt(B.span / B.speed + 0.5, [7, 6])).toHaveLength(0);
    for (const b of birdsAt(3, [7, 6])) expect(b.pos[1]).toBeGreaterThan(B.height - 1);
  });

  it('бабочки держатся у своих мест, низко над травой', () => {
    for (let t = 0; t < 60; t += 0.7) {
      butterfliesAt(t).forEach((b, i) => {
        const home = DECOR.life.butterflies[i];
        expect(Math.hypot(b.pos[0] - home.x, b.pos[2] - home.z)).toBeLessThan(2);
        expect(b.pos[1]).toBeGreaterThan(0.2);
        expect(b.pos[1]).toBeLessThan(0.9);
      });
    }
  });
});
