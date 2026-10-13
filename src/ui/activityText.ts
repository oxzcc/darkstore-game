// Подпись «что делает сборщик» для карточек: из данных rules (через selectors) — в текст.
import type { PickerActivity } from '../model/picker';
import { clockText } from '../store/selectors';
import type { IconName } from './icons';

export function activityLine(a: PickerActivity): { text: string; icon: IconName; progress: number | null } {
  switch (a.kind) {
    case 'idle': return { text: 'Свободен', icon: 'check', progress: null };
    case 'waitingTsd': return { text: `Ждёт: взять ТСД? · ${clockText(a.secondsLeft)}`, icon: 'pause', progress: null };
    case 'atRack': return { text: 'Ждёт указаний с ТСД', icon: 'pause', progress: null };
    case 'calling': return {
      text: a.secondsLeft === null ? 'Нужна помощь' : `Нужна помощь · ${clockText(a.secondsLeft)}`,
      icon: 'pause', progress: null,
    };
    case 'busy': return { text: a.label, icon: 'work', progress: a.progress };
    case 'walking': return { text: `Идёт ${a.to} · ${clockText(a.secondsLeft)}`, icon: 'walk', progress: a.progress };
    case 'picking': return { text: `Собирает ${a.line} из ${a.lines}`, icon: 'work', progress: a.progress };
    case 'packing': return { text: 'Фасует заказ', icon: 'work', progress: a.progress };
  }
}
