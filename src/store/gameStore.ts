// Хранилище игры (09, раздел 8): единственный источник правды.
// Действия — тонкие обёртки: взять состояние, вызвать чистую функцию из rules, положить результат.
import { create } from 'zustand';
import type { GameState } from '../model/game';
import type { Outcome } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from '../rules/warehouse';
import { createInitialGame } from '../rules/game';
import { dispatchTask } from '../rules/tasks/lifecycle';

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
      const task = s.game.tasks[assignTaskId];
      const { state, event } = dispatchTask(s.game, assignTaskId, chosenPickerId, 0);
      const toast: Toast = {
        id: s.ui.nextToastId,
        taskNumber: task.number,
        pickerName: state.pickers[event.pickerId].name,
        outcome: event.outcome,
      };
      return {
        game: state,
        ui: {
          ...s.ui,
          assignTaskId: null,
          chosenPickerId: null,
          toasts: [...s.ui.toasts, toast],
          nextToastId: s.ui.nextToastId + 1,
        },
      };
    }),

  dismissToast: (id) => set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
}));
