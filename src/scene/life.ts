// Фон (W8c; 08, раздел 0): где в момент t (игровое время) машины, птицы и бабочки. Только декорация, без своего состояния:
// всё — чистые функции времени, поэтому на паузе замирает, а после перезагрузки страницы встаёт на те же места.
import { DECOR } from '../config/decor';

type V3 = [number, number, number];
const L = () => DECOR.life;

/** Число 0…1 из целых чисел — одинаковое при каждой загрузке. */
export function hash01(a: number, b: number, salt = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Верх дороги (как в World.tsx: трава чуть ниже пола, асфальт 3 см). */
const ROAD_Y = -0.08;

export type CarFrame = { id: string; pos: V3; yaw: number; color: string };

/**
 * Машины на дороге в момент t. В каждой полосе одна скорость, а выезд машины № k — в k × every + разброс (не больше
 * jitter × every), поэтому машины одной полосы не догоняют друг друга. Часть мест в расписании пустая (skip).
 */
export function carsAt(t: number): CarFrame[] {
  const C = L().cars;
  const out: CarFrame[] = [];
  C.lanes.forEach((lane, li) => {
    const travel = Math.abs(lane.to - lane.from) / lane.speed;
    const kFrom = Math.floor((t - travel) / lane.every) - 1;
    const kTo = Math.floor(t / lane.every);
    for (let k = kFrom; k <= kTo; k++) {
      if (hash01(li, k, 1) < C.skip) continue;
      const start = (k + hash01(li, k, 2) * C.jitter) * lane.every;
      const s = t - start;
      if (s < 0 || s > travel) continue;
      const x = lane.from + lane.dir * lane.speed * s;
      const color = C.colors[Math.floor(hash01(li, k, 3) * C.colors.length) % C.colors.length];
      out.push({ id: `${li}:${k}`, pos: [x, ROAD_Y, lane.z], yaw: lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2, color });
    }
  });
  return out;
}

export type BirdFrame = { pos: V3; yaw: number; flap: number };

/**
 * Стая птиц в момент t: раз в `every` секунд пролетает над складом в случайную сторону, клином. Пустой список — сейчас в небе никого.
 * `center` — над чем пролетают (середина склада).
 */
export function birdsAt(t: number, center: [number, number]): BirdFrame[] {
  const B = L().birds;
  const n = Math.floor(t / B.every);
  const s = t - n * B.every;
  const dist = s * B.speed;
  if (dist > B.span) return [];
  const ang = hash01(n, 7, 4) * Math.PI * 2;
  const [dx, dz] = [Math.sin(ang), Math.cos(ang)];
  const side = (hash01(n, 7, 5) - 0.5) * 12; // мимо центра на столько метров вбок
  const [sx, sz] = [dz, -dx];
  const count = B.count[0] + Math.floor(hash01(n, 7, 6) * (B.count[1] - B.count[0] + 1));
  const lead: V3 = [
    center[0] - dx * (B.span / 2 - dist) + sx * side,
    B.height,
    center[1] - dz * (B.span / 2 - dist) + sz * side,
  ];
  const out: BirdFrame[] = [];
  for (let i = 0; i < count; i++) {
    // клин: ведущий впереди, остальные по очереди слева и справа позади
    const row = Math.ceil(i / 2), lr = i === 0 ? 0 : i % 2 ? -1 : 1;
    const back = row * 1.1, aside = lr * row * 0.9;
    out.push({
      pos: [lead[0] - dx * back + sx * aside, lead[1] + Math.sin(t * 1.3 + i) * 0.15, lead[2] - dz * back + sz * aside],
      yaw: ang,
      flap: Math.sin(t * B.flap + i * 1.7),
    });
  }
  return out;
}

export type ButterflyFrame = { pos: V3; yaw: number; flap: number; color: string };

/** Бабочки: каждая порхает петлями у своей точки, крылья часто машут. */
export function butterfliesAt(t: number): ButterflyFrame[] {
  return L().butterflies.map((b, i) => {
    const ph = i * 2.3;
    const at = (tt: number): V3 => [
      b.x + Math.sin(tt * 0.7 + ph) * 1.2 + Math.sin(tt * 1.9 + ph) * 0.25,
      0.45 + Math.sin(tt * 1.6 + ph) * 0.2 + Math.abs(Math.sin(tt * 4.1 + ph)) * 0.1,
      b.z + Math.cos(tt * 0.53 + ph) * 1.0,
    ];
    const p = at(t), q = at(t + 0.05);
    return { pos: p, yaw: Math.atan2(q[0] - p[0], q[2] - p[2]), flap: Math.sin(t * 22 + ph), color: b.color };
  });
}
