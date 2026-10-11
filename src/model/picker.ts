// Сборщик (docs/05-pickers.md, docs/09-architecture.md, раздел 4.5).
import type { TaskType } from './task';
import type { Cell } from './warehouse';

export type PickerState = 'idle' | 'walking' | 'waiting' | 'working' | 'playing' | 'resting';

export type PickerStats = {
  speed: number;    // 1–10
  accuracy: number; // 1–10
  fatigue: number;  // 0–100 (%)
};

/** Один шаг работы над заданием: дойти до клетки, собрать позицию заказа или расфасовать. */
export type JobStep =
  | { kind: 'walk'; to: Cell; label: string }        // label — куда идёт, для экрана: «к 2.3.2» или «на фасовку»
  | { kind: 'pick'; lineIndex: number; seconds: number }
  | { kind: 'pack'; seconds: number };

/** Текущая работа сборщика: список шагов и где он сейчас. */
export type PickerJob = {
  taskId: string;
  steps: JobStep[];
  stepIndex: number;   // какой шаг выполняется
  stepElapsed: number; // сколько секунд прошло в текущем рабочем шаге (pick/pack)
};

/** Что сборщик делает сейчас — для карточек интерфейса (считает rules/jobs.ts). */
export type PickerActivity =
  | { kind: 'idle' }
  | { kind: 'walking'; to: string; secondsLeft: number; progress: number }
  | { kind: 'picking'; line: number; lines: number; progress: number }
  | { kind: 'packing'; progress: number };

export type Picker = {
  id: string;
  name: string;
  breed: string;                 // порода собаки (08, раздел 5)
  color: string;                 // цвет на сцене и в UI, не пересекается с цветами исходов
  state: PickerState;
  taskId: string | null;
  stats: PickerStats;
  specialization: Record<TaskType, { level: number; xp: number }>;
  position: Cell;                // клетка, где стоит; во время ходьбы — откуда вышел на текущий отрезок
  path: Cell[];                  // оставшийся маршрут текущего отрезка (без стартовой клетки)
  pathProgress: number;          // сколько клеток пути пройдено (дробное — между клетками)
  workEndsAt: number | null;     // для перерыва (M8); работа над заданием считается по job
  job: PickerJob | null;
  // на будущее (05, раздел 2): пока не используются
  description?: string;
  traits?: string[];
};
