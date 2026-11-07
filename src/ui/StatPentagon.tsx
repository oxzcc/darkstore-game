// Пятиугольник характеристик (X3, docs/10 раздел 14.9; макеты «Пять характеристик», одобрены автором 20.10).
// Пять осей всегда в одном порядке: Лапы сверху, дальше по часовой Нюх, Сила, Память, Дружба.
// Заливка цветом сборщика — что он умеет (с усталостью); пунктир — что нужно заданию; где заливка не дотягивает — красным.
// Серый контур — характеристики без усталости (только в профиле). Рисуется SVG кодом; всё считает rules, тут только рисунок.
import { useId, type CSSProperties } from 'react';
import { STAT_KEYS, type StatBlock, type StatKey } from '../model/picker';
import { STAT_SCALE } from '../config/pickers';
import { ICON_PATHS } from '../config/icons';
import { STAT_LOOK } from './labels';

type Props = {
  stats: StatBlock;          // рабочие характеристики (с усталостью)
  color: string;             // цвет сборщика
  size?: number;             // сторона квадрата в px
  req?: StatBlock | null;    // требования задания — пунктир и красная нехватка
  base?: StatBlock | null;   // без усталости — серый контур (рисуется, только если отличается)
  /** Подписи у осей: значок; `numbers` — ещё и числа (большой вид в профиле и итогах). */
  numbers?: boolean;
  /** Подсветить ось (только что вложили очко). */
  flash?: StatKey | null;
};

const ANGLE = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / STAT_KEYS.length;

export default function StatPentagon({ stats, color, size = 96, req = null, base = null, numbers = false, flash = null }: Props) {
  const id = useId().replace(/:/g, '');
  const pad = numbers ? 0.3 : 0.2; // место под подписи по краям
  const c = 50;
  const r = 50 * (1 - pad);
  const max = STAT_SCALE.max;
  const pt = (i: number, v: number) => {
    const k = Math.max(0, Math.min(max, v)) / max;
    return [c + Math.cos(ANGLE(i)) * r * k, c + Math.sin(ANGLE(i)) * r * k] as const;
  };
  const poly = (block: StatBlock) => STAT_KEYS.map((k, i) => pt(i, block[k]).join(',')).join(' ');
  const ring = (v: number) => STAT_KEYS.map((_, i) => pt(i, v).join(',')).join(' ');
  const showBase = base && STAT_KEYS.some((k) => base[k] !== stats[k]);
  const iconSize = numbers ? 11 : 13;

  return (
    <svg className="pent" viewBox="0 0 100 100" width={size} height={size} style={{ '--pc': color } as CSSProperties} aria-hidden>
      <defs>
        {/* красное — внутри требований, но снаружи формы сборщика */}
        <mask id={`m${id}`}>
          <rect width="100" height="100" fill="#fff" />
          <polygon points={poly(stats)} fill="#000" />
        </mask>
      </defs>
      <polygon className="pent-ring" points={ring(max)} />
      <polygon className="pent-ring half" points={ring(max / 2)} />
      {STAT_KEYS.map((k, i) => {
        const [x, y] = pt(i, max);
        return <line key={k} className="pent-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      {showBase && <polygon className="pent-base" points={poly(base!)} />}
      <polygon className="pent-fill" points={poly(stats)} />
      {req && <polygon className="pent-short" points={poly(req)} mask={`url(#m${id})`} />}
      {req && <polygon className="pent-req" points={poly(req)} />}
      {STAT_KEYS.map((k, i) => {
        const a = ANGLE(i);
        const lr = r + (numbers ? 13 : 9);
        const x = c + Math.cos(a) * lr;
        const y = c + Math.sin(a) * lr;
        const look = STAT_LOOK[k];
        return (
          <g key={k} className={`pent-label${flash === k ? ' flash' : ''}`}>
            <svg x={x - iconSize / 2} y={y - iconSize / 2 - (numbers ? 3 : 0)} width={iconSize} height={iconSize} viewBox="0 0 24 24"
              dangerouslySetInnerHTML={{ __html: ICON_PATHS[look.icon] }} />
            {numbers && (
              <text x={x} y={y + 10} textAnchor="middle">{fmt(stats[k])}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Число: целое — как есть, дробное (усталость) — с одним знаком. */
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}
