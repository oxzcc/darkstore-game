// Грузовик поставки едет (W8b): подъезжает задом к воротам и уезжает.
import { describe, expect, it } from 'vitest';
import { DECOR } from '../config/decor';
import { arrivalPose, arrivalSeconds, departurePose, departureSeconds } from './truckDrive';

const parked: [number, number] = [2.5, 13.72];
const yawNorm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('грузовик едет', () => {
  it('приезжает с востока по дороге и встаёт у ворот кабиной к дороге', () => {
    const start = arrivalPose(parked, 0);
    expect(start.pos[0]).toBe(DECOR.truck.fromX);
    expect(start.pos[2]).toBe(DECOR.truck.inLaneZ);
    expect(yawNorm(start.yaw)).toBeCloseTo(-Math.PI / 2, 5); // кабиной на запад
    const end = arrivalPose(parked, arrivalSeconds(parked) + 5);
    expect(end.pos[0]).toBeCloseTo(parked[0], 5);
    expect(end.pos[2]).toBeCloseTo(parked[1], 5);
    expect(end.pos[1]).toBeCloseTo(0, 5);
    expect(yawNorm(end.yaw)).toBeCloseTo(0, 2); // кабиной на юг (+z)
  });

  it('едет без рывков: за кадр сдвигается меньше чем на полметра', () => {
    const total = arrivalSeconds(parked);
    let prev = arrivalPose(parked, 0).pos;
    for (let s = 0.05; s <= total; s += 0.05) {
      const p = arrivalPose(parked, s).pos;
      expect(Math.hypot(p[0] - prev[0], p[2] - prev[2])).toBeLessThan(0.5);
      prev = p;
    }
  });

  it('уезжает от ворот на восток и пропадает за краем', () => {
    const start = departurePose(parked, 0)!;
    expect(start.pos[0]).toBeCloseTo(parked[0], 5);
    expect(start.pos[2]).toBeCloseTo(parked[1], 5);
    const later = departurePose(parked, departureSeconds(parked) - 0.1)!;
    expect(later.pos[0]).toBeGreaterThan(30);
    expect(later.pos[2]).toBe(DECOR.truck.outLaneZ);
    expect(departurePose(parked, departureSeconds(parked) + 0.1)).toBe(null);
  });
});
