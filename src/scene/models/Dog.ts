// Сборщик-собака по art/reference/character_picker_*.png (W7): зелёная кепка, зелёный фартук с белым бейджем,
// белая рубашка с короткими рукавами; окрас, уши, хвост и штаны — порода (DogLook в config/pickers.ts).
// Пропорции игрушечные: голова крупнее, чем на референсе (08, раздел 0). Рост ~1,6 м до верха кепки, стоячие уши — выше.
// Координаты: y — вверх от пола (0 — подошвы), +z — «вперёд» (куда смотрит морда), x — вбок.
//
// Модель разбита на части (голова, туловище, лапы, руки, хвост). У каждой своя точка поворота (`pivot`):
// бруски части заданы относительно неё, поэтому в W7b часть можно качать, просто поворачивая её группу.
import { PALETTE } from '../../config/palette';
import type { DogLook } from '../../config/pickers';
import type { VoxelPart } from './ProductItem';

export type DogPartName = 'body' | 'head' | 'legL' | 'legR' | 'armL' | 'armR' | 'tail';
export type DogRigPart = { pivot: [number, number, number]; parts: VoxelPart[] };
export type DogRig = Record<DogPartName, DogRigPart>;

const SHIRT = '#FAFAF6';
const BADGE = '#FFFFFF';
const EYE = '#1E1E22';
const TONGUE = '#F07A8A';

// Точки поворота, м (тело неподвижно: оно двигается всей фигуркой).
const HIP = 0.47;      // тазобедренный сустав
const SHOULDER = 0.9;  // плечо
const NECK = 0.97;     // шея
const PIVOTS: Record<DogPartName, [number, number, number]> = {
  body: [0, 0, 0],
  head: [0, NECK, 0],
  legL: [-0.11, HIP, 0],
  legR: [0.11, HIP, 0],
  armL: [-0.3, SHOULDER, 0],
  armR: [0.3, SHOULDER, 0],
  tail: [0, 0.58, -0.17],
};

type V3 = [number, number, number];

function part(name: DogPartName) {
  const pivot = PIVOTS[name];
  const parts: VoxelPart[] = [];
  /** Брусок в координатах всей собаки — пересчитывается относительно точки поворота части. */
  const add = (pos: V3, size: V3, color: string, rot?: V3) =>
    parts.push({ pos: [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]], size, color, rot });
  return { rig: { pivot, parts } as DogRigPart, add };
}

function body(look: DogLook) {
  const { rig, add } = part('body');
  add([0, 0.72, 0], [0.46, 0.5, 0.32], SHIRT);                  // рубашка
  add([0, 0.56, 0], [0.48, 0.18, 0.34], PALETTE.primary);       // низ фартука — вокруг пояса
  add([0, 0.74, 0.165], [0.36, 0.38, 0.03], PALETTE.primary);   // нагрудник фартука
  for (const x of [-0.14, 0.14]) add([x, 0.92, 0.1], [0.07, 0.04, 0.16], PALETTE.primary); // лямки через плечо
  add([0.08, 0.84, 0.185], [0.11, 0.04, 0.02], BADGE);          // бейдж
  add([0, 0.97, 0.03], [0.26, 0.06, 0.22], look.light);         // шея / грудка
  return rig;
}

function head(look: DogLook) {
  const { rig, add } = part('head');
  const front = 0.28; // передняя грань головы
  add([0, 1.23, 0], [0.58, 0.5, 0.54], look.fur);               // голова
  if (look.mask) add([0, 1.17, front + 0.005], [0.38, 0.3, 0.02], look.light); // светлая «маска» хаски
  add([0, 1.1, front + 0.07], [0.3, 0.2, 0.16], look.light);    // морда
  add([0, 1.17, front + 0.16], [0.11, 0.07, 0.04], look.nose);  // нос
  if (look.tongue) add([0.04, 0.99, front + 0.11], [0.08, 0.1, 0.04], TONGUE); // высунутый язык
  for (const x of [-0.13, 0.13]) add([x, 1.29, front + 0.02], [0.07, 0.09, 0.02], EYE); // глаза
  // уши
  for (const s of [-1, 1]) {
    if (look.ears === 'floppy') {
      add([s * 0.32, 1.19, -0.02], [0.08, 0.3, 0.22], look.ear);                   // висячее ухо сбоку
    } else {
      const big = look.ears === 'bigPointy';
      const [w, h] = big ? [0.17, 0.27] : [0.14, 0.21];
      const x = s * (big ? 0.21 : 0.19);
      const y = 1.48 + h / 2;
      add([x, y, -0.08], [w, h, 0.08], look.ear, [0, 0, -s * 0.12]);             // стоячее ухо, чуть врозь
      if (look.earInner) add([x, y - 0.02, -0.035], [w * 0.5, h * 0.6, 0.02], look.earInner, [0, 0, -s * 0.12]);
    }
  }
  // кепка: тулья и козырёк вперёд
  add([0, 1.53, -0.01], [0.6, 0.12, 0.54], PALETTE.primary);
  add([0, 1.49, front + 0.08], [0.44, 0.04, 0.2], PALETTE.primary);
  return rig;
}

function leg(look: DogLook, name: 'legL' | 'legR') {
  const { rig, add } = part(name);
  const x = PIVOTS[name][0];
  add([x, 0.27, 0], [0.17, 0.4, 0.2], look.legs);               // нога (штаны или шерсть)
  add([x, 0.05, 0.03], [0.19, 0.1, 0.27], look.feet);           // ботинок или светлая лапа
  return rig;
}

function arm(look: DogLook, name: 'armL' | 'armR') {
  const { rig, add } = part(name);
  const x = PIVOTS[name][0];
  add([x, 0.84, 0], [0.14, 0.16, 0.18], SHIRT);                 // короткий рукав
  add([x, 0.63, 0], [0.12, 0.27, 0.15], look.fur);              // лапа-рука
  add([x, 0.46, 0.01], [0.13, 0.09, 0.16], look.light);         // кисть
  return rig;
}

function tail(look: DogLook) {
  const { rig, add } = part('tail');
  const [, py, pz] = PIVOTS.tail;
  if (look.tail === 'straight') {
    add([0, py + 0.1, pz - 0.11], [0.09, 0.09, 0.3], look.fur, [0.7, 0, 0]);        // прямой, вверх-назад
  } else if (look.tail === 'fluffy') {
    add([0, py + 0.03, pz - 0.07], [0.18, 0.18, 0.15], look.fur);                   // пушистый короткий
    add([0, py + 0.03, pz - 0.18], [0.14, 0.14, 0.08], look.light);                 // светлый кончик
  } else {
    add([0, py + 0.2, pz - 0.15], [0.12, 0.36, 0.28], look.light);                  // бублик
    add([0, py + 0.2, pz - 0.15], [0.14, 0.15, 0.12], look.fur);                    // тёмная серединка видна сбоку
  }
  return rig;
}

/** Все части собаки этой породы (W7). */
export function dogRig(look: DogLook): DogRig {
  return {
    body: body(look),
    head: head(look),
    legL: leg(look, 'legL'),
    legR: leg(look, 'legR'),
    armL: arm(look, 'armL'),
    armR: arm(look, 'armR'),
    tail: tail(look),
  };
}

/** Поза рук, когда собака катит тележку: руки вперёд к ручке (поворот вокруг x, радианы). */
export const ARMS_ON_CART = -1.25;
