// Мелкие общие части карточек сборщика: аватар, полоска усталости, полосы характеристик.
import type { CSSProperties } from 'react';
import type { Picker } from '../model/picker';
import { STAT_SCALE } from '../config/pickers';
import Vx from './Vx';
import Icon from './icons';

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

/** Скорость, точность, усталость — короткими полосками, как на ui_03. */
export function StatBars({ picker }: { picker: Picker }) {
  const pct = (v: number) => `${((v - STAT_SCALE.min + 1) / (STAT_SCALE.max - STAT_SCALE.min + 1)) * 100}%`;
  return (
    <div className="stats">
      <Icon name="speedStat" small />
      <div className="stat-bar" title={`Скорость ${picker.stats.speed}`}><b style={{ width: pct(picker.stats.speed) }} /></div>
      <Icon name="acc" small />
      <div className="stat-bar" title={`Точность ${picker.stats.accuracy}`}><b style={{ width: pct(picker.stats.accuracy) }} /></div>
      <Icon name="fatigue" small />
      <div className="stat-bar" title={`Усталость ${Math.round(picker.stats.fatigue)}%`}>
        <b style={{ width: `${picker.stats.fatigue}%`, background: 'var(--failed)' }} />
      </div>
    </div>
  );
}
