// Мелкие общие части карточек сборщика: аватар, полоска усталости, ромбы уровня.
import type { CSSProperties } from 'react';
import type { Picker } from '../model/picker';
import Vx from './Vx';

/** Аватар: рамка в цвете сборщика. Пока буква — морды из макетов подключим, когда решим их роль. */
export function Avatar({ picker, small }: { picker: Picker; small?: boolean }) {
  return (
    <Vx className={`avatar${small ? ' small' : ''}`} style={{ '--pc': picker.color } as CSSProperties}>
      {picker.name[0]}
    </Vx>
  );
}

/** Усталость 0–100% шкалой из 10 сегментов. */
export function FatigueBar({ value }: { value: number }) {
  const on = Math.round(value / 10);
  return (
    <div className="seg" title={`Усталость ${Math.round(value)}% — снижает скорость и точность`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </div>
  );
}

/** Ромбы уровня: `value` из `max` (половинки — для шкалы 1–10 в пяти ромбах). Цвет — сборщика (`--pc`). */
export function Pips({ value, max = 5, title }: { value: number; max?: number; title?: string }) {
  return (
    <span className="pips" title={title}>
      {Array.from({ length: max }, (_, i) => {
        const cls = value >= i + 1 ? 'on' : value >= i + 0.5 ? 'half' : '';
        return <i key={i} className={cls} />;
      })}
    </span>
  );
}
