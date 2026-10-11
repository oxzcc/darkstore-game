// Хранилище игры (09, раздел 8): единственный источник правды.
// Действия — тонкие обёртки: взять состояние, вызвать чистую функцию из rules, положить результат.
import { create } from 'zustand';
import type { GameState } from '../model/game';
import type { Outcome } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from '../rules/warehouse';
import { createInitialGame } from '../rules/game';
import { dispatchTask } from '../rules/tasks/lifecycle';
import { advanceWorld } from '../rules/advance';
import { worldDt } from '../rules/time';

/** Карта не меняется во время игры, поэтому строится один раз и не хранится в состоянии (09, 4.1а). */
export const WAREHOUSE_MAP = buildWarehouseMap(WAREHOUSE_LAYOUT);

export type Toast = { id: number; taskNumber: number; pickerName: string; outcome: Outcome };

/** Состояние интерфейса: что выделено и что открыто. Не игровое, не сохраняется. */
export type UiState = {
  assignTaskId: string | null;  // для какого задания открыто окно «Кого отправить?»
  chosenPickerId: string | null;
  toasts: Toast[];
  nextToastId: number;
};

type Store = {
  game: GameState;
  ui: UiState;
  openAssign: (taskId: string) => void;
  closeAssign: () => void;
  choosePicker: (pickerId: string) => void;
  sendChosenPicker: () => void;
  dismissToast: (id: number) => void;
  /** Вызывается каждый кадр из GameLoop: двигает игровое время. */
  tick: (realDt: number) => void;
  togglePause: () => void;
  setPlayerSpeed: (speed: 1 | 2) => void;
};

/** Случайное зерно для новой игры. Math.random можно здесь, но не в rules (09, раздел 5.2). */
const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export const useGameStore = create<Store>((set) => ({
  game: createInitialGame(WAREHOUSE_MAP, newSeed()),
  ui: { assignTaskId: null, chosenPickerId: null, toasts: [], nextToastId: 1 },

  openAssign: (taskId) => set((s) => ({ ui: { ...s.ui, assignTaskId: taskId, chosenPickerId: null } })),
  closeAssign: () => set((s) => ({ ui: { ...s.ui, assignTaskId: null, chosenPickerId: null } })),
  choosePicker: (pickerId) => set((s) => ({ ui: { ...s.ui, chosenPickerId: pickerId } })),

  sendChosenPicker: () =>
    set((s) => {
      const { assignTaskId, chosenPickerId } = s.ui;
      if (!assignTaskId || !chosenPickerId) return s;
      return {
        game: dispatchTask(s.game, WAREHOUSE_MAP, assignTaskId, chosenPickerId),
        ui: { ...s.ui, assignTaskId: null, chosenPickerId: null },
      };
    }),

  tick: (realDt) =>
    set((s) => {
      // автопауза, пока открыто окно «Кого отправить?» (02, раздел 2)
      const dt = worldDt(s.game.clock, realDt, s.ui.assignTaskId !== null);
      if (dt === 0) return s;
      const { state, events } = advanceWorld(s.game, WAREHOUSE_MAP, dt);
      if (events.length === 0) return { game: state };
      let nextToastId = s.ui.nextToastId;
      const toasts: Toast[] = events.map((e) => ({
        id: nextToastId++,
        taskNumber: state.tasks[e.taskId].number,
        pickerName: state.pickers[e.pickerId].name,
        outcome: e.outcome,
      }));
      return { game: state, ui: { ...s.ui, toasts: [...s.ui.toasts, ...toasts], nextToastId } };
    }),

  togglePause: () =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, paused: !s.game.clock.paused } } })),
  setPlayerSpeed: (speed) =>
    set((s) => ({ game: { ...s.game, clock: { ...s.game.clock, playerSpeed: speed, paused: false } } })),

  dismissToast: (id) => set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
}));
