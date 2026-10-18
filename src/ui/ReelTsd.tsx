// Барабан на корпусе ТСД (P3/P4): лента символов в пропорции долей останавливается на выпавшем,
// под ней (на корпусе) — полоса долей и стрелки-маркер в точке броска. Исход уже известен (его бросили правила) — барабан только показывает.
// Общий для окна барабана (задание без развилки) и центра окна итога развилки.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ROLL_REEL } from '../config/balance';
import { AUDIO } from '../config/audio';
import { play, type SoundHandle } from '../audio/engine';
import { reelTickTimes } from '../audio/reelTicks';
import Icon, { type IconName } from './icons';

export type ReelSeg = { key: string; share: number; color: string; icon: IconName };

const SYM_H = 44; // высота одного символа на ленте, px (= .rr-sym в theme.css)
/** Кривая, по которой едет лента: та же для CSS и для щелчков звука (M9e). */
const EASE: [number, number, number, number] = [0.12, 0.75, 0.18, 1];

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

  // звук (M9e): щелчок на каждый символ, проходящий окно; остановка — «тук». Остановили кликом раньше — щелчки обрываются.
  const ticks = useRef<SoundHandle[]>([]);
  useEffect(() => {
    if (!moving || done) return;
    ticks.current = reelTickTimes(stop - 1, spinMs / 1000, EASE, AUDIO.reelMaxTicks).map((delay) => play('reelTick', { delay }));
  }, [moving]);
  useEffect(() => {
    if (!done) return;
    ticks.current.forEach((h) => h.stop());
    ticks.current = [];
    play('reelStop');
  }, [done]);
  useEffect(() => () => ticks.current.forEach((h) => h.stop()), []);

  // кадр на месте → запуск ленты; после spinMs — остановилась
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoving(true));
    const t = setTimeout(onDone, spinMs + 30);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // onDone не в зависимостях: запуск — один раз на карточку
  }, [spinMs]);

  const go = moving || done;
  const ease = `cubic-bezier(${EASE.join(',')})`;
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
        <div className="rr-tsd-head"><i className="rr-led" /><span>ТСД</span><i className="rr-grill" /></div>
        <div className="rr-screen">
          <div className={`rr-window${done ? ' hit' : ''}`} />
          <div className="rr-strip" style={stripStyle}>
            {strip.map((sg, i) => (
              <div key={i} className="rr-sym"><span style={{ background: sg.color }}><Icon name={sg.icon} /></span></div>
            ))}
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
        <div className="rr-keys"><i /><i className="g" /><i /></div>
      </div>
    </div>
  );
}
