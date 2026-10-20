// Развилки (docs/10-minigames-concept.md, раздел 3): сборщик упирается в ситуацию и зовёт диспетчера.
import type { Outcome } from './task';
import type { TsdGameKind } from './tsdGame';

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
  autoOptionId: string;     // что выберет сборщик сам, если не ответить (решено заранее — окно пишет «Лаки выберет вариант 1»)
  expiresAt: number | null; // игровое время, когда сборщик решит сам; null — ждёт в очереди, таймер не идёт
  /** В окне есть вариант «Взять ТСД» с этой игрой (выпадает с шансом, 10, раздел 11.1); null — нет. */
  tsd: TsdGameKind | null;
};

/** Как развилка разрешилась — записывается в задание; по этому журналу считается исход (и в M6 — последствия). */
export type CallAnswer = {
  situationId: string;
  lineIndex: number;  // позиция заказа, к которой относилась развилка
  optionId: string;
  risk: RiskLevel; // уже с учётом «решил сам» (на ступень выше)
  auto: boolean;   // true — игрок не ответил, решил сборщик
  /** Игрок взял ТСД (optionId = TSD_OPTION_ID): итог его игры. Броска осложнения тогда нет (10, раздел 11.4). */
  tsd?: Outcome;
  /** Как прошла игра на ТСД — для кадра «Вы решили» в окне итога (решение автора 20.10, вариант А). */
  tsdStats?: TsdStats;
};

/** Цифры игры на ТСД: время в игре и что сделано. В старых сохранениях их нет — окно тогда показывает только оценку. */
export type TsdStats =
  | { kind: 'depth'; seconds: number; moves: number; best: number; timeout: boolean; tooMany: boolean }
  | { kind: 'expiry'; seconds: number; timeout: boolean; takenDays: number | null; mode: 'fresh' | 'expired' }
  | { kind: 'barcode'; seconds: number; timeout: boolean; tries: number; attempts: number; solved: boolean };

/** Раскрытие одной развилки в конце заказа: выпало ли осложнение и каким стал исход. */
export type CallReveal = CallAnswer & {
  chance: number;      // шанс осложнения по риску (для ширины зоны на полосе; игрок видит только полосу)
  roll: number;        // куда «упал маркер», 0…1: меньше chance — осложнение
  complication: boolean;
  capped: boolean;     // сработало ограничение варианта («исход не выше с ошибками»)
  after: Outcome;      // исход после этой развилки
};

/** Раскрытие исхода заказа (как «шарик» в Dispatch): бросок по характеристикам, потом развилки по очереди. */
export type OutcomeReveal = {
  chances: Record<Outcome, number>; // ширины зон «идеально / с ошибками / провал»
  roll: number;                     // куда упал маркер на основной полосе, 0…1
  base: Outcome;                    // исход по характеристикам
  calls: CallReveal[];
  final: Outcome;
  /** Исход хуже «идеально» по характеристикам: на какой позиции сборщик ошибся и сколько штук собрал (строка чека, ui_12). */
  errorLine?: { lineIndex: number; picked: number };
};
