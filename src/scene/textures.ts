// Рисованные текстуры крупных поверхностей (W4; 08, раздел 0): рисуются кодом на холсте, без файлов.
// Все текстуры светлые и почти серые — это «узор» (пятна, швы, волокна). Цвет даёт материал из палитры:
// текстура умножается на цвет, поэтому палитра остаётся главной. Узор одинаковый при каждой загрузке (своё зерно).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { PALETTE } from '../config/palette';

/** Маленький генератор случайных чисел с зерном: узор не меняется от загрузки к загрузке. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grey = (v: number, a = 1) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`;

function make(px: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  draw(c.getContext('2d')!, seeded(seed));
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Пятно, повторённое у краёв, чтобы текстура стыковалась без шва. */
function blob(g: CanvasRenderingContext2D, px: number, x: number, y: number, rx: number, ry: number, rot: number) {
  for (const dx of [-px, 0, px]) for (const dy of [-px, 0, px]) {
    if (x + dx < -rx || x + dx > px + rx || y + dy < -rx || y + dy > px + rx) continue;
    g.beginPath();
    g.ellipse(x + dx, y + dy, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  }
}

const cache = new Map<string, CanvasTexture>();
function cached(key: string, build: () => CanvasTexture): CanvasTexture {
  let t = cache.get(key);
  if (!t) { t = build(); cache.set(key, t); }
  return t;
}

/** Метров на одно повторение текстуры (для repeat). */
export const TEXTURE_METERS = { grass: 12, tiles: 4, planks: 2 };

/** Трава: светлые и тёмные пятна, пучки травинок. */
export const grassTexture = () => cached('grass', () => make(1024, (g, rnd) => {
  const px = 1024;
  g.fillStyle = grey(0.93);
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = grey(0.86 + rnd() * 0.14, 0.55);
    const r = 30 + rnd() * 60;
    blob(g, px, rnd() * px, rnd() * px, r, r * (0.6 + rnd() * 0.4), rnd() * 3);
  }
  g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rnd() * px, y = rnd() * px;
    g.strokeStyle = rnd() < 0.5 ? grey(0.78) : grey(1);
    g.beginPath();
    g.moveTo(x - 5, y); g.lineTo(x - 2, y - 9);
    g.moveTo(x, y); g.lineTo(x + 1, y - 12);
    g.moveTo(x + 5, y); g.lineTo(x + 3, y - 8);
    g.stroke();
  }
}, 11));

/** Плитка пола: 4 × 4 плитки по 1 м, у каждой свой оттенок, затирка, блик сверху слева, тень снизу справа, потёртости. */
export const tilesTexture = () => cached('tiles', () => make(512, (g, rnd) => {
  const px = 512, s = px / 4;
  g.fillStyle = grey(0.86); // затирка
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * s, y = j * s;
    g.fillStyle = grey(0.95 + rnd() * 0.04);
    g.beginPath(); g.roundRect(x + 3, y + 3, s - 6, s - 6, 8); g.fill();
    g.lineWidth = 4;
    g.strokeStyle = grey(1, 0.9); // блик
    g.beginPath(); g.moveTo(x + 12, y + s - 14); g.lineTo(x + 12, y + 12); g.lineTo(x + s - 14, y + 12); g.stroke();
    g.strokeStyle = grey(0.85, 0.5); // тень
    g.beginPath(); g.moveTo(x + s - 8, y + 14); g.lineTo(x + s - 8, y + s - 8); g.lineTo(x + 14, y + s - 8); g.stroke();
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = grey(0.8 + rnd() * 0.1, 0.35); g.fillRect(rnd() * px, rnd() * px, 2, 2); }
  g.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = grey(0.4, 0.07);
    g.beginPath(); g.arc(rnd() * px, rnd() * px, 12 + rnd() * 24, rnd() * 3, rnd() * 3 + 1.5); g.stroke();
  }
}, 22));

/** Деревянный пол зоны отдыха: доски поперёк, со швами и сучками. */
export const planksTexture = () => cached('planks', () => make(256, (g, rnd) => {
  const px = 256, n = 4, h = px / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = grey(0.9 + rnd() * 0.1);
    g.fillRect(0, i * h, px, h);
    g.fillStyle = grey(0.6, 0.5);
    g.fillRect(0, i * h, px, 3);                       // шов между досками
    g.fillRect(Math.floor(rnd() * px), i * h, 3, h);   // торец доски
    for (let k = 0; k < 6; k++) {                      // волокна
      g.strokeStyle = grey(0.75, 0.25); g.lineWidth = 2;
      const y = i * h + 6 + rnd() * (h - 10);
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(px * 0.3, y + 3, px * 0.6, y - 3, px, y); g.stroke();
    }
  }
}, 33));

/** Дерево полок, паллет и брусков: волокна и пара сучков. */
export const woodTexture = () => cached('wood', () => make(256, (g, rnd) => {
  const px = 256;
  g.fillStyle = grey(0.97);
  g.fillRect(0, 0, px, px);
  for (let y = 4; y < px; y += 8 + rnd() * 8) {
    g.strokeStyle = rnd() < 0.5 ? grey(0.78, 0.45) : grey(1, 0.5);
    g.lineWidth = 2 + rnd() * 2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= px; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 3);
    g.stroke();
  }
  for (let i = 0; i < 3; i++) { g.fillStyle = grey(0.6, 0.45); g.beginPath(); g.ellipse(rnd() * px, rnd() * px, 7, 4, 0, 0, Math.PI * 2); g.fill(); }
}, 44));

/** Картон коробок: волокна, крапинки, лёгкие пятна. */
export const cardboardTexture = () => cached('cardboard', () => make(256, (g, rnd) => {
  const px = 256;
  g.fillStyle = grey(0.97);
  g.fillRect(0, 0, px, px);
  g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 120; i++) {
    const x = rnd() * px, y = rnd() * px, l = 20 + rnd() * 40;
    g.strokeStyle = grey(0.8, 0.3);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 6, x + l, y + (rnd() - 0.5) * 4); g.stroke();
  }
  for (let i = 0; i < 250; i++) { g.fillStyle = rnd() < 0.5 ? grey(0.75, 0.3) : grey(1, 0.4); g.fillRect(rnd() * px, rnd() * px, 2, 2); }
  for (let i = 0; i < 6; i++) { g.fillStyle = grey(0.7, 0.12); blob(g, px, rnd() * px, rnd() * px, 14 + rnd() * 10, 10, rnd()); }
}, 55));

/** Копия текстуры со своим повтором (картинка общая): `w`, `d` — размер поверхности в метрах. */
export function tiled(tex: Texture, w: number, d: number, meters: number): Texture {
  const t = tex.clone();
  t.repeat.set(w / meters, d / meters);
  t.needsUpdate = true;
  return t;
}

/** Какой узор у бруска такого цвета в VoxelBatch (дерево, картон); у остальных — без узора. */
export function textureForColor(color: string): Texture | null {
  switch (color) {
    case PALETTE.rackBoard:
    case PALETTE.palletWood:
    case PALETTE.wood:
      return woodTexture();
    case PALETTE.box:
      return cardboardTexture();
    default:
      return null;
  }
}
