// Стеллаж по art/reference/world_shelving_unit.png (M9b1; 08, раздел 7: 1×2 клетки, 4 полки, без ячеек).
// Тёмные стойки с прорезями и «башмаками», крест-накрест на боковых рамах, балки под полками, светлый настил.
// Стиль — low poly из брусков (решение автора 15.10): детали могут стоять под наклоном (крест на торцах).
// Возвращает список брусков, а не компонент: стеллажей на складе много, все рисует один VoxelBatch (08, раздел 11).
// Толщины деталей — от шага 1/16 м. Высоты полок — из rackGeometry, товар стоит на них как раньше.
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import { RACK_BOARD, rackWidth, shelfY } from '../rackGeometry';
import type { VoxelPart } from './ProductItem';

const V = 1 / 16;         // шаг размеров деталей, м
const POST = V;           // сечение стойки
const FOOT = 2 * V;       // «башмак» под стойкой
const SLOT_STEP = 2 * V;  // шаг прорезей на стойке

/**
 * Кубики стеллажа в его собственных координатах: x — вдоль (по длине `length` клеток), y — вверх от пола,
 * z — поперёк (лицо и тыл одинаковые, поэтому сторона прохода не важна).
 */
export function rackParts(length: number, shelves: number): VoxelPart[] {
  const h = WAREHOUSE_VIEW.rackHeight;
  const d = WAREHOUSE_VIEW.rackDepth;
  const w = rackWidth(length);
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string) => out.push({ pos, size, color });

  const xs = [-w / 2 + POST / 2, w / 2 - POST / 2];
  const zs = [-d / 2 + POST / 2, d / 2 - POST / 2];

  // Стойки: тёмный брусок, сверху выступает над верхней полкой, внизу «башмак»,
  // на наружных гранях — прорези (тёмные квадратики) по всей высоте.
  for (const x of xs) {
    for (const z of zs) {
      add([x, h / 2, z], [POST, h, POST], PALETTE.metal);
      add([x, V / 2, z], [FOOT, V, FOOT], PALETTE.metalDark);
      const sx = Math.sign(x);
      const sz = Math.sign(z);
      for (let y = FOOT + V; y < h - V; y += SLOT_STEP) {
        add([x, y, z + sz * (POST / 2)], [V / 3, V / 2, 0.004], PALETTE.metalDark);       // прорезь на лице
        add([x + sx * (POST / 2), y, z], [0.004, V / 2, V / 3], PALETTE.metalDark);       // прорезь на боку
      }
    }
  }

  // Полки: светлый настил между стойками и металлические балки под ним спереди и сзади.
  const boardW = w - 2 * POST;
  for (let s = 1; s <= shelves; s++) {
    const y = shelfY(s, shelves);
    add([0, y, 0], [boardW, RACK_BOARD, d - V / 2], PALETTE.rackBoard);
    const beamY = y - RACK_BOARD / 2 - V / 2;
    for (const z of zs) add([0, beamY, z], [boardW, V, V / 2], PALETTE.metal);
    // поперечины на торцах под полкой
    for (const x of xs) add([x, beamY, 0], [V / 2, V, d - 2 * POST], PALETTE.metal);
  }

  // Крест-накрест на торцевых рамах между соседними полками: две наклонные планки на каждый пролёт.
  const span = d - 2 * POST; // ширина рамы между стойками
  for (const x of xs) {
    for (let s = 1; s < shelves; s++) {
      const y0 = shelfY(s, shelves) + RACK_BOARD / 2;
      const y1 = shelfY(s + 1, shelves) - RACK_BOARD / 2 - V;
      const len = Math.hypot(span, y1 - y0);
      const tilt = Math.atan2(y1 - y0, span); // планка вдоль z, наклонённая вокруг оси x
      const mid: VoxelPart['pos'] = [x, (y0 + y1) / 2, 0];
      out.push({ pos: mid, size: [V / 2, V * 0.75, len], color: PALETTE.metal, rot: [-tilt, 0, 0] });
      out.push({ pos: mid, size: [V / 2, V * 0.75, len], color: PALETTE.metal, rot: [tilt, 0, 0] });
    }
  }

  return out;
}
