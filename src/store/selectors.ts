// Готовые выборки для интерфейса и сцены (09, раздел 8). Интерфейс сам ничего не считает:
// шансы и проверки берутся отсюда, а здесь — из rules.
import type { GameState } from '../model/game';
import type { OutcomeChances, Task } from '../model/task';
import type { Picker, PickerActivity } from '../model/picker';
import { outcomeChances } from '../rules/outcome';
import { canAssign } from '../rules/tasks/lifecycle';
import { formatAddress } from '../rules/address';
import { etaToTask, pickerActivity } from '../rules/jobs';
import { WAREHOUSE_MAP } from './gameStore';

/** Открытые задания по порядку появления. */
export function openTaskList(tasks: GameState['tasks']): Task[] {
  return Object.values(tasks)
    .filter((t) => t.status === 'new')
    .sort((a, b) => a.number - b.number);
}

export function pickerList(pickers: GameState['pickers']): Picker[] {
  return Object.values(pickers);
}

/** Шансы исходов для карточки сборщика — та же функция, по которой бросается исход. */
export function chancesFor(game: GameState, pickerId: string, taskId: string): OutcomeChances {
  return outcomeChances(game.pickers[pickerId], game.tasks[taskId]);
}

/** Можно ли отправить сборщика; если нет — причина. */
export function assignCheck(game: GameState, taskId: string, pickerId: string) {
  return canAssign(game, taskId, pickerId);
}

/** Адрес в виде для экрана: 3.2.1. */
export const addressText = formatAddress;

/** Короткое описание заказа: «3 товара · аллеи 1, 4». */
export function orderSummary(task: Task): string {
  if (task.type !== 'order') return '';
  const n = task.payload.lines.length;
  const aisles = [...new Set(task.payload.lines.map((l) => l.address.aisle))].sort((a, b) => a - b);
  return `${n} ${plural(n, 'товар', 'товара', 'товаров')} · ${aisles.length > 1 ? 'аллеи' : 'аллея'} ${aisles.join(', ')}`;
}

/** Русское склонение по числу: 1 товар, 2 товара, 5 товаров. */
export function plural(n: number, one: string, few: string, many: string): string {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return one;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
  return many;
}

/** Деньги для экрана: 12 450 ₽ (08, раздел 10.4). */
export function money(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
}

// ---------- время и работа (M4) ----------

/** Что делает сборщик сейчас (идёт, собирает, фасует) — из rules. */
export function activityOf(game: GameState, pickerId: string): PickerActivity {
  return pickerActivity(game, pickerId);
}

/** «0:16 до места»: время до первой точки задания для свободного сборщика. null — недоступно. */
export function etaFor(game: GameState, pickerId: string, taskId: string): number | null {
  const task = game.tasks[taskId];
  const picker = game.pickers[pickerId];
  if (!task || !picker || task.type !== 'order') return null;
  return etaToTask(WAREHOUSE_MAP, picker, task);
}

/** Секунды → «м:сс» (08, раздел 10.4). Округляем вверх, чтобы 0:00 показывалось только в самом конце. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Какой сборщик работает над заданием (для аватара на карточке задания). */
export function assigneeOf(game: GameState, task: Task): Picker | null {
  return task.assignedPickerId ? game.pickers[task.assignedPickerId] ?? null : null;
}

/** Задания для панели: новые и те, что в работе, по порядку появления. */
export function panelTaskList(tasks: GameState['tasks']): Task[] {
  return Object.values(tasks)
    .filter((t) => t.status !== 'done' && t.status !== 'expired')
    .sort((a, b) => a.number - b.number);
}
