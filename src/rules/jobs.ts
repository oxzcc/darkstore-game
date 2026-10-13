// Работа сборщика над заданием: из каких шагов она состоит и что сейчас происходит.
import type { Picker, PickerActivity, PickerJob } from '../model/picker';
import type { OrderTask } from '../model/task';
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { formatAddress } from './address';
import { accessSpotsForAddress, distancesFrom, zoneAccess, zoneCells } from './warehouse';
import { packSeconds, pickSeconds, secondsPerCell, travelSeconds } from './time';

/**
 * Маршрут заказа (03, раздел 6): по адресам позиций в том порядке, как они идут в заказе (07, раздел 7),
 * у каждого адреса собрать позицию, затем отнести в зону фасовки и расфасовать.
 */
export function buildOrderJob(map: WarehouseMap, picker: Picker, task: OrderTask): PickerJob {
  const steps: PickerJob['steps'] = [];
  task.payload.lines.forEach((line, i) => {
    const spots = accessSpotsForAddress(map, line.address);
    steps.push({ kind: 'walk', to: spots[0], spots, label: `к ${formatAddress(line.address)}` });
    steps.push({ kind: 'pick', lineIndex: i, seconds: pickSeconds(picker) });
  });
  steps.push(...packSteps(map));
  return { taskId: task.id, steps, stepIndex: 0, stepElapsed: 0 };
}

/** Последние шаги заказа: отнести в зону фасовки и расфасовать. Общие для сборщика и для личной «Сборки». */
export function packSteps(map: WarehouseMap): PickerJob['steps'] {
  return [
    { kind: 'walk', to: zoneAccess(map, 'packing'), spots: zoneCells(map, 'packing'), label: 'на фасовку' },
    { kind: 'pack', seconds: packSeconds() },
  ];
}

/** Время до первой точки задания (ближайшего места у стеллажа) из того места, где сборщик стоит. null — дойти нельзя. */
export function etaToTask(map: WarehouseMap, picker: Picker, task: OrderTask): number | null {
  const first = task.payload.lines[0];
  if (!first) return 0;
  const dist = distancesFrom(map, picker.position);
  const cells = accessSpotsForAddress(map, first.address)
    .map((c) => dist.get(`${c.x},${c.z}`))
    .filter((d): d is number => d !== undefined);
  return cells.length ? travelSeconds(picker, Math.min(...cells)) : null;
}

/** Что сборщик делает сейчас — для карточки в интерфейсе. Без текстов: подписи собирает UI. */
export function pickerActivity(game: GameState, pickerId: string): PickerActivity {
  const p = game.pickers[pickerId];
  const job = p?.job;
  const step = job?.steps[job.stepIndex];
  if (p?.state === 'playing' && job && !step) return { kind: 'atRack' };
  if (!p || !job || !step) return { kind: 'idle' };
  if (p.state === 'waiting' && game.tsdOffer?.pickerId === p.id) {
    return { kind: 'waitingTsd', secondsLeft: Math.max(0, game.tsdOffer.expiresAt - game.clock.time) };
  }
  if (p.state === 'calling') {
    const call = game.calls.find((c) => c.pickerId === p.id);
    const left = call?.expiresAt != null ? Math.max(0, call.expiresAt - game.clock.time) : null;
    return { kind: 'calling', secondsLeft: left };
  }
  if (step.kind === 'delay') {
    return { kind: 'busy', label: step.label, progress: Math.min(1, job.stepElapsed / step.seconds) };
  }
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
