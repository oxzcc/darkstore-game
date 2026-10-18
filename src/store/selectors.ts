// Готовые выборки для интерфейса и сцены (09, раздел 8). Интерфейс сам ничего не считает:
// шансы и проверки берутся отсюда, а здесь — из rules.
import type { GameState } from '../model/game';
import type { OutcomeChances, Task } from '../model/task';
import type { Picker, PickerActivity } from '../model/picker';
import { outcomeBreakdown, outcomeChances, type OutcomeBreakdown } from '../rules/outcome';
export type { ChancePart } from '../rules/outcome';
import { canAssign } from '../rules/tasks/lifecycle';
import { formatAddress } from '../rules/address';
import { etaToTask, jobSecondsEstimate, pickerActivity } from '../rules/jobs';
import { tsdOfferSecondsLeft } from '../rules/tsd';
import { shelfContents } from '../rules/stock';
import { takenPerLine } from '../rules/minigames/picking';
import { callText, complicationChance, fillText, lineContext } from '../rules/calls';
import { taskLines } from '../rules/taskLines';
import { expiryDate } from '../rules/minigames/expiry';
import { pickedQty, rewardFor } from '../rules/rewards';
import { CALLS, DEPTH, EXPIRY, RESULT_XP, SITUATION_BY_ID, TSD_OPTION_ID, tsdTextFor, type CallOption } from '../config/calls';
import type { RackRef } from '../model/minigame';
import type { Call } from '../model/call';
import type { CallFlash, ResultCard, RollCard } from './gameStore';
import { TASK_REPORT } from '../config/taskReport';
import { TIRED_BADGE_FROM } from '../config/pickers';
import type { Address } from '../model/address';
import type { Stock } from '../model/stock';
import type { Cell } from '../model/warehouse';
import { WAREHOUSE_MAP } from './gameStore';
import { isLastShift, shiftSecondsLeft } from '../rules/shift';
import { secondsToTake } from '../rules/deadline';
import { canRest } from '../rules/rest';
import { EMPTY_TALLY, shiftTally, specPerfectBonus, xpToNext } from '../rules/pickerStats';
import { isTutorial } from '../rules/shiftPlan';
import { currentHint } from '../rules/tutorial';
import { HINTS } from '../config/tutorial';
import { DEADLINE, PICKER_GROWTH, SHIFT } from '../config/balance';
import { TASK_PINS } from '../config/warehouse';
import { cellToWorld } from '../rules/warehouse';
import type { WarehouseMap } from '../model/warehouse';

/** Открытые задания по порядку появления. */
export function openTaskList(tasks: GameState['tasks']): Task[] {
  return Object.values(tasks)
    .filter((t) => t.status === 'new')
    .sort((a, b) => a.number - b.number);
}

export function pickerList(pickers: GameState['pickers']): Picker[] {
  return Object.values(pickers);
}

/** Шансы исходов для карточки сборщика — та же функция, по которой бросается исход. */
export function chancesFor(game: GameState, pickerId: string, taskId: string): OutcomeChances {
  return outcomeChances(game.pickers[pickerId], game.tasks[taskId]);
}

/** Всё для карточки сборщика в окне назначения: можно ли отправить, шансы с раскладкой, время до места и до конца задания. */
export type AssignCardView = {
  picker: Picker;
  check: { ok: boolean; reason?: string };
  breakdown: OutcomeBreakdown;
  eta: number | null;
  total: number | null;
};
export function assignCardView(game: GameState, pickerId: string, taskId: string): AssignCardView | null {
  const picker = game.pickers[pickerId];
  const task = game.tasks[taskId];
  if (!picker || !task) return null;
  const check = canAssign(game, taskId, pickerId);
  return {
    picker,
    check,
    breakdown: outcomeBreakdown(picker, task),
    eta: check.ok ? etaToTask(WAREHOUSE_MAP, picker, task) : null,
    total: check.ok ? jobSecondsEstimate(WAREHOUSE_MAP, picker, task) : null,
  };
}

/** Можно ли отправить сборщика; если нет — причина. */
export function assignCheck(game: GameState, taskId: string, pickerId: string) {
  return canAssign(game, taskId, pickerId);
}

/** Адрес в виде для экрана: 3.2.1. */
export const addressText = formatAddress;

/** Короткое описание заказа или выкладки: «3 товара · аллеи 1, 4». */
export function orderSummary(task: Task): string {
  if (task.type !== 'order' && task.type !== 'putaway') return '';
  const lines: { address: Address }[] = task.payload.lines;
  const n = lines.length;
  const aisles = [...new Set(lines.map((l) => l.address.aisle))].sort((a, b) => a - b);
  return `${n} ${plural(n, 'товар', 'товара', 'товаров')} · ${aisles.length > 1 ? 'аллеи' : 'аллея'} ${aisles.join(', ')}`;
}

/** Короткое описание поставки: «2 паллеты · 34 шт.». */
export function deliverySummary(game: GameState, task: Task): string {
  if (task.type !== 'receiving') return '';
  const pallets = deliveryPallets(game, task);
  const qty = pallets.reduce((sum, p) => sum + p.items.reduce((s, it) => s + it.qty, 0), 0);
  const n = pallets.length;
  return `${n} ${plural(n, 'паллета', 'паллеты', 'паллет')} · ${qty} шт.`;
}

/** Паллеты поставки по заданию «Приёмка» (по порядку). */
export function deliveryPallets(game: GameState, task: Task) {
  if (task.type !== 'receiving') return [];
  const d = game.deliveries[task.payload.deliveryId];
  return d ? d.palletIds.map((id) => game.pallets[id]).filter(Boolean) : [];
}

/**
 * Товары задания одной строкой на товар — для окна назначения у выкладки и приёмки (правка автора 14.10):
 * «Кофе ×7» и мелко, где он: «1.1.2, 3.1.4» или «П1, П3». Порядок — как товары встречаются в задании.
 */
export function groupedLines(game: GameState, task: Task): { productId: string; name: string; qty: number; places: string[] }[] {
  const out: { productId: string; name: string; qty: number; places: string[] }[] = [];
  for (const l of taskLines(game, task)) {
    const place = l.address ? formatAddress(l.address) : l.pallet ? `П${l.pallet}` : '';
    const g = out.find((x) => x.productId === l.productId);
    if (g) {
      g.qty += l.qty;
      if (place && !g.places.includes(place)) g.places.push(place);
    } else {
      out.push({ productId: l.productId, name: game.products[l.productId]?.name ?? l.productId, qty: l.qty, places: place ? [place] : [] });
    }
  }
  return out;
}

/** Подпись под названием задания в панели и окне назначения — по типу задания. */
export function taskSummary(game: GameState, task: Task): string {
  if (task.type === 'writeoff') {
    // «Сыр ×3 · 3.4.2» (M7e1)
    const name = game.products[task.payload.productId]?.name ?? task.payload.productId;
    return `${name} ×${task.payload.qty} · ${formatAddress(task.payload.address)}`;
  }
  return task.type === 'receiving' ? deliverySummary(game, task) : orderSummary(task);
}

/** Грузовики у ворот и паллеты в зоне приёмки — для сцены (M7b). */
export function trucksAtGate(deliveries: GameState['deliveries']) {
  return Object.values(deliveries).filter((d) => d.status === 'atGate');
}
export function palletsOnFloor(pallets: GameState['pallets']) {
  return Object.values(pallets).filter((p) => p.state !== 'empty');
}

/** Русское склонение по числу: 1 товар, 2 товара, 5 товаров. */
export function plural(n: number, one: string, few: string, many: string): string {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return one;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
  return many;
}

/** Деньги для экрана: 12 450 ₽ (08, раздел 10.4). */
export function money(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
}

/** Рейтинг даркстора для верхней панели: «4,55». Два знака — иначе прибавка за одно задание (0,05) не видна. */
export function ratingText(r: number): string {
  return r.toFixed(2).replace('.', ',');
}

/** Изменение рейтинга со знаком: «+0,05», «−0,02». */
export function signedRating(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')}`;
}

// ---------- время и работа (M4) ----------

/** Что делает сборщик сейчас (идёт, собирает, фасует) — из rules. */
export function activityOf(game: GameState, pickerId: string): PickerActivity {
  return pickerActivity(game, pickerId);
}

/** «0:16 до места»: время до первой точки задания для свободного сборщика. null — недоступно. */
export function etaFor(game: GameState, pickerId: string, taskId: string): number | null {
  const task = game.tasks[taskId];
  const picker = game.pickers[pickerId];
  if (!task || !picker) return null;
  return etaToTask(WAREHOUSE_MAP, picker, task);
}

/** Секунды → «м:сс» (08, раздел 10.4). Округляем вверх, чтобы 0:00 показывалось только в самом конце. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- «Взять ТСД» (M5b) ----------

/** Сколько секунд осталось ответить на «Взять ТСД?». null — предложения нет. */
export function tsdSecondsLeft(game: GameState): number | null {
  return tsdOfferSecondsLeft(game);
}

/** Какой сборщик работает над заданием (для аватара на карточке задания). */
export function assigneeOf(game: GameState, task: Task): Picker | null {
  return task.assignedPickerId ? game.pickers[task.assignedPickerId] ?? null : null;
}

/** Задания для панели: новые и те, что в работе, по порядку появления. */
export function panelTaskList(tasks: GameState['tasks']): Task[] {
  return Object.values(tasks)
    .filter((t) => t.status !== 'done' && t.status !== 'expired')
    .sort((a, b) => a.number - b.number);
}

/** Все непустые полки и что на них ФАКТИЧЕСКИ лежит — для отрисовки товара на сцене (06, раздел 15). */
export function goodsOnShelves(stock: Stock): { address: Address; contents: { productId: string; qty: number }[] }[] {
  const seen = new Map<string, Address>();
  for (const r of Object.values(stock)) if (r.qty > 0) seen.set(formatAddress(r.address), r.address);
  return [...seen.values()].map((address) => ({ address, contents: shelfContents(stock, address) }));
}

/** Что видно на экране ТСД в «Сборке» (06, раздел 5): позиции заказа и сколько взято. Тексты собирает экран. */
export function pickingView(game: GameState) {
  const session = game.minigame;
  if (!session) return null;
  const task = game.tasks[session.taskId];
  const picker = game.pickers[session.pickerId];
  if (task?.type !== 'order' || !picker) return null;
  const taken = takenPerLine(session, task.payload.lines.length);
  const lines = task.payload.lines.map((l, i) => {
    const product = game.products[l.productId];
    return { index: i, name: product?.name ?? l.productId, look: product?.look ?? null,
      address: formatAddress(l.address), qty: l.qty, taken: taken[i] };
  });
  const scan = session.lastScan;
  return {
    number: task.number,
    summary: orderSummary(task),
    picker: { name: picker.name, color: picker.color },
    elapsed: session.elapsed,
    lines,
    lastScan: scan && {
      ...scan,
      name: game.products[scan.productId]?.name ?? scan.productId,
      address: formatAddress(scan.address),
      line: scan.lineIndex !== null ? lines[scan.lineIndex] : null,
    },
  };
}

export type PickingView = NonNullable<ReturnType<typeof pickingView>>;

// ---------- Развилки (N1) ----------

/** Вариант для окна (ui_11): доступен ли он этому сборщику, описание с подстановками.
 *  Закрытые показываются серыми с требованием — как в Dispatch (13.10). */
/** chance — шанс осложнения этого варианта у этого сборщика (риск × Нюх, P4): то же число, по которому потом крутится барабан. */
export type CallOptionView = CallOption & { locked: boolean; number: number | null; text: string; tsd?: boolean; chance: number };

function optionViews(game: GameState, call: Call): CallOptionView[] {
  const ctx = lineContext(game, call.taskId, call.lineIndex, call.pickerId);
  let n = 0;
  const views: CallOptionView[] = SITUATION_BY_ID[call.situationId].options.map((o) => {
    const locked = !call.optionIds.includes(o.id);
    const chance = complicationChance(o.risk, game.pickers[call.pickerId]?.stats.accuracy);
    return { ...o, locked, number: locked ? null : ++n, text: fillText(o.description, { ...ctx, seconds: o.seconds }), chance };
  });
  // «Взять ТСД» — последней карточкой, если выпала (10, раздел 11.1). Пока идёт другая игра, второй не начать.
  if (call.tsd) {
    const t = tsdTextFor(SITUATION_BY_ID[call.situationId], call.tsd);
    const busy = game.tsdGame !== null || game.minigame !== null;
    views.push({
      id: TSD_OPTION_ID, label: t.label, description: t.description, seconds: 0, risk: 'low', busyLabel: '',
      okTitle: '', okText: '', badTitle: '', badText: '',
      tsd: true, chance: 0, locked: busy, number: busy ? null : ++n,
      text: busy ? 'ТСД сейчас занят другой игрой.' : fillText(t.description, ctx),
    });
  }
  return views;
}

/** Окно развилки по центру (ui_11): реплика, варианты, что выберет сборщик сам, сколько ещё ждут помощи. */
function callCardView(game: GameState, call: Call, text: string) {
  const options = optionViews(game, call);
  return {
    picker: game.pickers[call.pickerId],
    taskNumber: game.tasks[call.taskId]?.number ?? 0,
    taskType: game.tasks[call.taskId]?.type ?? 'order',
    text,
    riskLabel: SITUATION_BY_ID[call.situationId].riskLabel,
    options,
    autoNumber: options.find((o) => o.id === call.autoOptionId)?.number ?? null,
  };
}

/** Развилки, которые ждут ответа (у «!» идёт таймер). */
export function callsView(game: GameState) {
  const shown = game.calls.filter((c) => c.expiresAt !== null).slice(0, CALLS.maxVisible).map((c) => ({
    id: c.id,
    ...callCardView(game, c, callText(game, c)),
    secondsLeft: Math.max(0, (c.expiresAt ?? 0) - game.clock.time),
  }));
  return { shown };
}

/** Окно после ответа (подсвечен выбор). */
export function flashView(game: GameState, f: CallFlash) {
  return { id: f.id, ...callCardView(game, f.call, f.text), chosenId: f.optionId, auto: f.auto };
}

/**
 * Окно итога задания без развилки (P3, прототип «Окно итога задания»): доклад сборщика, из чего сложились шансы, барабан из трёх исходов, итог.
 * Шансы и их раскладка — по сборщику до задания (`RollCard.parts`), потому что после него растут опыт и усталость.
 */
export function rollView(game: GameState, card: RollCard) {
  const picker = game.pickers[card.pickerId];
  const task = game.tasks[card.taskId];
  if (!picker || !task) return null;
  const ctx: Record<string, string> = task.type === 'writeoff'
    ? { product: game.products[task.payload.productId]?.name ?? task.payload.productId, address: formatAddress(task.payload.address) }
    : {};
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => ctx[k] ?? m);
  const report = TASK_REPORT[task.type];
  let accuracy = picker.stats.accuracy;
  let level = picker.specialization[task.type]?.level ?? 1;
  let tired: number | null = null;
  for (const part of card.parts) {
    if (part.kind === 'accuracy') accuracy = part.points;
    if (part.kind === 'spec') level = part.level;
    if (part.kind === 'fatigue' && part.fatigue >= TIRED_BADGE_FROM) tired = part.value;
  }
  return {
    picker,
    taskType: task.type,
    taskNumber: task.number,
    speech: fill(report.speech),
    title: fill(report.results[card.outcome].title),
    text: fill(report.results[card.outcome].text),
    /** Что повлияло на шансы: Нюх, опыт по этому типу, усталость (null — не устал). */
    why: { accuracy, level, tired },
    xp: level >= PICKER_GROWTH.spec.maxLevel ? 0 : PICKER_GROWTH.spec.xp[card.outcome],
  };
}

/** Окно итога задания с развилкой (ui_12): что решили, что вышло, чек с позициями и наградой. */
export function resultView(game: GameState, card: ResultCard) {
  const task = game.tasks[card.taskId];
  const picker = game.pickers[card.pickerId];
  if (!task || !picker) return null;
  const { reveal } = card;
  const c = reveal.calls[0];
  const option = c ? SITUATION_BY_ID[c.situationId]?.options.find((o) => o.id === c.optionId) : undefined;
  const ctx = c ? { ...lineContext(game, task.id, c.lineIndex, picker.id), seconds: option?.seconds ?? 0 } : {};
  const worked = c ? !c.complication : true;
  // игрок брал ТСД: тексты — по итогу его игры (10, раздел 11.4)
  const tsdKind = c?.tsd ? SITUATION_BY_ID[c.situationId]?.tsdGame : undefined;
  const tsdText = c?.tsd && tsdKind ? tsdTextFor(SITUATION_BY_ID[c.situationId], tsdKind).results[c.tsd] : undefined;
  // сколько собрано — те же правила, что снимают товар с полок (rules/rewards.ts); приёмка и выкладка — всё целиком (10, раздел 11.6)
  const all = taskLines(game, task);
  const picked = task.type === 'order' ? pickedQty(task, reveal) : all.map((l) => l.qty);
  const lines = all.map((l, i) => {
    let note: string | null = null;
    if (c && i === c.lineIndex && option?.cap) note = 'позиция пропущена';
    if (c && i === c.lineIndex && c.tsd === 'failed' && task.type === 'putaway') {
      // выкладка: товар на полке в любом случае (10, раздел 11.6) — страдает только порядок
      note = tsdKind === 'depth' ? 'старая партия осталась в глубине' : 'выложили без скана — могли перепутать';
    } else if (c && i === c.lineIndex && c.tsd === 'failed' && task.type === 'writeoff') {
      // списание (M7e2): партия уходит в любом случае — страдает только порядок
      note = tsdKind === 'expiry' ? 'сняли годную, просрочка осталась' : tsdKind === 'depth' ? 'просрочку не достали' : 'списали без скана — могли перепутать';
    } else if (c && i === c.lineIndex && c.tsd === 'failed') {
      // «Глубина» — товар не достали; «Срок» — товар есть, но срок короткий
      if (tsdKind === 'expiry') note = 'взяли товар с коротким сроком';
      else if (tsdKind === 'barcode') note = 'взяли без скана — могли перепутать';
      else note = 'не достали с ТСД';
    }
    if (reveal.errorLine?.lineIndex === i) note = `${picker.name} ошибся с количеством — зависит от его точности`;
    return { name: game.products[l.productId]?.name ?? l.productId, qty: l.qty, picked: picked[i], note };
  });
  const reward = rewardFor(task, reveal.final, isTutorial(game)); // ровно то, что начислено (rules/rewards.ts)
  // окно итога в три колонки (P4, правка автора 18.10): слева сюжет — реплика и варианты с выбранным
  const situation = c ? SITUATION_BY_ID[c.situationId] : undefined;
  const lineCtx = c ? lineContext(game, task.id, c.lineIndex, picker.id) : {};
  const options = situation ? situation.options.map((o) => ({ id: o.id, label: o.label, chosen: !c?.tsd && o.id === c?.optionId })) : [];
  if (c?.tsd) options.push({ id: TSD_OPTION_ID, label: 'Взять ТСД', chosen: true });
  return {
    speech: situation ? fillText(situation.speech, lineCtx) : '',
    riskLabel: situation?.riskLabel ?? '',
    options,
    /** Ответ вариантом (не ТСД) — барабан «Сработало / Осложнение» по шансу варианта; null — играли на ТСД. */
    reel: c && !c.tsd ? { chance: c.chance, roll: c.roll, complication: c.complication } : null,
    /** Какую игру на ТСД играли (для подписи в окне итога); null — ответили вариантом. */
    tsdGame: c?.tsd ? tsdKind ?? null : null,
    /** Ограничение варианта сработало: исход не выше этого. */
    capped: c?.capped && option?.cap ? option.cap : null,
    taskNumber: task.number,
    taskType: task.type,
    picker,
    optionLabel: tsdText ? 'Взяли ТСД' : option?.label ?? '',
    auto: c?.auto ?? false,
    worked,
    /** Подпись итога решения: «Сработало» / «Не сработало», для игры на ТСД — её исход. */
    verdict: c?.tsd ? c.tsd : worked ? 'Сработало' : 'Не сработало',
    title: tsdText ? tsdText.title : option ? fillText(worked ? option.okTitle : option.badTitle, ctx) : '',
    text: tsdText ? fillText(tsdText.text, ctx) : option ? fillText(worked ? option.okText : option.badText, ctx) : '',
    lines,
    money: { got: reward.money, of: task.reward.money },
    rating: { got: reward.rating, of: task.reward.rating },
    xp: RESULT_XP,
    outcome: reveal.final,
    /** Для сценки-иллюстрации итога (config/vignettes.ts): какая развилка, какой вариант, сработал ли, какой товар. */
    art: c ? {
      situationId: c.situationId,
      optionId: c.optionId,
      worked,
      tsd: c.tsd ?? null,
      product: game.products[all[c.lineIndex]?.productId ?? '']?.look ?? null,
    } : null,
  };
}

// ---------- Игра на ТСД из развилки (N2) ----------

/** Куда смотрит камера вблизи: стеллаж игры на ТСД или стеллаж личной «Сборки» (M5e1, выключена). */
export function closeupFocus(game: GameState): RackRef | null {
  if (game.tsdGame) return game.tsdGame.rack;
  return game.minigame?.atFocus ? game.minigame.focus : null;
}

/** Что показывает панель ТСД в «Глубине» (10, раздел 11.3). */
export function depthView(game: GameState) {
  const g = game.tsdGame;
  if (!g || g.kind !== 'depth') return null;
  const picker = game.pickers[g.pickerId];
  const task = game.tasks[g.taskId];
  const product = game.products[g.board.boxes[0]];
  if (!picker || !task) return null;
  return {
    goal: task.type === 'putaway' ? 'Выведите вперёд' : 'Достаньте', // выкладка: старая партия вперёд (M7d2)
    taskNumber: task.number,
    picker: { name: picker.name, color: picker.color },
    product: { name: product?.name ?? g.board.boxes[0], look: product?.look ?? null },
    address: formatAddress(g.address),
    secondsLeft: Math.max(0, g.timeLimit - g.elapsed),
    timeLimit: g.timeLimit,
    moves: g.moves,
    best: g.best,
    perfectUpTo: g.best + DEPTH.perfectExtra,
    errorsUpTo: g.best + DEPTH.withErrorsExtra,
    note: g.note,
    noteAt: g.noteAt,
    result: g.result,
  };
}

export type DepthView = NonNullable<ReturnType<typeof depthView>>;

/** Что показывает экран «Срока» (10, раздел 11.3): что найти, какой срок нужен, штуки в лотке, поднятая штука. */
export function expiryView(game: GameState) {
  const g = game.tsdGame;
  if (!g || g.kind !== 'expiry') return null;
  const product = game.products[g.productId];
  const unit = (i: number | null) => (i === null ? null : { index: i, ...g.units[i], date: expiryDate(g.units[i].days) });
  return {
    product: { name: product?.name ?? g.productId, look: product?.look ?? null },
    need: expiryDate(g.need),
    today: expiryDate(0),
    // списание (M7e2): ищем просроченную — другие подписи
    expired: g.mode === 'expired',
    goal: g.mode === 'expired' ? 'Найдите просроченный' : 'Найдите',
    rule: g.mode === 'expired' ? { label: 'Срок истёк', value: `до ${expiryDate(0)}` } : { label: 'Годен не ранее', value: expiryDate(g.need) },
    secondsLeft: Math.max(0, g.timeLimit - g.elapsed),
    elapsed: g.elapsed,
    timeLimit: g.timeLimit,
    perfectSeconds: g.perfectSeconds ?? EXPIRY.perfectSeconds,
    open: unit(g.open),
    taken: unit(g.taken),
    note: g.note,
    result: g.result,
  };
}

export type ExpiryView = NonNullable<ReturnType<typeof expiryView>>;

/** Что показывает ТСД в «Штрихкоде» (N4): попытки с отметками, сколько осталось, время (без вступления). */
export function barcodeView(game: GameState, input: number[]) {
  const g = game.tsdGame;
  if (!g || g.kind !== 'barcode') return null;
  const product = game.products[g.productId];
  const picker = game.pickers[g.pickerId];
  const played = Math.max(0, g.elapsed - g.startDelay);
  return {
    product: { name: product?.name ?? g.productId, look: product?.look ?? null },
    picker: { name: picker?.name ?? '', color: picker?.color ?? '#428C00' },
    hiddenCount: g.hiddenCount,
    attempts: g.attempts,
    perfectWithin: g.perfectWithin,
    guesses: g.guesses,
    input,
    ready: g.elapsed >= g.startDelay,
    secondsLeft: Math.max(0, g.timeLimit - played),
    timeLimit: g.timeLimit,
    result: g.result,
    note: g.note,
    code: g.code.join(''),
  };
}

export type BarcodeView = NonNullable<ReturnType<typeof barcodeView>>;

// ---------- Смена и кампания (M8a) ----------

/** Плашка смены сверху: «Смена 2 из 5 · 7:32». */
export function shiftClock(game: GameState) {
  return { shift: game.campaign.shift, total: game.campaign.totalShifts, secondsLeft: shiftSecondsLeft(game) };
}

/** Экран итогов смены: последняя запись истории и кто что сделал. null — смена идёт. */
export function shiftSummaryView(game: GameState) {
  if (game.campaign.phase !== 'summary') return null;
  const r = game.campaign.history.at(-1);
  if (!r) return null;
  return {
    ...r,
    total: game.campaign.totalShifts,
    last: isLastShift(game),
    lost: game.campaign.lost,
    pickers: Object.values(game.pickers).map((p) => ({ picker: p, tasks: r.pickers[p.id] ?? 0 })),
  };
}

/** Итоги кампании: все смены и сумма. null — кампания не закончена. */
export function campaignSummaryView(game: GameState) {
  if (game.campaign.phase !== 'over') return null;
  const h = game.campaign.history;
  return {
    shifts: h,
    stars: h.reduce((sum, r) => sum + r.stars, 0),
    maxStars: h.length * 3,
    closed: h.reduce((sum, r) => sum + r.closed, 0),
    appeared: h.reduce((sum, r) => sum + r.appeared, 0),
    money: game.money,
    rating: game.rating,
    lost: game.campaign.lost,
  };
}

// ---------- Сроки (M8b) ----------

/** Таймер на карточке задания: сколько осталось его взять; warn — последние секунды. null — таймера нет. */
export function takeTimer(game: GameState, task: Task): { secondsLeft: number; warn: boolean } | null {
  const left = secondsToTake(game, task);
  return left === null ? null : { secondsLeft: left, warn: left <= DEADLINE.warnSeconds };
}

/** Порог рейтинга для экрана проигрыша. */
export const LOSE_RATING = SHIFT.loseRating;

// ---------- Сборщики: опыт, усталость, перерыв (M8c) ----------

/** Можно ли отправить на перерыв (кнопка на карточке). */
export const restAllowed = (game: GameState, pickerId: string) => canRest(game.pickers[pickerId]);

/** Уровень специализации сборщика по типу задания — для окна «Кого отправить?». */
export function specLevel(game: GameState, pickerId: string, taskId: string): number {
  const t = game.tasks[taskId];
  return t ? game.pickers[pickerId]?.specialization[t.type]?.level ?? 1 : 1;
}

// ---------- Обучающая смена (M8d) ----------

/** Подсказка для окна по центру; null — показывать нечего. */
export function hintView(game: GameState, openCallId: string | null) {
  const id = currentHint(game, openCallId);
  return id ? HINTS.find((h) => h.id === id) ?? null : null;
}

/** Плашка «обучение» у таймера смены. */
export const tutorialShift = (game: GameState) => isTutorial(game);

/**
 * Какую полку сейчас подсвечивать у каждого сборщика (W7b; 08, раздел 6: «нужная полка подсвечивается цветом сборщика, который туда идёт»):
 * полка ближайшей впереди позиции сборки или выкладки; у списания — полка партии, пока её не сняли. Нет такой — сборщика в списке нет.
 */
export function pickerShelfTargets(pickers: GameState['pickers'], tasks: GameState['tasks']): { pickerId: string; color: string; address: Address }[] {
  const out: { pickerId: string; color: string; address: Address }[] = [];
  for (const p of Object.values(pickers)) {
    const job = p.job;
    const task = p.taskId ? tasks[p.taskId] : undefined;
    if (!job || !task) continue;
    const rest = job.steps.slice(job.stepIndex);
    let address: Address | undefined;
    if (task.type === 'writeoff') {
      // пока не закончен шаг «Снимает с полки» (первый рабочий шаг)
      const takeAt = job.steps.findIndex((s) => s.kind === 'work');
      if (takeAt >= job.stepIndex) address = task.payload.address;
    } else if (task.type === 'order' || task.type === 'putaway') {
      const next = rest.find((s) => s.kind === 'pick' || s.kind === 'place');
      if (next && (next.kind === 'pick' || next.kind === 'place')) address = task.payload.lines[next.lineIndex]?.address;
    }
    if (address) out.push({ pickerId: p.id, color: p.color, address });
  }
  return out;
}

/**
 * Закрытые заказы смены для пакетов на столах и курьеров (W8a): когда закрыт, где фасовали, что в заказе.
 * Только для сцены; расписание курьеров считает scene/couriers.ts.
 */
export type PackedOrderInfo = { taskId: string; at: number; cell: Cell | null; items: { productId: string; qty: number }[] };
export function packedOrders(game: GameState): PackedOrderInfo[] {
  const out: PackedOrderInfo[] = [];
  for (const e of game.shiftLog) {
    if (e.kind !== 'taskDone') continue;
    const t = game.tasks[e.taskId];
    if (!t || t.type !== 'order') continue;
    out.push({ taskId: e.taskId, at: e.at, cell: e.cell ?? null, items: t.payload.lines.map((l) => ({ productId: l.productId, qty: l.qty })) });
  }
  return out;
}

// ---------- Пины заданий на складе (T1) ----------

export type TaskPin = {
  id: string;
  type: Task['type'];
  /** Где остриё пина в мире: x, y (высота), z. */
  pos: [number, number, number];
  /** Сколько времени осталось взять задание, доля 0…1 (кольцо). null — срока нет (просрочено или не посчитан). */
  left: number | null;
  warn: boolean;
  overdue: boolean;
};

/** Среднее мировых точек клеток (центр группы паллет). */
function centerOf(cells: Cell[]): [number, number] {
  const pts = cells.map(cellToWorld);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[2], 0) / pts.length];
}

/**
 * Пины новых заданий: над чем висит каждый (решение автора 18.10). Приёмка — над паллетами поставки,
 * выкладка — над своей паллетой, списание — над стеллажом с адресом, сборка — над столами фасовки (по одному на стол, дальше — следующим рядом).
 */
export function taskPins(game: GameState, map: WarehouseMap): TaskPin[] {
  const H = TASK_PINS.height;
  const out: TaskPin[] = [];
  let orderIndex = 0;
  for (const t of openTaskList(game.tasks)) {
    let xz: [number, number] | null = null;
    if (t.type === 'order') {
      const tables = map.tables;
      if (tables.length) {
        const k = orderIndex++;
        const [x, , z] = cellToWorld(tables[k % tables.length]);
        // стол 2×1: левая клетка + соседняя справа — пин над серединой; следующий ряд — ближе к центру склада
        const row = Math.floor(k / tables.length);
        const dir = tables[0].z > map.depth / 2 ? -1 : 1;
        xz = [x + 0.5, z + dir * row * TASK_PINS.orderRowStep];
      }
    } else if (t.type === 'putaway') {
      const [x, , z] = cellToWorld(t.payload.palletCell);
      xz = [x, z];
    } else if (t.type === 'receiving') {
      const cells = (game.deliveries[t.payload.deliveryId]?.palletIds ?? [])
        .map((id) => game.pallets[id]?.cell).filter((c): c is Cell => !!c);
      if (cells.length) xz = centerOf(cells);
    } else if (t.type === 'writeoff') {
      const a = t.payload.address;
      const rack = map.racks.find((r) => r.aisle === a.aisle && r.rack === a.rack);
      if (rack) xz = centerOf(rack.cells);
    }
    if (!xz) {
      // запасной вариант — над клеткой подхода зоны задания
      const zone = t.location.kind === 'zone' ? map.zones.find((zn) => zn.type === (t.location as { zone: string }).zone) : undefined;
      if (!zone) continue;
      const [x, , z] = cellToWorld(zone.access);
      xz = [x, z];
    }
    const secs = secondsToTake(game, t);
    const total = t.deadline !== null ? t.deadline - t.createdAt : 0;
    out.push({
      id: t.id,
      type: t.type,
      pos: [xz[0], H[t.type], xz[1]],
      left: secs === null || total <= 0 ? null : Math.min(1, secs / total),
      warn: secs !== null && secs <= DEADLINE.warnSeconds,
      overdue: !!t.overdue,
    });
  }
  return out;
}

// ---------- Профиль сборщика (P2) ----------

/** Всё для окна профиля: характеристики, опыт по типам (до следующего уровня, бонус к «идеально»), итоги за смену и кампанию. */
export function pickerProfileView(game: GameState, pickerId: string) {
  const picker = game.pickers[pickerId];
  if (!picker) return null;
  const maxLevel = PICKER_GROWTH.spec.maxLevel;
  const exp = (['order', 'putaway', 'receiving', 'writeoff'] as const).map((type) => {
    const { level, xp } = picker.specialization[type] ?? { level: 1, xp: 0 };
    return {
      type,
      level,
      xp,
      need: level >= maxLevel ? null : xpToNext(level),
      bonus: specPerfectBonus(level),
    };
  });
  return {
    picker,
    activity: pickerActivity(game, pickerId),
    energy: Math.round(100 - picker.stats.fatigue),
    exp,
    maxLevel,
    xpPerOutcome: PICKER_GROWTH.spec.xp,
    shift: shiftTally(game.shiftLog, pickerId),
    campaign: picker.tally ?? EMPTY_TALLY,
  };
}
export type PickerProfileView = NonNullable<ReturnType<typeof pickerProfileView>>;
