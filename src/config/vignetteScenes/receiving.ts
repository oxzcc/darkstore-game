// Сцены итога развилок приёмки поставки (V2c): 6 ситуаций из config/calls.ts, у каждого варианта «сработало» (ok) и «не сработало» (bad).
// Место действия — зона у ворот: паллета поставки, сзади грузовик, иногда водитель. Ключ — «ситуация.вариант.ok|bad».
import type { VignetteRecipe } from '../vignettes';
import { customer, dock, dog, driver, floorMess, icon, pallet, scene, WIDE_CAMERA } from './kit';

/** Мятая коробка у ног собаки (ситуация «мятая коробка»). */
const DENTED_AT: [number, number, number] = [-0.15, 0, 0.75];

export const RECEIVING_SCENES: Record<string, VignetteRecipe> = {
  // ── «Недостача по накладной» (r_short) ──
  'r_short.recount.ok': dock(dog('idle', 'happy', 'clipboard'), [icon('check')], 7),
  'r_short.recount.bad': dock(dog('think', 'tired', 'clipboard'), [icon('question')], 7),
  'r_short.byInvoice.ok': dock(dog('point', 'happy', null, [0.2, 0, 0.6], -0.6), [pallet(5, [-2.0, 0, -0.3]), icon('check')], 7),
  'r_short.byInvoice.bad': dock(dog('oops', 'oops', 'clipboard'), [icon('cross')], 5),
  'r_short.markShort.ok': dock(dog('point', 'happy', null, [0.25, 0, 0.5], 0.7), [driver('idle', 'happy', 'clipboard'), icon('check', [0.8, 2.3, 0])], 7),
  'r_short.markShort.bad': dock(dog('think', 'think', 'clipboard', [0.25, 0, 0.5], 0.5), [driver('impatient', 'angry'), icon('cross', [0.8, 2.3, 0])], 7),

  // ── «Мятая коробка» (r_dented) ──
  'r_dented.asIs.ok': dock(dog('idle', 'happy', 'product'), [{ kind: 'box', at: DENTED_AT, dented: true, open: true }, icon('check')]),
  'r_dented.asIs.bad': dock(dog('oops', 'oops'), [{ kind: 'box', at: DENTED_AT, dented: true, open: true }, ...floorMess().slice(1)]),
  'r_dented.toScrap.ok': scene(dog('carry', 'happy', 'box', [0.9, 0, 0.6], -0.4), [{ kind: 'scrapZone', at: [-0.5, 0, -0.6] }, icon('check')], WIDE_CAMERA),
  'r_dented.toScrap.bad': scene(dog('think', 'think', null, [0.9, 0, 0.6], -0.4), [
    { kind: 'scrapZone', at: [-0.5, 0, -0.6] }, { kind: 'box', at: [-0.2, 0, -0.1], open: true },
    { kind: 'product', at: [-0.2, 0.36, -0.1] }, icon('cross'),
  ], WIDE_CAMERA),
  'r_dented.inspect.ok': dock(dog('kneel', 'happy', null, [0.2, 0, 0.45], 0.2), [
    { kind: 'box', at: [0.25, 0, 1.0], open: true, dented: true },
    { kind: 'product', at: [-0.45, 0, 1.0] }, { kind: 'product', at: [-0.8, 0, 1.0] },
    { kind: 'product', at: [1.0, 0.1, 1.0], rot: [Math.PI / 2, 0, 0.4] }, icon('check'),
  ]),
  'r_dented.inspect.bad': dock(dog('kneel', 'oops', null, [0.2, 0, 0.45], 0.2), [
    { kind: 'box', at: [0.25, 0, 1.0], open: true, dented: true },
    { kind: 'product', at: [-0.45, 0, 1.0] }, { kind: 'product', at: [-0.8, 0.1, 1.0], rot: [Math.PI / 2, 0, 0.7] }, icon('cross'),
  ]),
  'r_dented.quickLook.ok': dock(dog('carry', 'happy', 'box'), [icon('check')]),
  'r_dented.quickLook.bad': dock(dog('oops', 'oops'), [{ kind: 'box', at: DENTED_AT, dented: true, open: true }, ...floorMess().slice(2)]),

  // ── «Затёртая наклейка» (r_barcode) ──
  'r_barcode.noScan.ok': dock(dog('idle', 'happy', 'product'), [icon('check')]),
  'r_barcode.noScan.bad': dock(dog('think', 'think', 'product'), [icon('cross')]),
  'r_barcode.byInvoice.ok': dock(dog('idle', 'happy', 'clipboard'), [icon('check')]),
  'r_barcode.byInvoice.bad': dock(dog('oops', 'oops', 'tsd'), [icon('cross')]),

  // ── «Короткий срок у поставки» (r_shortDate) ──
  'r_shortDate.accept.ok': customer('good', 'idle', 'happy'),
  'r_shortDate.accept.bad': scene(dog('tired', 'tired', null, [0.9, 0, 0.6], -0.4), [{ kind: 'scrapZone', at: [-0.5, 0, -0.6], full: true }, icon('clock')], WIDE_CAMERA),
  'r_shortDate.returnDriver.ok': dock(dog('point', 'happy', null, [0.25, 0, 0.5], 0.7), [driver('carry', 'happy', 'box'), icon('check', [0.8, 2.3, 0])]),
  'r_shortDate.returnDriver.bad': dock(dog('oops', 'oops', null, [0.25, 0, 0.5], 0.5), [driver('impatient', 'angry'), icon('cross', [0.8, 2.3, 0])]),
  'r_shortDate.checkDates.ok': dock(dog('compare', 'happy', 'twoProducts'), [icon('check')]),
  'r_shortDate.checkDates.bad': dock(dog('tired', 'tired', 'product'), [icon('clock')]),

  // ── «Водитель торопит» (r_rush) ──
  'r_rush.noCount.ok': dock(dog('idle', 'happy', 'clipboard', [0.25, 0, 0.5], 0.5), [driver('idle', 'happy'), icon('check', [0.8, 2.3, 0])]),
  'r_rush.noCount.bad': dock(dog('oops', 'oops', 'clipboard'), [icon('cross')], 5, false),
  'r_rush.askWait.ok': dock(dog('idle', 'happy', 'clipboard', [0.25, 0, 0.5], 0.5), [driver('impatient', 'think'), icon('check', [0.8, 2.3, 0])]),
  'r_rush.askWait.bad': dock(dog('tired', 'tired', 'clipboard', [0.25, 0, 0.5], 0.3), [driver('impatient', 'angry', null, [0.9, 0, -0.05], -0.9), icon('question', [0.8, 2.3, 0])]),
  'r_rush.countFast.ok': dock(dog('walk', 'happy', 'clipboard', [0.3, 0, 0.6], -0.8), [driver('idle', 'think'), icon('star', [0.8, 2.3, 0])]),
  'r_rush.countFast.bad': dock(dog('oops', 'oops', 'clipboard'), [{ kind: 'box', at: [1.6, 0, -0.9], rot: [0, 0.4, 0] }, icon('cross')]),

  // ── «Чужая коробка» (r_foreign) ──
  'r_foreign.accept.ok': dock(dog('carry', 'happy', 'box'), [icon('check')]),
  'r_foreign.accept.bad': dock(dog('carry', 'think', 'box'), [icon('cross')]),
  'r_foreign.returnDriver.ok': dock(dog('point', 'happy', null, [0.25, 0, 0.5], 0.7), [driver('carry', 'happy', 'box'), icon('check', [0.8, 2.3, 0])]),
  'r_foreign.returnDriver.bad': dock(dog('oops', 'oops', null, [0.25, 0, 0.5], 0.5), [driver('carry', 'happy', 'box', [1.6, 0, -0.6], -2.6), icon('cross', [0.8, 2.3, 0])]),
};
