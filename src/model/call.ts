// Развилки (docs/10-minigames-concept.md, раздел 3): сборщик упирается в ситуацию и зовёт диспетчера.
import type { Outcome, OutcomeChances } from './task';
import type { StatKey } from './picker';
import type { TsdGameKind } from './tsdGame';

/**
 * Сложность варианта (docs/10, раздел 14.6; X2): «надёжно» — без проверки, у всех одни шансы;
 * «обычно» и «рискованно» — проверка одной характеристики сборщика. Числа — CALLS.levels.
 */
export type OptionLevel = 'safe' | 'normal' | 'risky';

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
  auto: boolean;   // true — игрок не ответил, решил сборщик (характеристика −2)
  /** Шансы варианта у этого сборщика в момент ответа — ровно то, что было на карточке; по ним в конце задания один бросок. Нет у ТСД. */
  chances?: OutcomeChances;
  /** Что проверял вариант и сколько было у сборщика (с усталостью и −2 за «решил сам»); нет — «надёжно» или ТСД. */
  check?: { stat: StatKey; value: number };
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

/** Раскрытие развилки в конце задания (X2): один бросок по шансам варианта. */
export type CallReveal = CallAnswer & {
  roll: number;        // куда встал маркер на полосе шансов варианта, 0…1 (у ТСД — 0)
  capped: boolean;     // у варианта есть ограничение («исход не выше неплохо»)
  after: Outcome;      // исход задания
};

/** Раскрытие исхода задания с развилкой (как «шарик» в Dispatch): шансы варианта и куда встал маркер. */
export type OutcomeReveal = {
  chances: Record<Outcome, number>; // ширины зон «идеально / неплохо / провал» — шансы выбранного варианта
  roll: number;                     // куда встал маркер, 0…1
  base: Outcome;                    // исход броска (то же, что final)
  calls: CallReveal[];
  final: Outcome;
  /** Исход хуже «идеально» по характеристикам: на какой позиции сборщик ошибся и сколько штук собрал (строка чека, ui_12). */
  errorLine?: { lineIndex: number; picked: number };
};
