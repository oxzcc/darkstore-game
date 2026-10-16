// Перерыв (M8c; docs/05, раздел 6): свободного сборщика можно отправить в зону отдыха — там усталость падает.
// Пока он на перерыве, назначить его нельзя (canAssign: не «свободен»). Вернуть — кнопкой или сам, когда отдохнул полностью.
// Работа «перерыв» — обычный PickerJob без задания (taskId пустой): дойти до свободного места на диване (W7b, решение автора 16.10).
import type { GameState } from '../model/game';
import type { Picker } from '../model/picker';
import type { Cell, WarehouseMap } from '../model/warehouse';
import { distancesFrom, isRestSeat, zoneAccess, zoneCells } from './warehouse';

/** Можно ли отправить на перерыв: только свободного и только если он хоть немного устал. */
export function canRest(picker: Picker | undefined): boolean {
  return !!picker && picker.state === 'idle' && picker.stats.fatigue > 0;
}

/** «На перерыв»: сборщик идёт в зону отдыха и отдыхает там. */
export function sendToRest(state: GameState, map: WarehouseMap, pickerId: string): GameState {
  const p = state.pickers[pickerId];
  if (!canRest(p) || state.campaign.phase !== 'running') return state;
  const spots = map.rest.seats.length > 0 ? map.rest.seats : zoneCells(map, 'rest');
  const job = {
    taskId: '', // без задания
    steps: [{ kind: 'walk' as const, to: spots[0] ?? zoneAccess(map, 'rest'), spots, label: 'на перерыв' }],
    stepIndex: 0,
    stepElapsed: 0,
  };
  return { ...state, pickers: { ...state.pickers, [p.id]: { ...p, state: 'resting', job, path: [], pathProgress: 0 } } };
}

/** «Вернуть» с перерыва (или отдохнул полностью): свободен и стоит там, где был; с дивана встаёт на клетку перед ним (если дана карта). */
export function endRest(state: GameState, pickerId: string, map?: WarehouseMap): GameState {
  const p = state.pickers[pickerId];
  if (!p || p.state !== 'resting') return state;
  // если шёл — останавливается на последней пройденной клетке пути
  const passed = Math.floor(p.pathProgress);
  let position = p.path.length > 0 && passed > 0 ? p.path[Math.min(passed, p.path.length) - 1] : p.position;
  if (map && isRestSeat(map, position)) position = freeCellNear(state, map, position, p.id);
  return { ...state, pickers: { ...state.pickers, [p.id]: { ...p, state: 'idle', job: null, path: [], pathProgress: 0, position } } };
}

/**
 * Куда встать, поднявшись с дивана (W7b, правка автора 16.10: отдохнувшие стояли друг в друге): ближайшая клетка,
 * где можно стоять (не диван, не мебель) и которую не занимает другой сборщик — ни где стоит, ни куда идёт.
 */
function freeCellNear(state: GameState, map: WarehouseMap, from: Cell, pickerId: string): Cell {
  const taken = new Set(
    Object.values(state.pickers)
      .filter((o) => o.id !== pickerId)
      .flatMap((o) => [o.position, ...(o.path.length > 0 ? [o.path[o.path.length - 1]] : [])])
      .map((c) => `${c.x},${c.z}`),
  );
  const dist = distancesFrom(map, from);
  let best: Cell | null = null, bestD = Infinity;
  for (const [k, d] of dist) {
    const [x, z] = k.split(',').map(Number);
    const c = { x, z };
    if (d === 0 || isRestSeat(map, c) || taken.has(k)) continue;
    if (d < bestD) { best = c; bestD = d; }
  }
  return best ?? { x: from.x + map.rest.facing.x, z: from.z + map.rest.facing.z };
}

/** Сборщик на перерыве уже дошёл до зоны отдыха (и отдыхает, а не идёт). */
export function isRestingInPlace(p: Picker): boolean {
  return p.state === 'resting' && !!p.job && p.job.stepIndex >= p.job.steps.length;
}
