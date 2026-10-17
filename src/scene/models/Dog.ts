// Сборщик-собака (W7). Размеры, пропорции и цвета — из концепт-рендера «Даркстор: Moving Out-стиль» (одобрен автором 16.10),
// окрасы пород — по art/reference/character_picker_*.png. Коренастый «чиби»: голова 0,78 × 0,66 м, туловище 0,64 м в ширину,
// рост ~1,9 м до верха кепки (стоячие уши — чуть выше). Форма: толстая зелёная кепка с пуговкой и козырьком, белая футболка
// с зелёным фартуком и бейджем, длинные белые рукава с зелёной манжетой, серые штаны, белые кроссовки с зелёной подошвой.
// Координаты: y — вверх от пола, +z — «вперёд» (куда смотрит морда), x — вбок.
//
// Модель разбита на части (голова, туловище, ноги, руки, хвост) — как в рендере. У каждой своя точка поворота (`pivot`):
// бруски части заданы относительно неё, поэтому в W7b часть можно качать, просто поворачивая её группу.
import { PALETTE } from '../../config/palette';
import type { DogLook } from '../../config/pickers';
import type { VoxelPart } from './ProductItem';

/** Форма: сборщик (фартук, белые рукава) или курьер (W8a, art/reference/character_courier_*.png: открытая зелёная куртка). */
export type DogOutfit = 'picker' | 'courier';

export type DogPartName = 'body' | 'head' | 'legL' | 'legR' | 'armL' | 'armR' | 'tail';
export type DogRigPart = { pivot: [number, number, number]; parts: VoxelPart[] };
export type DogRig = Record<DogPartName, DogRigPart>;

const WHITE = '#FFFFFF';
const EYE = '#241F1F';
const GREEN = PALETTE.uniform;

// Точки поворота, м — как группы в рендере.
const PIVOTS: Record<DogPartName, [number, number, number]> = {
  body: [0, 0.42, 0],     // туловище
  head: [0, 1.0, 0],      // шея
  legL: [-0.15, 0.45, 0], // бёдра
  legR: [0.15, 0.45, 0],
  armL: [-0.41, 0.92, 0], // плечи
  armR: [0.41, 0.92, 0],
  tail: [0, 0.62, -0.22],
};

type V3 = [number, number, number];

/**
 * Брусок «как в рендере»: ширина, высота, глубина, цвет; x, y — НИЗ бруска, z — относительно точки поворота части;
 * rotZ — наклон вокруг оси взгляда (уши).
 */
function builder() {
  const parts: VoxelPart[] = [];
  const rb = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, rotZ = 0) =>
    parts.push({ pos: [x, y + h / 2, z], size: [w, h, d], color, rot: rotZ ? [0, 0, rotZ] : undefined });
  return { parts, rb };
}

function torso(outfit: DogOutfit): VoxelPart[] {
  const { parts, rb } = builder();
  if (outfit === 'courier') {
    // как на character_courier_*.png: открытая зелёная куртка поверх белой футболки
    rb(0.62, 0.54, 0.4, WHITE, 0, 0.01, 0);     // футболка
    rb(0.68, 0.58, 0.3, GREEN, 0, 0, -0.07);    // куртка: спина и бока
    for (const s of [-1, 1]) rb(0.19, 0.58, 0.15, GREEN, s * 0.245, 0, 0.14); // полы куртки, между ними — футболка
    for (const s of [-1, 1]) rb(0.1, 0.1, 0.08, GREEN, s * 0.2, 0.5, 0.2);    // воротник
    return parts;
  }
  rb(0.64, 0.56, 0.42, WHITE, 0, 0, 0);       // футболка
  rb(0.56, 0.5, 0.08, GREEN, 0, 0, 0.2);      // фартук
  rb(0.2, 0.1, 0.04, WHITE, 0, 0.32, 0.24);   // бейдж
  return parts;
}

function leg(outfit: DogOutfit): VoxelPart[] {
  const { parts, rb } = builder();
  rb(0.22, 0.34, 0.24, PALETTE.pants, 0, -0.4, 0);   // штанина
  if (outfit === 'courier') {
    // у курьера наоборот: зелёный кроссовок с белой подошвой и белой полоской
    rb(0.26, 0.13, 0.36, GREEN, 0, -0.43, 0.05);
    rb(0.27, 0.05, 0.37, WHITE, 0, -0.47, 0.05);
    rb(0.14, 0.03, 0.02, WHITE, 0, -0.36, 0.235);
    return parts;
  }
  rb(0.26, 0.13, 0.36, WHITE, 0, -0.47, 0.05);       // кроссовок
  rb(0.27, 0.04, 0.37, GREEN, 0, -0.47, 0.05);       // зелёная подошва
  return parts;
}

function arm(look: DogLook, outfit: DogOutfit): VoxelPart[] {
  const { parts, rb } = builder();
  if (outfit === 'courier') {
    // короткий зелёный рукав куртки с белой полосой, дальше лапа
    rb(0.2, 0.3, 0.22, GREEN, 0, -0.32, 0);
    rb(0.21, 0.07, 0.23, WHITE, 0, -0.38, 0);
    rb(0.17, 0.3, 0.19, look.fur, 0, -0.66, 0);
    return parts;
  }
  rb(0.18, 0.4, 0.2, WHITE, 0, -0.42, 0);     // рукав
  rb(0.2, 0.08, 0.22, GREEN, 0, -0.5, 0);     // манжета
  rb(0.17, 0.15, 0.19, look.fur, 0, -0.66, 0); // кисть
  return parts;
}

function head(look: DogLook): VoxelPart[] {
  const { parts, rb } = builder();
  rb(0.78, 0.66, 0.7, look.fur, 0, 0, 0);                    // голова
  rb(0.5, 0.34, 0.08, look.face, 0, 0.02, 0.33);             // светлая «маска»
  if (look.patch) rb(0.2, 0.2, 0.05, look.patch, -0.17, 0.33, 0.35);
  rb(0.36, 0.24, 0.22, look.face, 0, 0.03, 0.42);            // морда
  rb(0.16, 0.09, 0.08, EYE, 0, 0.17, 0.53);                  // нос (верх ниже верха морды — грани не совпадают)
  for (const x of [-0.18, 0.18]) rb(0.09, 0.11, 0.04, EYE, x, 0.38, 0.36); // глаза
  rb(0.03, 0.035, 0.02, WHITE, -0.16, 0.45, 0.38);           // блики в глазах
  rb(0.03, 0.035, 0.02, WHITE, 0.2, 0.45, 0.38);
  for (const s of [-1, 1]) {
    if (look.ears === 'floppy') {
      rb(0.16, 0.38, 0.32, look.ear, s * 0.44, 0.2, -0.02, s * 0.15);              // висячие
    } else if (look.ears === 'tall') {
      rb(0.22, 0.36, 0.12, look.ear, s * 0.24, 0.62, -0.12, -s * 0.12);            // стоячие
      if (look.earInner) rb(0.12, 0.22, 0.04, look.earInner, s * 0.24, 0.68, -0.05, -s * 0.12);
    } else {
      rb(0.3, 0.42, 0.12, look.ear, s * 0.34, 0.58, -0.12, -s * 0.3);              // «летучая мышь»
      if (look.earInner) rb(0.16, 0.26, 0.04, look.earInner, s * 0.34, 0.63, -0.05, -s * 0.3);
    }
  }
  rb(0.82, 0.24, 0.76, GREEN, 0, 0.6, -0.02);                // кепка (чуть глубже головы, чтобы лоб не просвечивал)
  rb(0.66, 0.06, 0.34, GREEN, 0, 0.61, 0.48);                // козырёк
  rb(0.12, 0.06, 0.12, PALETTE.uniformDark, 0, 0.84, 0);     // пуговка
  return parts;
}

function tail(look: DogLook): VoxelPart[] {
  const { parts, rb } = builder();
  if (!look.tail) return parts;
  rb(0.2, 0.2, 0.32, look.tail[0], 0, 0, -0.15);
  rb(0.24, 0.22, 0.2, look.tail[1], 0, 0.08, -0.36);         // светлый кончик
  return parts;
}

/** Все части собаки этой породы (W7); `outfit` — форма сборщика или курьера (W8a). */
export function dogRig(look: DogLook, outfit: DogOutfit = 'picker'): DogRig {
  const at = (name: DogPartName, parts: VoxelPart[]) => ({ pivot: PIVOTS[name] as V3, parts });
  return {
    body: at('body', torso(outfit)),
    head: at('head', head(look)),
    legL: at('legL', leg(outfit)),
    legR: at('legR', leg(outfit)),
    armL: at('armL', arm(look, outfit)),
    armR: at('armR', arm(look, outfit)),
    tail: at('tail', tail(look)),
  };
}

/** Поза рук, когда собака катит тележку: руки вперёд к ручке (поворот вокруг x, радианы) — как в рендере. */
export const ARMS_ON_CART = -1.25;
/** Тележка стоит на столько метров впереди собаки — как в рендере. Собака идёт на это расстояние позади тележки по пути (pickerPose). */
export const CART_AHEAD = 0.8;
