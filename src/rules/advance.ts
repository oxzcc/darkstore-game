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
import { declineTsd, worldSpeed, worldSpeedFor } from './tsd';
import { applyCalls, expireCalls, raiseCall, showQueuedCalls } from './calls';

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

    // развилка: дошёл до позиции, на которой запланирован вызов, — останавливается и зовёт диспетчера (10, раздел 3)
    if (job.call && !job.call.raised && job.stepIndex === job.call.stepIndex) {
      p = { ...p, state: 'calling', job: { ...job, call: { ...job.call, raised: true } } };
      break;
    }

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

/**
 * Продвинуть мир. `dt` — шаг обычного мира; во время личной мини-игры остальной мир (и часы смены)
 * идут медленнее, а свой сборщик — в обычном темпе (02, раздел 2; 09, раздел 7.2).
 */
export function advanceWorld(state: GameState, map: WarehouseMap, dt: number): { state: GameState; events: ShiftEvent[] } {
  if (dt <= 0) return { state, events: [] };

  const time = state.clock.time + dt * worldSpeed(state);
  const blocked = blockedCells(map);
  const rng = createRng(state.rngSeed);
  const events: ShiftEvent[] = [];
  const newCallers: string[] = []; // кто за этот шаг остановился на развилке
  const pickers = { ...state.pickers };
  // сколько идёт личная сборка — в темпе своего сборщика (×1), а не замедленного мира
  let minigame = state.minigame ? { ...state.minigame, elapsed: state.minigame.elapsed + dt } : null;
  let tasks = state.tasks;
  const setTask = (id: string, patch: Partial<GameState['tasks'][string]>) => {
    tasks = { ...tasks, [id]: { ...tasks[id], ...patch } as GameState['tasks'][string] };
  };

  for (const id of Object.keys(pickers)) {
    const before = pickers[id];
    if (!before.job) continue;
    if (before.state === 'waiting') continue; // висит «Взять ТСД?» — стоит и ждёт ответа
    if (before.state === 'calling') continue; // висит развилка — стоит и ждёт ответа диспетчера
    const taken = new Set(Object.values(pickers).filter((o) => o.id !== id).map((o) => key(claimedCell(o))));
    let p = advancePicker(map, blocked, before, dt * worldSpeedFor(state, id), taken);
    if (before.state === 'playing') p = { ...p, state: 'playing' }; // пока идёт мини-игра — «играете за него»
    const task = tasks[p.job!.taskId];

    // первый отрезок пути пройден — сборщик на месте, задание «выполняется»
    if (task && task.status === 'pickerEnRoute' && p.job!.stepIndex > 0) setTask(task.id, { status: 'inProgress' });

    // личная «Сборка»: сборщик дошёл до выбранного стеллажа — камера подлетает (06, раздел 2.3).
    // Задание при этом не заканчивается: его закончит сама мини-игра.
    // Именно «дошёл за этот шаг»: если он уже стоял у стеллажа, а игрок нажал «Назад к складу», камеру не возвращаем.
    if (minigame?.pickerId === id) {
      const job = p.job!;
      const wasWalking = before.job!.stepIndex < before.job!.steps.length;
      if (minigame.focus && !minigame.atFocus && wasWalking && job.stepIndex >= job.steps.length) {
        minigame = { ...minigame, atFocus: true };
      }
      pickers[id] = p;
      continue;
    }

    if (isJobDone(p) && task) {
      // исход по характеристикам, потом — осложнения от ответов в развилках (10, раздел 3)
      const outcome = applyCalls(rollOutcome(outcomeChances(p, task), rng), task.callLog, rng);
      setTask(task.id, { status: 'done', outcome });
      events.push({ kind: 'taskDone', taskId: task.id, pickerId: p.id, outcome, at: time });
      p = { ...p, state: 'idle', taskId: null, job: null, path: [], pathProgress: 0 };
    }
    pickers[id] = p;
    if (p.state === 'calling') newCallers.push(id); // уже звавшие сюда не попадают — их пропускает continue выше
  }

  let next: GameState = {
    ...state,
    clock: { ...state.clock, time },
    rngSeed: rng.seed(),
    pickers,
    tasks,
    minigame,
    shiftLog: events.length ? [...state.shiftLog, ...events] : state.shiftLog,
  };
  // игрок не ответил на «Взять ТСД?» вовремя — сборщик работает сам
  if (next.tsdOffer && time >= next.tsdOffer.expiresAt) next = declineTsd(next);

  // развилки: новые вызовы в очередь, первые на экране получают таймер, просроченные решает сборщик
  for (const id of newCallers) next = raiseCall(next, id);
  next = expireCalls(showQueuedCalls(next));

  return { state: next, events };
}
