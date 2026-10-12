// Развилки (docs/10-minigames-concept.md, раздел 3): сборщик упирается в ситуацию и зовёт диспетчера.

/** Риск варианта. Игрок видит только слово (решение автора 12.10), шансы осложнения — в config. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Вызов от сборщика, который висит на экране (или ждёт в очереди). */
export type Call = {
  id: string;
  taskId: string;
  pickerId: string;
  situationId: string;      // ситуация из config/calls.ts
  lineIndex: number;        // к какой позиции заказа относится (для текста: адрес, товар, аллея)
  optionIds: string[];      // какие варианты доступны этому сборщику (часть открывают характеристики)
  expiresAt: number | null; // игровое время, когда сборщик решит сам; null — ждёт в очереди, таймер не идёт
};

/** Как развилка разрешилась — записывается в задание; по этому журналу считается исход (и в M6 — последствия). */
export type CallAnswer = {
  situationId: string;
  optionId: string;
  risk: RiskLevel; // уже с учётом «решил сам» (на ступень выше)
  auto: boolean;   // true — игрок не ответил, решил сборщик
};
