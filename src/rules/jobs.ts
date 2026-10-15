// Работа сборщика над заданием: из каких шагов она состоит и что сейчас происходит.
import type { Picker, PickerActivity, PickerJob } from '../model/picker';
import type { OrderTask, PutawayTask, ReceivingTask, Task, WriteoffTask } from '../model/task';
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { formatAddress } from './address';
import { accessSpotsForAddress, distancesFrom, zoneAccess, zoneCells } from './warehouse';
import { dropSeconds, loadSeconds, packSeconds, pickSeconds, placeSeconds, receiveSeconds, secondsPerCell, takeDownSeconds, travelSeconds } from './time';
import { DELIVERY } from '../config/balance';

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

/**
 * Приёмка (10, раздел 13.2): дойти до зоны приёмки и принять поставку.
 * Встаёт на свободную клетку зоны, но не туда, где стоят паллеты.
 */
export function buildReceivingJob(map: WarehouseMap, picker: Picker, task: ReceivingTask): PickerJob {
  const slots = new Set(DELIVERY.palletSlots.map((c) => `${c.x},${c.z}`));
  const spots = zoneCells(map, 'receiving').filter((c) => !slots.has(`${c.x},${c.z}`));
  const steps: PickerJob['steps'] = [
    { kind: 'walk', to: spots[0] ?? zoneAccess(map, 'receiving'), spots, label: 'на приёмку' },
    { kind: 'work', seconds: receiveSeconds(picker, task.payload.palletCount), label: 'Принимает поставку' },
  ];
  return { taskId: task.id, steps, stepIndex: 0, stepElapsed: 0 };
}

/**
 * Выкладка (10, раздел 13.3): подойти к паллете, загрузить тележку, обойти адреса и выложить товар.
 * У паллеты встаёт на соседнюю клетку зоны приёмки, не занятую паллетами.
 */
export function buildPutawayJob(map: WarehouseMap, picker: Picker, task: PutawayTask): PickerJob {
  const slots = new Set(DELIVERY.palletSlots.map((c) => `${c.x},${c.z}`));
  const pc = task.payload.palletCell;
  const zone = zoneCells(map, 'receiving').filter((c) => !slots.has(`${c.x},${c.z}`));
  const near = zone.filter((c) => Math.abs(c.x - pc.x) + Math.abs(c.z - pc.z) === 1);
  const spots = near.length > 0 ? near : zone;
  const steps: PickerJob['steps'] = [
    { kind: 'walk', to: spots[0] ?? zoneAccess(map, 'receiving'), spots, label: 'к паллете' },
    { kind: 'work', seconds: loadSeconds(picker), label: 'Грузит тележку' },
  ];
  task.payload.lines.forEach((line, i) => {
    const at = accessSpotsForAddress(map, line.address);
    steps.push({ kind: 'walk', to: at[0], spots: at, label: `к ${formatAddress(line.address)}` });
    steps.push({ kind: 'place', lineIndex: i, seconds: placeSeconds(picker) });
  });
  return { taskId: task.id, steps, stepIndex: 0, stepElapsed: 0 };
}

/** Списание (10, раздел 13.4): к полке, снять партию, отнести в зону брака и сдать. */
export function buildWriteoffJob(map: WarehouseMap, picker: Picker, task: WriteoffTask): PickerJob {
  const at = accessSpotsForAddress(map, task.payload.address);
  const steps: PickerJob['steps'] = [
    { kind: 'walk', to: at[0], spots: at, label: `к ${formatAddress(task.payload.address)}` },
    { kind: 'work', seconds: takeDownSeconds(picker), label: 'Снимает с полки' },
    { kind: 'walk', to: zoneAccess(map, 'scrap'), spots: zoneCells(map, 'scrap'), label: 'в брак' },
    { kind: 'work', seconds: dropSeconds(), label: 'Сдаёт в брак' },
  ];
  return { taskId: task.id, steps, stepIndex: 0, stepElapsed: 0 };
}

/** Работа над заданием любого типа. */
export function buildJob(map: WarehouseMap, picker: Picker, task: Task): PickerJob {
  switch (task.type) {
    case 'order': return buildOrderJob(map, picker, task);
    case 'receiving': return buildReceivingJob(map, picker, task);
    case 'putaway': return buildPutawayJob(map, picker, task);
    case 'writeoff': return buildWriteoffJob(map, picker, task);
  }
}

/** Задания каких типов сборщика можно отправить выполнять (с M7e1 — все четыре). */
export function canBuildJob(_task: Task): boolean {
  return true;
}

/** Последние шаги заказа: отнести в зону фасовки и расфасовать. Общие для сборщика и для личной «Сборки». */
export function packSteps(map: WarehouseMap): PickerJob['steps'] {
  return [
    { kind: 'walk', to: zoneAccess(map, 'packing'), spots: zoneCells(map, 'packing'), label: 'на фасовку' },
    { kind: 'pack', seconds: packSeconds() },
  ];
}

/** Время до первой точки задания (ближайшего места, куда можно встать) из того места, где сборщик стоит. null — дойти нельзя. */
export function etaToTask(map: WarehouseMap, picker: Picker, task: Task): number | null {
  if (!canBuildJob(task)) return null;
  const first = buildJob(map, picker, task).steps.find((s) => s.kind === 'walk');
  if (!first || first.kind !== 'walk') return 0;
  const dist = distancesFrom(map, picker.position);
  const cells = first.spots
    .map((c) => dist.get(`${c.x},${c.z}`))
    .filter((d): d is number => d !== undefined);
  return cells.length ? travelSeconds(picker, Math.min(...cells)) : null;
}

/** Что сборщик делает сейчас — для карточки в интерфейсе. Без текстов: подписи собирает UI. */
export function pickerActivity(game: GameState, pickerId: string): PickerActivity {
  const p = game.pickers[pickerId];
  const job = p?.job;
  const step = job?.steps[job.stepIndex];
  if (p && game.tsdGame?.pickerId === p.id) return { kind: 'tsdGame' };
  if (p?.state === 'playing' && job && !step) return { kind: 'atRack' };
  if (p?.state === 'resting' && !step) return { kind: 'resting', fatigue: p.stats.fatigue }; // дошёл до зоны отдыха (M8c)
  if (!p || !job || !step) return { kind: 'idle' };
  if (p.state === 'waiting' && game.tsdOffer?.pickerId === p.id) {
    return { kind: 'waitingTsd', secondsLeft: Math.max(0, game.tsdOffer.expiresAt - game.clock.time) };
  }
  if (p.state === 'calling') {
    const call = game.calls.find((c) => c.pickerId === p.id);
    const left = call?.expiresAt != null ? Math.max(0, call.expiresAt - game.clock.time) : null;
    return { kind: 'calling', secondsLeft: left };
  }
  if (step.kind === 'delay' || step.kind === 'work') {
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
  if (step.kind === 'place') {
    const task = game.tasks[job.taskId];
    const lines = task?.type === 'putaway' ? task.payload.lines.length : 1;
    return { kind: 'placing', line: step.lineIndex + 1, lines, progress };
  }
  return { kind: 'packing', progress };
}
