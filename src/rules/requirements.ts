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
