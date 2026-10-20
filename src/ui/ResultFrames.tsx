// Кадры окна итога (прототип «Окно итога задания», одобрен автором 18.10): общие для итога с развилкой (ResultWindow)
// и без развилки (RollWindow). Первый кадр — задание, реплика сборщика и портрет; стрелка между кадрами; последний — итог.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import type { Outcome, TaskType } from '../model/task';
import { money } from '../store/selectors';
import { OUTCOME_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import Icon from './icons';

const ratingText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')}`;
const CONFETTI = ['#FFC629', '#7FC743', '#2280FF', '#E0409B', '#FFFFFF'];

/** Первый кадр: вкладка, портрет, мелко «Сборка №1 · Коржик» и реплика обычным текстом
 *  (упрощение по макету «Итог · В», одобрен автором 20.10: без тёмной плашки задания и пузыря). */
export function StoryFrame({ tab, taskType, taskNumber, speech, picker, portrait }: {
  tab: string; taskType: TaskType; taskNumber: number; speech: string; picker: Picker; portrait?: ReactNode;
}) {
  return (
    <section className="rw-panel rw-p1">
      <span className="rw-tab" style={{ '--tc': picker.color } as CSSProperties}>{tab}</span>
      <div className="rw-story">
        <span className="rw-pic"><span className="rw-face-in">{portrait ?? <Avatar picker={picker} />}</span></span>
        <div className="rw-story-text">
          <span className="rw-who">{taskTitle({ type: taskType, number: taskNumber })} · {picker.name}</span>
          <b className="rw-say">{speech}</b>
        </div>
      </div>
    </section>
  );
}

/** Стрелка между кадрами; `lit: false` — бледная, пока итог не открылся. */
export function Join({ lit = true }: { lit?: boolean }) {
  return (
    <div className={`rw-join${lit ? ' pop' : ' dim'}`}>
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

type FinalProps = {
  done: boolean;
  outcome: Outcome;
  title: string;
  text: string;
  notes: string[];          // красные плашки: проблемные позиции, ограничение варианта
  gain: { money: number; rating: number; xp: number };
  seed: number;             // разлёт конфетти — один на окно
  onClose: () => void;
};

/** Последний кадр: пока барабан крутится — «?», потом лента исхода, что произошло, жетоны наград и «Дальше». */
export function FinalFrame({ done, outcome, title, text, notes, gain, seed, onClose }: FinalProps) {
  const look = OUTCOME_LOOK[outcome];
  const confetti = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + ((seed * 7 + i * 13) % 10) / 10;
    const d = 70 + ((seed * 31 + i * 17) % 90);
    return { background: CONFETTI[i % CONFETTI.length], '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d - 30}px`, '--r': `${(i * 97) % 540}deg` } as CSSProperties;
  }), [seed]);
  return (
    <section className="rw-panel rw-p3">
      <span className="rw-tab" style={{ '--tc': done ? look.color : '#C9BFA8' } as CSSProperties}>Итог</span>
      {done ? <>
        <div className="rw-ribbon"><Icon name={look.icon} /><span>{look.name}</span></div>
        {/* одна фраза под лентой (макет «Итог · В», 20.10): заголовок итога не показываем */}
        <div className="rw-text">{text || title}</div>
        {notes.map((n, i) => <span key={i} className="rw-oops">{n}</span>)}
        <div className="rw-loot">
          <span className="rw-tok coin"><i>₽</i>{gain.money > 0 ? '+' : gain.money < 0 ? '−' : ''}{money(Math.abs(gain.money))}</span>
          <span className="rw-tok star"><i><Icon name="perfect" small /></i>{ratingText(gain.rating)}</span>
          <span className="rw-tok paw"><i><Icon name="paw" small /></i>+{gain.xp}</span>
        </div>
        <button className="rw-go" onClick={(e) => { e.stopPropagation(); onClose(); }}>Дальше</button>
        {outcome === 'perfect' && <div className="rw-burst">{confetti.map((st, i) => <i key={i} style={st} />)}</div>}
      </> : <div className="rw-q"><span>?</span>Сейчас узнаем…</div>}
    </section>
  );
}
