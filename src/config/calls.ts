// Развилки (docs/10-minigames-concept.md, раздел 3). Все числа и тексты — стартовые, меняются здесь.
// Решения автора 12.10: шанс 35% на задание, не больше одной на задание; риск игрок видит только словом;
// до 3 вызовов на экране, остальные ждут в очереди (их таймер не идёт); бонуса опыта за ответ нет.
import type { RiskLevel } from '../model/call';
import type { Outcome, TaskType } from '../model/task';

export const CALLS = {
  chance: 0.35,          // шанс развилки на задание
  answerSeconds: 8,      // таймер ответа, игровые секунды (на паузе стоит)
  maxVisible: 3,         // сколько вызовов на экране одновременно
  /** Шанс осложнения по риску: осложнение ухудшает исход задания на ступень. */
  complication: { low: 0.1, medium: 0.35, high: 0.6 } as Record<RiskLevel, number>,
};

/** Вариант ответа. Время добавляется к работе сборщика; cap — исход не выше этого. */
export type CallOption = {
  id: string;
  label: string;          // «Поискать рядом»
  seconds: number;        // сколько добавит к работе
  risk: RiskLevel;
  note?: string;          // последствие словами: «клиент может быть недоволен»
  busyLabel: string;      // что пишет карточка сборщика, пока он это делает
  cap?: Outcome;          // исход не выше (например, пропустил позицию — не выше «с ошибками»)
  requires?: { stat: 'speed' | 'accuracy'; min: number }; // вариант есть только у сборщика с такой характеристикой
};

/**
 * Ситуация. В тексте подставляются {address} (адрес позиции), {product} (товар), {aisle} (аллея).
 * Сейчас только для сборки; остальные типы заданий — M7.
 */
export type Situation = { id: string; taskType: TaskType; text: string; options: CallOption[] };

export const SITUATIONS: Situation[] = [
  {
    id: 'notVisible',
    taskType: 'order',
    text: 'На {address} не видно: {product}. Что делаю?',
    options: [
      { id: 'search', label: 'Поискать рядом', seconds: 15, risk: 'medium', busyLabel: 'Ищет рядом' },
      { id: 'substitute', label: 'Заменить похожим', seconds: 0, risk: 'medium', note: 'клиент может быть недоволен', busyLabel: 'Берёт замену' },
      { id: 'skip', label: 'Пропустить позицию', seconds: 0, risk: 'low', note: 'исход не выше «с ошибками»', cap: 'withErrors', busyLabel: 'Пропускает позицию' },
      { id: 'checkNear', label: 'Проверить соседние полки', seconds: 8, risk: 'low', busyLabel: 'Проверяет соседние полки', requires: { stat: 'accuracy', min: 7 } },
    ],
  },
  {
    id: 'jam',
    taskType: 'order',
    text: 'В аллее {aisle} пробка: проход занят тележкой. Что делаю?',
    options: [
      { id: 'wait', label: 'Подождать', seconds: 8, risk: 'low', busyLabel: 'Ждёт, пока освободится проход' },
      { id: 'around', label: 'Обойти по соседней аллее', seconds: 5, risk: 'medium', busyLabel: 'Обходит' },
      { id: 'squeeze', label: 'Протиснуться', seconds: 0, risk: 'high', note: 'можно уронить товар', busyLabel: 'Протискивается' },
      { id: 'slip', label: 'Проскочить ловко', seconds: 0, risk: 'low', busyLabel: 'Проскакивает', requires: { stat: 'speed', min: 7 } },
    ],
  },
  {
    id: 'expiring',
    taskType: 'order',
    text: '{product}: у товара срок истекает сегодня. Что делаю?',
    options: [
      { id: 'take', label: 'Взять как есть', seconds: 0, risk: 'high', note: 'клиент может пожаловаться', busyLabel: 'Берёт товар' },
      { id: 'fresher', label: 'Поискать свежее', seconds: 10, risk: 'low', busyLabel: 'Ищет свежее' },
      { id: 'report', label: 'Сообщить на списание', seconds: 3, risk: 'low', note: 'отметка для списания', busyLabel: 'Сообщает на списание' },
    ],
  },
];

export const SITUATION_BY_ID: Record<string, Situation> = Object.fromEntries(SITUATIONS.map((s) => [s.id, s]));
