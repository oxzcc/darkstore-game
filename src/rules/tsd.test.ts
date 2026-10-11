import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { TSD } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openTasks } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity } from './jobs';
import { createRng } from './random';
import { acceptTsd, declineTsd, rollTsdOffer, sendPicker, tsdOfferSecondsLeft } from './tsd';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Отправить сборщика и принудительно выбросить (chance = 1) или не выбросить (0) предложение ТСД. */
function sent(chance: 0 | 1, pickerId = 'lucky', g: GameState = createInitialGame(map, 1)) {
  const task = openTasks(g)[0];
  const s = rollTsdOffer(dispatchTask(g, map, task.id, pickerId), task.id, createRng(7), chance);
  return { s, taskId: task.id };
}

function run(s: GameState, seconds: number, step = 0.1) {
  for (let t = 0; t < seconds - 1e-9; t += step) s = advanceWorld(s, map, step).state;
  return s;
}

/** Сколько клеток пути прошёл сборщик (для сравнения скорости). */
const moved = (s: GameState, id: string) => {
  const p = s.pickers[id];
  return (p.job?.stepIndex ?? 0) * 1000 + p.pathProgress;
};

describe('шанс «Взять ТСД»', () => {
  it('не выпал — всё как раньше: сборщик сразу идёт сам', () => {
    const { s, taskId } = sent(0);
    expect(s.tsdOffer).toBe(null);
    expect(s.pickers.lucky.state).toBe('walking');
    expect(s.tasks[taskId].status).toBe('pickerEnRoute');
  });

  it('выпал — сборщик стоит и ждёт ответа, срок ответа из config', () => {
    const { s, taskId } = sent(1);
    expect(s.tsdOffer?.taskId).toBe(taskId);
    expect(s.pickers.lucky.state).toBe('waiting');
    expect(s.tasks[taskId].status).toBe('assigned');
    expect(tsdOfferSecondsLeft(s)).toBe(TSD.offerSeconds);

    const later = run(s, 3);
    expect(later.pickers.lucky.position).toEqual(s.pickers.lucky.position);
    expect(later.pickers.lucky.pathProgress).toBe(0);
    const a = pickerActivity(later, 'lucky');
    expect(a.kind).toBe('waitingTsd');
  });

  it('на паузе таймер предложения не идёт', () => {
    const { s } = sent(1);
    expect(advanceWorld(s, map, 0).state).toBe(s);
  });

  it('таймер истёк — сборщик работает сам', () => {
    const { s, taskId } = sent(1);
    const later = run(s, TSD.offerSeconds + 0.2);
    expect(later.tsdOffer).toBe(null);
    expect(later.minigame).toBe(null);
    expect(later.tasks[taskId].mode).toBe('delegated');
    expect(['walking', 'working'].includes(later.pickers.lucky.state)).toBe(true);
  });

  it('«Пусть работает» — то же, что истёкший таймер', () => {
    const { s, taskId } = sent(1);
    const d = declineTsd(s);
    expect(d.tsdOffer).toBe(null);
    expect(d.tasks[taskId].status).toBe('pickerEnRoute');
    expect(d.tasks[taskId].mode).toBe('delegated');
    expect(d.pickers.lucky.state).toBe('walking');
  });

  it('пока висит предложение, второе не появляется', () => {
    const { s } = sent(1);
    const second = openTasks(s)[0];
    const s2 = rollTsdOffer(dispatchTask(s, map, second.id, 'korzh'), second.id, createRng(3), 1);
    expect(s2.tsdOffer?.pickerId).toBe('lucky');
    expect(s2.pickers.korzh.state).toBe('walking');
  });

  it('sendPicker назначает сборщика и не ломает очередь заказов', () => {
    const g = createInitialGame(map, 5);
    const task = openTasks(g)[0];
    const s = sendPicker(g, map, task.id, 'buran');
    expect(s.tasks[task.id].assignedPickerId).toBe('buran');
    expect(['walking', 'waiting'].includes(s.pickers.buran.state)).toBe(true);
    expect(openTasks(s).length).toBe(openTasks(g).length); // взяли одно — генератор добавил новое
  });
});

describe('личная мини-игра (заглушка M5b)', () => {
  it('«Взять ТСД» — начинается мини-игра, сборщик «играете за него»', () => {
    const { s, taskId } = sent(1);
    const a = acceptTsd(s);
    expect(a.tsdOffer).toBe(null);
    expect(a.minigame?.taskId).toBe(taskId);
    expect(a.tasks[taskId].mode).toBe('personal');
    expect(a.pickers.lucky.state).toBe('playing');
    // и остаётся «играете за него», пока идёт и собирает
    expect(run(a, 2).pickers.lucky.state).toBe('playing');
  });

  it('остальной мир замедлен, свой сборщик и часы — как задумано', () => {
    // Лаки и Коржик отправлены без ТСД, сравниваем их ход с ТСД у Лаки и без
    const g = createInitialGame(map, 1);
    const [t1, t2] = openTasks(g);
    const both = dispatchTask(dispatchTask(g, map, t1.id, 'lucky'), map, t2.id, 'korzh');
    const normal = run(both, 2);
    const withGame = run(
      acceptTsd(rollTsdOffer(both, t1.id, createRng(1), 1)),
      2,
    );
    // свой сборщик прошёл столько же
    expect(moved(withGame, 'lucky')).toBeCloseTo(moved(normal, 'lucky'), 5);
    // чужой — в TSD.worldSpeedDuringGame раз меньше
    expect(moved(withGame, 'korzh')).toBeCloseTo(moved(normal, 'korzh') * TSD.worldSpeedDuringGame, 5);
    // часы смены идут медленно
    expect(withGame.clock.time).toBeCloseTo(2 * TSD.worldSpeedDuringGame, 5);
    expect(normal.clock.time).toBeCloseTo(2, 5);
  });

  it('пока идёт мини-игра, новых предложений нет; после задания мини-игра заканчивается', () => {
    const { s, taskId } = sent(1);
    const a = acceptTsd(s);
    const other = openTasks(a)[0];
    const b = rollTsdOffer(dispatchTask(a, map, other.id, 'korzh'), other.id, createRng(2), 1);
    expect(b.tsdOffer).toBe(null);

    let x = b;
    for (let i = 0; i < 6000 && x.tasks[taskId].status !== 'done'; i++) x = advanceWorld(x, map, 0.1).state;
    expect(x.tasks[taskId].status).toBe('done');
    expect(x.minigame).toBe(null);
    expect(x.pickers.lucky.state).toBe('idle');
  });
});
