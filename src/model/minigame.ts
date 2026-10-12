// «Взять ТСД» и сессия мини-игры (docs/06-minigames.md, раздел 10; docs/09-architecture.md, раздел 6).

/** Висит предложение «Взять ТСД?»: сборщик стоит и ждёт ответа игрока. */
export type TsdOffer = {
  taskId: string;
  pickerId: string;
  expiresAt: number; // игровое время, когда предложение сгорит и сборщик пойдёт работать сам
};

import type { Address } from './address';

/** Стеллаж по номеру аллеи и номеру в аллее (адрес без полки). */
export type RackRef = { aisle: number; rack: number };

/**
 * Идёт личная мини-игра. Пока заглушка: сборщик работает сам, остальной мир замедлен (M5b),
 * игрок может выбрать стеллаж и посмотреть на него вблизи (M5c), кликнуть по товару на полке (M5d).
 * Сканы и ошибки — M5e (06, раздел 10).
 */
export type MinigameSession = {
  taskId: string;
  pickerId: string;
  startedAt: number;       // игровое время
  focus: RackRef | null;   // выбранный стеллаж (подсвечен на сцене)
  atFocus: boolean;        // камера у выбранного стеллажа; false — общий вид склада
  inspected: Address | null; // полка, по товару на которой кликнул игрок (M5d; в M5e клик станет сканом)
};
