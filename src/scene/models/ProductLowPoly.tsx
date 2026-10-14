// Товар крупно — low poly модель для «Срока» (решение автора 14.10: полноценный 3D-объект, который можно свободно крутить).
// Форма по товару (config/products.ts → look.shape), размеры примерно настоящие, в метрах; низ модели — на y = 0.
// На передней стороне — полоса с названием, на стороне `side` — наклейка «Годен до» (0 перед, 1 право, 2 зад, 3 лево, 4 верх, 5 низ).
// Пока штука лежит в лотке, на наклейке нет даты (showDate = false) — прочитать срок можно, только взяв её в руки.
// Заглушка до настоящих ассетов (M9): детализацию товаров автор решает позже.
import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ProductLook, ProductShape } from '../../model/product';

type Part =
  | { kind: 'box'; pos: [number, number, number]; size: [number, number, number]; color: 'c' | 'a' }
  | { kind: 'cyl'; pos: [number, number, number]; r: number; r2?: number; h: number; color: 'c' | 'a' };

/** Модель формы: детали, габарит (ширина x, высота y, глубина z), круглая ли (тогда стороны — грани восьмиугольника),
 *  на какой высоте верх для наклейки и какого размера там место. */
type ShapeModel = { parts: Part[]; w: number; h: number; d: number; round: boolean; topY: number; topSize: number };

const SHAPES: Record<ProductShape, ShapeModel> = {
  carton: { w: 0.08, h: 0.2, d: 0.08, round: false, topY: 0.2, topSize: 0.06, parts: [
    { kind: 'box', pos: [0, 0.1, 0], size: [0.08, 0.2, 0.08], color: 'c' },
    { kind: 'box', pos: [0, 0.05, 0], size: [0.0805, 0.012, 0.0805], color: 'a' },
  ] },
  bottle: { w: 0.07, h: 0.215, d: 0.07, round: true, topY: 0.215, topSize: 0.034, parts: [
    { kind: 'cyl', pos: [0, 0.075, 0], r: 0.035, h: 0.15, color: 'c' },
    { kind: 'cyl', pos: [0, 0.035, 0], r: 0.0355, h: 0.03, color: 'a' },
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

// ---------- надписи: рисуются на холсте и становятся текстурой (одна на текст, переиспользуется) ----------

const textures = new Map<string, CanvasTexture>();

function texture(key: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): CanvasTexture {
  const hit = textures.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  textures.set(key, t);
  return t;
}

const FONT = "'X5 Sans', system-ui, sans-serif";

/** Наклейка «Годен до 16.10»; без даты — пустые строчки (в лотке срок не прочитать). */
function stickerTexture(date: string | null): CanvasTexture {
  return texture(`sticker:${date ?? '-'}`, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#9AA3B0';
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#8C8270';
    ctx.textAlign = 'center';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('ГОДЕН ДО', w / 2, 52);
    if (date) {
      ctx.fillStyle = '#3A342A';
      ctx.font = `700 72px ${FONT}`;
      ctx.fillText(date, w / 2, 128);
    } else {
      ctx.fillStyle = '#D9DDE3';
      ctx.fillRect(w * 0.22, 88, w * 0.56, 22);
    }
  }, 256, 160);
}

/**
 * Наклейка со штрихкодом (N4): полосы по цифрам кода, под ними 13 цифр; середина затёрта — пятно, царапины и потёртости
 * поверх цифр hiddenFrom…hiddenFrom + hiddenCount − 1 и полос над ними (решение автора 14.10).
 */
function barcodeTexture(code: number[], hiddenFrom: number, hiddenCount: number): CanvasTexture {
  return texture(`barcode:${code.join('')}:${hiddenFrom}:${hiddenCount}`, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const pad = 16;
    const step = (w - pad * 2) / code.length;
    // полосы: у каждой цифры свой рисунок из 4 полос разной толщины
    ctx.fillStyle = '#1E1E1E';
    code.forEach((d, i) => {
      let x = pad + i * step;
      for (let k = 0; k < 4; k++) {
        const bw = 1.5 + ((d * 7 + k * 3 + i) % 3) * 1.5;
        const gap = 1.5 + ((d + k * 5 + i * 2) % 3) * 1.2;
        if (x + bw > pad + (i + 1) * step) break;
        ctx.fillRect(x, 14, bw, 118);
        x += bw + gap;
      }
    });
    // цифры
    ctx.fillStyle = '#1E1E1E';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.floor(step * 1.25)}px ${FONT}`;
    code.forEach((d, i) => ctx.fillText(String(d), pad + (i + 0.5) * step, 176));
    // затёртость: пятно и царапины поверх стёртых цифр и полос над ними
    const x0 = pad + hiddenFrom * step - 6;
    const x1 = pad + (hiddenFrom + hiddenCount) * step + 6;
    let seed = code.reduce((a, d) => a * 31 + d, 7) % 2147483647;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, 100, (x1 - x0) / 2, 92, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(232, 226, 214, 0.96)';
    ctx.fillRect(x0, 0, x1 - x0, h);
    for (let k = 0; k < 70; k++) { // царапины
      ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(170,162,148,0.55)';
      ctx.lineWidth = 1 + rnd() * 3;
      const x = x0 + rnd() * (x1 - x0);
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 14);
      ctx.stroke();
    }
    for (let k = 0; k < 14; k++) { // обрывки полос и цифр — чтобы было видно, что тут что-то было
      ctx.fillStyle = 'rgba(40,40,40,0.25)';
      ctx.fillRect(x0 + rnd() * (x1 - x0), 14 + rnd() * 150, 2 + rnd() * 3, 4 + rnd() * 14);
    }
    ctx.restore();
  }, 320, 200);
}

/** Полоса с названием товара на передней стороне. */
function brandTexture(name: string, bg: string): CanvasTexture {
  return texture(`brand:${name}:${bg}`, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `700 54px ${FONT}`;
    ctx.fillText(name.toUpperCase(), w / 2, 82, w - 20);
  }, 320, 120);
}

// ---------- модель ----------

/** Что на наклейке: срок годности («Срок»; без даты — пустая) или затёртый штрихкод («Штрихкод»). */
export type StickerSpec =
  | { kind: 'expiry'; date: string | null }
  | { kind: 'barcode'; code: number[]; hiddenFrom: number; hiddenCount: number };

type Props = {
  look: ProductLook;
  name: string;
  side: number;          // где наклейка
  sticker: StickerSpec;
};

/** Плоская наклейка на стороне: позиция, поворот, размер. */
function facePlacement(m: ShapeModel, side: number, size: number): { pos: [number, number, number]; rot: [number, number, number] } {
  const apothem = (r: number) => r * Math.cos(Math.PI / 8); // грань восьмиугольника ближе к центру, чем его радиус
  const hx = (m.round ? apothem(m.w / 2) : m.w / 2) + 0.0015;
  const hz = (m.round ? apothem(m.d / 2) : m.d / 2) + 0.0015;
  const y = size * 0.3125 + m.h * 0.06; // ниже полосы с названием
  switch (side) {
    case 0: return { pos: [0, y, hz], rot: [0, 0, 0] };
    case 1: return { pos: [hx, y, 0], rot: [0, Math.PI / 2, 0] };
    case 2: return { pos: [0, y, -hz], rot: [0, Math.PI, 0] };
    case 3: return { pos: [-hx, y, 0], rot: [0, -Math.PI / 2, 0] };
    case 4: return { pos: [0, m.topY + 0.0015, 0], rot: [-Math.PI / 2, 0, 0] };
    default: return { pos: [0, -0.0015, 0], rot: [Math.PI / 2, 0, 0] };
  }
}

export default function ProductLowPoly({ look, name, side, sticker: spec }: Props) {
  const m = SHAPES[look.shape];
  const sticker = spec.kind === 'expiry' ? stickerTexture(spec.date) : barcodeTexture(spec.code, spec.hiddenFrom, spec.hiddenCount);
  const brand = useMemo(() => brandTexture(name, look.accent), [name, look.accent]);

  // размер наклейки — по стороне, на которой она
  const faceW = side === 1 || side === 3 ? m.d : m.w;
  // штрихкод — поменьше (решение автора 14.10)
  const k = spec.kind === 'barcode' ? 0.72 : 0.82;
  const size = side >= 4 ? Math.min(m.topSize, m.w * 0.8, m.d * 0.8) : Math.min(faceW * k, 0.075, m.h * 0.64);
  const place = facePlacement(m, side, size);
  const brandZ = (m.round ? (m.d / 2) * Math.cos(Math.PI / 8) : m.d / 2) + 0.001;
  const color = (c: 'c' | 'a') => (c === 'c' ? look.color : look.accent);

  return (
    <group>
      {m.parts.map((p, i) =>
        p.kind === 'box' ? (
          <mesh key={i} position={p.pos}>
            <boxGeometry args={p.size} />
            <meshStandardMaterial color={color(p.color)} flatShading />
          </mesh>
        ) : (
          // восьмигранник, повёрнутый гранью к игроку — низкополигональный «цилиндр»
          <mesh key={i} position={p.pos} rotation={[0, Math.PI / 8, 0]}>
            <cylinderGeometry args={[p.r, p.r2 ?? p.r, p.h, 8]} />
            <meshStandardMaterial color={color(p.color)} flatShading />
          </mesh>
        ),
      )}
      {/* название — полоса на передней стороне чуть выше середины (наклейка спереди — ниже, не закрывает её) */}
      <mesh position={[0, m.h * 0.6, brandZ]}>
        <planeGeometry args={[m.w * 0.9, Math.min(m.h * 0.2, m.w * 0.34)]} />
        <meshBasicMaterial map={brand} />
      </mesh>
      {/* наклейка со сроком */}
      <mesh position={place.pos} rotation={place.rot}>
        <planeGeometry args={[size, size * 0.625]} />
        <meshBasicMaterial map={sticker} />
      </mesh>
    </group>
  );
}
