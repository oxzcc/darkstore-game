// Когда щёлкает барабан (M9e): по щелчку на каждый символ ленты, проходящий через окно.
// Лента едет по той же кривой, что в CSS (ReelTsd: cubic-bezier), поэтому щелчки сначала частые, к остановке реже.

/** Точка кривой cubic-bezier(x1, y1, x2, y2) при параметре s (0…1). */
function bez(s: number, p1: number, p2: number): number {
  const u = 1 - s;
  return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s;
}

/**
 * Моменты щелчков (секунды от старта) для ленты, которая проезжает `symbols` символов за `spinSec`.
 * Щелчков не больше maxTicks: на длинной ленте щёлкает каждый второй, третий… символ.
 */
export function reelTickTimes(symbols: number, spinSec: number, curve: [number, number, number, number], maxTicks: number): number[] {
  if (symbols <= 0 || spinSec <= 0 || maxTicks <= 0) return [];
  const [x1, y1, x2, y2] = curve;
  const every = Math.ceil(symbols / maxTicks);
  const times: number[] = [];
  for (let k = every; k < symbols; k += every) {
    const target = k / symbols; // какая доля пути пройдена
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, y1, y2) < target) lo = mid; else hi = mid;
    }
    times.push(bez((lo + hi) / 2, x1, x2) * spinSec);
  }
  return times;
}
