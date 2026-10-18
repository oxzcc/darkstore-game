// Хранилище игры (09, раздел 8): единственный источник правды.
// Действия — тонкие обёртки: взять состояние, вызвать чистую функцию из rules, положить результат.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistOptions } from './persist';
import type { GameState } from '../model/game';
import type { Outcome, TaskType } from '../model/task';
import { WAREHOUSE_LAYOUT, WAREHOUSE_VIEW } from '../config/warehouse';
import { ROLL_REEL } from '../config/balance';
import { buildWarehouseMap } from '../rules/warehouse';
import { createInitialGame } from '../rules/game';
import { acceptTsd, declineTsd, sendPicker } from '../rules/tsd';
import { chooseRack, leaveRack, scanShelf } from '../rules/minigames/picking';
import { answerCall, callText } from '../rules/calls';
import { submitBarcodeGuess, closeExpiryUnit, closeTsdGame, depthMovesFrom, moveDepthBox, openExpiryUnit, takeExpiryUnit, tapDepthBox } from '../rules/tsdGame';
import { TSD_OPTION_ID } from '../config/calls';
import type { Call, OutcomeReveal } from '../model/call';
import type { Address } from '../model/address';
import { advanceWorld } from '../rules/advance';
import { rewardFor } from '../rules/rewards';
import { outcomeBreakdown, type ChancePart } from '../rules/outcome';
import { worldDt } from '../rules/time';
import { finishCampaign, startNextShift } from '../rules/shift';
import { endRest, sendToRest } from '../rules/rest';
import { isTutorial } from '../rules/shiftPlan';
import { currentHint, markHintSeen } from '../rules/tutorial';
import type { HintId } from '../config/tutorial';

/** Карта не меняется во время игры, поэтому строится один раз и не хранится в состоянии (09, 4.1а). */
export const WAREHOUSE_MAP = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Всплывашка об итоге задания; expired — срок взять задание вышел (M8b), тогда pickerName пустой. */
export type Toast = { id: number; taskType: TaskType; taskNumber: number; pickerName: string; outcome: Outcome; expired?: boolean };
/** Всплывашка у денег и рейтинга в верхней панели: «+180 ₽», «+0,05» (M6). */
export type Gain = { id: number; money: number; rating: number };

/** Окно вызова после ответа: ~1,5 с подсвечен выбранный вариант — «Ваше решение» или «Лаки решил сам» (13.10).
 *  chain — после него открыть следующую развилку, если она ждёт (решение автора 13.10). */
export type CallFlash = { id: number; call: Call; text: string; optionId: string; auto: boolean; chain: boolean };

/** Окно результата после заказа с развилкой: раскрытие исхода (13.10; 10, раздел 3). */
export type ResultCard = { id: number; taskId: string; taskNumber: number; pickerId: string; reveal: OutcomeReveal; gain?: Gain };
/** Барабан исхода (P3): задание без развилки закрыто. Всплывашка у денег показывается, когда барабан закрыт — чтобы не выдать исход раньше. */
export type RollCard = {
  id: number; taskId: string; taskType: TaskType; taskNumber: number; pickerId: string;
  outcome: Outcome; chances: Record<Outcome, number>; value: number; gain: Gain;
  /** Из чего сложились шансы — по сборщику до задания (после него растут опыт и усталость). */
  parts: ChancePart[];
};

/** Состояние интерфейса: что выделено и что открыто. Не игровое, не сохраняется. */
export type UiState = {
  assignTaskId: string | null;  // для какого задания открыто окно «Кого отправить?»
  profilePickerId: string | null; // открыт профиль сборщика (P2): мир на паузе
  chosenPickerId: string | null;
  toasts: Toast[];
  gains: Gain[];
  nextToastId: number;          // общий счётчик id для всплывашек, вспышек и окон результата
  callFlashes: CallFlash[];
  openCallId: string | null;    // открыто окно развилки (по клику на «!»): мир на паузе
  results: ResultCard[];        // очередь окон результата: показывается первое (не во время игры на ТСД)
  rolls: RollCard[];            // очередь барабанов исхода (P3): показывается первый, мир на паузе
  depthSelected: number | null; // «Глубина»: выбранная коробка (клетка) — сцена подсвечивает, куда её можно сдвинуть
  barcodeInput: number[];       // «Штрихкод»: цифры текущей попытки, которые игрок уже набрал
  /** Камера общего вида (W1): куда игрок её повернул (радианы, 0 — исходный угол) и зум. Не игровое состояние, не сохраняется. */
  camera: { yaw: number; zoom: number };
};

type Store = {
  game: GameState;
  ui: UiState;
  openAssign: (taskId: string) => void;
  /** Профиль сборщика (P2): клик по нижней карточке или по собаке на складе; пока открыт — мир на паузе. */
  openProfile: (pickerId: string) => void;
  closeProfile: () => void;
  closeAssign: () => void;
  choosePicker: (pickerId: string) => void;
  sendChosenPicker: () => void;
  /** «Взять ТСД» / «Пусть работает» на предложении (02, раздел 6). */
  acceptTsd: () => void;
  declineTsd: () => void;
  /** Мини-игра: клик по стеллажу на сцене и «Назад к складу» (06, раздел 2). */
  chooseRack: (aisle: number, rack: number) => void;
  leaveRack: () => void;
  /** Клик по товару на полке у стеллажа — скан одной штуки (06, раздел 5). */
  scanShelf: (address: Address, productId: string) => void;
  /** Ответ на развилку: вариант optionId вызова callId (10, раздел 3). */
  answerCall: (callId: string, optionId: string) => void;
  /** Игра на ТСД из развилки (10, раздел 11): клик по клетке полки в «Глубине»; «К складу» после итога. */
  tapDepthBox: (cell: number) => void;
  moveDepthBox: (to: number) => void;
  closeTsdGame: () => void;
  /** «Срок»: поднять штуку крупно, положить обратно, взять. */
  openExpiryUnit: (index: number) => void;
  closeExpiryUnit: () => void;
  takeExpiryUnit: () => void;
  /** «Штрихкод»: цифра, стереть, «Ввод». */
  barcodeType: (digit: number) => void;
  barcodeErase: () => void;
  barcodeEnter: () => void;
  dismissToast: (id: number) => void;
  dismissGain: (id: number) => void;
  dismissFlash: (id: number) => void;
  /** Клик по «!» над сборщиком — открыть окно развилки; закрыть — мир идёт дальше, таймер «!» тоже. */
  openCall: (callId: string) => void;
  closeCall: () => void;
  dismissResult: (id: number) => void;
  /** Барабан исхода закрыт (сам или кликом): всплывашка у денег (P3). */
  dismissRoll: (id: number) => void;
  /** Вызывается каждый кадр из GameLoop: двигает игровое время. */
  tick: (realDt: number) => void;
  togglePause: () => void;
  /** Перерыв (M8c): отправить свободного сборщика в зону отдыха и вернуть. */
  sendToRest: (pickerId: string) => void;
  endRest: (pickerId: string) => void;
  /** «Понятно» в подсказке обучающей смены (M8d). */
  dismissHint: (id: HintId) => void;
  /** Экран итогов смены (M8a): следующая смена; после последней — итоги кампании; «Начать заново». */
  nextShift: () => void;
  finishCampaign: () => void;
  restartCampaign: () => void;
  setPlayerSpeed: (speed: 1 | 2) => void;
  /** Камера (W1): поворот на четверть круга (кнопки ⟲ ⟳), перетаскивание, зум (колесо, + −), исходный вид. */
  turnCamera: (dir: 1 | -1) => void;
  dragCamera: (deltaYaw: number) => void;
  zoomCamera: (steps: number) => void;
  resetCamera: () => void;
};

/** Окна и всплывашки, которые закрываются, когда кончилась смена или началась новая. */
const clearWindows = (ui: UiState): UiState => ({
  ...ui, assignTaskId: null, chosenPickerId: null, profilePickerId: null, openCallId: null, callFlashes: [], results: [], rolls: [], toasts: [], gains: [],
  depthSelected: null, barcodeInput: [],
});

/** Исходный вид камеры: поворот 0, зум из config. */
const HOME_CAMERA = { yaw: 0, zoom: WAREHOUSE_VIEW.homeCamera.zoom };
const QUARTER = Math.PI / 2;

/** Случайное зерно для новой игры. Math.random можно здесь, но не в rules (09, раздел 5.2). */
const newSeed = () => Math.floor(Math.random() * 2 ** 32);

// persist — сохранение игры в браузере (M8e, store/persist.ts)
export const useGameStore = create<Store>()(persist((set) => ({
  game: createInitialGame(WAREHOUSE_MAP, newSeed()),
  ui: { assignTaskId: null, chosenPickerId: null, profilePickerId: null, toasts: [], gains: [], nextToastId: 1, callFlashes: [], openCallId: null, results: [], rolls: [], depthSelected: null, barcodeInput: [], camera: HOME_CAMERA },

  openAssign: (taskId) => set((s) => ({ ui: { ...s.ui, assignTaskId: taskId, chosenPickerId: null, profilePickerId: null } })),
  openProfile: (pickerId) => set((s) => ({ ui: { ...s.ui, profilePickerId: pickerId } })),
  closeProfile: () => set((s) => ({ ui: { ...s.ui, profilePickerId: null } })),
  closeAssign: () => set((s) => ({ ui: { ...s.ui, assignTaskId: null, chosenPickerId: null } })),
  choosePicker: (pickerId) => set((s) => ({ ui: { ...s.ui, chosenPickerId: pickerId } })),

  sendChosenPicker: () =>
    set((s) => {
      const { assignTaskId, chosenPickerId } = s.ui;
      if (!assignTaskId || !chosenPickerId) return s;
      return {
        game: sendPicker(s.game, WAREHOUSE_MAP, assignTaskId, chosenPickerId),
        ui: { ...s.ui, assignTaskId: null, chosenPickerId: null },
      };
    }),

  acceptTsd: () => set((s) => ({ game: acceptTsd(s.game) })),
  declineTsd: () => set((s) => ({ game: declineTsd(s.game) })),
  chooseRack: (aisle, rack) => set((s) => ({ game: chooseRack(s.game, WAREHOUSE_MAP, aisle, rack) })),
  leaveRack: () => set((s) => ({ game: leaveRack(s.game) })),
  answerCall: (callId, optionId) =>
    set((s) => {
      const call = s.game.calls.find((c) => c.id === callId);
      const game = answerCall(s.game, callId, optionId);
      if (!call || game === s.game) return s;
      // «Взять ТСД» — окно закрывается сразу, камера летит к стеллажу; подсветка выбора не нужна
      if (optionId === TSD_OPTION_ID) return { game, ui: { ...s.ui, openCallId: null } };
      const flash: CallFlash = { id: s.ui.nextToastId, call, text: callText(s.game, call), optionId, auto: false, chain: true };
      return {
        game,
        ui: { ...s.ui, openCallId: null, callFlashes: [...s.ui.callFlashes, flash], nextToastId: s.ui.nextToastId + 1 },
      };
    }),
  // «Глубина»: клик по коробке — выбрать её (или взять нужную из переднего ряда); клик по подсвеченной клетке — сдвинуть туда
  tapDepthBox: (cell) =>
    set((s) => {
      if (s.game.clock.paused) return s;
      const game = tapDepthBox(s.game, cell);
      const canMove = game === s.game && depthMovesFrom(s.game, cell).length > 0;
      const depthSelected = canMove && s.ui.depthSelected !== cell ? cell : null; // повторный клик — снять выбор
      return { game, ui: { ...s.ui, depthSelected } };
    }),
  moveDepthBox: (to) =>
    set((s) => {
      const from = s.ui.depthSelected;
      if (s.game.clock.paused || from === null) return s;
      return { game: moveDepthBox(s.game, from, to), ui: { ...s.ui, depthSelected: null } };
    }),
  closeTsdGame: () => set((s) => ({ game: closeTsdGame(s.game), ui: { ...s.ui, depthSelected: null, barcodeInput: [] } })),
  barcodeType: (digit) =>
    set((s) => {
      const g = s.game.tsdGame;
      if (s.game.clock.paused || g?.kind !== 'barcode' || g.result || s.ui.barcodeInput.length >= g.hiddenCount) return s;
      return { ui: { ...s.ui, barcodeInput: [...s.ui.barcodeInput, digit] } };
    }),
  barcodeErase: () => set((s) => ({ ui: { ...s.ui, barcodeInput: s.ui.barcodeInput.slice(0, -1) } })),
  barcodeEnter: () =>
    set((s) => {
      if (s.game.clock.paused) return s;
      const game = submitBarcodeGuess(s.game, s.ui.barcodeInput);
      return game === s.game ? s : { game, ui: { ...s.ui, barcodeInput: [] } };
    }),
  openExpiryUnit: (index) => set((s) => (s.game.clock.paused ? s : { game: openExpiryUnit(s.game, index) })),
  closeExpiryUnit: () => set((s) => (s.game.clock.paused ? s : { game: closeExpiryUnit(s.game) })),
  takeExpiryUnit: () => set((s) => (s.game.clock.paused ? s : { game: takeExpiryUnit(s.game) })),
  scanShelf: (address, productId) => set((s) => ({ game: scanShelf(s.game, WAREHOUSE_MAP, address, productId) })),

  tick: (realDt) =>
    set((s) => {
      // автопауза, пока открыто окно «Кого отправить?» (02, раздел 2)
      // окна по центру (развилка и итог заказа) тоже ставят мир на паузу
      // во время игры на ТСД окно итога ждёт её конца и мир не держит (решение автора 14.10)
      const resultShown = (s.ui.results.length > 0 || s.ui.rolls.length > 0) && s.game.tsdGame === null; // и барабан исхода (P3)
      // подсказка обучающей смены по центру — тоже пауза (M8d)
      const hintShown = currentHint(s.game, s.ui.openCallId) !== null;
      const dt = worldDt(s.game.clock, realDt, s.ui.assignTaskId !== null || s.ui.profilePickerId !== null || s.ui.openCallId !== null || resultShown || hintShown);
      if (dt === 0) return s;
      const { state, events } = advanceWorld(s.game, WAREHOUSE_MAP, dt);
      // смена кончилась — открытые окна закрываются, поверх всего экран итогов (M8a)
      if (state.campaign.phase !== s.game.campaign.phase) return { game: state, ui: clearWindows(s.ui) };
      if (events.length === 0) return { game: state };
      let nextToastId = s.ui.nextToastId;
      const toasts: Toast[] = [];
      const flashes: CallFlash[] = [];
      const results: ResultCard[] = [];
      const rolls: RollCard[] = [];
      const gains: Gain[] = [];
      for (const e of events) {
        if (e.kind === 'taskExpired') {
          // просрочка: штраф у денег и рейтинга и всплывашка (M8b)
          const t = state.tasks[e.taskId];
          gains.push({ id: nextToastId++, money: -e.money, rating: -e.rating });
          toasts.push({ id: nextToastId++, taskType: t.type, taskNumber: t.number, pickerName: '', outcome: 'failed', expired: true });
          continue;
        }
        // начисленное за задание — всплывашка у денег и рейтинга (те же числа, что прибавил applyTaskResult)
        if (e.kind === 'taskDone') {
          const gain = { id: nextToastId++, ...rewardFor(state.tasks[e.taskId], e.outcome, isTutorial(state)) };
          // без развилки — барабан по центру; деньги всплывут, когда он закроется (P3)
          if (ROLL_REEL.enabled && e.roll && !e.reveal) {
            const t = state.tasks[e.taskId];
            rolls.push({ id: nextToastId++, taskId: e.taskId, taskType: t.type, taskNumber: t.number, pickerId: e.pickerId,
              outcome: e.outcome, chances: e.roll.chances, value: e.roll.value, gain,
              parts: outcomeBreakdown(s.game.pickers[e.pickerId] ?? state.pickers[e.pickerId], t).parts });
            continue;
          }
          gains.push(gain);
        }
        if (e.kind === 'callAnswered') {
          // таймер истёк — подсветить, что выбрал сборщик (текст — по прежнему состоянию, пока вызов был на экране)
          flashes.push({ id: nextToastId++, call: e.call, text: callText(s.game, e.call), optionId: e.optionId, auto: true, chain: false });
        } else if (e.reveal) {
          // окно итога развилки (P4): деньги всплывут, когда его закроют — чтобы барабан не выдал исход раньше
          results.push({ id: nextToastId++, taskId: e.taskId, taskNumber: state.tasks[e.taskId].number, pickerId: e.pickerId, reveal: e.reveal, gain: gains.pop() });
        } else {
          toasts.push({
            id: nextToastId++,
            taskType: state.tasks[e.taskId].type,
            taskNumber: state.tasks[e.taskId].number,
            pickerName: state.pickers[e.pickerId].name,
            outcome: e.outcome,
          });
        }
      }
      return {
        game: state,
        ui: {
          ...s.ui,
          toasts: [...s.ui.toasts, ...toasts],
          gains: [...s.ui.gains, ...gains],
          callFlashes: [...s.ui.callFlashes, ...flashes],
          results: [...s.ui.results, ...results],
          rolls: [...s.ui.rolls, ...rolls],
          nextToastId,
        },
      };
    }),

  dismissHint: (id) => set((s) => ({ game: markHintSeen(s.game, id) })),
  sendToRest: (pickerId) => set((s) => ({ game: sendToRest(s.game, WAREHOUSE_MAP, pickerId) })),
  endRest: (pickerId) => set((s) => ({ game: endRest(s.game, pickerId, WAREHOUSE_MAP) })),
  nextShift: () => set((s) => ({ game: startNextShift(s.game, WAREHOUSE_MAP), ui: clearWindows(s.ui) })),
  finishCampaign: () => set((s) => ({ game: finishCampaign(s.game) })),
  restartCampaign: () => set((s) => ({ game: createInitialGame(WAREHOUSE_MAP, newSeed()), ui: clearWindows(s.ui) })),

  togglePause: () =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, paused: !s.game.clock.paused } } })),
  setPlayerSpeed: (speed) =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, playerSpeed: speed, paused: false } } })),

  dismissToast: (id) => set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
  dismissGain: (id) => set((s) => ({ ui: { ...s.ui, gains: s.ui.gains.filter((g) => g.id !== id) } })),
  // поворот кнопкой — до следующей «четверти», чтобы после перетаскивания вид снова встал ровно
  turnCamera: (dir) => set((s) => ({ ui: { ...s.ui, camera: { ...s.ui.camera, yaw: (Math.round(s.ui.camera.yaw / QUARTER) + dir) * QUARTER } } })),
  dragCamera: (deltaYaw) => set((s) => ({ ui: { ...s.ui, camera: { ...s.ui.camera, yaw: s.ui.camera.yaw + deltaYaw } } })),
  zoomCamera: (steps) => set((s) => {
    const { zoomMin, zoomMax, zoomStep } = WAREHOUSE_VIEW.homeCamera;
    const zoom = Math.min(zoomMax, Math.max(zoomMin, s.ui.camera.zoom * Math.pow(zoomStep, steps)));
    return { ui: { ...s.ui, camera: { ...s.ui.camera, zoom } } };
  }),
  // исходный вид: ближайший к текущему полный оборот, чтобы камера не крутилась лишние круги
  resetCamera: () => set((s) => ({ ui: { ...s.ui, camera: { yaw: Math.round(s.ui.camera.yaw / (2 * Math.PI)) * 2 * Math.PI, zoom: HOME_CAMERA.zoom } } })),
  dismissFlash: (id) =>
    set((s) => {
      const flash = s.ui.callFlashes.find((f) => f.id === id);
      const callFlashes = s.ui.callFlashes.filter((f) => f.id !== id);
      // после вашего решения — следующая ждущая развилка, если есть (решение автора 13.10)
      const next = flash?.chain && !s.ui.openCallId && !s.ui.assignTaskId ? s.game.calls.find((c) => c.expiresAt !== null) : undefined;
      return { ui: { ...s.ui, callFlashes, openCallId: next ? next.id : s.ui.openCallId } };
    }),
  openCall: (callId) =>
    set((s) => (s.game.calls.some((c) => c.id === callId && c.expiresAt !== null) && !s.ui.assignTaskId
      ? { ui: { ...s.ui, openCallId: callId } }
      : s)),
  closeCall: () => set((s) => ({ ui: { ...s.ui, openCallId: null } })),
  dismissResult: (id) => set((s) => {
    const card = s.ui.results.find((r) => r.id === id);
    return { ui: { ...s.ui, results: s.ui.results.filter((r) => r.id !== id), gains: card?.gain ? [...s.ui.gains, card.gain] : s.ui.gains } };
  }),
  dismissRoll: (id) => set((s) => {
    const card = s.ui.rolls.find((r) => r.id === id);
    if (!card) return s;
    return { ui: { ...s.ui, rolls: s.ui.rolls.filter((r) => r.id !== id), gains: [...s.ui.gains, card.gain] } };
  }),
}), persistOptions<Store>()));
