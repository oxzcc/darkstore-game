// «Взять ТСД» и сессия мини-игры (docs/06-minigames.md, раздел 10; docs/09-architecture.md, раздел 6).

/** Висит предложение «Взять ТСД?»: сборщик стоит и ждёт ответа игрока. */
export type TsdOffer = {
  taskId: string;
  pickerId: string;
  expiresAt: number; // игровое время, когда предложение сгорит и сборщик пойдёт работать сам
};

/**
 * Идёт личная мини-игра. Пока (M5b) — заглушка: сборщик работает сам, но остальной мир замедлен.
 * В M5e сюда добавятся выбранный стеллаж, сканы и ошибки (06, раздел 10).
 */
export type MinigameSession = {
  taskId: string;
  pickerId: string;
  startedAt: number; // игровое время
};
