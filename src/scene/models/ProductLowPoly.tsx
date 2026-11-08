// Товар крупно — low poly модель для «Срока» (решение автора 14.10: полноценный 3D-объект, который можно свободно крутить).
// Форма по товару (config/products.ts → look.shape), размеры примерно настоящие, в метрах; низ модели — на y = 0.
// На передней стороне — полоса с названием, на стороне `side` — наклейка «Годен до» (0 перед, 1 право, 2 зад, 3 лево, 4 верх, 5 низ).
// Пока штука лежит в лотке, на наклейке нет даты (showDate = false) — прочитать срок можно, только взяв её в руки.
// Заглушка до настоящих ассетов (M9): детализацию товаров автор решает позже.
import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ProductLook } from '../../model/product';

import { SHAPES, type ShapeModel } from './productShapes';

export { lowPolySize } from './productShapes';

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
