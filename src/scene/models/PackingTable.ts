// Стол фасовки по art/reference/world_packaging_table.png (M9b2; 08, раздел 7: 2×1 клетки). Стиль — low poly.
// Светлая столешница, тёмный каркас с ножками на опорах, нижняя полка с коробками и серыми лотками,
// на столе — коробка и диспенсер скотча. Декорация: на правила не влияет, сборщик фасует, стоя перед столом.
// Координаты: x — вдоль стола (по длине `length` клеток), y — вверх, z — поперёк; лицо (сторона сборщика) — −z.
// Возвращает список брусков: все столы рисует один VoxelBatch (08, раздел 11).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const DEPTH = 0.78;   // поперёк
const HEIGHT = 0.85;  // верх столешницы
const TOP = 0.06;     // толщина столешницы
const LEG = 0.07;     // сечение ножки
const SHELF_Y = 0.2;  // нижняя полка

export function packingTableParts(length = 2): VoxelPart[] {
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) =>
    out.push(rot ? { pos, size, color, rot } : { pos, size, color });

  const len = length * 0.94;
  const lx = len / 2 - 0.08;
  const lz = DEPTH / 2 - 0.08;

  // столешница с небольшим свесом
  add([0, HEIGHT - TOP / 2, 0], [len, TOP, DEPTH], PALETTE.tableTop);

  // ножки, опоры-«пятки» (восьмигранник из двух брусков) и муфты у полки
  for (const x of [-lx, lx]) {
    for (const z of [-lz, lz]) {
      add([x, (HEIGHT - TOP) / 2 + 0.02, z], [LEG, HEIGHT - TOP - 0.04, LEG], PALETTE.metal);
      add([x, 0.02, z], [0.08, 0.04, 0.08], PALETTE.metalDark);
      add([x, 0.02, z], [0.08, 0.04, 0.08], PALETTE.metalDark, [0, Math.PI / 4, 0]);
      add([x, SHELF_Y + 0.02, z], [LEG + 0.02, 0.08, LEG + 0.02], PALETTE.metalDark);
    }
  }
  // царга под столешницей
  const rimY = HEIGHT - TOP - 0.04;
  for (const z of [-lz, lz]) add([0, rimY, z], [lx * 2, 0.08, 0.04], PALETTE.metal);
  for (const x of [-lx, lx]) add([x, rimY, 0], [0.04, 0.08, lz * 2], PALETTE.metal);
  // нижняя полка
  add([0, SHELF_Y, 0], [lx * 2 + LEG, 0.03, lz * 2 + LEG], PALETTE.metal);

  // на полке слева — две коробки со скотчем
  const shelfTop = SHELF_Y + 0.015;
  const box = (x: number, z: number, sx: number, sz: number, h: number, y0: number, turn = 0) => {
    add([x, y0 + h / 2, z], [sx, h, sz], PALETTE.box, turn ? [0, turn, 0] : undefined);
    add([x, y0 + h + 0.004, z], [0.06, 0.008, sz + 0.008], PALETTE.boxTape, turn ? [0, turn, 0] : undefined);
  };
  box(-lx + 0.27, 0.05, 0.4, 0.34, 0.2, shelfTop, 0.04);
  box(-lx + 0.6, -0.1, 0.3, 0.26, 0.15, shelfTop, -0.05);

  // справа — два серых лотка: дно, четыре стенки, тёмная прорезь-ручка спереди
  const bin = (x: number) => {
    const w = 0.3, d = 0.36, h = 0.14, t = 0.02;
    const y0 = shelfTop;
    add([x, y0 + t / 2, 0], [w, t, d], PALETTE.bin);
    for (const s of [-1, 1]) {
      add([x + (s * (w - t)) / 2, y0 + h / 2, 0], [t, h, d], PALETTE.bin);
      add([x, y0 + h / 2, (s * (d - t)) / 2], [w, h, t], PALETTE.bin);
    }
    add([x, y0 + h * 0.7, -d / 2 - 0.002], [0.1, 0.03, 0.006], PALETTE.metalDark);
  };
  bin(lx - 0.5);
  bin(lx - 0.17);

  // на столе: коробка слева и диспенсер скотча справа
  box(-len / 2 + 0.35, 0.02, 0.36, 0.3, 0.2, HEIGHT, -0.06);

  // пустые сложенные пакеты стопкой у задней кромки (W8a): пакеты с заказами ставит сцена (scene/OrderBags.tsx), когда заказ зафасован
  for (let i = 0; i < 4; i++) {
    add([-0.62 + i * 0.004, HEIGHT + 0.012 + i * 0.02, 0.27], [0.3, 0.018, 0.2], i % 2 ? PALETTE.bagFold : PALETTE.bag, [0, 0.05 * (i % 2 ? 1 : -1), 0]);
  }
  add([-0.62, HEIGHT + 0.09, 0.27], [0.08, 0.006, 0.08], PALETTE.uniform);  // логотип на верхнем
  const dx = len / 2 - 0.3;
  add([dx, HEIGHT + 0.05, 0], [0.16, 0.1, 0.12], PALETTE.metal);              // корпус
  add([dx + 0.085, HEIGHT + 0.07, 0], [0.012, 0.13, 0.12], PALETTE.accentGreen); // зелёная боковина
  // рулон: восьмигранник из двух брусков, ось вдоль x
  add([dx, HEIGHT + 0.15, 0.01], [0.08, 0.1, 0.1], PALETTE.palletWood);
  add([dx, HEIGHT + 0.15, 0.01], [0.08, 0.1, 0.1], PALETTE.palletWood, [Math.PI / 4, 0, 0]);
  add([dx, HEIGHT + 0.15, 0.01], [0.085, 0.04, 0.04], PALETTE.metalDark);   // втулка
  add([dx, HEIGHT + 0.03, -0.09], [0.06, 0.004, 0.08], PALETTE.palletWood); // язычок ленты

  return out;
}
