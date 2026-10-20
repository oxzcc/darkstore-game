// Сцены итога развилок списания (V2e): 5 ситуаций из config/calls.ts, у каждого варианта «сработало» (ok) и «не сработало» (bad).
// Списание узнаётся по зоне брака справа (красная штриховка, ограждение, контейнер). Ключ — «ситуация.вариант.ok|bad».
// Товар на полках и в лапах — партия задания (у списания это просроченный товар).
import type { VignetteActor, VignetteProp, VignetteRecipe } from '../vignettes';
import {
  boxesAside, boxesFallen, dog, icon, NEIGHBOR_AT, rack, scene, WIDE_CAMERA,
} from './kit';

/** Зона брака справа от стеллажа; `full` — завалена коробками. */
const scrap = (full = false): VignetteProp => ({ kind: 'scrapZone', at: [2.05, 0, -0.7], full });
/** Сборщик между стеллажом и зоной брака. */
const at = (pose: VignetteActor['pose'], mood: VignetteActor['mood'], hold: VignetteActor['hold'] = null): VignetteActor =>
  dog(pose, mood, hold, [0.9, 0, 0.6], -0.2);
/** Сцена списания: стеллаж, зона брака и что ещё нужно; камера широкая, чтобы влезла зона брака. */
const writeoff = (d: VignetteActor, extra: VignetteProp[], full = false): VignetteRecipe =>
  scene(d, [rack(), scrap(full), ...extra], WIDE_CAMERA);
/** Значок над сценой — по центру, между стеллажом и зоной брака. */
const mark = (s: Parameters<typeof icon>[0]) => icon(s, [0.9, 2.3, 0]);
/** Другой сборщик — у зоны брака (несёт коробку). */
const helper = (turn: number): VignetteProp => ({ kind: 'npc', role: 'picker', at: [1.6, 0, 0.35], turn, pose: 'carry', mood: 'happy', hold: 'box' });

export const WRITEOFF_SCENES: Record<string, VignetteRecipe> = {
  // ── «Две партии с похожими датами» (w_similar) ──
  'w_similar.both.ok': writeoff(at('carry', 'happy', 'box'), [mark('check')]),
  'w_similar.both.bad': writeoff(at('oops', 'oops'), [
    { kind: 'product', at: [2.3, 0.6, -0.95] }, { kind: 'product', at: [1.9, 0.6, -0.9], rot: [0, 0.6, 0] }, mark('cross'),
  ]),
  'w_similar.check.ok': writeoff(at('compare', 'happy', 'twoProducts'), [mark('check')]),
  'w_similar.check.bad': writeoff(at('compare', 'think', 'twoProducts'), [mark('cross')]),
  'w_similar.top.ok': writeoff(at('idle', 'happy', 'product'), [mark('star')]),
  'w_similar.top.bad': writeoff(at('think', 'think', 'product'), [mark('cross')]),

  // ── «Просроченной партии не видно» (w_missing) ──
  'w_missing.search.ok': scene(dog('point', 'happy', null, [0.8, 0, 0.6], -0.5), [rack('empty'), rack('product', 'product', NEIGHBOR_AT), mark('check')], WIDE_CAMERA),
  'w_missing.search.bad': scene(dog('tired', 'tired', null, [0.8, 0, 0.6], 0), [rack('empty', 'empty'), rack('other', 'empty', NEIGHBOR_AT), mark('question')], WIDE_CAMERA),
  // «Вспомнить, куда переложили» (X2, Память)
  'w_missing.recall.ok': scene(dog('point', 'happy', null, [0.8, 0, 0.6], -0.5), [rack('empty'), rack('product', 'product', NEIGHBOR_AT), mark('star')], WIDE_CAMERA),
  'w_missing.recall.bad': scene(dog('think', 'think', null, [0.8, 0, 0.6], 0), [rack('empty', 'empty'), rack('other', 'other', NEIGHBOR_AT), mark('question')], WIDE_CAMERA),
  'w_missing.asFound.ok': writeoff(at('idle', 'happy', 'tsd'), [mark('check')]),
  'w_missing.asFound.bad': writeoff(at('oops', 'oops', 'tsd'), [mark('cross')]),

  // ── «Штрихкод не читается» (w_barcode) ──
  'w_barcode.noScan.ok': writeoff(at('carry', 'happy', 'box'), [mark('check')]),
  'w_barcode.noScan.bad': writeoff(at('carry', 'think', 'box'), [mark('cross')]),
  'w_barcode.manual.ok': writeoff(at('idle', 'happy', 'tsd'), [mark('check')]),
  'w_barcode.manual.bad': writeoff(at('oops', 'oops', 'tsd'), [mark('cross')]),

  // ── «Просрочка в глубине полки» (w_deep) ──
  'w_deep.unpack.ok': writeoff(at('idle', 'happy', 'product'), [...boxesAside(), mark('check')]),
  'w_deep.unpack.bad': writeoff(at('think', 'think'), [...boxesFallen(), mark('cross')]),
  'w_deep.reach.ok': scene(at('idle', 'happy', 'product'), [rack('product', 'deep'), scrap(), mark('star')], WIDE_CAMERA),
  'w_deep.reach.bad': scene(at('oops', 'oops'), [
    rack('product', 'gap'), scrap(),
    { kind: 'product', at: [-0.3, 0.1, 0.9], rot: [Math.PI / 2, 0, 0.5] }, { kind: 'product', at: [0.2, 0.1, 1.15], rot: [Math.PI / 2, 0, -0.7] },
  ], WIDE_CAMERA),

  // ── «Зона брака заставлена» (w_scrapFull) ──
  'w_scrapFull.nearby.ok': writeoff(at('point', 'happy'), [helper(-0.3), mark('check')], true),
  'w_scrapFull.nearby.bad': writeoff(at('oops', 'oops'), [helper(2.6), mark('cross')], true),
  // «Позвать коллегу» (X2, Дружелюбие): вдвоём / никто не пришёл
  'w_scrapFull.callMate.ok': writeoff(at('carry', 'happy', 'box'), [helper(-0.3), mark('star')]),
  'w_scrapFull.callMate.bad': writeoff(at('tired', 'tired', 'box'), [mark('cross')], true),
  'w_scrapFull.clear.ok': writeoff(at('idle', 'happy'), [mark('star')]),
  'w_scrapFull.clear.bad': writeoff(at('oops', 'oops'), [
    { kind: 'box', at: [1.2, 0.2, 0.05], rot: [0, 0.6, 1.25] }, { kind: 'box', at: [2.9, 0, 0.4], rot: [0, -0.5, 0] },
    { kind: 'box', at: [1.5, 0.2, 1.05], rot: [1.2, 0.3, 0], dented: true },
  ], true),
};
