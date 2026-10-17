// Заготовки для рецептов сценок итога (V2b–V2e): типовые места, камеры и куски сцен, из которых собираются рецепты.
// Только данные. Из config/vignettes.ts берутся одни типы — поэтому файлы сцен можно подключать в vignettes.ts без круговой загрузки.
import type {
  VignetteActor, VignetteCamera, VignetteHold, VignetteIcon, VignetteMood, VignettePose, VignetteProp, VignetteRecipe, ShelfFill,
} from '../vignettes';

export type V3 = [number, number, number];

/** Фон за сценой итога — тёплый, как стена вдали (он же VIGNETTE.wallColor). */
export const SCENE_BG = '#E8E1CC';

/** Сбоку у стеллажа: стеллаж сзади, собака спереди справа. */
export const SIDE_CAMERA: VignetteCamera = { target: [0.1, 1.05, 0.2], azimuthDeg: 18, elevationDeg: 16, distance: 5.0, fovDeg: 28 };
/** Шире: две вещи рядом (два стеллажа, дверь и телефон, тележка и стеллаж). */
export const WIDE_CAMERA: VignetteCamera = { target: [0.1, 1.0, -0.2], azimuthDeg: 12, elevationDeg: 15, distance: 6.6, fovDeg: 30 };

/** Стеллаж на привычном месте — сзади по центру. */
export const RACK_AT: V3 = [-0.2, 0, -0.75];
export const rack = (top: ShelfFill = 'product', mid: ShelfFill = 'product', at: V3 = RACK_AT): VignetteProp => ({ kind: 'rack', at, top, mid });

/** Собака-сборщик; по умолчанию — перед стеллажом, чуть справа, повёрнута к камере. */
export const dog = (pose: VignettePose, mood: VignetteMood, hold: VignetteHold = null, at: V3 = [0.35, 0, 0.55], turn = 0.35): VignetteActor =>
  ({ at, turn, pose, mood, hold });

/** Значок над сценой; по умолчанию — справа сверху. */
export const icon = (symbol: VignetteIcon, at: V3 = [1.35, 2.05, 0.1]): VignetteProp => ({ kind: 'icon', at, symbol });

export const scene = (d: VignetteActor, props: VignetteProp[], camera: VignetteCamera = SIDE_CAMERA): VignetteRecipe =>
  ({ dog: d, props, camera, background: SCENE_BG });

/** Товар и коробка рассыпались по полу перед стеллажом. */
export const floorMess = (): VignetteProp[] => [
  { kind: 'box', at: [-0.95, 0.2, 0.55], rot: [0, 0.5, 1.2], open: true },
  { kind: 'product', at: [-0.45, 0.1, 0.95], rot: [Math.PI / 2, 0, 0.4] },
  { kind: 'product', at: [-0.05, 0.1, 1.25], rot: [Math.PI / 2, 0, -0.9] },
  { kind: 'product', at: [1.1, 0.1, 1.05], rot: [Math.PI / 2, 0, 1.6] },
  { kind: 'product', at: [-1.4, 0, 1.0], rot: [0, 0.4, 0] },
];

/** Коробки, аккуратно снятые с полки и составленные на полу слева. */
export const boxesAside = (): VignetteProp[] => [
  { kind: 'box', at: [-1.35, 0, 0.35] },
  { kind: 'box', at: [-1.35, 0.38, 0.35], rot: [0, 0.1, 0] },
  { kind: 'box', at: [-0.8, 0, 0.6], rot: [0, -0.15, 0] },
];

/** Коробки свалились вкривь. */
export const boxesFallen = (): VignetteProp[] => [
  { kind: 'box', at: [-0.9, 0.2, 0.5], rot: [0, 0.6, 1.25] },
  { kind: 'box', at: [-1.45, 0, 0.9], rot: [0, -0.5, 0] },
  { kind: 'box', at: [-0.3, 0.2, 1.05], rot: [1.2, 0.3, 0], dented: true },
];

/**
 * Клиент без лица (решение 17.10): дверь, пакет на коврике и телефон с реакцией. Собака стоит рядом.
 * `pose`, `mood` — как собака относится к итогу.
 */
export const customer = (reaction: 'good' | 'bad', pose: VignettePose, mood: VignetteMood, extra: VignetteProp[] = []): VignetteRecipe =>
  scene(dog(pose, mood, null, [0.25, 0, 0.45], 0.2), [
    { kind: 'door', at: [-1.45, 0, -0.9] },
    { kind: 'bag', at: [-1.25, 0, -0.25], turn: 0.3 },
    { kind: 'phone', at: [1.25, 1.35, 0.1], turn: -0.15, reaction },
    ...extra,
  ], WIDE_CAMERA);

/** Стол фасовки с пакетом заказа. */
export const packing = (): VignetteProp[] => [
  { kind: 'table', at: [-0.45, 0, -0.6] },
  { kind: 'bag', at: [-0.85, 0.85, -0.6], turn: 0.3 },
];

/** Второй стеллаж правее — «соседняя полка». */
export const NEIGHBOR_AT: V3 = [1.85, 0, -0.75];
