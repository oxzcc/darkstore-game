// Работа сборщика над заданием: из каких шагов она состоит и что сейчас происходит.
import type { Picker, PickerActivity, PickerJob } from '../model/picker';
import type { OrderTask } from '../model/task';
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { formatAddress } from './address';
import { accessForAddress, findPath, zoneAccess } from './warehouse';
import { packSeconds, pickSeconds, secondsPerCell, travelSeconds } from './time';

/**
 * Маршрут заказа (03, раздел 6): по адресам позиций в том порядке, как они идут в заказе (07, раздел 7),
 * у каждого адреса собрать позицию, затем отнести в зону фасовки и расфасовать.
 */
export function buildOrderJob(map: WarehouseMap, picker: Picker, task: OrderTask): PickerJob {
  const steps: PickerJob['steps'] = [];
  task.payload.lines.forEach((line, i) => {
    steps.push({ kind: 'walk', to: accessForAddress(map, line.address), label: `к ${formatAddress(line.address)}` });
    steps.push({ kind: 'pick', lineIndex: i, seconds: pickSeconds(picker) });
  });
  steps.push({ kind: 'walk', to: zoneAccess(map, 'packing'), label: 'на фасовку' });
  steps.push({ kind: 'pack', seconds: packSeconds() });
  return { taskId: task.id, steps, stepIndex: 0, stepElapsed: 0 };
}

/** Время до первой точки задания из того места, где сборщик стоит. null — дойти нельзя. */
export function etaToTask(map: WarehouseMap, picker: Picker, task: OrderTask): number | null {
  const first = task.payload.lines[0];
  if (!first) return 0;
  const path = findPath(map, picker.position, accessForAddress(map, first.address));
  return path ? travelSeconds(picker, path.length) : null;
}

/** Что сборщик делает сейчас — для карточки в интерфейсе. Без текстов: подписи собирает UI. */
export function pickerActivity(game: GameState, pickerId: string): PickerActivity {
  const p = game.pickers[pickerId];
  const job = p?.job;
  const step = job?.steps[job.stepIndex];
  if (!p || !job || !step) return { kind: 'idle' };
  if (step.kind === 'walk') {
    const total = p.path.length;
    const left = Math.max(0, total - p.pathProgress);
    return {
      kind: 'walking',
      to: step.label,
      secondsLeft: left * secondsPerCell(p),
      progress: total > 0 ? p.pathProgress / total : 0,
    };
  }
  const progress = Math.min(1, job.stepElapsed / step.seconds);
  if (step.kind === 'pick') {
    const task = game.tasks[job.taskId];
    const lines = task?.type === 'order' ? task.payload.lines.length : 1;
    return { kind: 'picking', line: step.lineIndex + 1, lines, progress };
  }
  return { kind: 'packing', progress };
}
