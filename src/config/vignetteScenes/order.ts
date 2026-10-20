// Сцены итога развилок сборки заказа (V2b): 7 ситуаций из config/calls.ts, у каждого варианта «сработало» (ok) и «не сработало» (bad).
// Ключ — «ситуация.вариант.ok|bad» (vignetteKey). Тексты итогов — okTitle / badTitle в config/calls.ts; сцена их иллюстрирует.
// Товар на полках, в лапах и на полу — товар позиции задания (его подставляет Vignette.tsx).
import type { VignetteRecipe } from '../vignettes';
import {
  boxesAside, boxesFallen, customer, dog, floorMess, icon, NEIGHBOR_AT, packing, rack, scene, WIDE_CAMERA,
} from './kit';

// Общие итоги, которые повторяются у разных ситуаций
/** Клиент доволен: заказ доехал, жалоб нет. */
const CUSTOMER_HAPPY = customer('good', 'idle', 'happy');
/** Клиент пожаловался. */
const CUSTOMER_ANGRY = customer('bad', 'oops', 'oops');
/** «Пропустить позицию» сработало: заказ без одной позиции собран вовремя. */
const SKIP_OK = scene(dog('idle', 'happy', null, [0.45, 0, 0.45], -0.2), [...packing(), icon('clock')]);
/** «Пропустить позицию» не сработало: клиент заметил недостачу. */
const SKIP_BAD = customer('bad', 'tired', 'tired', [icon('cross', [0.55, 2.2, 0])]);

export const ORDER_SCENES: Record<string, VignetteRecipe> = {
  // ── «Срок годности — сегодня» (expiring) ──
  'expiring.take.ok': CUSTOMER_HAPPY,
  'expiring.take.bad': customer('bad', 'oops', 'oops', [icon('clock', [0.55, 2.2, 0])]),
  'expiring.fresher.ok': scene(dog('idle', 'happy', 'product'), [rack('gap'), icon('star')]),
  'expiring.fresher.bad': scene(dog('tired', 'tired', 'product'), [rack('empty', 'empty'), icon('clock')]),
  'expiring.report.ok': scene(dog('point', 'happy', null, [0.6, 0, 0.55], 0.7), [rack(), icon('check', [-0.2, 2.05, 0.1])]),
  'expiring.report.bad': customer('bad', 'think', 'think', [icon('clock', [0.55, 2.2, 0])]),

  // ── «Две похожие упаковки» (similar) ──
  'similar.byEye.ok': scene(dog('idle', 'happy', 'product'), [rack('product', 'messy'), icon('check')]),
  'similar.byEye.bad': CUSTOMER_ANGRY,
  'similar.label.ok': scene(dog('compare', 'happy', 'twoProducts'), [rack('product', 'messy'), icon('check')]),
  'similar.label.bad': scene(dog('compare', 'think', 'twoProducts'), [rack('product', 'messy'), icon('question')]),
  'similar.both.ok': scene(dog('compare', 'happy', 'twoProducts', [0.45, 0, 0.45], -0.2), [...packing(), icon('check')]),
  'similar.both.bad': scene(dog('oops', 'oops', 'product', [0.45, 0, 0.45], -0.2), [...packing(), icon('cross')]),
  'similar.capColor.ok': scene(dog('point', 'happy', null, [0.6, 0, 0.55], 0.7), [rack('product', 'messy'), icon('check')]),
  'similar.capColor.bad': scene(dog('think', 'think'), [rack('messy', 'messy'), icon('cross')]),

  // ── «Штрихкод не читается» (barcode) ──
  'barcode.noScan.ok': CUSTOMER_HAPPY,
  'barcode.noScan.bad': CUSTOMER_ANGRY,
  'barcode.another.ok': scene(dog('idle', 'happy', 'tsd'), [rack(), icon('check')]),
  'barcode.another.bad': scene(dog('tired', 'tired', 'tsd'), [rack('gap'), ...floorMess().slice(1), icon('cross')]),
  'barcode.skipScan.ok': SKIP_OK,
  'barcode.skipScan.bad': SKIP_BAD,

  // ── «Пробка в аллее» (jam): проход перегородила чужая тележка ──
  'jam.wait.ok': scene(dog('walk', 'happy', null, [0.2, 0, 0.6], 0.6), [
    rack(), { kind: 'cart', at: [1.6, 0, 0.3], turn: -1.4 },
    { kind: 'npc', role: 'picker', at: [2.35, 0, 0.45], turn: -1.4, pose: 'push', mood: 'happy', hold: null },
  ], WIDE_CAMERA),
  'jam.wait.bad': scene(dog('impatient', 'tired', null, [0.9, 0, 0.6], -0.3), [rack(), { kind: 'cart', at: [-0.4, 0, 0.45], turn: 1.2 }, icon('clock')]),
  'jam.around.ok': scene(dog('walk', 'happy', null, [0.8, 0, 0.6], -0.6), [rack(), rack('product', 'product', NEIGHBOR_AT), icon('check', [0.8, 2.3, 0])], WIDE_CAMERA),
  'jam.around.bad': scene(dog('think', 'think', 'product', [0.8, 0, 0.6], -0.3), [rack(), rack('other', 'other', NEIGHBOR_AT), icon('question', [0.8, 2.3, 0])], WIDE_CAMERA),
  'jam.squeeze.ok': scene(dog('squeeze', 'happy', null, [0.3, 0, 0.35], 1.4), [rack(), { kind: 'cart', at: [0.35, 0, 1.15], turn: 1.57 }, icon('check')]),
  'jam.squeeze.bad': scene(dog('oops', 'oops', null, [0.5, 0, 0.35], 0.2), [
    rack(), { kind: 'cart', at: [-0.6, 0, 0.6], turn: 1.3 },
    { kind: 'box', at: [0.4, 0, 1.1], dented: true }, { kind: 'product', at: [1.0, 0.1, 1.0], rot: [Math.PI / 2, 0, 0.8] },
  ]),
  'jam.slip.ok': scene(dog('cheer', 'happy', null, [0.7, 0, 0.6], -0.4), [rack(), { kind: 'cart', at: [-0.7, 0, 0.5], turn: 1.3 }, icon('star')]),
  // «Попросить убрать тележку» (X2, Дружелюбие): коллега откатывает тележку / спорят у тележки
  'jam.askMove.ok': scene(dog('point', 'happy', null, [0.2, 0, 0.6], 0.6), [
    rack(), { kind: 'cart', at: [1.6, 0, 0.3], turn: -1.4 },
    { kind: 'npc', role: 'picker', at: [2.35, 0, 0.45], turn: -1.4, pose: 'push', mood: 'happy', hold: null }, icon('check', [0.8, 2.3, 0]),
  ], WIDE_CAMERA),
  'jam.askMove.bad': scene(dog('impatient', 'angry', null, [0.4, 0, 0.6], 0.6), [
    rack(), { kind: 'cart', at: [1.3, 0, 0.45], turn: -1.4 },
    { kind: 'npc', role: 'picker', at: [2.1, 0, 0.5], turn: -1.9, pose: 'impatient', mood: 'angry', hold: null }, icon('cross', [1.2, 2.3, 0]),
  ], WIDE_CAMERA),
  'jam.slip.bad': scene(dog('oops', 'oops', null, [0.6, 0, 0.6], 0.3), [rack('gap', 'gap'), ...floorMess(), { kind: 'cart', at: [1.6, 0, 0.1], turn: -1.2 }]),

  // ── «Товар в глубине полки» (deep) ──
  'deep.unpack.ok': scene(dog('idle', 'happy', 'product'), [rack('product', 'empty'), ...boxesAside(), icon('check')]),
  'deep.unpack.bad': scene(dog('think', 'think'), [rack('product', 'messy'), ...boxesFallen(), icon('cross')]),
  'deep.reach.ok': scene(dog('idle', 'happy', 'product'), [rack('product', 'deep'), icon('star')]),
  'deep.reach.bad': scene(dog('oops', 'oops'), [rack('product', 'gap'), ...boxesFallen(), { kind: 'product', at: [0.9, 0.1, 1.1], rot: [Math.PI / 2, 0, 0.5] }]),
  'deep.skipDeep.ok': SKIP_OK,
  'deep.skipDeep.bad': SKIP_BAD,

  // ── «Тяжёлое наверху» (heavy) ──
  'heavy.alone.ok': scene(dog('carry', 'happy', 'productBox'), [rack('gap'), icon('star')]),
  'heavy.alone.bad': scene(dog('oops', 'oops'), [rack('gap'), ...floorMess(), { kind: 'product', at: [1.45, 0.1, 0.35], rot: [Math.PI / 2, 0, 0.2] }]),
  'heavy.ladder.ok': scene(dog('carry', 'happy', 'productBox', [0.75, 0, 0.6], -0.25), [rack('gap'), { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.15 }]),
  'heavy.ladder.bad': scene(dog('impatient', 'angry', null, [0.9, 0, 0.6], -0.4), [
    rack('gap'), { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.15 },
    { kind: 'npc', role: 'picker', at: [-0.15, 0, 0.55], turn: 0.4, pose: 'tired', mood: 'tired', hold: null }, icon('clock'),
  ]),
  'heavy.byOne.ok': scene(dog('reach', 'happy', 'product'), [
    rack('gap'), { kind: 'product', at: [-0.9, 0, 0.45] }, { kind: 'product', at: [-0.5, 0, 0.45] }, { kind: 'product', at: [-0.1, 0, 0.45] },
  ]),
  'heavy.byOne.bad': customer('bad', 'think', 'think', [{ kind: 'box', at: [-0.55, 0, -0.1], open: true }]),
  'heavy.ladderRun.ok': scene(dog('carry', 'happy', 'productBox', [0.8, 0, 0.6], -0.3), [rack('gap'), { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.15 }, icon('star')]),
  'heavy.ladderRun.bad': scene(dog('oops', 'oops', null, [0.75, 0, 0.6], 0.2), [rack('gap'), { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.7 }, ...floorMess().slice(1)]),

  // ── «Товара нет» (missing) ──
  'missing.search.ok': scene(dog('point', 'happy', null, [0.8, 0, 0.6], -0.5), [rack('empty'), rack('product', 'product', NEIGHBOR_AT), icon('check', [1.85, 2.3, 0])], WIDE_CAMERA),
  'missing.search.bad': scene(dog('tired', 'tired', null, [0.8, 0, 0.6], 0), [rack('empty', 'empty'), rack('other', 'empty', NEIGHBOR_AT), icon('question', [0.8, 2.3, 0])], WIDE_CAMERA),
  'missing.substitute.ok': CUSTOMER_HAPPY,
  'missing.substitute.bad': customer('bad', 'think', 'think'),
  'missing.skip.ok': SKIP_OK,
  'missing.skip.bad': SKIP_BAD,
  // «Вспомнить, где ещё лежит» (X2, Память)
  'missing.recall.ok': scene(dog('point', 'happy', null, [0.8, 0, 0.6], -0.5), [rack('empty'), rack('product', 'product', NEIGHBOR_AT), icon('star', [1.85, 2.3, 0])], WIDE_CAMERA),
  'missing.recall.bad': scene(dog('think', 'think', null, [0.8, 0, 0.6], 0), [rack('empty', 'empty'), rack('other', 'other', NEIGHBOR_AT), icon('question', [0.8, 2.3, 0])], WIDE_CAMERA),
  'missing.checkNear.ok': scene(dog('idle', 'happy', 'product', [0.8, 0, 0.6], -0.3), [rack('empty'), rack('gap', 'product', NEIGHBOR_AT), icon('star', [0.8, 2.3, 0])], WIDE_CAMERA),
  'missing.checkNear.bad': scene(dog('oops', 'oops', null, [0.8, 0, 0.6], 0), [rack('empty', 'empty'), rack('empty', 'empty', NEIGHBOR_AT)], WIDE_CAMERA),
};

