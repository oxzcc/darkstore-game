// Стремянка-«домик» для сценок-иллюстраций (config/vignettes.ts): две пары наклонных опор, зелёные ступени спереди
// и площадка сверху. Координаты: y — вверх от пола, +z — лицо (ступени), x — поперёк.
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const H = 1.3;      // высота площадки
const SPREAD = 0.38; // насколько разъезжаются опоры внизу (от центра вперёд и назад)
const W = 0.5;      // ширина
const RAIL = 0.06;

export function ladderParts(): VoxelPart[] {
  const out: VoxelPart[] = [];
  const len = Math.hypot(SPREAD, H);
  const tilt = Math.atan2(SPREAD, H);
  for (const x of [-W / 2 + RAIL / 2, W / 2 - RAIL / 2]) {
    // передняя опора: низ спереди (+z), верх у центра — наклон «верхом назад»
    out.push({ pos: [x, H / 2, SPREAD / 2], size: [RAIL, len, RAIL], color: PALETTE.ladder, rot: [-tilt, 0, 0] });
    // задняя опора: низ сзади
    out.push({ pos: [x, H / 2, -SPREAD / 2], size: [RAIL, len, RAIL], color: PALETTE.ladder, rot: [tilt, 0, 0] });
  }
  // ступени спереди: на высоте h опора стоит на z = SPREAD · (1 − h / H); ступень чуть шире опор, чтобы грани не совпадали
  for (const h of [0.33, 0.66, 0.99]) {
    out.push({ pos: [0, h, SPREAD * (1 - h / H) + 0.04], size: [W + 0.04, 0.05, 0.16], color: PALETTE.uniform });
  }
  // площадка сверху
  out.push({ pos: [0, H + 0.03, 0], size: [W + 0.06, 0.06, 0.3], color: PALETTE.uniform });
  return out;
}
