// Иллюстрации-сценки (прототип, решение автора 16.10: вариант «живые 3D-сценки из моделей игры» вместо картинок).
// Только отображение: правила это не читают. Сцена — «рецепт»: где стоит собака, какая у неё поза и эмоция,
// какой реквизит вокруг и откуда смотрит камера. Порода берётся от сборщика, товар — от позиции задания,
// поэтому одна строка рецепта годится для всех сборщиков и любого товара.
// Сделано: портрет в окне развилки (V1); набор реквизита, поз и эмоций (V2a); сцены итога сборки (V2b), приёмки (V2c) и выкладки (V2d) — config/vignetteScenes/.
// Ключ сцены итога: «ситуация.вариант.ok|bad» (vignetteKey); нет рецепта — в окне остаётся заглушка.

import { BULLDOG, type DogLook } from './pickers';
import { SCENE_BG } from './vignetteScenes/kit';
import { ORDER_SCENES } from './vignetteScenes/order';
import { RECEIVING_SCENES } from './vignetteScenes/receiving';
import { PUTAWAY_SCENES } from './vignetteScenes/putaway';

type V3 = [number, number, number];

/** Эмоция на морде: зовёт (брови домиком), доволен, «ой», задумался, устал, сердится. */
export type VignetteMood = 'call' | 'happy' | 'oops' | 'think' | 'tired' | 'angry';

/**
 * Поза собаки (V2a). Все поднятые лапы — снаружи от головы (pickerAnim.raisedArmOut).
 * call — машет; oops — разводит лапами; carry — несёт перед собой; cheer — лапы вверх и прыгает;
 * idle — стоит; walk — идёт; reach — тянется лапой вверх к полке; kneel — сидит на полу у нижней полки;
 * push — толкает тележку; impatient — нетерпеливо ждёт (притопывает, лапы чуть в стороны); squeeze — протискивается боком;
 * think — лапа у морды; tired — сутулится; point — показывает лапой вперёд; compare — сравнивает две штуки в лапах.
 */
export type VignettePose =
  | 'call' | 'oops' | 'carry' | 'cheer'
  | 'idle' | 'walk' | 'reach' | 'kneel' | 'push' | 'impatient' | 'squeeze' | 'think' | 'tired' | 'point' | 'compare';

/**
 * Что в лапах: ТСД (левая лапа); коробка с товаром задания или закрытая коробка (перед собой, поза carry);
 * штука товара задания (правая лапа); по штуке в каждой лапе (поза compare); планшет с накладной (левая лапа).
 */
export type VignetteHold = 'tsd' | 'productBox' | 'box' | 'product' | 'twoProducts' | 'clipboard' | null;

/** Персонаж сценки: где стоит, куда повёрнут, поза, эмоция, что в лапах. */
export type VignetteActor = { at: V3; turn: number; pose: VignettePose; mood: VignetteMood; hold: VignetteHold };

/**
 * Что лежит на полке стеллажа: товар задания целиком; пусто; товар с пустым местом посередине; чужой товар;
 * товар задания у задней стенки, а спереди коробки; вперемешку свой и чужой.
 */
export type ShelfFill = 'product' | 'empty' | 'gap' | 'other' | 'deep' | 'messy';

/** Значок над сценой (на белой плашке): часы, вопрос, восклицание, галочка, крестик, звезда. */
export type VignetteIcon = 'clock' | 'question' | 'exclaim' | 'check' | 'cross' | 'star';

/** Реквизит. Координаты — метры, пол на y = 0, камера обычно со стороны +z; `turn` — поворот вокруг вертикали. */
export type VignetteProp =
  /** стеллаж (длина 2 клетки, 3 полки); нижняя полка — коробки, средняя и верхняя — по `mid` и `top` (по умолчанию товар задания) */
  | { kind: 'rack'; at: V3; turn?: number; top?: ShelfFill; mid?: ShelfFill }
  /** стремянка */
  | { kind: 'ladder'; at: V3; turn?: number }
  /** одна штука товара задания; `rot` — наклон (x, y, z), чтобы штука лежала на боку */
  | { kind: 'product'; at: V3; rot?: V3; size?: number }
  /** картонная коробка; `open` — без крышки, `dented` — мятая, `rot` — наклон */
  | { kind: 'box'; at: V3; rot?: V3; open?: boolean; dented?: boolean }
  /** тележка сборщика (ручка к −z); `full` — в корзине товар задания */
  | { kind: 'cart'; at: V3; turn?: number; full?: boolean }
  /** паллета с коробками (до 12) */
  | { kind: 'pallet'; at: V3; turn?: number; boxes: number }
  /** стол фасовки (лицо к −z) */
  | { kind: 'table'; at: V3; turn?: number }
  /** пакет заказа с товаром задания внутри */
  | { kind: 'bag'; at: V3; turn?: number }
  /** грузовик поставки (задний край — в `at`, длина по +z) */
  | { kind: 'truck'; at: V3; turn?: number }
  /** зона брака: штриховка, ограждение, красный контейнер; `full` — завалена коробками */
  | { kind: 'scrapZone'; at: V3; turn?: number; full?: boolean }
  /** дверь клиента: рама и приоткрытая створка (сам клиент без лица — его реакцию показывает `phone`) */
  | { kind: 'door'; at: V3; turn?: number }
  /** телефон клиента с реакцией на экране: доволен или недоволен */
  | { kind: 'phone'; at: V3; turn?: number; reaction: 'good' | 'bad' }
  /** значок на белой плашке (часы, вопрос и т. п.) */
  | { kind: 'icon'; at: V3; symbol: VignetteIcon; size?: number }
  /** другой персонаж: водитель поставки или другой сборщик (не тот, что в сценке) */
  | ({ kind: 'npc'; role: 'driver' | 'picker' } & VignetteActor);

export type VignetteCamera = {
  target: V3;          // куда смотрит
  azimuthDeg: number;  // с какой стороны: 0 — прямо спереди (+z), плюс — правее
  elevationDeg: number;
  distance: number;    // м от цели
  fovDeg: number;
};

/**
 * Задник сцены итога (правка автора 17.10): hall — стена склада со стеллажами и коробками; dock — та же стена с проёмом ворот
 * (сквозь него грузовик); home — у клиента: стена дома, окно, растение, деревянный пол. Портрету задник не нужен.
 */
export type VignetteBackdrop = 'hall' | 'dock' | 'home';

export type VignetteRecipe = {
  dog: VignetteActor;
  backdrop?: VignetteBackdrop; // по умолчанию — hall (если у сцены есть фон)
  props: VignetteProp[];
  camera: VignetteCamera;
  background: string | null; // цвет фона; null — прозрачный (портрет на подложке окна)
};

/** Размеры и цвета задника (scene/vignette/Backdrop.tsx). Стена — вдоль x, передняя грань на z = wallZ. */
export const BACKDROP = {
  wallZ: -2.7,
  wallThickness: 0.3,
  wallHeight: 3.4,      // выше, чем на складе (1,75 м): в кадре сценки стена должна закрывать фон
  wallHalfWidth: 9,
  plinth: 0.28,
  ribStep: 0.42,        // шаг рёбер профлиста — как на складе (models/Wall.ts)
  windowY0: 2.55,       // лента окон под крышей
  windowY1: 3.1,
  gate: [1.35, 3.65] as [number, number], // проём ворот (dock): грузовик поставки стоит по x 2,5 ± 0,95
  gateHeight: 2.6,
  lineColor: '#F2C230', // жёлтая разметка пола
  fogFrom: 2,           // дымка: начинается за целью сцены на столько метров…
  fogTo: 16,            // …и густеет к этому расстоянию
  homeWall: '#EFE2C6',
  homePanel: '#D8C29C',
  homeTrim: '#FBF7EE',
  homeFloor: '#D9B98F',
  picture: '#8CC0D8',
  pot: '#C9734A',
};

export const VIGNETTE = {
  floorColor: '#DED8C0',   // как пол склада (PALETTE.floor)
  driverLook: { fur: '#9A6A45', face: '#EBD3B2', ear: '#6E4529', ears: 'floppy' } as DogLook, // водитель поставки — своя порода, не из сборщиков
  otherPickerLook: BULLDOG, // «другой сборщик» в сценках — бульдог Буля (08, раздел 5: в игру пока не входит, поэтому не совпадёт с героем сценки)
  wallColor: SCENE_BG,     // фон за сценой итога — тёплый, как стена вдали
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

/** Сцены итога развилки. Ключ — vignetteKey(ситуация, вариант, сработало ли). Рецепты — в config/vignetteScenes/ по типам заданий. */
export const RESULT_VIGNETTES: Record<string, VignetteRecipe> = {
  ...ORDER_SCENES,
  ...RECEIVING_SCENES,
  ...PUTAWAY_SCENES,
};

export const vignetteKey = (situationId: string, optionId: string, worked: boolean) =>
  `${situationId}.${optionId}.${worked ? 'ok' : 'bad'}`;

/** Рецепт сцены итога или null, если её ещё нет (тогда в окне заглушка). */
export function resultVignette(situationId: string, optionId: string, worked: boolean): VignetteRecipe | null {
  return RESULT_VIGNETTES[vignetteKey(situationId, optionId, worked)] ?? null;
}
