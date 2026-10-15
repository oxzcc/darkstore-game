// Время: сколько длятся ходьба и работа, и как реальное время превращается в игровое (09, раздел 7).
import type { GameClock } from '../model/game';
import type { Picker } from '../model/picker';
import { DELIVERY, PUTAWAY, TIMING, WRITEOFF } from '../config/balance';
import type { TaskType } from '../model/task';
import { effectiveSpeed } from './pickerStats';

/**
 * Во сколько раз сборщик медленнее эталона: скорость 5 → 1, скорость 7 → ~0,71, скорость 3 → ~1,67.
 * Скорость рабочая (M8c): усталость замедляет всегда, специализация ускоряет работу своего типа (`type`).
 */
export function speedFactor(picker: Picker, type?: TaskType): number {
  return TIMING.refSpeed / Math.max(1, effectiveSpeed(picker, type));
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
  return TIMING.pickSeconds * speedFactor(picker, 'order');
}

/** Приёмка поставки: база + на каждую паллету, пропорционально скорости (10, раздел 13.2). */
export function receiveSeconds(picker: Picker, pallets: number): number {
  return (DELIVERY.receiveBaseSeconds + DELIVERY.receivePerPalletSeconds * pallets) * speedFactor(picker, 'receiving');
}

/** Выкладка: загрузить тележку у паллеты и выложить одну позицию на полку. */
export function loadSeconds(picker: Picker): number {
  return PUTAWAY.loadSeconds * speedFactor(picker, 'putaway');
}
export function placeSeconds(picker: Picker): number {
  return PUTAWAY.placeSeconds * speedFactor(picker, 'putaway');
}

/** Списание: снять партию с полки (от скорости) и сдать в брак (как фасовка — не зависит). */
export function takeDownSeconds(picker: Picker): number {
  return WRITEOFF.takeSeconds * speedFactor(picker, 'writeoff');
}
export function dropSeconds(): number {
  return WRITEOFF.dropSeconds;
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
