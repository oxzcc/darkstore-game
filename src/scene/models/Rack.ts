// Стеллаж по art/reference/world_shelving_unit.png (M9b1; 08, раздел 7: 1×2 клетки, 4 полки, без ячеек).
// Тёмные стойки с прорезями и «башмаками», крест-накрест на боковых рамах, балки под полками, светлый настил.
// Возвращает список кубиков, а не компонент: стеллажей на складе много, все рисует один VoxelBatch (08, раздел 11).
// Размеры деталей кратны вокселю 1/16 м (08, раздел 2). Высоты полок — из rackGeometry, товар стоит на них как раньше.
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import { RACK_BOARD, rackWidth, shelfY } from '../rackGeometry';
import type { VoxelPart } from './ProductItem';

const V = 1 / 16;         // один воксель, м
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

  // Крест-накрест на торцевых рамах между соседними полками: две диагонали «лесенкой» из вокселей.
  const span = d - 2 * POST; // ширина рамы между стойками
  for (const x of xs) {
    for (let s = 1; s < shelves; s++) {
      const y0 = shelfY(s, shelves) + RACK_BOARD / 2;
      const y1 = shelfY(s + 1, shelves) - RACK_BOARD / 2 - V;
      const steps = Math.max(2, Math.round(span / V));
      const dy = (y1 - y0) / steps;
      for (let i = 0; i < steps; i++) {
        const z = -span / 2 + (i + 0.5) * (span / steps);
        const yUp = y0 + (i + 0.5) * dy;
        const yDown = y1 - (i + 0.5) * dy;
        add([x, yUp, z], [V / 2, dy + V / 4, span / steps], PALETTE.metal);
        add([x, yDown, z], [V / 2, dy + V / 4, span / steps], PALETTE.metal);
      }
    }
  }

  return out;
}
