// Хранилище игры (09, раздел 8): единственный источник правды.
// Действия — тонкие обёртки: взять состояние, вызвать чистую функцию из rules, положить результат.
import { create } from 'zustand';
import type { GameState } from '../model/game';
import type { Outcome } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from '../rules/warehouse';
import { createInitialGame } from '../rules/game';
import { acceptTsd, declineTsd, sendPicker } from '../rules/tsd';
import { chooseRack, leaveRack, scanShelf } from '../rules/minigames/picking';
import { answerCall, callText } from '../rules/calls';
import type { Call, OutcomeReveal } from '../model/call';
import type { Address } from '../model/address';
import { advanceWorld } from '../rules/advance';
import { worldDt } from '../rules/time';

/** Карта не меняется во время игры, поэтому строится один раз и не хранится в состоянии (09, 4.1а). */
export const WAREHOUSE_MAP = buildWarehouseMap(WAREHOUSE_LAYOUT);

export type Toast = { id: number; taskNumber: number; pickerName: string; outcome: Outcome };

/** Окно вызова после ответа: ~2 с подсвечен выбранный вариант — «Ваше решение» или «Лаки решил сам» (13.10). */
export type CallFlash = { id: number; call: Call; text: string; optionId: string; auto: boolean };

/** Окно результата после заказа с развилкой: раскрытие исхода (13.10; 10, раздел 3). */
export type ResultCard = { id: number; taskNumber: number; pickerId: string; reveal: OutcomeReveal };

/** Состояние интерфейса: что выделено и что открыто. Не игровое, не сохраняется. */
export type UiState = {
  assignTaskId: string | null;  // для какого задания открыто окно «Кого отправить?»
  chosenPickerId: string | null;
  toasts: Toast[];
  nextToastId: number;          // общий счётчик id для всплывашек, вспышек и окон результата
  callFlashes: CallFlash[];
  results: ResultCard[];        // очередь окон результата: показывается первое
};

type Store = {
  game: GameState;
  ui: UiState;
  openAssign: (taskId: string) => void;
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
  dismissToast: (id: number) => void;
  dismissFlash: (id: number) => void;
  dismissResult: (id: number) => void;
  /** Вызывается каждый кадр из GameLoop: двигает игровое время. */
  tick: (realDt: number) => void;
  togglePause: () => void;
  setPlayerSpeed: (speed: 1 | 2) => void;
};

/** Случайное зерно для новой игры. Math.random можно здесь, но не в rules (09, раздел 5.2). */
const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export const useGameStore = create<Store>((set) => ({
  game: createInitialGame(WAREHOUSE_MAP, newSeed()),
  ui: { assignTaskId: null, chosenPickerId: null, toasts: [], nextToastId: 1, callFlashes: [], results: [] },

  openAssign: (taskId) => set((s) => ({ ui: { ...s.ui, assignTaskId: taskId, chosenPickerId: null } })),
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
      const flash: CallFlash = { id: s.ui.nextToastId, call, text: callText(s.game, call), optionId, auto: false };
      return { game, ui: { ...s.ui, callFlashes: [...s.ui.callFlashes, flash], nextToastId: s.ui.nextToastId + 1 } };
    }),
  scanShelf: (address, productId) => set((s) => ({ game: scanShelf(s.game, WAREHOUSE_MAP, address, productId) })),

  tick: (realDt) =>
    set((s) => {
      // автопауза, пока открыто окно «Кого отправить?» (02, раздел 2)
      const dt = worldDt(s.game.clock, realDt, s.ui.assignTaskId !== null);
      if (dt === 0) return s;
      const { state, events } = advanceWorld(s.game, WAREHOUSE_MAP, dt);
      if (events.length === 0) return { game: state };
      let nextToastId = s.ui.nextToastId;
      const toasts: Toast[] = [];
      const flashes: CallFlash[] = [];
      const results: ResultCard[] = [];
      for (const e of events) {
        if (e.kind === 'callAnswered') {
          // таймер истёк — подсветить, что выбрал сборщик (текст — по прежнему состоянию, пока вызов был на экране)
          flashes.push({ id: nextToastId++, call: e.call, text: callText(s.game, e.call), optionId: e.optionId, auto: true });
        } else if (e.reveal) {
          results.push({ id: nextToastId++, taskNumber: state.tasks[e.taskId].number, pickerId: e.pickerId, reveal: e.reveal });
        } else {
          toasts.push({
            id: nextToastId++,
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
          callFlashes: [...s.ui.callFlashes, ...flashes],
          results: [...s.ui.results, ...results],
          nextToastId,
        },
      };
    }),

  togglePause: () =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, paused: !s.game.clock.paused } } })),
  setPlayerSpeed: (speed) =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, playerSpeed: speed, paused: false } } })),

  dismissToast: (id) => set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
  dismissFlash: (id) => set((s) => ({ ui: { ...s.ui, callFlashes: s.ui.callFlashes.filter((f) => f.id !== id) } })),
  dismissResult: (id) => set((s) => ({ ui: { ...s.ui, results: s.ui.results.filter((r) => r.id !== id) } })),
}));
