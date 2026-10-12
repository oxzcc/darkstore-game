// Подписи и цвета для экрана. Цвета исходов зарезервированы (08, раздел 3.2).
import type { Outcome } from '../model/task';
import type { PickerState } from '../model/picker';
import type { IconName } from './icons';

/** Порядок исходов на экране: идеально → с ошибками → провал. */
export const OUTCOMES_ORDER: Outcome[] = ['perfect', 'withErrors', 'failed'];

export const OUTCOME_LOOK: Record<Outcome, { name: string; color: string; icon: IconName }> = {
  perfect: { name: 'Идеально', color: 'var(--perfect)', icon: 'perfect' },
  withErrors: { name: 'С ошибками', color: 'var(--errors)', icon: 'errors' },
  failed: { name: 'Провал', color: 'var(--failed)', icon: 'fail' },
};

export const PICKER_STATE_NAME: Record<PickerState, string> = {
  idle: 'Свободен',
  walking: 'Идёт',
  waiting: 'Ждёт решения',
  calling: 'Нужна помощь',
  working: 'Работает',
  playing: 'Играете за него',
  resting: 'Отдыхает',
};

/** Риск варианта в развилке — только словом и числом делений (решение автора 12.10, 10, раздел 3). */
export const RISK_LOOK: Record<'low' | 'medium' | 'high', { name: string; bars: number }> = {
  low: { name: 'низкий', bars: 1 },
  medium: { name: 'средний', bars: 2 },
  high: { name: 'высокий', bars: 3 },
};
