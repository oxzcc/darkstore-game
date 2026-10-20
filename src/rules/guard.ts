// Скрытые подпорки бросков, как в Dispatch (docs/10, раздел 14.7; решение автора 20.10: скрытые).
// Игрок видит честные шансы; бросок чуть подкручен в его пользу, чтобы игра «ощущалась честной».
import type { Outcome, OutcomeChances } from '../model/task';
import { GUARD } from '../config/balance';
import { outcomeAt } from './outcome';

/** Где сейчас подпорки: off — выключены (последняя смена), tutorial — без ограничения «подряд». */
export type GuardMode = 'on' | 'off' | 'tutorial';

export type GuardedRoll = {
  outcome: Outcome;
  /** Куда встал маркер на полосе показанных шансов (0…1) — совпадает с выпавшим исходом. */
  value: number;
  /** Сколько «подарков» подряд стало после броска. */
  streak: number;
};

/** Середина зоны исхода на полосе — туда ставим маркер, если исход дала подпорка. */
function middleOf(chances: OutcomeChances, outcome: Outcome): number {
  if (outcome === 'perfect') return chances.perfect / 2;
  if (outcome === 'withErrors') return chances.perfect + chances.withErrors / 2;
  return chances.perfect + chances.withErrors + chances.failed / 2;
}

/**
 * Бросок с подпорками. r — честное случайное 0…1, streak — сколько подарков подряд уже было.
 * 1) «Идеально» ≥ sure → «Идеально», пока подарков подряд меньше maxStreak; честный промах на ≥ sure сбрасывает счётчик.
 * 2) «Идеально» ниже floor — бросаем так, будто оно floor (доля берётся у соседних зон); у варианта с потолком (0%) — нет.
 * 3) провал не больше noFailUpTo не выпадает — вместо него «Неплохо».
 */
export function guardedRoll(chances: OutcomeChances, r: number, streak: number, mode: GuardMode): GuardedRoll {
  const honest = outcomeAt(chances, r);
  if (!GUARD.enabled || mode === 'off') return { outcome: honest, value: r, streak: 0 };
  const limit = mode === 'tutorial' ? Infinity : GUARD.maxStreak;
  if (chances.perfect >= GUARD.sure) {
    if (honest === 'perfect') return { outcome: honest, value: r, streak };
    if (streak < limit) return { outcome: 'perfect', value: middleOf(chances, 'perfect'), streak: streak + 1 };
    return { outcome: honest, value: r, streak: 0 }; // честный промах — подпорка снова включится
  }
  let outcome = honest;
  if (chances.perfect > 0 && chances.perfect < GUARD.floor && r < GUARD.floor) outcome = 'perfect'; // 0 — вариант с потолком, подарка нет
  if (outcome === 'failed' && chances.failed <= GUARD.noFailUpTo) outcome = 'withErrors';
  return { outcome, value: outcome === honest ? r : middleOf(chances, outcome), streak };
}
