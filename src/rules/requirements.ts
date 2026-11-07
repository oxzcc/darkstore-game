// Требования задания по пяти характеристикам (docs/10, раздел 14.4; решения автора 20.10).
// От типа задания и от содержимого — иначе все сборки одинаковые и выбор сборщика не важен. Числа — REQUIREMENTS в config/balance.ts.
import { STAT_KEYS, type StatBlock } from '../model/picker';
import type { Task } from '../model/task';
import { REQUIREMENTS } from '../config/balance';
import { PRODUCTS } from '../config/products';

const empty = (): StatBlock => ({ speed: 0, accuracy: 0, strength: 0, memory: 0, friendly: 0 });
const heavy = (productId: string) => PRODUCTS[productId]?.heavy === true;

/** Что нужно для задания: пять чисел 0–10 (0 — эта характеристика не нужна). */
export function taskRequirements(task: Task): StatBlock {
  const R = REQUIREMENTS;
  const req = empty();
  const add = (part: Partial<StatBlock>) => { for (const k of STAT_KEYS) req[k] += part[k] ?? 0; };
  if (task.type === 'order') {
    add(R.order.base);
    const lines = task.payload.lines.length;
    req.memory += Math.max(0, lines - R.order.memoryPerLineFrom) * R.order.memoryPerLine;
    if (task.payload.lines.some((l) => heavy(l.productId))) req.strength += R.order.heavyStrength;
  } else if (task.type === 'receiving') {
    add(R.receiving.base);
    req.strength += Math.max(0, task.payload.palletCount - 1) * R.receiving.strengthPerPallet;
  } else if (task.type === 'putaway') {
    add(R.putaway.base);
    req.memory += Math.max(0, task.payload.lines.length - R.putaway.memoryPerShelfFrom) * R.putaway.memoryPerShelf;
  } else {
    add(R.writeoff.base);
    if (heavy(task.payload.productId)) req.strength += R.writeoff.heavyStrength;
  }
  req.memory = Math.min(R.maxMemory, req.memory);
  const k = 1 + R.perDifficulty * (task.difficulty - 1);
  for (const s of STAT_KEYS) req[s] = Math.min(R.max, Math.round(req[s] * k));
  return req;
}

/**
 * Откуда взялись требования — для шапки окна назначения (X3): «4 позиции → Память 4», «есть вода → Сила 5», база задания,
 * сложность. `label: null` — база типа задания. Числа — до множителя сложности (он отдельной строкой `difficulty`).
 */
export type RequirementReason =
  | { kind: 'base'; adds: Partial<StatBlock> }
  | { kind: 'lines' | 'pallets' | 'shelves'; count: number; adds: Partial<StatBlock> }
  | { kind: 'heavy'; productId: string; adds: Partial<StatBlock> }
  | { kind: 'difficulty'; level: number; factor: number };

export function requirementReasons(task: Task): RequirementReason[] {
  const R = REQUIREMENTS;
  const out: RequirementReason[] = [];
  const memoryCap = (v: number) => Math.min(R.maxMemory, v);
  if (task.type === 'order') {
    const lines = task.payload.lines.length;
    const memory = memoryCap(Math.max(0, lines - R.order.memoryPerLineFrom) * R.order.memoryPerLine);
    if (memory > 0) out.push({ kind: 'lines', count: lines, adds: { memory } });
    const h = task.payload.lines.find((l) => heavy(l.productId));
    if (h) out.push({ kind: 'heavy', productId: h.productId, adds: { strength: R.order.heavyStrength } });
    out.push({ kind: 'base', adds: R.order.base });
  } else if (task.type === 'receiving') {
    const n = task.payload.palletCount;
    const strength = Math.max(0, n - 1) * R.receiving.strengthPerPallet;
    if (strength > 0) out.push({ kind: 'pallets', count: n, adds: { strength } });
    out.push({ kind: 'base', adds: R.receiving.base });
  } else if (task.type === 'putaway') {
    const n = task.payload.lines.length;
    const memory = memoryCap(Math.max(0, n - R.putaway.memoryPerShelfFrom) * R.putaway.memoryPerShelf);
    if (memory > 0) out.push({ kind: 'shelves', count: n, adds: { memory } });
    out.push({ kind: 'base', adds: R.putaway.base });
  } else {
    if (heavy(task.payload.productId)) out.push({ kind: 'heavy', productId: task.payload.productId, adds: { strength: R.writeoff.heavyStrength } });
    out.push({ kind: 'base', adds: R.writeoff.base });
  }
  if (task.difficulty > 1) out.push({ kind: 'difficulty', level: task.difficulty, factor: 1 + R.perDifficulty * (task.difficulty - 1) });
  return out;
}
