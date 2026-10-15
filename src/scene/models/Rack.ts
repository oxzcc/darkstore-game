// Стеллаж по art/reference/world_shelving_unit.png и концепт-рендеру «Даркстор: Moving Out-стиль» (W6; 08, раздел 0).
// Крупно и мягко: толстые тёмные стойки, верхняя рама, деревянные полки с металлической балкой спереди и сзади,
// поперечины на торцах и крест из двух планок на каждом торце. Без прорезей и «башмаков» — как в концепте.
// Все бруски толще 2 см, поэтому все скругляются (мягкие кубы). Полок — сколько в планировке (сейчас 3).
// Возвращает список брусков, а не компонент: стеллажей на складе много, все рисует один VoxelBatch (08, раздел 11).
// Высоты полок — из rackGeometry, товар стоит на них.
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import { RACK_BOARD, rackWidth, shelfY } from '../rackGeometry';
import type { VoxelPart } from './ProductItem';

const POST = 0.1;   // сечение стойки
const BEAM = 0.07;  // высота балок и верхней рамы
const BRACE = 0.04; // толщина планки креста на торце

/**
 * Бруски стеллажа в его собственных координатах: x — вдоль (по длине `length` клеток), y — вверх от пола,
 * z — поперёк (лицо и тыл одинаковые, поэтому сторона прохода не важна).
 */
export function rackParts(length: number, shelves: number): VoxelPart[] {
  const h = WAREHOUSE_VIEW.rackHeight;
  const d = WAREHOUSE_VIEW.rackDepth;
  const w = rackWidth(length);
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) => out.push({ pos, size, color, rot });

  const xs = [-w / 2 + POST / 2, w / 2 - POST / 2];
  const zs = [-d / 2 + POST / 2, d / 2 - POST / 2];
  const inner = w - 2 * POST; // длина между стойками
  const span = d - 2 * POST;  // ширина торца между стойками

  // стойки
  for (const x of xs) for (const z of zs) add([x, h / 2, z], [POST, h, POST], PALETTE.metal);

  // полки: деревянный настил, под ним балки спереди и сзади и поперечины на торцах
  for (let s = 1; s <= shelves; s++) {
    const y = shelfY(s, shelves);
    add([0, y, 0], [inner + 0.02, RACK_BOARD, d - 0.04], PALETTE.rackBoard);
    const beamY = y - RACK_BOARD / 2 - BEAM / 2 + 0.01;
    for (const z of zs) add([0, beamY, z], [inner, BEAM, POST * 0.7], PALETTE.metal);
    for (const x of xs) add([x, beamY, 0], [POST * 0.7, BEAM, span], PALETTE.metal);
  }

  // верхняя рама
  for (const z of zs) add([0, h - BEAM / 2, z], [w, BEAM, POST], PALETTE.metal);
  for (const x of xs) add([x, h - BEAM / 2, 0], [POST, BEAM, d], PALETTE.metal);

  // крест на каждом торце: от нижней полки до верхней, две наклонные планки
  const y0 = shelfY(1, shelves) + RACK_BOARD / 2;
  const y1 = shelfY(shelves, shelves) - RACK_BOARD / 2 - BEAM;
  const len = Math.hypot(span, y1 - y0);
  const tilt = Math.atan2(y1 - y0, span); // планка вдоль z, наклонённая вокруг оси x
  for (const x of xs) {
    const mid: VoxelPart['pos'] = [x, (y0 + y1) / 2, 0];
    add(mid, [BRACE, BRACE, len], PALETTE.metal, [-tilt, 0, 0]);
    add(mid, [BRACE, BRACE, len], PALETTE.metal, [tilt, 0, 0]);
  }
  return out;
}
