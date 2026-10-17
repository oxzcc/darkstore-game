// Сцены итога игр на ТСД (V2f): «Глубина», «Срок», «Штрихкод» × идеально / неплохо / провал.
// Ключ — «ситуация.tsd.исход» (tsdVignetteKey в config/vignettes.ts): одна и та же игра выглядит по-разному у разных заданий —
// у сборки просто стеллаж, у выкладки рядом тележка с товаром, у списания справа зона брака.
// Значок: идеально — звезда, неплохо — часы (сделали, но долго), провал — крестик.
import type { Outcome } from '../../model/task';
import type { VignetteActor, VignetteCamera, VignetteHold, VignetteIcon, VignetteMood, VignettePose, VignetteProp, VignetteRecipe } from '../vignettes';
import { boxesAside, boxesFallen, customer, dog, icon, rack, scene, SIDE_CAMERA, WIDE_CAMERA, type V3 } from './kit';

/** Где идёт сцена: какой реквизит добавить, где стоит собака, где значок и какая камера. */
type Place = {
  extra: VignetteProp[];
  at: V3;
  turn: number;
  iconAt: V3;
  camera: VignetteCamera;
};

const ORDER: Place = { extra: [], at: [0.35, 0, 0.55], turn: 0.35, iconAt: [1.35, 2.05, 0.1], camera: SIDE_CAMERA };
/** Выкладка — тележка с товаром рядом (как в putaway.ts). */
const PUTAWAY: Place = {
  extra: [{ kind: 'cart', at: [1.45, 0, 0.25], turn: -1.25, full: true }],
  at: [0.35, 0, 0.55], turn: 0.35, iconAt: [0.35, 2.4, 0.1], camera: SIDE_CAMERA,
};
/** Списание — зона брака справа, собака между стеллажом и ней (как в writeoff.ts). */
const WRITEOFF: Place = {
  extra: [{ kind: 'scrapZone', at: [2.05, 0, -0.7] }],
  at: [0.9, 0, 0.6], turn: -0.2, iconAt: [0.9, 2.3, 0], camera: WIDE_CAMERA,
};

const MARK: Record<Outcome, VignetteIcon> = { perfect: 'star', withErrors: 'clock', failed: 'cross' };

/** Сцена в этом месте: стеллаж (по умолчанию полный), собака, реквизит и значок исхода. */
function at(
  place: Place, outcome: Outcome,
  pose: VignettePose, mood: VignetteMood, hold: VignetteHold,
  props: VignetteProp[] = [], shelf: VignetteProp = rack(),
): VignetteRecipe {
  const d: VignetteActor = dog(pose, mood, hold, place.at, place.turn);
  return scene(d, [shelf, ...place.extra, ...props, icon(MARK[outcome], place.iconAt)], place.camera);
}

type Scenes = Record<Outcome, VignetteRecipe>;

/** «Глубина»: достали товар из глубины полки (сборка, списание). */
const depth = (p: Place): Scenes => ({
  perfect: at(p, 'perfect', 'idle', 'happy', 'product', boxesAside()),
  withErrors: at(p, 'withErrors', 'tired', 'tired', 'product', boxesAside()),
  failed: at(p, 'failed', 'oops', 'oops', null, boxesFallen(), rack('product', 'deep')),
});

/** «Глубина» у выкладки: старую партию вывели вперёд (на полке порядок) или она осталась в глубине. */
const depthForward = (p: Place): Scenes => ({
  perfect: at(p, 'perfect', 'point', 'happy', null),
  withErrors: at(p, 'withErrors', 'tired', 'tired', null, boxesAside()),
  failed: at(p, 'failed', 'think', 'think', null, [], rack('product', 'deep')),
});

/** «Штрихкод»: подобрали код (экран ТСД зелёный у довольной собаки) или нет (красный). */
const barcode = (p: Place): Scenes => ({
  perfect: at(p, 'perfect', 'cheer', 'happy', null),
  withErrors: at(p, 'withErrors', 'idle', 'happy', 'tsd'),
  failed: at(p, 'failed', 'oops', 'oops', 'tsd'),
});

/** «Срок» у сборки: взяли штуку с подходящим сроком; провал — клиенту приехала не та, он недоволен. */
const expiry = (p: Place): Scenes => ({
  perfect: at(p, 'perfect', 'idle', 'happy', 'product'),
  withErrors: at(p, 'withErrors', 'think', 'think', 'product'),
  failed: customer('bad', 'oops', 'oops', [icon('cross', [0.25, 2.3, 0.1])]),
});

/** «Срок» наоборот у списания: нашли просроченную и несут в брак; провал — в брак ушла не та. */
const expiryExpired = (p: Place): Scenes => ({
  perfect: at(p, 'perfect', 'carry', 'happy', 'box'),
  withErrors: at(p, 'withErrors', 'carry', 'tired', 'box'),
  failed: at(p, 'failed', 'compare', 'oops', 'twoProducts'),
});

/** Ситуации с игрой на ТСД (config/calls.ts, tsdGame) → сцены по исходу. */
const BY_SITUATION: Record<string, Scenes> = {
  expiring: expiry(ORDER),
  barcode: barcode(ORDER),
  deep: depth(ORDER),
  p_oldDeep: depthForward(PUTAWAY),
  p_barcode: barcode(PUTAWAY),
  w_similar: expiryExpired(WRITEOFF),
  w_barcode: barcode(WRITEOFF),
  w_deep: depth(WRITEOFF),
};

export const TSD_SCENES: Record<string, VignetteRecipe> = Object.fromEntries(
  Object.entries(BY_SITUATION).flatMap(([sid, scenes]) =>
    (Object.keys(scenes) as Outcome[]).map((o) => [`${sid}.tsd.${o}`, scenes[o]])),
);
