// Сцены итога развилок выкладки (V2d): 6 ситуаций из config/calls.ts, у каждого варианта «сработало» (ok) и «не сработало» (bad).
// Выкладка узнаётся по тележке с товаром рядом со сборщиком. Ключ — «ситуация.вариант.ok|bad».
// «Тяжёлое наверх» и «Пробка» по смыслу совпадают со сборкой — там, где итог тот же, берётся сцена сборки (с тележкой).
import type { VignetteProp, VignetteRecipe } from '../vignettes';
import { ORDER_SCENES } from './order';
import {
  dock, dog, floorMess, icon, NEIGHBOR_AT, rack, scene, WIDE_CAMERA,
} from './kit';

/** Тележка выкладки с товаром — справа от сборщика. */
const CART: VignetteProp = { kind: 'cart', at: [1.45, 0, 0.25], turn: -1.25, full: true };
/** Сцена сборки + тележка с товаром (если её там ещё нет). */
const withCart = (r: VignetteRecipe): VignetteRecipe =>
  r.props.some((p) => p.kind === 'cart') ? r : { ...r, props: [...r.props, CART] };
const fromOrder = (key: string): VignetteRecipe => withCart(ORDER_SCENES[key]);

export const PUTAWAY_SCENES: Record<string, VignetteRecipe> = {
  // ── «Полка занята чужим товаром» (p_taken) ──
  'p_taken.neighbor.ok': scene(dog('idle', 'happy', 'tsd'), [rack('other', 'product'), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_taken.neighbor.bad': scene(dog('oops', 'oops', 'tsd'), [rack('other', 'product'), CART, icon('cross', [0.35, 2.4, 0.1])]),
  'p_taken.clear.ok': scene(dog('idle', 'happy'), [rack('product', 'other'), CART, icon('star', [0.35, 2.4, 0.1])]),
  'p_taken.clear.bad': scene(dog('think', 'think', 'product'), [rack('messy', 'messy'), CART, icon('cross', [0.35, 2.4, 0.1])]),
  'p_taken.stack.ok': scene(dog('idle', 'happy'), [rack('messy', 'product'), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_taken.stack.bad': scene(dog('oops', 'oops'), [rack('messy', 'messy'), CART, icon('question', [0.35, 2.4, 0.1])]),

  // ── «Не хватает места» (p_noRoom) ──
  'p_noRoom.split.ok': scene(dog('point', 'happy', null, [0.8, 0, 0.6], -0.5), [rack(), rack('product', 'gap', NEIGHBOR_AT), icon('check', [0.8, 2.3, 0])], WIDE_CAMERA),
  'p_noRoom.split.bad': scene(dog('oops', 'oops', 'tsd', [0.8, 0, 0.6], -0.2), [rack(), rack('product', 'gap', NEIGHBOR_AT), icon('cross', [0.8, 2.3, 0])], WIDE_CAMERA),
  'p_noRoom.squeeze.ok': scene(dog('cheer', 'happy'), [rack(), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_noRoom.squeeze.bad': scene(dog('oops', 'oops'), [
    rack(), CART, { kind: 'box', at: [-0.6, 0, 0.6], dented: true }, { kind: 'box', at: [-1.2, 0, 0.8], rot: [0, 0.6, 0], dented: true },
  ]),
  'p_noRoom.returnRest.ok': dock(dog('push', 'happy', null, [0.1, 0, 0.0], -0.9), [{ ...CART, at: [-0.55, 0, -0.3], turn: -0.9, full: false }, icon('check')], 2, false),
  'p_noRoom.returnRest.bad': dock(dog('think', 'think', null, [0.6, 0, 0.5], -0.3), [icon('question')], 2, false),

  // ── «Старая партия в глубине» (p_oldDeep) ──
  'p_oldDeep.front.ok': scene(dog('idle', 'happy'), [rack('product', 'product'), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_oldDeep.front.bad': scene(dog('think', 'think'), [rack('product', 'deep'), CART, icon('clock', [0.35, 2.4, 0.1])]),
  'p_oldDeep.rearrange.ok': scene(dog('carry', 'happy', 'productBox'), [rack('product', 'product'), CART, icon('star', [0.35, 2.4, 0.1])]),
  'p_oldDeep.rearrange.bad': scene(dog('think', 'think'), [rack('product', 'deep'), CART, icon('cross', [0.35, 2.4, 0.1])]),

  // ── «Штрихкод не читается» (p_barcode) ──
  'p_barcode.noScan.ok': scene(dog('idle', 'happy', 'product'), [rack('gap'), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_barcode.noScan.bad': scene(dog('think', 'think'), [rack('product', 'other'), CART, icon('cross', [0.35, 2.4, 0.1])]),
  'p_barcode.byInvoice.ok': scene(dog('idle', 'happy', 'clipboard'), [rack(), CART, icon('check', [0.35, 2.4, 0.1])]),
  'p_barcode.byInvoice.bad': scene(dog('oops', 'oops', 'tsd'), [rack(), CART, icon('cross', [0.35, 2.4, 0.1])]),

  // ── «Тяжёлое на верхнюю полку» (p_heavy): как у сборки, только с тележкой ──
  'p_heavy.alone.ok': fromOrder('heavy.alone.ok'),
  'p_heavy.alone.bad': fromOrder('heavy.alone.bad'),
  'p_heavy.ladder.ok': fromOrder('heavy.ladder.ok'),
  'p_heavy.ladder.bad': scene(dog('oops', 'oops', null, [0.75, 0, 0.6], 0.2), [
    rack('gap'), { kind: 'ladder', at: [-0.55, 0, 0.05], turn: 0.15 }, CART,
    { kind: 'product', at: [-0.1, 0.1, 0.9], rot: [Math.PI / 2, 0, 0.7] },
  ]),
  'p_heavy.byOne.ok': fromOrder('heavy.byOne.ok'),
  'p_heavy.byOne.bad': scene(dog('tired', 'tired'), [rack('gap'), CART, { kind: 'product', at: [-0.3, 0.1, 0.95], rot: [Math.PI / 2, 0, 0.4] }]),
  'p_heavy.ladderRun.ok': fromOrder('heavy.ladderRun.ok'),
  'p_heavy.ladderRun.bad': fromOrder('heavy.ladderRun.bad'),

  // ── «Пробка, тележка не проезжает» (p_jam) ──
  'p_jam.wait.ok': fromOrder('jam.wait.ok'),
  'p_jam.wait.bad': scene(dog('oops', 'oops', null, [0.4, 0, 0.6], 0.3), [
    rack(), CART, { kind: 'npc', role: 'picker', at: [-0.6, 0, 0.55], turn: 0.9, pose: 'impatient', mood: 'angry', hold: null },
  ]),
  'p_jam.around.ok': fromOrder('jam.around.ok'),
  'p_jam.around.bad': scene(dog('tired', 'tired', null, [0.3, 0, 0.7], 0.2), [
    rack(), { kind: 'cart', at: [-0.7, 0, 0.45], turn: 1.0 }, { kind: 'cart', at: [-0.15, 0, -0.05], turn: -0.6, full: true }, CART,
    icon('cross', [0.35, 2.4, 0.1]),
  ]),
  'p_jam.squeeze.ok': fromOrder('jam.squeeze.ok'),
  'p_jam.squeeze.bad': scene(dog('oops', 'oops', null, [0.5, 0, 0.35], 0.2), [
    rack(), { kind: 'cart', at: [-0.6, 0, 0.6], turn: 1.3, full: true }, CART, ...floorMess().slice(2),
  ]),
  'p_jam.slip.ok': fromOrder('jam.slip.ok'),
  'p_jam.slip.bad': fromOrder('jam.slip.bad'),
};
