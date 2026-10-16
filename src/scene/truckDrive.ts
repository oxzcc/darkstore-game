// Грузовик поставки едет (W8b; 08, раздел 0). Только отображение: правила знают лишь «приехал» (arrivedAt) и «стоит у ворот».
// Подъезд: по ближней к складу полосе с востока на запад мимо площадки, потом задом по дуге к воротам (кабиной к дороге).
// Отъезд: вперёд с площадки, поворот налево на дальнюю полосу и на восток за край экрана.
// Положение грузовика — середина заднего края (как у модели Truck), поворот — куда смотрит кабина (0 — на +z).
import { DECOR } from '../config/decor';

type XZ = [number, number];
export type TruckPose = { pos: [number, number, number]; yaw: number };

const T = () => DECOR.truck;

/** Квадратичная кривая Безье: точка и направление движения. */
function bezier(a: XZ, c: XZ, b: XZ, k: number): { p: XZ; d: XZ } {
  const u = 1 - k;
  return {
    p: [u * u * a[0] + 2 * u * k * c[0] + k * k * b[0], u * u * a[1] + 2 * u * k * c[1] + k * k * b[1]],
    d: [2 * u * (c[0] - a[0]) + 2 * k * (b[0] - c[0]), 2 * u * (c[1] - a[1]) + 2 * k * (b[1] - c[1])],
  };
}
/** Длина кривой (по 24 отрезкам — точнее не нужно). */
function bezierLength(a: XZ, c: XZ, b: XZ): number {
  let len = 0, prev = a;
  for (let i = 1; i <= 24; i++) {
    const { p } = bezier(a, c, b, i / 24);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
}
/** Плавный разгон и торможение: 0…1 → 0…1. */
const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
/** Дорога чуть ниже площадки: на дороге колёса опускаются. */
const groundY = (z: number) => T().roadY * clamp01((z - DECOR.road.z0 + 0.4) / 0.8);
const pose = (p: XZ, yaw: number): TruckPose => ({ pos: [p[0], groundY(p[1]), p[1]], yaw });
const yawOf = (d: XZ) => Math.atan2(d[0], d[1]);

/** Подъезд: прямо по полосе, затем задом по дуге. `parked` — где стоит у ворот. */
function arrivalLegs(parked: XZ) {
  const t = T();
  const turnX = parked[0] - t.reverseSwing;            // здесь кончается проезд вперёд и начинается задний ход
  const forward = { from: [t.fromX, t.inLaneZ] as XZ, to: [turnX, t.inLaneZ] as XZ };
  const back = { a: forward.to, c: [parked[0], t.inLaneZ] as XZ, b: parked };
  const fLen = forward.from[0] - forward.to[0];
  const bLen = bezierLength(back.a, back.c, back.b);
  return { forward, back, fSec: fLen / t.forwardSpeed, bSec: bLen / t.reverseSpeed };
}

/** Отъезд: вперёд по дуге на дальнюю полосу, затем прямо на восток. */
function departureLegs(parked: XZ) {
  const t = T();
  const curve = { a: parked, c: [parked[0], t.outLaneZ] as XZ, b: [parked[0] + t.reverseSwing, t.outLaneZ] as XZ };
  const cLen = bezierLength(curve.a, curve.c, curve.b);
  const straight = { from: curve.b, to: [t.toX, t.outLaneZ] as XZ };
  return { curve, straight, cSec: cLen / t.turnSpeed, sSec: (straight.to[0] - straight.from[0]) / t.forwardSpeed };
}

/** Сколько секунд игрового времени едет к воротам. */
export function arrivalSeconds(parked: XZ): number {
  const l = arrivalLegs(parked);
  return l.fSec + l.bSec;
}
/** Сколько секунд игрового времени уезжает. */
export function departureSeconds(parked: XZ): number {
  const l = departureLegs(parked);
  return l.cSec + l.sSec;
}

/** Где грузовик через `s` секунд после приезда поставки (после конца подъезда — у ворот). */
export function arrivalPose(parked: XZ, s: number): TruckPose {
  const l = arrivalLegs(parked);
  if (s < l.fSec) {
    // вперёд на запад, к концу притормаживает: кабина впереди, то есть задний край — позади по ходу
    const k = s / l.fSec;
    const eased = k < 0.7 ? k * 0.85 / 0.7 : 0.85 + 0.15 * ease((k - 0.7) / 0.3);
    const x = l.forward.from[0] + (l.forward.to[0] - l.forward.from[0]) * eased;
    return pose([x, l.forward.from[1]], -Math.PI / 2);
  }
  const k = ease(clamp01((s - l.fSec) / l.bSec));
  const { p } = bezier(l.back.a, l.back.c, l.back.b, k);
  const { d } = bezier(l.back.a, l.back.c, l.back.b, Math.max(0.001, Math.min(0.999, k))); // направление — чуть внутри кривой, на концах оно не ноль
  // задним ходом впереди задний край, поэтому кабина смотрит против движения
  return pose(p, yawOf([-d[0], -d[1]]));
}

/** Где грузовик через `s` секунд после того, как отъехал от ворот; null — уже уехал за край. */
export function departurePose(parked: XZ, s: number): TruckPose | null {
  const l = departureLegs(parked);
  if (s < l.cSec) {
    const k = clamp01(s / l.cSec);
    const kk = k * k * 0.7 + k * 0.3; // трогается медленно
    const { p } = bezier(l.curve.a, l.curve.c, l.curve.b, kk);
    const { d } = bezier(l.curve.a, l.curve.c, l.curve.b, Math.max(0.001, kk));
    return pose(p, yawOf(d));
  }
  const s2 = s - l.cSec;
  if (s2 >= l.sSec) return null;
  const x = l.straight.from[0] + (l.straight.to[0] - l.straight.from[0]) * (s2 / l.sSec);
  return pose([x, l.straight.from[1]], Math.PI / 2);
}
