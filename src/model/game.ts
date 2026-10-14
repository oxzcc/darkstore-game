// Состояние игры целиком (docs/09-architecture.md, раздел 4.6). Обычный JSON: без классов и функций.
// Часть полей из 09 (кампания) добавится на своих этапах. Поставки и паллеты — с M7b.
import type { MinigameSession, TsdOffer } from './minigame';
import type { TsdGame } from './tsdGame';
import type { Call, OutcomeReveal } from './call';
import type { Delivery, Pallet } from './delivery';
import type { Picker } from './picker';
import type { Product } from './product';
import type { Stock } from './stock';
import type { Outcome, Task } from './task';

/** Что случилось — для всплывающих сообщений и итогов смены. */
export type ShiftEvent =
  | {
      kind: 'taskDone';
      taskId: string;
      pickerId: string;
      outcome: Outcome;
      at: number;             // игровое время
      reveal?: OutcomeReveal; // была развилка — окно результата с раскрытием исхода (10, раздел 3)
    }
  | {
      kind: 'callAnswered';   // таймер развилки истёк, сборщик решил сам — окно подсветит его выбор
      call: Call;
      optionId: string;
      at: number;
    };

export type GameClock = {
  time: number;       // игровое время, секунды (на паузе не растёт)
  paused: boolean;    // ручная пауза
  playerSpeed: 1 | 2; // кнопка ×1 / ×2
};

export type GameState = {
  version: number;   // версия формата состояния
  rngSeed: number;   // текущее состояние генератора случайностей
  nextId: number;    // счётчик для новых id

  clock: GameClock;
  money: number;     // пока не меняется: деньги и рейтинг от исходов — M6
  rating: number;

  products: Record<string, Product>;
  stock: Stock;
  tasks: Record<string, Task>;
  deliveries: Record<string, Delivery>; // поставки (M7b; 10, раздел 13.2)
  pallets: Record<string, Pallet>;
  nextDeliveryAt: number;               // когда приедет следующая поставка, игровое время
  nextWriteoffAt: number;               // когда может появиться следующее задание «Списание» (M7e1)
  pickers: Record<string, Picker>;

  tsdOffer: TsdOffer | null;        // висит «Взять ТСД?» (одно за раз)
  minigame: MinigameSession | null; // идёт личная мини-игра (одна за раз)
  tsdGame: TsdGame | null;         // идёт игра на ТСД из развилки (одна за раз; 10, раздел 11)
  calls: Call[];                    // развилки: вызовы от сборщиков, по порядку появления (10, раздел 3)

  shiftLog: ShiftEvent[];
};
