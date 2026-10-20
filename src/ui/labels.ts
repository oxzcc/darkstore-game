// Подписи и цвета для экрана. Цвета исходов зарезервированы (08, раздел 3.2).
import type { Outcome, TaskType } from '../model/task';
import type { PickerState } from '../model/picker';
import type { TsdGameKind } from '../model/tsdGame';
import type { IconName } from './icons';

/** Порядок исходов на экране: идеально → неплохо → провал (средний исход раньше назывался «С ошибками», переименован автором 14.10). */
export const OUTCOMES_ORDER: Outcome[] = ['perfect', 'withErrors', 'failed'];

export const OUTCOME_LOOK: Record<Outcome, { name: string; color: string; icon: IconName }> = {
  perfect: { name: 'Идеально', color: 'var(--perfect)', icon: 'perfect' },
  withErrors: { name: 'Неплохо', color: 'var(--errors)', icon: 'errors' },
  failed: { name: 'Провал', color: 'var(--failed)', icon: 'fail' },
};

// Тип задания: название, значок, плитка и цвет пина — config/taskLook.ts (их читает и сцена).
import { TASK_TYPE_LOOK } from '../config/taskLook';
export { TASK_TYPE_LOOK };

/** Названия игр на ТСД (10, раздел 11.3). */
export const TSD_GAME_NAME: Record<TsdGameKind, string> = { depth: 'Глубина', expiry: 'Срок', barcode: 'Штрихкод' };

/** «Сборка №12», «Приёмка №15». */
export function taskTitle(task: { type: TaskType; number: number }): string {
  return `${TASK_TYPE_LOOK[task.type].name} №${task.number}`;
}

export const PICKER_STATE_NAME: Record<PickerState, string> = {
  idle: 'Свободен',
  walking: 'Идёт',
  waiting: 'Ждёт решения',
  calling: 'Нужна помощь',
  working: 'Работает',
  playing: 'Играете за него',
  resting: 'Отдыхает',
};

/** Сложность варианта развилки (X2, docs/10 раздел 14.6). */
export const LEVEL_NAME: Record<'safe' | 'normal' | 'risky', string> = {
  safe: 'надёжно',
  normal: 'обычно',
  risky: 'рискованно',
};

/** Имя в родительном падеже: «глазами Коржика», «работа Бурана». Имена сборщиков известны заранее (config/pickers.ts). */
export function nameForm(name: string): string {
  if (/[бвгджзйклмнпрстфхцчшщ]$/.test(name)) return `${name}а`; // Коржик → Коржика, Буран → Бурана
  return name; // Лаки — не склоняется
}

/** Характеристики сборщика собачьими словами (решение автора 18.10). Бодрость = 100% − усталость: у всех трёх «больше — лучше». */
export const STAT_LOOK = {
  speed: { name: 'Лапы', icon: 'paw', hint: 'скорость и ловкость' },
  accuracy: { name: 'Нюх', icon: 'nose', hint: 'заметить: сроки, похожие упаковки, сверка' },
  strength: { name: 'Сила', icon: 'strength', hint: 'тяжёлое, коробки, разбор полки' },
  memory: { name: 'Память', icon: 'memory', hint: 'адреса и маршрут: не забыть, не перепутать' },
  friendly: { name: 'Дружба', icon: 'friendly', hint: 'водитель, клиент, коллеги' }, // «Дружба» — коротко, влезает у осей (решение автора 21.10)
  energy: { name: 'Бодрость', icon: 'energy', hint: 'падает после каждого задания, растёт на перерыве' },
} as const satisfies Record<string, { name: string; icon: IconName; hint: string }>;

