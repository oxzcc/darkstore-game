// Сборщик (docs/05-pickers.md, docs/09-architecture.md, раздел 4.5).
import type { Cell } from './warehouse';

export type PickerState = 'idle' | 'walking' | 'waiting' | 'calling' | 'working' | 'playing' | 'resting';

/**
 * Пять характеристик сборщика, шкала 1–10 (docs/10, раздел 14.3; решения автора 20.10).
 * Ключи в коде: speed — Лапы, accuracy — Нюх (имена остались от первых версий), strength — Сила, memory — Память, friendly — Дружелюбие.
 */
export type StatKey = 'speed' | 'accuracy' | 'strength' | 'memory' | 'friendly';
/** Порядок осей везде (пятиугольник, списки): Лапы сверху, дальше по часовой. */
export const STAT_KEYS: StatKey[] = ['speed', 'accuracy', 'strength', 'memory', 'friendly'];
/** Пять чисел по характеристикам: у сборщика — что умеет, у задания — что нужно (0 — не нужно). */
export type StatBlock = Record<StatKey, number>;

export type PickerStats = StatBlock & {
  fatigue: number;  // 0–100 (%) — состояние, а не характеристика: снижает все пять
};

/** Один шаг работы над заданием: дойти до клетки, собрать позицию заказа или расфасовать. */
export type JobStep =
  // spots — куда можно встать (у стеллажа — любая из его клеток прохода, на фасовке — любая клетка зоны);
  // в начале перехода выбирается ближайшее свободное место и записывается в `to`, чтобы сборщики не стояли друг в друге.
  // label — куда идёт, для экрана: «к 2.3.2» или «на фасовку».
  | { kind: 'walk'; to: Cell; spots: Cell[]; label: string }
  | { kind: 'pick'; lineIndex: number; seconds: number }
  | { kind: 'pack'; seconds: number }
  // выложить позицию выкладки на полку (M7c)
  | { kind: 'place'; lineIndex: number; seconds: number }
  // работа на месте без позиций заказа: «Принимает поставку» (M7b)
  | { kind: 'work'; seconds: number; label: string }
  // задержка из-за ответа на развилку: «Ищет рядом», «Ждёт, пока освободится проход» (10, раздел 3)
  | { kind: 'delay'; seconds: number; label: string };

/** Текущая работа сборщика: список шагов и где он сейчас. */
export type PickerJob = {
  taskId: string;
  steps: JobStep[];
  stepIndex: number;   // какой шаг выполняется
  stepElapsed: number; // сколько секунд прошло в текущем рабочем шаге (pick/pack/delay)
  /** Развилка, запланированная при отправке: на каком шаге сборщик остановится и позовёт диспетчера. */
  call?: { stepIndex: number; lineIndex: number; situationId: string; raised: boolean; forceTsd?: boolean };
};

/** Что сборщик делает сейчас — для карточек интерфейса (считает rules/jobs.ts). */
export type PickerActivity =
  | { kind: 'idle' }
  | { kind: 'waitingTsd'; secondsLeft: number } // висит «Взять ТСД?», сборщик стоит
  | { kind: 'tsdGame' }                           // игрок взял ТСД из развилки: стоит у полки, пока идёт игра
  | { kind: 'atRack' }                            // личная «Сборка»: стоит, ждёт, куда отправит игрок, или у стеллажа
  | { kind: 'calling'; secondsLeft: number | null } // зовёт диспетчера (развилка); null — вызов ждёт в очереди
  | { kind: 'busy'; label: string; progress: number } // делает то, что решили в развилке
  | { kind: 'walking'; to: string; secondsLeft: number; progress: number }
  | { kind: 'picking'; line: number; lines: number; progress: number }
  | { kind: 'placing'; line: number; lines: number; progress: number }
  | { kind: 'packing'; progress: number }
  | { kind: 'resting'; fatigue: number };          // на перерыве в зоне отдыха (M8c)

/** Сколько заданий сборщик закрыл и с каким исходом (P2, профиль сборщика). */
export type PickerTally = { done: number; perfect: number; withErrors: number; failed: number };

export type Picker = {
  id: string;
  name: string;
  breed: string;                 // порода собаки (08, раздел 5)
  color: string;                 // цвет на сцене и в UI, не пересекается с цветами исходов
  state: PickerState;
  taskId: string | null;
  stats: PickerStats;
  /** Рост (docs/10, раздел 14.8): опыт копит сборщик целиком, новый уровень даёт очко; очки игрок вкладывает после смены. */
  level: number;
  xp: number;                    // опыт к следующему уровню
  points: number;                // невложенные очки
  position: Cell;                // клетка, где стоит; во время ходьбы — откуда вышел на текущий отрезок
  path: Cell[];                  // оставшийся маршрут текущего отрезка (без стартовой клетки)
  pathProgress: number;          // сколько клеток пути пройдено (дробное — между клетками)
  workEndsAt: number | null;     // для перерыва (M8); работа над заданием считается по job
  job: PickerJob | null;
  /** Итоги за кампанию (P2). Нет поля (сохранения до P2) — считаем с нуля; за смену считается по shiftLog. */
  tally?: PickerTally;
  // на будущее (05, раздел 2): пока не используются
  description?: string;
  traits?: string[];
};
