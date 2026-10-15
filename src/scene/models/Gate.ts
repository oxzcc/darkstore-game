// Ворота дока по art/reference/world_gates.png (M9b3). Решение автора 15.10: ворота низкие, «в разрезе» —
// без верхней балки и шторы, потому что стоят в ближней к камере низкой стене и не должны закрывать приёмку.
// Есть: тёмные стойки рамы чуть выше низкой стены, бетонная площадка снаружи, площадка-перегрузчик с зелёной кромкой
// и боковыми упорами, зелёные столбики-отбойники внутри и снаружи. Стиль — low poly.
// Возвращает список брусков в координатах сцены: рисуется вместе со стенами одним VoxelBatch.
import type { WallOpening, WarehouseMap } from '../../model/warehouse';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';
import { wallBox } from './Wall';

const POST = 0.24;     // ширина стойки рамы вдоль стены
const POST_EXTRA = 0.2; // на сколько стойка выше низкой стены
const APRON = 0.45;    // бетонная площадка снаружи (до грузовика)
const BOLLARD = 0.1;   // сечение столбика
const BOLLARD_H = 0.55;

export function gateParts(map: WarehouseMap, gate: WallOpening): VoxelPart[] {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const ft = WAREHOUSE_VIEW.floorThickness;
  const h = WAREHOUSE_VIEW.frontWallHeight + POST_EXTRA;
  const a0 = gate.from * s;
  const a1 = (gate.to + 1) * s;
  const out: VoxelPart[] = [];
  // «Поперёк» (i) — от оси стены, плюс внутрь склада; снаружи — минус.
  const box = (b0: number, b1: number, y0: number, y1: number, i0: number, i1: number, color: string) =>
    out.push(wallBox(map, gate.side, b0, b1, y0, y1, i0, i1, color));

  // бетонная площадка снаружи и в проёме (пол склада кончается у стены)
  box(a0 - 0.3, a1 + 0.3, -ft, 0, -t / 2 - APRON, t / 2, PALETTE.concrete);
  // площадка-перегрузчик: тёмная плита, зелёная кромка снаружи
  const plate0 = a0 + 0.35, plate1 = a1 - 0.35;
  box(plate0, plate1, 0, 0.025, -t / 2 - APRON + 0.05, t / 2 - 0.02, PALETTE.metalDark);
  box(plate0, plate1, 0.025, 0.035, -t / 2 - APRON + 0.05, -t / 2 - APRON + 0.11, PALETTE.wallAccent);
  // боковые упоры перегрузчика с зелёной вставкой
  for (const [b0, b1] of [[plate0 - 0.16, plate0 - 0.02], [plate1 + 0.02, plate1 + 0.16]]) {
    box(b0, b1, 0, 0.16, -t / 2 - APRON + 0.05, -t / 2 - 0.05, PALETTE.metalDark);
    box(b0 + 0.04, b1 - 0.04, 0.03, 0.13, -t / 2 - APRON + 0.04, -t / 2 - APRON + 0.05, PALETTE.wallAccent);
  }

  // тёмные стойки рамы по краям проёма, сверху колпак
  for (const [b0, b1] of [[a0, a0 + POST], [a1 - POST, a1]]) {
    box(b0, b1, 0, h, -t / 2 - 0.04, t / 2 + 0.04, PALETTE.metal);
    box(b0 - 0.02, b1 + 0.02, h, h + 0.04, -t / 2 - 0.06, t / 2 + 0.06, PALETTE.metalDark);
  }

  // зелёные столбики-отбойники: внутри у стоек и снаружи у левой стойки (как на образце)
  const bollard = (b: number, i: number) => {
    box(b - BOLLARD / 2, b + BOLLARD / 2, 0, BOLLARD_H, i - BOLLARD / 2, i + BOLLARD / 2, PALETTE.wallAccent);
    box(b - BOLLARD / 2 - 0.01, b + BOLLARD / 2 + 0.01, BOLLARD_H, BOLLARD_H + 0.03, i - BOLLARD / 2 - 0.01, i + BOLLARD / 2 + 0.01, PALETTE.wallAccentSeam);
  };
  bollard(a0 + POST + 0.12, t / 2 + 0.15);
  bollard(a1 - POST - 0.12, t / 2 + 0.15);
  bollard(a0 - 0.15, -t / 2 - 0.15);
  bollard(a1 + 0.15, -t / 2 - 0.15);

  return out;
}
