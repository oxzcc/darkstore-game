// Формы товаров в настоящих размерах (метры; низ — на y = 0, лицо — к +z): одна таблица на всю игру.
// Из неё строятся и крупная модель для игр на ТСД (ProductLowPoly — «Срок», «Штрихкод»),
// и товар на полках склада (productShapeParts → VoxelBatch; G1a, решение автора 07.11).
// Чистые данные и функции, без React.
import type { ProductLook, ProductShape } from '../../model/product';
import type { VoxelPart } from './ProductItem';

export type Part =
  | { kind: 'box'; pos: [number, number, number]; size: [number, number, number]; color: 'c' | 'a' }
  | { kind: 'cyl'; pos: [number, number, number]; r: number; r2?: number; h: number; color: 'c' | 'a' };

/** Модель формы: детали, габарит (ширина x, высота y, глубина z), круглая ли (тогда стороны — грани восьмиугольника),
 *  на какой высоте верх для наклейки и какого размера там место. */
export type ShapeModel = { parts: Part[]; w: number; h: number; d: number; round: boolean; topY: number; topSize: number };

export const SHAPES: Record<ProductShape, ShapeModel> = {
  carton: { w: 0.08, h: 0.2, d: 0.08, round: false, topY: 0.2, topSize: 0.06, parts: [
    { kind: 'box', pos: [0, 0.1, 0], size: [0.08, 0.2, 0.08], color: 'c' },
    { kind: 'box', pos: [0, 0.05, 0], size: [0.084, 0.012, 0.084], color: 'a' },
  ] },
  bottle: { w: 0.07, h: 0.215, d: 0.07, round: true, topY: 0.215, topSize: 0.034, parts: [
    { kind: 'cyl', pos: [0, 0.075, 0], r: 0.035, h: 0.15, color: 'c' },
    { kind: 'cyl', pos: [0, 0.035, 0], r: 0.0372, h: 0.03, color: 'a' },
    { kind: 'cyl', pos: [0, 0.165, 0], r: 0.018, r2: 0.035, h: 0.03, color: 'c' },
    { kind: 'cyl', pos: [0, 0.19, 0], r: 0.016, h: 0.02, color: 'c' },
    { kind: 'cyl', pos: [0, 0.2075, 0], r: 0.02, h: 0.015, color: 'a' },
  ] },
  loaf: { w: 0.16, h: 0.085, d: 0.09, round: false, topY: 0.085, topSize: 0.06, parts: [
    { kind: 'box', pos: [0, 0.035, 0], size: [0.16, 0.07, 0.09], color: 'c' },
    { kind: 'box', pos: [0, 0.0775, 0], size: [0.13, 0.015, 0.07], color: 'a' },
  ] },
  bunch: { w: 0.13, h: 0.14, d: 0.045, round: false, topY: 0.14, topSize: 0.035, parts: [
    { kind: 'box', pos: [-0.042, 0.06, 0], size: [0.038, 0.12, 0.04], color: 'c' },
    // средний банан вровень с боковыми: раньше он выступал вперёд и закрывал наклейку со штрихкодом (баг, найден автором 14.10)
    { kind: 'box', pos: [0, 0.065, 0], size: [0.04, 0.13, 0.04], color: 'c' },
    { kind: 'box', pos: [0.042, 0.06, 0], size: [0.038, 0.12, 0.04], color: 'c' },
    { kind: 'box', pos: [0, 0.135, 0], size: [0.02, 0.012, 0.02], color: 'a' },
  ] },
  cup: { w: 0.086, h: 0.092, d: 0.086, round: true, topY: 0.092, topSize: 0.06, parts: [
    { kind: 'cyl', pos: [0, 0.04, 0], r: 0.043, r2: 0.036, h: 0.08, color: 'c' },
    { kind: 'cyl', pos: [0, 0.086, 0], r: 0.045, h: 0.012, color: 'a' },
  ] },
  tray: { w: 0.12, h: 0.07, d: 0.09, round: false, topY: 0.07, topSize: 0.06, parts: [
    { kind: 'box', pos: [0, 0.025, 0], size: [0.12, 0.05, 0.09], color: 'c' },
    { kind: 'box', pos: [-0.03, 0.06, -0.022], size: [0.03, 0.02, 0.03], color: 'a' },
    { kind: 'box', pos: [0.03, 0.06, -0.022], size: [0.03, 0.02, 0.03], color: 'a' },
    { kind: 'box', pos: [-0.03, 0.06, 0.022], size: [0.03, 0.02, 0.03], color: 'a' },
    { kind: 'box', pos: [0.03, 0.06, 0.022], size: [0.03, 0.02, 0.03], color: 'a' },
  ] },
  wedge: { w: 0.1, h: 0.08, d: 0.09, round: false, topY: 0.08, topSize: 0.06, parts: [
    { kind: 'box', pos: [0, 0.008, 0], size: [0.1, 0.016, 0.09], color: 'a' },
    { kind: 'box', pos: [0, 0.048, 0], size: [0.1, 0.064, 0.09], color: 'c' },
  ] },
  pack: { w: 0.12, h: 0.17, d: 0.05, round: false, topY: 0.17, topSize: 0.04, parts: [
    { kind: 'box', pos: [0, 0.085, 0], size: [0.12, 0.17, 0.05], color: 'c' },
  ] },
  bag: { w: 0.11, h: 0.175, d: 0.05, round: false, topY: 0.175, topSize: 0.035, parts: [
    { kind: 'box', pos: [0, 0.08, 0], size: [0.11, 0.16, 0.05], color: 'c' },
    { kind: 'box', pos: [0, 0.1675, 0], size: [0.115, 0.015, 0.035], color: 'a' },
  ] },
  jar: { w: 0.094, h: 0.12, d: 0.094, round: true, topY: 0.12, topSize: 0.07, parts: [
    { kind: 'cyl', pos: [0, 0.05, 0], r: 0.045, h: 0.1, color: 'c' },
    { kind: 'cyl', pos: [0, 0.11, 0], r: 0.047, h: 0.02, color: 'a' },
  ] },
};

/** Габарит модели — для расстановки в лотке. */
export function lowPolySize(shape: ProductShape): { w: number; h: number; d: number } {
  const m = SHAPES[shape];
  return { w: m.w, h: m.h, d: m.d };
}

/**
 * Наклейка на лице товара для полок склада: где и какого размера (доли габарита). У игры на ТСД вместо неё —
 * полоса с названием (текстура), поэтому здесь только для форм, у которых без наклейки лицо пустое.
 * `face` — где лицо тела на высоте наклейки (м от центра; у круглых — грань многоугольника, она ближе радиуса).
 */
const R = Math.cos(Math.PI / 12); // от радиуса до грани у 12-гранника (ROUND_SEGMENTS)
const SHELF_LABEL: Partial<Record<ProductShape, { y: number; w: number; h: number; face: number }>> = {
  pack: { y: 0.55, w: 0.7, h: 0.32, face: 0.025 },
  bag:  { y: 0.5,  w: 0.6, h: 0.3,  face: 0.025 },
  jar:  { y: 0.45, w: 0.5, h: 0.4,  face: 0.045 * R },
  cup:  { y: 0.45, w: 0.45, h: 0.35, face: 0.0396 * R }, // стаканчик сужается книзу: радиус на высоте наклейки
};

/** Насколько наклейка выступает над лицом, м (в настоящих размерах). */
const LABEL_THICK = 0.003;
/** Сколько граней у круглых деталей на полках (VoxelBatch), одна грань смотрит прямо на +z. */
export const ROUND_SEGMENTS = 12;

/** Цвета мелких деталей: основной и акцент товара, они же светлее / темнее, белый. */
type DetailColor = 'c' | 'a' | 'cDark' | 'cLight' | 'aDark' | 'white';
type Detail =
  | { kind: 'box'; pos: [number, number, number]; size: [number, number, number]; color: DetailColor; rot?: [number, number, number] }
  | { kind: 'cyl'; pos: [number, number, number]; r: number; h: number; color: DetailColor };

/** Плашка на лице, вросшая в него на 1 мм (так грани не совпадают — правило W8). `face` — где лицо, `out` — сколько торчит. */
const onFace = (x: number, y: number, face: number, w: number, h: number, color: DetailColor, out = 0.003): Detail =>
  ({ kind: 'box', pos: [x, y, face + (out - 0.001) / 2], size: [w, h, out + 0.001], color });
/** То же поверх наклейки: наклейка торчит на 0,0024 м. */
const onLabel = (x: number, y: number, face: number, w: number, h: number, color: DetailColor) =>
  onFace(x, y, face + 0.0024, w, h, color, 0.0025);

/**
 * G1c: мелкие детали товара на полках — крышки, горлышки, узор на наклейках, дырки в сыре.
 * Только для полок: модель игр на ТСД (ProductLowPoly) остаётся прежней, у неё свои надписи-текстуры.
 * Размеры настоящие, в метрах, как в SHAPES.
 */
const SHELF_DETAILS: Partial<Record<ProductShape, Detail[]>> = {
  // пакет молока или сока: «крыша» с гребнем, крышечка, картинка на лице
  carton: [
    { kind: 'box', pos: [0, 0.207, 0], size: [0.084, 0.014, 0.014], color: 'cDark' },
    { kind: 'cyl', pos: [0.02, 0.205, 0.022], r: 0.009, h: 0.012, color: 'a' },
    onFace(0, 0.125, 0.04, 0.05, 0.05, 'aDark'),
    onFace(0, 0.125, 0.0425, 0.03, 0.03, 'white'),
  ],
  // бутылка воды: широкая белая этикетка с полосой
  bottle: [
    { kind: 'cyl', pos: [0, 0.1, 0], r: 0.0372, h: 0.05, color: 'white' },
    { kind: 'cyl', pos: [0, 0.1, 0], r: 0.0385, h: 0.012, color: 'a' },
  ],
  // хлеб: надрезы на корке
  loaf: [-0.04, 0, 0.04].map((x): Detail => (
    { kind: 'box', pos: [x, 0.086, 0], size: [0.012, 0.004, 0.06], color: 'cDark', rot: [0, 0.5, 0] }
  )),
  // бананы: тёмные кончики снизу
  bunch: [-0.042, 0, 0.042].map((x): Detail => (
    { kind: 'box', pos: [x, 0.004, 0], size: [0.016, 0.01, 0.016], color: 'aDark' }
  )),
  // йогурт: язычок фольги и ягода на наклейке
  cup: [
    { kind: 'box', pos: [0.028, 0.093, 0.04], size: [0.02, 0.004, 0.016], color: 'white' },
    onLabel(0, 0.0414, 0.0396 * R, 0.014, 0.014, 'cDark'),
  ],
  // яйца: белая полоска-наклейка на лотке
  tray: [onFace(0, 0.025, 0.045, 0.08, 0.02, 'white')],
  // сыр: дырки на лице и сверху
  wedge: [
    onFace(-0.028, 0.035, 0.045, 0.014, 0.014, 'aDark', 0.002),
    onFace(0.02, 0.055, 0.045, 0.018, 0.018, 'aDark', 0.002),
    onFace(0.03, 0.028, 0.045, 0.01, 0.01, 'aDark', 0.002),
    { kind: 'box', pos: [-0.015, 0.0805, 0.01], size: [0.016, 0.002, 0.016], color: 'aDark' },
    { kind: 'box', pos: [0.025, 0.0805, -0.02], size: [0.012, 0.002, 0.012], color: 'aDark' },
  ],
  // печенье, макароны: тёмная полоса клапана сверху, «окошко» с товаром на наклейке
  pack: [
    { kind: 'box', pos: [0, 0.162, 0], size: [0.124, 0.012, 0.054], color: 'cDark' },
    onLabel(0, 0.0935, 0.025, 0.05, 0.03, 'cLight'),
  ],
  // чипсы: шов снизу, «чипс» ромбом на наклейке
  bag: [
    { kind: 'box', pos: [0, 0.006, 0], size: [0.115, 0.012, 0.035], color: 'a' },
    { ...(onLabel(0, 0.0875, 0.025, 0.026, 0.026, 'cDark') as Extract<Detail, { kind: 'box' }>), rot: [0, 0, Math.PI / 4] },
  ],
  // кофе: тёмная полоса на наклейке и рифлёный край крышки
  jar: [
    onLabel(0, 0.054, 0.045 * R, 0.043, 0.01, 'c'),
    { kind: 'cyl', pos: [0, 0.11, 0], r: 0.0485, h: 0.008, color: 'aDark' },
  ],
};

/** Смешать цвет с белым (t > 0) или чёрным (t < 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (v: number) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/**
 * Товар для VoxelBatch: детали формы, увеличенные в `scale` раз, в координатах товара
 * (x — вдоль полки, y — вверх от доски, z — к лицу). Круглые детали — цилиндры (`VoxelPart.cyl`).
 */
export function productShapeParts(look: ProductLook, scale: number): VoxelPart[] {
  const m = SHAPES[look.shape];
  const colors: Record<DetailColor, string> = {
    c: look.color,
    a: look.accent,
    cDark: shade(look.color, -0.22),
    cLight: shade(look.color, 0.45),
    aDark: shade(look.accent, -0.3),
    white: '#FBFAF6',
  };
  const s = scale;
  const cylPart = (p: { pos: [number, number, number]; r: number; r2?: number; h: number }, color: string): VoxelPart => {
    const top = p.r;
    const bottom = p.r2 ?? p.r;
    const r = Math.max(top, bottom);
    return {
      pos: [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s],
      size: [2 * r * s, p.h * s, 2 * r * s],
      color,
      cyl: { top: top / r, bottom: bottom / r },
    };
  };
  const out: VoxelPart[] = m.parts.map((p): VoxelPart => (p.kind === 'box'
    ? { pos: [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s], size: [p.size[0] * s, p.size[1] * s, p.size[2] * s], color: colors[p.color] }
    : cylPart(p, colors[p.color])));
  const label = SHELF_LABEL[look.shape];
  if (label) {
    out.push({
      pos: [0, m.h * label.y * s, (label.face + LABEL_THICK * 0.3) * s],
      size: [m.w * label.w * s, m.h * label.h * s, LABEL_THICK * s],
      color: look.accent,
    });
  }
  for (const d of SHELF_DETAILS[look.shape] ?? []) {
    if (d.kind === 'cyl') {
      out.push(cylPart(d, colors[d.color]));
    } else {
      out.push({
        pos: [d.pos[0] * s, d.pos[1] * s, d.pos[2] * s],
        size: [d.size[0] * s, d.size[1] * s, d.size[2] * s],
        color: colors[d.color],
        ...(d.rot ? { rot: d.rot } : {}),
      });
    }
  }
  return out;
}
