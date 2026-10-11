// Сборщик (docs/05-pickers.md, docs/09-architecture.md, раздел 4.5).
import type { TaskType } from './task';
import type { Cell } from './warehouse';

export type PickerState = 'idle' | 'walking' | 'waiting' | 'working' | 'playing' | 'resting';

export type PickerStats = {
  speed: number;    // 1–10
  accuracy: number; // 1–10
  fatigue: number;  // 0–100 (%)
};

export type Picker = {
  id: string;
  name: string;
  breed: string;                 // порода собаки (08, раздел 5)
  color: string;                 // цвет на сцене и в UI, не пересекается с цветами исходов
  state: PickerState;
  taskId: string | null;
  stats: PickerStats;
  specialization: Record<TaskType, { level: number; xp: number }>;
  position: Cell;                // клетка, где стоит
  path: Cell[];                  // маршрут, если идёт (M4)
  pathProgress: number;          // сколько клеток пути пройдено
  workEndsAt: number | null;     // когда закончит работу или перерыв
  // на будущее (05, раздел 2): пока не используются
  description?: string;
  traits?: string[];
};
