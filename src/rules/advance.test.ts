import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { TIMING } from '../config/balance';
import { buildWarehouseMap, zoneCells } from './warehouse';
import { createInitialGame } from './game';
import { openTasks } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity, etaToTask } from './jobs';
import { pickSeconds, secondsPerCell, worldDt } from './time';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Прокрутить мир кадрами по 0,1 с, пока не выполнится условие (или не выйдет лимит). */
function runUntil(s: GameState, done: (s: GameState) => boolean, limitSec = 600) {
  const events = [];
  for (let t = 0; t < limitSec && !done(s); t += 0.1) {
    const r = advanceWorld(s, map, 0.1);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

/** Отправить без развилки: здесь проверяется ходьба и работа, развилки — в calls.test.ts. */
function dispatch(g: GameState, m: typeof map, taskId: string, pickerId: string): GameState {
  const s = dispatchTask(g, m, taskId, pickerId);
  const p = s.pickers[pickerId];
  return { ...s, pickers: { ...s.pickers, [pickerId]: { ...p, job: p.job && { ...p.job, call: undefined } } } };
}

const started = (seed = 1, pickerId = 'lucky') => {
  const g = createInitialGame(map, seed);
  const task = openTasks(g)[0];
  return { s: dispatch(g, map, task.id, pickerId), taskId: task.id };
};

describe('время', () => {
  it('на паузе и при автопаузе игровое время не идёт', () => {
    const clock = { time: 0, paused: false, playerSpeed: 1 as const };
    expect(worldDt({ ...clock, paused: true }, 0.016, false)).toBe(0);
    expect(worldDt(clock, 0.016, true)).toBe(0);
    expect(worldDt(clock, 0.016, false)).toBe(0.016);
    expect(worldDt({ ...clock, playerSpeed: 2 }, 0.016, false)).toBe(0.032);
    expect(worldDt(clock, 5, false)).toBe(TIMING.maxFrameSeconds); // свёрнутая вкладка — без прыжка
  });

  it('при dt = 0 мир не меняется', () => {
    const { s } = started();
    expect(advanceWorld(s, map, 0).state).toBe(s);
  });

  it('быстрый сборщик ходит и собирает быстрее медленного', () => {
    const g = createInitialGame(map, 1);
    expect(secondsPerCell(g.pickers.korzh) < secondsPerCell(g.pickers.lucky)).toBe(true);
    expect(secondsPerCell(g.pickers.lucky) < secondsPerCell(g.pickers.buran)).toBe(true);
    expect(pickSeconds(g.pickers.korzh) < pickSeconds(g.pickers.buran)).toBe(true);
    expect(secondsPerCell(g.pickers.lucky)).toBe(TIMING.secondsPerCell); // скорость 5 — эталон
  });
});

describe('выполнение задания', () => {
  it('сборщик идёт, собирает, фасует — и только потом исход', () => {
    const { s: s0, taskId } = started();
    // сразу после первого кадра — идёт, исхода нет
    const s1 = advanceWorld(s0, map, 0.1).state;
    expect(s1.pickers.lucky.state).toBe('walking');
    expect(pickerActivity(s1, 'lucky').kind).toBe('walking');
    expect(s1.tasks[taskId].outcome).toBe(null);

    // дошёл до первого адреса — собирает, задание «выполняется»
    const { s: s2 } = runUntil(s1, (s) => s.pickers.lucky.state === 'working');
    expect(pickerActivity(s2, 'lucky').kind).toBe('picking');
    expect(s2.tasks[taskId].status).toBe('inProgress');

    // до конца
    const { s: s3, events } = runUntil(s2, (s) => s.tasks[taskId].status === 'done');
    const t = s3.tasks[taskId];
    expect(t.status).toBe('done');
    expect(['perfect', 'withErrors', 'failed'].includes(t.outcome!)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe(t.outcome);
    // свободен и стоит в зоне фасовки — там, где закончил (07, раздел 2)
    const p = s3.pickers.lucky;
    expect(p.state).toBe('idle');
    expect(p.job).toBe(null);
    expect(zoneCells(map, 'packing').some((c) => c.x === p.position.x && c.z === p.position.z)).toBe(true);
    expect(s3.clock.time > s0.clock.time).toBe(true);
  });

  it('один большой шаг даёт тот же итог, что много маленьких', () => {
    const { s, taskId } = started(5);
    const big = advanceWorld(s, map, 300).state;
    const small = runUntil(s, (x) => x.tasks[taskId].status === 'done').s;
    expect(big.tasks[taskId].status).toBe('done');
    expect(big.pickers.lucky.position).toEqual(small.pickers.lucky.position);
  });

  it('Коржик заканчивает тот же заказ быстрее Бурана', () => {
    const g = createInitialGame(map, 9);
    const task = openTasks(g)[0];
    const timeFor = (pickerId: string) => {
      const s = dispatch(g, map, task.id, pickerId);
      return runUntil(s, (x) => x.tasks[task.id].status === 'done').s.clock.time;
    };
    expect(timeFor('korzh') < timeFor('buran')).toBe(true);
  });

  it('время до места: у быстрого меньше, и это число совпадает с реальной ходьбой', () => {
    const g = createInitialGame(map, 3);
    const task = openTasks(g)[0];
    if (task.type !== 'order') throw new Error('ожидался заказ');
    const eta = etaToTask(map, g.pickers.lucky, task)!;
    expect(etaToTask(map, g.pickers.korzh, task)! < etaToTask(map, g.pickers.buran, task)!).toBe(true);
    const s = dispatch(g, map, task.id, 'lucky');
    const arrived = runUntil(s, (x) => x.pickers.lucky.state === 'working').s;
    expect(Math.abs(arrived.clock.time - eta) <= 0.1 + 1e-9).toBe(true);
  });

  it('пока сборщик работает, исходное состояние не портится', () => {
    const { s } = started();
    const before = JSON.stringify(s);
    advanceWorld(s, map, 5);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('сборщики не встают друг в друга: на фасовке у каждого своё место', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let s = createInitialGame(map, seed);
      for (const pid of ['lucky', 'korzh', 'buran']) s = dispatch(s, map, openTasks(s)[0].id, pid);
      const allIdle = (x: GameState) => Object.values(x.pickers).every((p) => p.state === 'idle');
      s = runUntil(s, allIdle).s;
      expect(allIdle(s)).toBe(true);
      const spots = Object.values(s.pickers).map((p) => `${p.position.x},${p.position.z}`);
      expect(new Set(spots).size).toBe(3);
    }
  });

  it('пока работают, двое не стоят в одной клетке', () => {
    let s = createInitialGame(map, 11);
    for (const pid of ['lucky', 'korzh', 'buran']) s = dispatch(s, map, openTasks(s)[0].id, pid);
    for (let t = 0; t < 300; t += 0.1) {
      s = advanceWorld(s, map, 0.1).state;
      const standing = Object.values(s.pickers).filter((p) => p.path.length === 0);
      const cells = standing.map((p) => `${p.position.x},${p.position.z}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
});
