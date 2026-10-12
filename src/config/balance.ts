// Числа баланса (docs/02-gameplay-loop.md, раздел 12; docs/04-tasks.md, раздел 9).
// Всё здесь — стартовые значения, меняются без правки логики.
import type { OutcomeChances, TaskType } from '../model/task';

/** Версия формата GameState (09, раздел 12). */
export const GAME_STATE_VERSION = 4;

/**
 * «Взять ТСД» (02, раздел 6; 06, разделы 2–3). Допущения из документов, автор их ещё не подтвердил.
 * Обучающая смена со 100% на первое задание каждого типа — вместе с кампанией (M8).
 */
export const TSD: {
  chance: Record<TaskType, number>;
  offerSeconds: number;
  worldSpeedDuringGame: number;
  cameraFlySeconds: number;
} = {
  chance: { order: 0.3, putaway: 0.3, receiving: 0.3, writeoff: 0.3 }, // шанс предложения при «Отправить»
  offerSeconds: 8,           // таймер предложения, игровые секунды (на паузе стоит)
  worldSpeedDuringGame: 0.2, // остальной мир во время мини-игры; свой сборщик идёт ×1
  cameraFlySeconds: 0.6,     // перелёт камеры к стеллажу и обратно, реальные секунды (06, раздел 2.3)
};

/**
 * Время работы сборщиков (утверждено автором для M4, формула исходов — отдельно).
 * Всё «на эталонной скорости» refSpeed; быстрее/медленнее — пропорционально скорости сборщика.
 */
export const TIMING = {
  refSpeed: 5,
  secondsPerCell: 0.5,  // ходьба: секунд на клетку при скорости 5
  pickSeconds: 3,       // сбор одной позиции заказа при скорости 5
  packSeconds: 4,       // фасовка заказа (от скорости не зависит)
  maxFrameSeconds: 0.1, // долгий кадр (свёрнутая вкладка) обрезается, чтобы мир не «прыгал» (09, 7.1)
};

/** Деньги и рейтинг на старте кампании. ОТКРЫТО: точные значения (02, раздел 10). */
export const START_MONEY = 0;
export const START_RATING = 4.5;

/**
 * ВРЕМЕННЫЕ шансы исходов при поручении — одинаковые для всех сборщиков (решение автора для M3).
 * Настоящая формула со скоростью, точностью, специализацией и усталостью — ОТКРЫТО (05, раздел 4).
 */
export const PLACEHOLDER_CHANCES: OutcomeChances = { perfect: 0.6, withErrors: 0.3, failed: 0.1 };

/** Заказы на сборку (04, раздел 5.1). */
export const ORDER = {
  linesPerOrder: [1, 5] as [number, number], // позиций в заказе
  qtyPerLine: [1, 3] as [number, number],    // штук одной позиции
  /** Сложность по числу позиций: до 2 — 1, до 4 — 2, больше — 3 (допущение из 04, раздел 4.2). */
  difficultyByLines: [2, 4],
  /** Сколько открытых заказов держать в очереди. ВРЕМЕННО до генератора по весам (M8). */
  openOrdersTarget: 4,
};

/**
 * Базовая награда за идеальное выполнение. ОТКРЫТО: суммы (04, раздел 4.3).
 * Пока только хранится в задании и показывается; начисление — в M6.
 */
export const REWARD = {
  moneyPerDifficulty: 100,
  ratingPerTask: 0.05,
  typeFactor: { order: 1.0, putaway: 0.8, receiving: 1.2, writeoff: 0.6 },
};
