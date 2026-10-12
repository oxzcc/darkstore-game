import { describe, expect, it } from 'vitest';
import type { GameState } from '../../model/game';
import type { OrderLine } from '../../model/task';
import { WAREHOUSE_LAYOUT } from '../../config/warehouse';
import { buildWarehouseMap } from '../warehouse';
import { createInitialGame } from '../game';
import { openTasks } from '../tasks/generator';
import { dispatchTask } from '../tasks/lifecycle';
import { createRng } from '../random';
import { acceptTsd, rollTsdOffer } from '../tsd';
import { advanceWorld } from '../advance';
import { shelfContents } from '../stock';
import { parseAddress } from '../address';
import { chooseRack, leaveRack, scanShelf, seenStock, takenPerLine } from './picking';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

// В начальном запасе: 2.3.2 — молоко (6), 2.2.1 — яйца (10), 2.2.4 — макароны (9).
const MILK = parseAddress('2.3.2');
const EGGS = parseAddress('2.2.1');
const PASTA = parseAddress('2.2.4');

/** Игра, где игрок взял ТСД у Лаки. Заказ можно подменить, чтобы знать, что на каких полках. */
function inSession(lines?: OrderLine[]): GameState {
  const g = createInitialGame(map, 1);
  const task = openTasks(g)[0];
  const s = acceptTsd(rollTsdOffer(dispatchTask(g, map, task.id, 'lucky'), task.id, createRng(1), 1));
  if (!lines) return s;
  const t = s.tasks[task.id];
  if (t.type !== 'order') throw new Error('ожидался заказ');
  return { ...s, tasks: { ...s.tasks, [t.id]: { ...t, payload: { lines } } } };
}

/** Крутить мир, пока сборщик не дойдёт до выбранного стеллажа. */
function arrive(s: GameState): GameState {
  for (let i = 0; i < 3000 && s.minigame && !s.minigame.atFocus; i++) s = advanceWorld(s, map, 0.1).state;
  return s;
}

const goTo = (s: GameState, aisle: number, rack: number) => arrive(chooseRack(s, map, aisle, rack));
const taken = (s: GameState) => {
  const t = s.tasks[s.minigame!.taskId];
  return takenPerLine(s.minigame!, t.type === 'order' ? t.payload.lines.length : 0);
};

describe('«Сборка»: выбор стеллажа и ходьба (M5e1)', () => {
  it('после «Взять ТСД» сборщик стоит и ждёт, пока игрок не выберет стеллаж', () => {
    const s = inSession();
    expect(s.minigame?.focus).toBe(null);
    let x = s;
    for (let i = 0; i < 50; i++) x = advanceWorld(x, map, 0.1).state;
    expect(x.pickers.lucky.position).toEqual(s.pickers.lucky.position);
    expect(x.pickers.lucky.state).toBe('playing');
    expect(x.minigame?.elapsed).toBeCloseTo(5, 5);
  });

  it('клик по стеллажу — сборщик идёт к нему, камера подлетает только когда дошёл', () => {
    const s = chooseRack(inSession(), map, 4, 6);
    expect(s.minigame?.focus).toEqual({ aisle: 4, rack: 6 });
    expect(s.minigame?.atFocus).toBe(false);
    const there = arrive(s);
    expect(there.minigame?.atFocus).toBe(true);
    expect(there.pickers.lucky.path).toEqual([]);
  });

  it('пока идёт, можно передумать; у стеллажа другой выбрать нельзя — сначала «Назад к складу»', () => {
    const walking = advanceWorld(chooseRack(inSession(), map, 4, 6), map, 1).state;
    const changed = chooseRack(walking, map, 1, 1);
    expect(changed.minigame?.focus).toEqual({ aisle: 1, rack: 1 });
    const there = arrive(changed);
    expect(chooseRack(there, map, 2, 2)).toBe(there);
    const back = leaveRack(there);
    expect(back.minigame?.atFocus).toBe(false);
    // сборщик стоит у стеллажа, но камера не возвращается к нему сама
    expect(advanceWorld(back, map, 0.5).state.minigame?.atFocus).toBe(false);
    expect(back.minigame?.focus).toEqual({ aisle: 1, rack: 1 });
    expect(chooseRack(back, map, 2, 2).minigame?.focus).toEqual({ aisle: 2, rack: 2 });
  });

  it('без мини-игры, на паузе и для несуществующего стеллажа клик ничего не делает', () => {
    const g = createInitialGame(map, 1);
    expect(chooseRack(g, map, 1, 1)).toBe(g);
    expect(leaveRack(g)).toBe(g);
    const s = inSession();
    const paused = { ...s, clock: { ...s.clock, paused: true } };
    expect(chooseRack(paused, map, 1, 1)).toBe(paused);
    expect(chooseRack(s, map, 99, 1)).toBe(s);
  });
});

describe('«Сборка»: скан товара (M5e1)', () => {
  const order: OrderLine[] = [
    { productId: 'milk', address: MILK, qty: 2 },
    { productId: 'eggs', address: EGGS, qty: 1 },
  ];

  it('товар из заказа — +1 к позиции, на полке его видно на штуку меньше, склад не меняется', () => {
    const s = goTo(inSession(order), 2, 3);
    const a = scanShelf(s, map, MILK, 'milk');
    expect(taken(a)).toEqual([1, 0]);
    expect(a.minigame?.lastScan?.result).toBe('taken');
    expect(a.stock).toBe(s.stock);
    expect(shelfContents(seenStock(a.stock, a.minigame?.actions), MILK)).toEqual([{ productId: 'milk', qty: 5 }]);
  });

  it('товар не из заказа — «Товар не из заказа», мелкая ошибка, ничего не взято', () => {
    const s = goTo(inSession(order), 2, 2);
    const a = scanShelf(s, map, PASTA, 'pasta');
    expect(taken(a)).toEqual([0, 0]);
    expect(a.minigame?.lastScan?.result).toBe('notInOrder');
    expect(a.minigame?.errors).toEqual([{ kind: 'wrong_product', severity: 'minor', address: PASTA }]);
  });

  it('взять больше, чем лежит на полке, нельзя — «Полка пуста»', () => {
    let s = goTo(inSession([{ productId: 'milk', address: MILK, qty: 9 }]), 2, 3);
    for (let i = 0; i < 6; i++) s = scanShelf(s, map, MILK, 'milk');
    expect(taken(s)).toEqual([6]);
    const more = scanShelf(s, map, MILK, 'milk');
    expect(taken(more)).toEqual([6]);
    expect(more.minigame?.lastScan?.result).toBe('shelfEmpty');
  });

  it('скан не принимается в общем виде, у другого стеллажа, на паузе и по пустому месту', () => {
    const home = chooseRack(inSession(order), map, 2, 3); // ещё идёт
    expect(scanShelf(home, map, MILK, 'milk')).toBe(home);
    const s = goTo(inSession(order), 2, 3);
    expect(scanShelf(s, map, EGGS, 'eggs')).toBe(s);                        // другой стеллаж
    expect(scanShelf(s, map, parseAddress('2.3.1'), 'milk')).toBe(s);       // тут пусто
    const paused = { ...s, clock: { ...s.clock, paused: true } };
    expect(scanShelf(paused, map, MILK, 'milk')).toBe(paused);
  });

  it('всё собрано — сборщик сам идёт на фасовку (временно до кнопки M5e2), задание выполняется', () => {
    let s = goTo(inSession(order), 2, 3);
    s = scanShelf(scanShelf(s, map, MILK, 'milk'), map, MILK, 'milk');
    expect(s.minigame).not.toBe(null);
    s = goTo(leaveRack(s), 2, 2);
    const taskId = s.minigame!.taskId;
    s = scanShelf(s, map, EGGS, 'eggs');
    expect(s.minigame).toBe(null);
    expect(s.pickers.lucky.job?.steps[0].kind).toBe('walk');
    for (let i = 0; i < 3000 && s.tasks[taskId].status !== 'done'; i++) s = advanceWorld(s, map, 0.1).state;
    expect(s.tasks[taskId].status).toBe('done');
    expect(s.pickers.lucky.state).toBe('idle');
  });
});
