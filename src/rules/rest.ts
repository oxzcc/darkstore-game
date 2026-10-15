// Перерыв (M8c; docs/05, раздел 6): свободного сборщика можно отправить в зону отдыха — там усталость падает.
// Пока он на перерыве, назначить его нельзя (canAssign: не «свободен»). Вернуть — кнопкой или сам, когда отдохнул полностью.
// Работа «перерыв» — обычный PickerJob без задания (taskId пустой): дойти до свободного места в зоне отдыха.
import type { GameState } from '../model/game';
import type { Picker } from '../model/picker';
import type { WarehouseMap } from '../model/warehouse';
import { zoneAccess, zoneCells } from './warehouse';

/** Можно ли отправить на перерыв: только свободного и только если он хоть немного устал. */
export function canRest(picker: Picker | undefined): boolean {
  return !!picker && picker.state === 'idle' && picker.stats.fatigue > 0;
}

/** «На перерыв»: сборщик идёт в зону отдыха и отдыхает там. */
export function sendToRest(state: GameState, map: WarehouseMap, pickerId: string): GameState {
  const p = state.pickers[pickerId];
  if (!canRest(p) || state.campaign.phase !== 'running') return state;
  const spots = zoneCells(map, 'rest');
  const job = {
    taskId: '', // без задания
    steps: [{ kind: 'walk' as const, to: spots[0] ?? zoneAccess(map, 'rest'), spots, label: 'на перерыв' }],
    stepIndex: 0,
    stepElapsed: 0,
  };
  return { ...state, pickers: { ...state.pickers, [p.id]: { ...p, state: 'resting', job, path: [], pathProgress: 0 } } };
}

/** «Вернуть» с перерыва (или отдохнул полностью): свободен и стоит там, где был. */
export function endRest(state: GameState, pickerId: string): GameState {
  const p = state.pickers[pickerId];
  if (!p || p.state !== 'resting') return state;
  // если шёл — останавливается на последней пройденной клетке пути
  const passed = Math.floor(p.pathProgress);
  const position = p.path.length > 0 && passed > 0 ? p.path[Math.min(passed, p.path.length) - 1] : p.position;
  return { ...state, pickers: { ...state.pickers, [p.id]: { ...p, state: 'idle', job: null, path: [], pathProgress: 0, position } } };
}

/** Сборщик на перерыве уже дошёл до зоны отдыха (и отдыхает, а не идёт). */
export function isRestingInPlace(p: Picker): boolean {
  return p.state === 'resting' && !!p.job && p.job.stepIndex >= p.job.steps.length;
}
