// Как выглядит тип задания на экране и на сцене (08, раздел 10.2). Только данные.
import type { TaskType } from '../model/task';
import type { IconName } from './icons';

/**
 * Тип задания: название и значок (08, раздел 10.2). Название одного цвета у всех типов — различаются значком и подписью
 * (строгое цветовое кодирование, 10, раздел 13.1). Списание — урна с крестом (08, раздел 10.2).
 */
export const TASK_TYPE_LOOK: Record<TaskType, { name: string; icon: IconName; receipt: string; doneBy: string; tint: string; pin: string }> = {
  // receipt и doneBy — шапка чека в окне итога: «ЗАКАЗ №12 · собрал Лаки» (ui_12)
  // tint — пастельная плитка под значком в панели заданий (концепт-рендер, 17.10)
  // pin — кольцо-таймер пина задания на складе (T1, решение автора 18.10: вариант «а», иконка с таймером)
  order: { name: 'Сборка', icon: 'pick', receipt: 'ЗАКАЗ', doneBy: 'собрал', tint: '#EFE3FF', pin: '#8E63E0' },
  receiving: { name: 'Приёмка', icon: 'truck', receipt: 'ПРИЁМКА', doneBy: 'принял', tint: '#DBE9FF', pin: '#3F7FE0' },
  putaway: { name: 'Выкладка', icon: 'rack', receipt: 'ВЫКЛАДКА', doneBy: 'выложил', tint: '#D6F6F1', pin: '#1FA08F' },
  writeoff: { name: 'Списание', icon: 'scrap', receipt: 'СПИСАНИЕ', doneBy: 'списал', tint: '#FFE0E0', pin: '#E0707C' },
};
