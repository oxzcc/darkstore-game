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
 */
const SHELF_LABEL: Partial<Record<ProductShape, { y: number; w: number; h: number }>> = {
  pack: { y: 0.55, w: 0.7, h: 0.32 },
  bag:  { y: 0.5,  w: 0.6, h: 0.3 },
  jar:  { y: 0.45, w: 0.5, h: 0.4 },
  cup:  { y: 0.45, w: 0.45, h: 0.35 },
};

/** Насколько наклейка выступает над лицом, м (в настоящих размерах). */
const LABEL_THICK = 0.003;
/** Сколько граней у круглых деталей на полках (VoxelBatch), одна грань смотрит прямо на +z. */
export const ROUND_SEGMENTS = 12;

/**
 * Товар для VoxelBatch: детали формы, увеличенные в `scale` раз, в координатах товара
 * (x — вдоль полки, y — вверх от доски, z — к лицу). Круглые детали — цилиндры (`VoxelPart.cyl`).
 */
export function productShapeParts(look: ProductLook, scale: number): VoxelPart[] {
  const m = SHAPES[look.shape];
  const color = (c: 'c' | 'a') => (c === 'c' ? look.color : look.accent);
  const s = scale;
  const out: VoxelPart[] = m.parts.map((p): VoxelPart => {
    if (p.kind === 'box') {
      return { pos: [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s], size: [p.size[0] * s, p.size[1] * s, p.size[2] * s], color: color(p.color) };
    }
    const top = p.r;
    const bottom = p.r2 ?? p.r;
    const r = Math.max(top, bottom);
    return {
      pos: [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s],
      size: [2 * r * s, p.h * s, 2 * r * s],
      color: color(p.color),
      cyl: { top: top / r, bottom: bottom / r },
    };
  });
  const label = SHELF_LABEL[look.shape];
  if (label) {
    // лицо круглой формы — грань многоугольника, она ближе к центру, чем радиус
    const face = m.round ? (m.d / 2) * Math.cos(Math.PI / ROUND_SEGMENTS) : m.d / 2;
    out.push({
      pos: [0, m.h * label.y * s, (face + LABEL_THICK * 0.3) * s],
      size: [m.w * label.w * s, m.h * label.h * s, LABEL_THICK * s],
      color: look.accent,
    });
  }
  return out;
}
