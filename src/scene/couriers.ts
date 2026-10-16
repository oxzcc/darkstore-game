// Пакеты заказов и курьеры (W8a; 08, раздел 0). Только отображение: правила это не читают.
// Всё считается из записей «заказ закрыт» (shiftLog) и игрового времени, без своего состояния:
// на паузе время стоит — курьеры замирают, после перезагрузки страницы всё встаёт на свои места.
//
// Путь одного заказа: зафасован → пакет на столе, у которого фасовали → курьер выезжает из-за края по дороге,
// паркуется → слезает → по пандусу через дверь выдачи к столу → берёт пакет → назад к велосипеду → разворачивает его,
// садится → уезжает по дороге на запад.
import type { Cell, WarehouseMap } from '../model/warehouse';
import { DECOR } from '../config/decor';
import { COURIER_LOOKS, type DogLook } from '../config/pickers';
import { PRODUCTS } from '../config/products';
import { WAREHOUSE_VIEW } from '../config/warehouse';

type V3 = [number, number, number];

/** Закрытый заказ: когда, где фасовали (клетка сборщика; в старых сохранениях нет) и что в нём. */
export type PackedOrder = { taskId: string; at: number; cell: Cell | null; items: { productId: string; qty: number }[] };

/** Что лежит в одном пакете: цвета товаров (просвечивают сквозь пакет). */
export type BagLook = { items: { color: string; accent: string; size: V3; pos: V3 }[] };

/** Ломаная: точки и длины от начала. */
export type Route = { pts: V3[]; at: number[]; total: number };

export type CourierPlan = {
  taskId: string;
  at: number;              // пакет встал на стол
  look: DogLook;
  bags: { slot: number; pos: V3; look: BagLook }[]; // пакеты на столе (место и вид)
  stallX: number;
  rideIn: Route;
  walkIn: Route;           // от велосипеда к столу
  walkOut: Route;          // назад — тот же путь наоборот
  rideOut: Route;
  // моменты (игровое время)
  tStart: number;          // выехал из-за края
  tParked: number;         // встал на парковке
  tOff: number;            // слез
  tAtTable: number;        // дошёл до стола
  tTaken: number;          // взял пакет (пакеты исчезают со стола на середине «take»)
  tAtBike: number;         // вернулся к велосипеду
  tOn: number;             // развернул велосипед и сел
  tEnd: number;            // уехал за край
};

const C = DECOR.couriers;
const B = DECOR.bags;
/** Верх плит снаружи (парковка, дорожка): трава чуть ниже пола склада (World.tsx), плиты 4 см. */
const OUT_Y = -WAREHOUSE_VIEW.floorThickness - 0.01 + 0.04;

function route(pts: V3[]): Route {
  const at = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1], [bx, by, bz] = pts[i];
    at.push(at[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
  }
  return { pts, at, total: at[at.length - 1] };
}

/** Точка на ломаной через `d` метров от начала и куда смотрит (поворот вокруг вертикали: 0 — на +z). */
export function pointOn(r: Route, d: number): { pos: V3; heading: number } {
  const dd = Math.max(0, Math.min(r.total, d));
  let i = 1;
  while (i < r.pts.length - 1 && r.at[i] < dd) i++;
  const a = r.pts[i - 1], b = r.pts[i];
  const len = r.at[i] - r.at[i - 1];
  const k = len > 0 ? (dd - r.at[i - 1]) / len : 0;
  const pos: V3 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  return { pos, heading: Math.atan2(b[0] - a[0], b[2] - a[2]) };
}

const reverse = (r: Route): Route => route([...r.pts].reverse());

/** Число 0…1 из строки — одинаковое при каждой загрузке. */
function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Центр стола и его номер: ближний к клетке, где фасовали (по x — все столы в одном ряду). */
function tableNear(map: WarehouseMap, cell: Cell | null): { index: number; center: V3 } {
  const s = WAREHOUSE_VIEW.cellSize;
  const centers = map.tables.map((t) => [(t.x + 1) * s, 0, (t.z + 0.5) * s] as V3);
  if (centers.length === 0) return { index: 0, center: [0, 0, 0] };
  let best = Math.floor(centers.length / 2);
  if (cell) {
    const x = (cell.x + 0.5) * s;
    best = centers.reduce((bi, c, i) => (Math.abs(c[0] - x) < Math.abs(centers[bi][0] - x) ? i : bi), 0);
  }
  return { index: best, center: centers[best] };
}

/** Что в пакетах: штуки делятся на 1 или 2 пакета, в каждом до 4 цветных брусков-товаров. */
function bagLooks(o: PackedOrder): BagLook[] {
  const units: string[] = [];
  for (const it of o.items) for (let i = 0; i < it.qty; i++) units.push(it.productId);
  const count = units.length >= B.twoBagsFrom ? 2 : 1;
  const out: BagLook[] = [];
  for (let b = 0; b < count; b++) {
    const mine = units.filter((_, i) => i % count === b);
    // разные товары — по бруску, одинаковые подряд не повторяем, всего до 4
    const kinds = [...new Set(mine)].slice(0, 4);
    while (kinds.length < Math.min(3, mine.length)) kinds.push(mine[kinds.length % mine.length]);
    const items = kinds.map((pid, i) => {
      const look = PRODUCTS[pid]?.look ?? { color: '#C9C2B4', accent: '#FFFFFF' };
      const r = hash01(o.taskId, b * 10 + i);
      const w = 0.1 + r * 0.05, h = 0.12 + hash01(o.taskId, b * 10 + i + 5) * 0.1, d = 0.08 + r * 0.04;
      const pos: V3 = [-0.08 + (i % 2) * 0.15, h / 2 + 0.015, (i < 2 ? -0.04 : 0.05)];
      return { color: look.color, accent: look.accent, size: [w, h, d] as V3, pos };
    });
    out.push({ items });
  }
  return out;
}

/**
 * Планы курьеров на все закрытые заказы смены. Заказы идут по времени: пакет занимает первые свободные места
 * своего стола (место свободно, если прежний пакет к этому моменту уже забрали). Места на парковке — по очереди.
 */
export function planCouriers(orders: PackedOrder[], map: WarehouseMap): CourierPlan[] {
  const sorted = [...orders].sort((a, b) => a.at - b.at);
  const taken: { table: number; slot: number; until: number }[] = [];
  const plans: CourierPlan[] = [];
  sorted.forEach((o, n) => {
    const { index: table, center } = tableNear(map, o.cell);
    const looks = bagLooks(o);
    const busy = new Set(taken.filter((x) => x.table === table && x.until > o.at).map((x) => x.slot));
    const free = B.slots.map((_, i) => i).filter((i) => !busy.has(i));
    const bags = looks.flatMap((look, k) => {
      const slot = free[k];
      if (slot === undefined) return []; // стол заставлен — лишний пакет не рисуем
      const [dx, dz] = B.slots[slot];
      return [{ slot, look, pos: [center[0] + dx, B.tableTop, center[2] + dz] as V3 }];
    });

    const stallX = C.stalls[n % C.stalls.length];
    const parked: V3 = [stallX, OUT_Y, C.stallZ];
    const rideIn = route([
      [C.fromX, OUT_Y - 0.01, C.laneZ],
      [stallX + 0.9, OUT_Y - 0.01, C.laneZ],
      [stallX, OUT_Y, C.laneZ - 0.9],
      parked,
    ]);
    // курьер встаёт к столу напротив своих пакетов
    const aimX = bags.length ? bags.reduce((s, b) => s + b.pos[0], 0) / bags.length : center[0];
    const standZ = C.doorZ;
    const walkIn = route([
      [stallX - 0.55, OUT_Y, C.stallZ],
      [stallX - 0.55, OUT_Y, C.doorZ], // сначала к складу вдоль велосипеда, потом к пандусу — мимо соседнего велосипеда
      [C.rampFoot, OUT_Y, C.doorZ],
      [14.0, 0, C.doorZ],
      [C.doorInside, 0, C.doorZ],
      [aimX, 0, standZ],
    ]);
    const rideOut = route([
      parked,
      [stallX, OUT_Y, C.laneZ - 0.9],
      [stallX - 0.9, OUT_Y - 0.01, C.laneZ],
      [C.toX, OUT_Y - 0.01, C.laneZ],
    ]);

    const tStart = o.at + C.waitFrom + hash01(o.taskId, 1) * (C.waitTo - C.waitFrom);
    const tParked = tStart + rideIn.total / C.rideSpeed;
    const tOff = tParked + C.dismount;
    const tAtTable = tOff + walkIn.total / C.walkSpeed;
    const tTaken = tAtTable + C.take;
    const tAtBike = tTaken + walkIn.total / C.walkSpeed;
    const tOn = tAtBike + C.mount;
    const tEnd = tOn + rideOut.total / C.rideSpeed;

    for (const b of bags) taken.push({ table, slot: b.slot, until: bagGoneAt({ tAtTable }) });
    const look = COURIER_LOOKS[Math.floor(hash01(o.taskId, 2) * COURIER_LOOKS.length) % COURIER_LOOKS.length];
    plans.push({ taskId: o.taskId, at: o.at, look, bags, stallX, rideIn, walkIn, walkOut: reverse(walkIn), rideOut,
      tStart, tParked, tOff, tAtTable, tTaken, tAtBike, tOn, tEnd });
  });
  return plans;
}

/** Когда пакеты уходят со стола в лапы курьера — на середине «взять». */
export const bagGoneAt = (p: Pick<CourierPlan, 'tAtTable'>) => p.tAtTable + C.take / 2;

/** Пакет на столе в момент t (и насколько он «впрыгнул»: 0…1). */
export function bagOnTable(p: CourierPlan, t: number): number {
  if (t < p.at || t >= bagGoneAt(p)) return 0;
  return Math.min(1, 0.6 + ((t - p.at) / B.popSeconds) * 0.4);
}

export type CourierAction = 'ride' | 'stand' | 'walk' | 'take';

/** Где курьер и велосипед в момент t; null — ещё не выехал или уже уехал. */
export type CourierFrame = {
  bike: { pos: V3; heading: number };
  dog: { pos: V3; heading: number; action: CourierAction; walked: number; carrying: boolean };
};

export function courierAt(p: CourierPlan, t: number): CourierFrame | null {
  if (t < p.tStart || t >= p.tEnd) return null;
  const parked = p.rideIn.pts[p.rideIn.pts.length - 1];
  const NORTH = Math.PI; // велосипед носом к складу (−z)
  const beside = p.walkIn.pts[0];
  const ride = (r: Route, d: number) => {
    const { pos, heading } = pointOn(r, d);
    return { bike: { pos, heading }, dog: { pos, heading, action: 'ride' as const, walked: 0, carrying: false } };
  };
  if (t < p.tParked) return ride(p.rideIn, (t - p.tStart) * C.rideSpeed);
  const parkedBike = { pos: parked, heading: NORTH };
  if (t < p.tOff) return { bike: parkedBike, dog: { pos: beside, heading: NORTH, action: 'stand', walked: 0, carrying: false } };
  if (t < p.tAtTable) {
    const d = (t - p.tOff) * C.walkSpeed;
    const { pos, heading } = pointOn(p.walkIn, d);
    return { bike: parkedBike, dog: { pos, heading, action: 'walk', walked: d, carrying: false } };
  }
  if (t < p.tTaken) {
    const end = p.walkIn.pts[p.walkIn.pts.length - 1];
    return { bike: parkedBike, dog: { pos: end, heading: 0, action: 'take', walked: 0, carrying: t >= bagGoneAt(p) } };
  }
  if (t < p.tAtBike) {
    const d = (t - p.tTaken) * C.walkSpeed;
    const { pos, heading } = pointOn(p.walkOut, d);
    return { bike: parkedBike, dog: { pos, heading, action: 'walk', walked: d, carrying: true } };
  }
  if (t < p.tOn) {
    // разворачивает велосипед носом к дороге (на юг, +z), пакеты — в кофр
    const k = (t - p.tAtBike) / C.mount;
    const heading = NORTH - Math.PI * k;
    return { bike: { pos: parked, heading }, dog: { pos: beside, heading: NORTH / 2, action: 'stand', walked: 0, carrying: k < 0.5 } };
  }
  return ride(p.rideOut, (t - p.tOn) * C.rideSpeed);
}
