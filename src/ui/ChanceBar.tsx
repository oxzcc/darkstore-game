// Тонкая полоса шансов с маркером (упрощённое окно итога, макет «Итог · В», одобрен автором 20.10):
// маркер пробегает по полосе и встаёт в точке броска — вместо корпуса ТСД с барабаном. Исход уже брошен правилами — полоса только показывает.
// Общая для итога развилки («Сработало / Осложнение») и итога без развилки (три исхода).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ROLL_REEL } from '../config/balance';
import { AUDIO } from '../config/audio';
import { play, type SoundHandle } from '../audio/engine';
import { reelTickTimes } from '../audio/reelTicks';
import type { ReelSeg } from './ReelTsd';

/** Та же кривая, что у барабана (ReelTsd): маркер разгоняется и плавно тормозит. */
const EASE: [number, number, number, number] = [0.12, 0.75, 0.18, 1];
/** Сколько «щелчков» звука за пробег маркера (как символы барабана). */
const TICKS = 14;

type Props = {
  segs: ReelSeg[];
  marker: number;     // где встаёт маркер, 0…1 слева направо
  done: boolean;      // родитель сказал «сразу итог» (клик / клавиша)
  onDone: () => void; // маркер встал сам
};

export default function ChanceBar({ segs, marker, done, onDone }: Props) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const spinMs = reduce ? 0 : ROLL_REEL.spinMs;
  const [moving, setMoving] = useState(false);

  // звук (M9e): щелчки по ходу маркера, в конце — «тук»; остановили кликом раньше — щелчки обрываются
  const ticks = useRef<SoundHandle[]>([]);
  useEffect(() => {
    if (!moving || done) return;
    ticks.current = reelTickTimes(TICKS, spinMs / 1000, EASE, AUDIO.reelMaxTicks).map((delay) => play('reelTick', { delay }));
  }, [moving]);
  useEffect(() => {
    if (!done) return;
    ticks.current.forEach((h) => h.stop());
    ticks.current = [];
    play('reelStop');
  }, [done]);
  useEffect(() => () => ticks.current.forEach((h) => h.stop()), []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoving(true));
    const t = setTimeout(onDone, spinMs + 30);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // onDone не в зависимостях: запуск — один раз на карточку
  }, [spinMs]);

  const go = moving || done;
  const style: CSSProperties = {
    left: `${(go ? marker : 0) * 100}%`,
    transition: done ? 'none' : moving ? `left ${spinMs}ms cubic-bezier(${EASE.join(',')})` : 'none',
  };
  return (
    <span className="cb">
      <span className="cb-bar">
        {segs.map((sg) => <b key={sg.key} style={{ width: `${sg.share * 100}%`, background: sg.color }} />)}
      </span>
      <i className="cb-marker" style={style} />
    </span>
  );
}
