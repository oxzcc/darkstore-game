// План текущей смены (M8d): одна строка из SHIFT_PLAN. Без зависимостей от других правил — ими пользуются многие.
import type { GameState } from '../model/game';
import { SHIFT_PLAN, type ShiftPlan } from '../config/balance';

/** План текущей смены. Смен больше, чем строк в SHIFT_PLAN, — берётся последняя. */
export function shiftPlan(state: Pick<GameState, 'campaign'>): ShiftPlan {
  const i = Math.min(Math.max(1, state.campaign.shift), SHIFT_PLAN.length) - 1;
  return SHIFT_PLAN[i];
}

/** Обучающая смена: без штрафов, с подсказками и гарантированными развилками (02, раздел 3). */
export function isTutorial(state: Pick<GameState, 'campaign'>): boolean {
  return shiftPlan(state).tutorial;
}
