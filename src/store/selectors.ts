// Готовые выборки для интерфейса и сцены (09, раздел 8). Интерфейс сам ничего не считает:
// шансы и проверки берутся отсюда, а здесь — из rules.
import type { GameState } from '../model/game';
import type { OutcomeChances, Task } from '../model/task';
import type { Picker, PickerActivity } from '../model/picker';
import { outcomeChances } from '../rules/outcome';
import { canAssign } from '../rules/tasks/lifecycle';
import { formatAddress } from '../rules/address';
import { etaToTask, pickerActivity } from '../rules/jobs';
import { tsdOfferSecondsLeft } from '../rules/tsd';
import { shelfContents } from '../rules/stock';
import { takenPerLine } from '../rules/minigames/picking';
import { callText, fillText, lineContext } from '../rules/calls';
import { expiryDate } from '../rules/minigames/expiry';
import { CALLS, DEPTH, EXPIRY, RESULT_SHARE, RESULT_XP, SITUATION_BY_ID, TSD_GAMES, TSD_OPTION_ID, type CallOption } from '../config/calls';
import type { RackRef } from '../model/minigame';
import type { Call } from '../model/call';
import type { CallFlash, ResultCard } from './gameStore';
import type { Address } from '../model/address';
import type { Stock } from '../model/stock';
import { WAREHOUSE_MAP } from './gameStore';

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

/** Можно ли отправить сборщика; если нет — причина. */
export function assignCheck(game: GameState, taskId: string, pickerId: string) {
  return canAssign(game, taskId, pickerId);
}

/** Адрес в виде для экрана: 3.2.1. */
export const addressText = formatAddress;

/** Короткое описание заказа: «3 товара · аллеи 1, 4». */
export function orderSummary(task: Task): string {
  if (task.type !== 'order') return '';
  const n = task.payload.lines.length;
  const aisles = [...new Set(task.payload.lines.map((l) => l.address.aisle))].sort((a, b) => a - b);
  return `${n} ${plural(n, 'товар', 'товара', 'товаров')} · ${aisles.length > 1 ? 'аллеи' : 'аллея'} ${aisles.join(', ')}`;
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

// ---------- время и работа (M4) ----------

/** Что делает сборщик сейчас (идёт, собирает, фасует) — из rules. */
export function activityOf(game: GameState, pickerId: string): PickerActivity {
  return pickerActivity(game, pickerId);
}

/** «0:16 до места»: время до первой точки задания для свободного сборщика. null — недоступно. */
export function etaFor(game: GameState, pickerId: string, taskId: string): number | null {
  const task = game.tasks[taskId];
  const picker = game.pickers[pickerId];
  if (!task || !picker || task.type !== 'order') return null;
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
export type CallOptionView = CallOption & { locked: boolean; number: number | null; text: string; tsd?: boolean };

function optionViews(game: GameState, call: Call): CallOptionView[] {
  const ctx = lineContext(game, call.taskId, call.lineIndex, call.pickerId);
  let n = 0;
  const views: CallOptionView[] = SITUATION_BY_ID[call.situationId].options.map((o) => {
    const locked = !call.optionIds.includes(o.id);
    return { ...o, locked, number: locked ? null : ++n, text: fillText(o.description, { ...ctx, seconds: o.seconds }) };
  });
  // «Взять ТСД» — последней карточкой, если выпала (10, раздел 11.1). Пока идёт другая игра, второй не начать.
  if (call.tsd) {
    const t = TSD_GAMES[call.tsd];
    const busy = game.tsdGame !== null || game.minigame !== null;
    views.push({
      id: TSD_OPTION_ID, label: t.label, description: t.description, seconds: 0, risk: 'low', busyLabel: '',
      okTitle: '', okText: '', badTitle: '', badText: '',
      tsd: true, locked: busy, number: busy ? null : ++n,
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

/** Окно итога заказа с развилкой (ui_12): что решили, что вышло, чек с позициями и наградой. */
export function resultView(game: GameState, card: ResultCard) {
  const task = game.tasks[card.taskId];
  const picker = game.pickers[card.pickerId];
  if (!task || task.type !== 'order' || !picker) return null;
  const { reveal } = card;
  const c = reveal.calls[0];
  const option = c ? SITUATION_BY_ID[c.situationId]?.options.find((o) => o.id === c.optionId) : undefined;
  const ctx = c ? { ...lineContext(game, task.id, c.lineIndex, picker.id), seconds: option?.seconds ?? 0 } : {};
  const worked = c ? !c.complication : true;
  // игрок брал ТСД: тексты — по итогу его игры (10, раздел 11.4)
  const tsdKind = c?.tsd ? SITUATION_BY_ID[c.situationId]?.tsdGame : undefined;
  const tsdText = c?.tsd && tsdKind ? TSD_GAMES[tsdKind].results[c.tsd] : undefined;
  const lines = task.payload.lines.map((l, i) => {
    let picked = l.qty;
    let note: string | null = null;
    if (c && i === c.lineIndex && option?.cap) { picked = 0; note = 'позиция пропущена'; }
    if (c && i === c.lineIndex && c.tsd === 'failed') {
      // «Глубина» — товар не достали; «Срок» — товар есть, но срок короткий
      if (tsdKind === 'expiry') note = 'взяли товар с коротким сроком';
      else if (tsdKind === 'barcode') note = 'взяли без скана — могли перепутать';
      else { picked = 0; note = 'не достали с ТСД'; }
    }
    if (reveal.errorLine?.lineIndex === i) {
      picked = Math.min(picked, reveal.errorLine.picked);
      note = `${picker.name} ошибся с количеством — зависит от его точности`;
    }
    return { name: game.products[l.productId]?.name ?? l.productId, qty: l.qty, picked, note };
  });
  const share = RESULT_SHARE[reveal.final];
  return {
    taskNumber: task.number,
    picker,
    optionLabel: tsdText ? 'Взяли ТСД' : option?.label ?? '',
    auto: c?.auto ?? false,
    worked,
    /** Подпись итога решения: «Сработало» / «Не сработало», для игры на ТСД — её исход. */
    verdict: c?.tsd ? c.tsd : worked ? 'Сработало' : 'Не сработало',
    title: tsdText ? tsdText.title : option ? fillText(worked ? option.okTitle : option.badTitle, ctx) : '',
    text: tsdText ? fillText(tsdText.text, ctx) : option ? fillText(worked ? option.okText : option.badText, ctx) : '',
    lines,
    money: { got: Math.round(task.reward.money * share.money), of: task.reward.money },
    rating: { got: task.reward.rating * share.rating, of: task.reward.rating },
    xp: RESULT_XP,
    outcome: reveal.final,
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
    secondsLeft: Math.max(0, g.timeLimit - g.elapsed),
    elapsed: g.elapsed,
    timeLimit: g.timeLimit,
    perfectSeconds: EXPIRY.perfectSeconds,
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
