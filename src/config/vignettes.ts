// Иллюстрации-сценки (прототип, решение автора 16.10: вариант «живые 3D-сценки из моделей игры» вместо картинок).
// Только отображение: правила это не читают. Сцена — «рецепт»: где стоит собака, какая у неё поза и эмоция,
// какой реквизит вокруг и откуда смотрит камера. Порода берётся от сборщика, товар — от позиции задания,
// поэтому одна строка рецепта годится для всех сборщиков и любого товара.
// Пока сделано: портрет в окне развилки и две сцены итога у ситуации «Тяжёлое наверху» (сборка).
// Ключ сцены итога: «ситуация.вариант.ok|bad» (vignetteKey); нет рецепта — в окне остаётся заглушка.

type V3 = [number, number, number];

/** Эмоция на морде: зовёт (брови домиком), доволен, «ой». */
export type VignetteMood = 'call' | 'happy' | 'oops';

/** Поза собаки в сценке: машет и держит ТСД; держится за голову; несёт перед собой; радуется. */
export type VignettePose = 'call' | 'oops' | 'carry' | 'cheer';

/** Что у собаки в лапах: ТСД, товар задания (в коробке) или ничего. */
export type VignetteHold = 'tsd' | 'productBox' | null;

/** Реквизит. Координаты — метры, пол на y = 0, камера обычно со стороны +z. */
export type VignetteProp =
  /** стеллаж (длина 2 клетки, 3 полки); на полках товар задания; `gapTop` — на верхней полке пустое место посередине */
  | { kind: 'rack'; at: V3; turn?: number; gapTop?: boolean }
  /** стремянка */
  | { kind: 'ladder'; at: V3; turn?: number }
  /** одна штука товара задания; `rot` — наклон (x, y, z), чтобы штука лежала на боку */
  | { kind: 'product'; at: V3; rot?: V3; size?: number }
  /** картонная коробка; `open` — без крышки (вскрытая), `rot` — наклон */
  | { kind: 'box'; at: V3; rot?: V3; open?: boolean };

export type VignetteCamera = {
  target: V3;          // куда смотрит
  azimuthDeg: number;  // с какой стороны: 0 — прямо спереди (+z), плюс — правее
  elevationDeg: number;
  distance: number;    // м от цели
  fovDeg: number;
};

export type VignetteRecipe = {
  dog: { at: V3; turn: number; pose: VignettePose; mood: VignetteMood; hold: VignetteHold };
  props: VignetteProp[];
  camera: VignetteCamera;
  background: string | null; // цвет фона; null — прозрачный (портрет на подложке окна)
};

export const VIGNETTE = {
  floorColor: '#DED8C0',   // как пол склада (PALETTE.floor)
  wallColor: '#E8E1CC',    // фон за сценой итога — тёплый, как стена вдали
  sweat: '#7FD3FF',        // капля пота у «ой»
  brow: '#3A2F2A',
  mouth: '#3A2F2A',
};

/** Портрет в окне развилки: собака по пояс машет лапой, в другой ТСД. */
export const PORTRAIT: VignetteRecipe = {
  dog: { at: [0, 0, 0], turn: 0.25, pose: 'call', mood: 'call', hold: 'tsd' },
  props: [],
  camera: { target: [0, 1.42, 0], azimuthDeg: 14, elevationDeg: 6, distance: 3.3, fovDeg: 30 },
  background: null,
};

const SIDE_CAMERA: VignetteCamera = { target: [0.1, 1.05, 0.2], azimuthDeg: 18, elevationDeg: 16, distance: 5.0, fovDeg: 28 };

/** Сцены итога развилки. Ключ — vignetteKey(ситуация, вариант, сработало ли). */
export const RESULT_VIGNETTES: Record<string, VignetteRecipe> = {
  // «Тяжёлое наверху» → «Снять одному» → не сработало: упаковка выскользнула, товар раскатился по полу
  'heavy.alone.bad': {
    dog: { at: [0.35, 0, 0.55], turn: 0.35, pose: 'oops', mood: 'oops', hold: null },
    props: [
      { kind: 'rack', at: [-0.2, 0, -0.75], gapTop: true },
      { kind: 'box', at: [-0.95, 0.2, 0.55], rot: [0, 0.5, 1.2], open: true },
      { kind: 'product', at: [-0.45, 0.1, 0.95], rot: [Math.PI / 2, 0, 0.4] },
      { kind: 'product', at: [-0.05, 0.1, 1.25], rot: [Math.PI / 2, 0, -0.9] },
      { kind: 'product', at: [1.1, 0.1, 1.05], rot: [Math.PI / 2, 0, 1.6] },
      { kind: 'product', at: [-1.4, 0, 1.0], rot: [0, 0.4, 0] },
      { kind: 'product', at: [1.45, 0.1, 0.35], rot: [Math.PI / 2, 0, 0.2] },
    ],
    camera: SIDE_CAMERA,
    background: VIGNETTE.wallColor,
  },
  // «Тяжёлое наверху» → «Взять стремянку» → сработало: стремянка у стеллажа, собака довольно несёт упаковку
  'heavy.ladder.ok': {
    dog: { at: [0.75, 0, 0.6], turn: -0.25, pose: 'carry', mood: 'happy', hold: 'productBox' },
    props: [
      { kind: 'rack', at: [-0.2, 0, -0.75], gapTop: true },
      { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.15 },
    ],
    camera: SIDE_CAMERA,
    background: VIGNETTE.wallColor,
  },
};

export const vignetteKey = (situationId: string, optionId: string, worked: boolean) =>
  `${situationId}.${optionId}.${worked ? 'ok' : 'bad'}`;

/** Рецепт сцены итога или null, если её ещё нет (тогда в окне заглушка). */
export function resultVignette(situationId: string, optionId: string, worked: boolean): VignetteRecipe | null {
  return RESULT_VIGNETTES[vignetteKey(situationId, optionId, worked)] ?? null;
}
