// Состояние игры целиком (docs/09-architecture.md, раздел 4.6). Обычный JSON: без классов и функций.
// Часть полей из 09 (время, кампания, поставки, паллеты) добавится на своих этапах.
import type { Picker } from './picker';
import type { Product } from './product';
import type { Stock } from './stock';
import type { Outcome, Task } from './task';

/** Что случилось — для всплывающих сообщений и итогов смены. */
export type ShiftEvent = {
  kind: 'taskDone';
  taskId: string;
  pickerId: string;
  outcome: Outcome;
};

export type GameState = {
  version: number;   // версия формата состояния
  rngSeed: number;   // текущее состояние генератора случайностей
  nextId: number;    // счётчик для новых id

  money: number;     // пока не меняется: деньги и рейтинг от исходов — M6
  rating: number;

  products: Record<string, Product>;
  stock: Stock;
  tasks: Record<string, Task>;
  pickers: Record<string, Picker>;

  shiftLog: ShiftEvent[];
};
