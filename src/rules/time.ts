// Время: сколько длятся ходьба и работа, и как реальное время превращается в игровое (09, раздел 7).
import type { GameClock } from '../model/game';
import type { Picker } from '../model/picker';
import { TIMING } from '../config/balance';

/** Во сколько раз сборщик медленнее эталона: скорость 5 → 1, скорость 7 → ~0,71, скорость 3 → ~1,67. */
export function speedFactor(picker: Picker): number {
  return TIMING.refSpeed / Math.max(1, picker.stats.speed);
}

/** Секунд на одну клетку пути. */
export function secondsPerCell(picker: Picker): number {
  return TIMING.secondsPerCell * speedFactor(picker);
}

/** Время дороги по пути длиной `cells` клеток. Это же число показывается как «0:16 до места». */
export function travelSeconds(picker: Picker, cells: number): number {
  return cells * secondsPerCell(picker);
}

/** Сбор одной позиции заказа. */
export function pickSeconds(picker: Picker): number {
  return TIMING.pickSeconds * speedFactor(picker);
}

/** Фасовка заказа. */
export function packSeconds(): number {
  return TIMING.packSeconds;
}

/**
 * Реальное время кадра → игровое.
 * Пауза (ручная или автопауза окна назначения) → 0; иначе кадр обрезается до maxFrameSeconds и умножается на ×1/×2.
 */
export function worldDt(clock: GameClock, realDt: number, autopause: boolean): number {
  if (clock.paused || autopause || realDt <= 0) return 0;
  return Math.min(realDt, TIMING.maxFrameSeconds) * clock.playerSpeed;
}
