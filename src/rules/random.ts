// Генератор случайных чисел с зерном (09, раздел 5.2). В rules нельзя вызывать Math.random():
// с одним и тем же зерном игра и тесты дают одинаковый результат, а баг можно повторить.

export type Rng = {
  /** Число от 0 (включительно) до 1 (не включительно). */
  next(): number;
  /** Целое от min до max включительно. */
  int(min: number, max: number): number;
  /** Случайный элемент массива. */
  pick<T>(items: T[]): T;
  /** Перемешанная копия массива. */
  shuffle<T>(items: T[]): T[];
  /** Текущее зерно — его store сохраняет в GameState.rngSeed. */
  seed(): number;
};

/** Алгоритм mulberry32: маленький, быстрый и достаточно случайный для игры. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick: пустой список');
      return items[int(0, items.length - 1)];
    },
    shuffle: (items) => {
      const a = [...items];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    seed: () => s,
  };
}
