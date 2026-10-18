// Барабан на корпусе ТСД (P3/P4): лента символов в пропорции долей останавливается на выпавшем,
// под ней — полоса долей и стрелки-маркер в точке броска. Исход уже известен (его бросили правила) — барабан только показывает.
// Общий для окна барабана (задание без развилки) и центра окна итога развилки.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ROLL_REEL } from '../config/balance';
import Icon, { type IconName } from './icons';

export type ReelSeg = { key: string; share: number; color: string; icon: IconName };

const SYM_H = 44; // высота одного символа на ленте, px (= .rr-sym в theme.css)

/** Лента: символы в пропорции долей, перемешаны по seed; три круга, остановка — на выпавшем в третьем. */
function buildStrip(segs: ReelSeg[], hit: string, seed0: number): { strip: ReelSeg[]; stop: number } {
  const pool: ReelSeg[] = [];
  for (const sg of segs) {
    const count = Math.max(sg.share > 0 ? 1 : 0, Math.round(sg.share * ROLL_REEL.symbols));
    for (let k = 0; k < count; k++) pool.push(sg);
  }
  let seed = seed0 * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const strip = [...pool, ...pool, ...pool];
  const third = pool.length * 2;
  const at = strip.slice(third).findIndex((sg) => sg.key === hit);
  return { strip, stop: third + Math.max(0, at) };
}

type Props = {
  segs: ReelSeg[];
  hit: string;          // ключ сегмента, на котором остановиться
  marker: number;       // где маркер на полосе, 0…1 слева направо
  seed: number;         // для перемешивания ленты (id карточки)
  done: boolean;        // родитель сказал «сразу итог» (клик / клавиша)
  onDone: () => void;   // лента остановилась сама
};

export default function ReelTsd({ segs, hit, marker, seed, done, onDone }: Props) {
  const { strip, stop } = useMemo(() => buildStrip(segs, hit, seed), [segs, hit, seed]);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const spinMs = reduce ? 0 : ROLL_REEL.spinMs;
  const [moving, setMoving] = useState(false);

  // кадр на месте → запуск ленты; после spinMs — остановилась
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoving(true));
    const t = setTimeout(onDone, spinMs + 30);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // onDone не в зависимостях: запуск — один раз на карточку
  }, [spinMs]);

  const go = moving || done;
  const ease = 'cubic-bezier(.12,.75,.18,1)';
  const stripStyle: CSSProperties = {
    transform: `translateY(${go ? -(stop * SYM_H - SYM_H) : 0}px)`,
    transition: done ? 'none' : moving ? `transform ${spinMs}ms ${ease}` : undefined,
  };
  const markerStyle: CSSProperties = {
    left: `${(go ? marker : 0) * 100}%`,
    transition: done ? 'none' : moving ? `left ${spinMs}ms ${ease}` : 'none',
  };
  const hitColor = segs.find((s) => s.key === hit)?.color;

  return (
    <div className="rr-reel" style={{ '--oc': hitColor } as CSSProperties}>
      <div className="rr-tsd">
        <div className="rr-screen">
          <div className={`rr-window${done ? ' hit' : ''}`} />
          <div className="rr-strip" style={stripStyle}>
            {strip.map((sg, i) => (
              <div key={i} className="rr-sym"><span style={{ background: sg.color }}><Icon name={sg.icon} /></span></div>
            ))}
          </div>
        </div>
      </div>
      {/* та же полоса долей, что на карточке сборщика / в окне развилки; стрелки — куда выпал бросок */}
      <div className="rr-barwrap">
        <span className="ac-bar rr-bar">
          {segs.map((sg) => (
            <b key={sg.key} style={{ width: `${sg.share * 100}%`, background: sg.color }}>
              {sg.share >= 0.14 ? `${Math.round(sg.share * 100)}%` : ''}
            </b>
          ))}
        </span>
        <i className="rr-marker" style={markerStyle} />
      </div>
    </div>
  );
}
