// Шаг мира (09, раздел 7.3): продвинуть время на dt игровых секунд.
// Сборщики идут по маршрутам и работают; когда работа над заданием закончена — бросается исход.
import type { GameState, ShiftEvent } from '../model/game';
import type { Picker } from '../model/picker';
import type { WarehouseMap } from '../model/warehouse';
import { blockedCells, distancesFrom, findPath } from './warehouse';
import type { Cell } from '../model/warehouse';
import { secondsPerCell } from './time';
import { createRng } from './random';
import { outcomeChances, rollOutcome } from './outcome';

/** Перейти к следующему шагу работы. Состояние сборщика — по виду шага. */
function nextStep(p: Picker): Picker {
  const job = p.job!;
  const stepIndex = job.stepIndex + 1;
  const step = job.steps[stepIndex];
  return {
    ...p,
    state: step?.kind === 'walk' ? 'walking' : 'working',
    job: { ...job, stepIndex, stepElapsed: 0 },
  };
}

const key = (c: Cell) => `${c.x},${c.z}`;

/** Где сборщик стоит или куда уже идёт — это место занято для остальных. */
function claimedCell(p: Picker): Cell {
  return p.path.length > 0 ? p.path[p.path.length - 1] : p.position;
}

/**
 * Выбрать, куда встать: ближайшее свободное место из списка.
 * Если всё занято — основное место (пусть лучше постоят рядом, чем задание зависнет).
 */
function chooseSpot(map: WarehouseMap, blocked: Set<string>, from: Cell, spots: Cell[], taken: Set<string>): Cell {
  const dist = distancesFrom(map, from, blocked);
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    const d = dist.get(key(s));
    if (d === undefined || taken.has(key(s))) continue;
    if (d < bestD) { best = s; bestD = d; }
  }
  return best ?? spots[0];
}

/** Продвинуть одного сборщика на dt. Если за кадр успевает закончить несколько шагов — проходит их все.
 *  `taken` — клетки, занятые остальными сборщиками. */
function advancePicker(map: WarehouseMap, blocked: Set<string>, picker: Picker, dt: number, taken: Set<string>): Picker {
  let p = picker;
  let left = dt;
  while (left > 0 && p.job) {
    const job = p.job;
    const step = job.steps[job.stepIndex];
    if (!step) break; // все шаги пройдены — завершение задания делает advanceWorld

    if (step.kind === 'walk') {
      if (p.path.length === 0) {
        // начало отрезка: выбираем свободное место и строим к нему путь от текущей клетки
        const to = chooseSpot(map, blocked, p.position, step.spots, taken);
        const steps = job.steps.map((s, i) => (i === job.stepIndex ? { ...step, to } : s));
        p = { ...p, job: { ...job, steps } };
        const path = findPath(map, p.position, to, blocked) ?? [];
        if (path.length === 0) { p = nextStep(p); continue; } // уже на месте (или дойти нельзя)
        p = { ...p, path, pathProgress: 0, state: 'walking' };
      }
      const spc = secondsPerCell(p);
      const need = (p.path.length - p.pathProgress) * spc;
      if (left >= need) {
        left -= need;
        p = nextStep({ ...p, position: p.path[p.path.length - 1], path: [], pathProgress: 0 });
      } else {
        p = { ...p, pathProgress: p.pathProgress + left / spc };
        left = 0;
      }
    } else {
      const need = step.seconds - job.stepElapsed;
      if (left >= need) {
        left -= need;
        p = nextStep(p);
      } else {
        p = { ...p, state: 'working', job: { ...job, stepElapsed: job.stepElapsed + left } };
        left = 0;
      }
    }
  }
  return p;
}

const isJobDone = (p: Picker) => !!p.job && p.job.stepIndex >= p.job.steps.length;

export function advanceWorld(state: GameState, map: WarehouseMap, dt: number): { state: GameState; events: ShiftEvent[] } {
  if (dt <= 0) return { state, events: [] };

  const time = state.clock.time + dt;
  const blocked = blockedCells(map);
  const rng = createRng(state.rngSeed);
  const events: ShiftEvent[] = [];
  const pickers = { ...state.pickers };
  let tasks = state.tasks;
  const setTask = (id: string, patch: Partial<GameState['tasks'][string]>) => {
    tasks = { ...tasks, [id]: { ...tasks[id], ...patch } as GameState['tasks'][string] };
  };

  for (const id of Object.keys(pickers)) {
    const before = pickers[id];
    if (!before.job) continue;
    const taken = new Set(Object.values(pickers).filter((o) => o.id !== id).map((o) => key(claimedCell(o))));
    let p = advancePicker(map, blocked, before, dt, taken);
    const task = tasks[p.job!.taskId];

    // первый отрезок пути пройден — сборщик на месте, задание «выполняется»
    if (task && task.status === 'pickerEnRoute' && p.job!.stepIndex > 0) setTask(task.id, { status: 'inProgress' });

    if (isJobDone(p) && task) {
      const outcome = rollOutcome(outcomeChances(p, task), rng);
      setTask(task.id, { status: 'done', outcome });
      events.push({ kind: 'taskDone', taskId: task.id, pickerId: p.id, outcome, at: time });
      p = { ...p, state: 'idle', taskId: null, job: null, path: [], pathProgress: 0 };
    }
    pickers[id] = p;
  }

  return {
    state: {
      ...state,
      clock: { ...state.clock, time },
      rngSeed: rng.seed(),
      pickers,
      tasks,
      shiftLog: events.length ? [...state.shiftLog, ...events] : state.shiftLog,
    },
    events,
  };
}
