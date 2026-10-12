import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../../config/warehouse';
import { buildWarehouseMap } from '../warehouse';
import { createInitialGame } from '../game';
import { openTasks } from '../tasks/generator';
import { dispatchTask } from '../tasks/lifecycle';
import { createRng } from '../random';
import { acceptTsd, rollTsdOffer } from '../tsd';
import { advanceWorld } from '../advance';
import { chooseRack, inspectShelf, leaveRack } from './picking';
import { removeStock, shelfContents } from '../stock';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Игра, где игрок уже взял ТСД у Лаки. */
function inSession() {
  const g = createInitialGame(map, 1);
  const task = openTasks(g)[0];
  return acceptTsd(rollTsdOffer(dispatchTask(g, map, task.id, 'lucky'), task.id, createRng(1), 1));
}

describe('мини-игра «Сборка»: выбор стеллажа (M5c)', () => {
  it('в начале мини-игры стеллаж не выбран, камера в общем виде', () => {
    const s = inSession();
    expect(s.minigame?.focus).toBe(null);
    expect(s.minigame?.atFocus).toBe(false);
  });

  it('клик по стеллажу — он выбран, камера у него; «Назад к складу» — общий вид, выбор остаётся', () => {
    const s = chooseRack(inSession(), map, 2, 3);
    expect(s.minigame?.focus).toEqual({ aisle: 2, rack: 3 });
    expect(s.minigame?.atFocus).toBe(true);
    const back = leaveRack(s);
    expect(back.minigame?.atFocus).toBe(false);
    expect(back.minigame?.focus).toEqual({ aisle: 2, rack: 3 });
    // после возврата можно выбрать другой
    expect(chooseRack(back, map, 1, 1).minigame?.focus).toEqual({ aisle: 1, rack: 1 });
  });

  it('у стеллажа другой выбрать нельзя — сначала назад к складу', () => {
    const s = chooseRack(inSession(), map, 2, 3);
    expect(chooseRack(s, map, 1, 1)).toBe(s);
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

  it('когда задание закончено, мини-игра закрывается — камера вернётся сама', () => {
    let s = chooseRack(inSession(), map, 1, 1);
    const taskId = s.minigame!.taskId;
    for (let i = 0; i < 6000 && s.tasks[taskId].status !== 'done'; i++) s = advanceWorld(s, map, 0.1).state;
    expect(s.minigame).toBe(null);
  });
});

describe('мини-игра «Сборка»: клик по товару на полке (M5d)', () => {
  const milkShelf = { aisle: 2, rack: 3, shelf: 2 }; // в начальном запасе: молоко, 6 шт.

  it('у стеллажа клик по полке с товаром запоминает её; «Назад к складу» сбрасывает', () => {
    const s = inspectShelf(chooseRack(inSession(), map, 2, 3), map, milkShelf);
    expect(s.minigame?.inspected).toEqual(milkShelf);
    expect(leaveRack(s).minigame?.inspected).toBe(null);
  });

  it('пустая полка, чужой стеллаж, общий вид и пауза — клик ничего не делает', () => {
    const atRack = chooseRack(inSession(), map, 2, 3);
    expect(inspectShelf(atRack, map, { aisle: 2, rack: 3, shelf: 1 })).toBe(atRack); // пусто
    expect(inspectShelf(atRack, map, { aisle: 1, rack: 1, shelf: 1 })).toBe(atRack); // другой стеллаж
    expect(inspectShelf(atRack, map, { aisle: 2, rack: 3, shelf: 9 })).toBe(atRack); // нет такой полки
    const home = inSession();
    expect(inspectShelf(home, map, milkShelf)).toBe(home);
    const paused = { ...atRack, clock: { ...atRack.clock, paused: true } };
    expect(inspectShelf(paused, map, milkShelf)).toBe(paused);
  });

  it('полка, где товар есть только в учёте, а по факту пусто, не кликается (виден факт, а не учёт)', () => {
    const atRack = chooseRack(inSession(), map, 2, 3);
    const rec = Object.values(atRack.stock).find((r) => r.address.aisle === 2 && r.address.rack === 3 && r.address.shelf === 2)!;
    const ghost = { ...atRack, stock: removeStock(atRack.stock, rec.id, { book: 0, actual: rec.actualQty }) };
    expect(shelfContents(ghost.stock, milkShelf)).toEqual([]);
    expect(inspectShelf(ghost, map, milkShelf)).toBe(ghost);
  });
});
