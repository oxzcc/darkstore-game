// Окно итога задания с развилкой — три кадра комикса (правка автора 18.10, P4; вид — прототип «Окно итога развилки», одобрен автором):
// 1. «Что случилось» — задание, реплика сборщика пузырём, его портрет; 2. «Вы решили» — выбранный вариант и ТСД с барабаном
// «Сработало / Осложнение» по шансу варианта (а если брали ТСД — сценка итога игры); 3. «Итог» — сразу после остановки барабана:
// лента исхода, что произошло, награды жетонами, «Дальше». Мир на паузе. Клик по окну, Enter или Esc во время барабана — сразу итог, потом — закрыть.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore, type ResultCard } from '../store/gameStore';
import { money, resultView } from '../store/selectors';
import { OUTCOME_LOOK, TASK_TYPE_LOOK, TSD_GAME_NAME, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import ReelTsd, { type ReelSeg } from './ReelTsd';
import Icon from './icons';

const ratingText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')}`;
const CONFETTI = ['#FFC629', '#7FC743', '#2280FF', '#E0409B', '#FFFFFF'];

/** Что нужно сценке итога: развилка, вариант, сработал ли, итог ТСД, сборщик и товар позиции. */
export type ResultArt = NonNullable<NonNullable<ReturnType<typeof resultView>>['art']> & { picker: Picker };

type Props = {
  /** Сценка-иллюстрация итога игры на ТСД (её передаёт App: интерфейс сам 3D не импортирует); null — заглушка. */
  renderArt?: (art: ResultArt) => ReactNode | null;
  /** 3D-портрет сборщика для первого кадра. */
  renderPortrait?: (picker: Picker) => ReactNode;
};

export default function ResultWindow(props: Props) {
  const card = useGameStore((s) => s.ui.results[0]);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null); // итог прошлого заказа — только после игры на ТСД
  const rollShown = useGameStore((s) => s.ui.rolls.length > 0);    // сначала барабан другого задания (P3)
  if (!card || tsdPlaying || rollShown) return null;
  return <Result key={card.id} card={card} {...props} />;
}

function Result({ card, renderArt, renderPortrait }: Props & { card: ResultCard }) {
  const game = useGameStore((s) => s.game);
  const dismiss = useGameStore((s) => s.dismissResult);
  // данные — на момент открытия окна: пока оно открыто, мир на паузе
  const v = useMemo(() => resultView(game, card), [card]);
  const reel = v?.reel ?? null;
  // ответ вариантом — сначала барабан; играли на ТСД — итог после короткой паузы
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reel) return;
    const t = setTimeout(() => setDone(true), 500);
    return () => clearTimeout(t);
  }, [reel]);

  const segs = useMemo<ReelSeg[]>(() => (reel ? [
    { key: 'ok', share: 1 - reel.chance, color: OUTCOME_LOOK.perfect.color, icon: 'check' },
    { key: 'bad', share: reel.chance, color: OUTCOME_LOOK.failed.color, icon: 'fail' },
  ] : []), [reel]);

  // конфетти при «Идеально» — разлёт задан один раз на окно
  const confetti = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + ((card.id * 7 + i * 13) % 10) / 10;
    const d = 70 + ((card.id * 31 + i * 17) % 90);
    return { background: CONFETTI[i % CONFETTI.length], '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d - 30}px`, '--r': `${(i * 97) % 540}deg` } as CSSProperties;
  }), [card.id]);

  const next = () => (done ? dismiss(card.id) : setDone(true));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!v) return null;
  const look = OUTCOME_LOOK[v.outcome];
  const p = v.picker;
  const art = !reel && v.art && renderArt ? renderArt({ ...v.art, picker: p }) : null;
  const problems = v.lines.filter((l) => l.note || l.picked < l.qty);
  const chosen = v.options.find((o) => o.chosen);
  const complication = reel?.complication ?? false;

  return (
    <div className="ac-veil">
      <div className="rw" style={{ '--pc': p.color, '--oc': look.color } as CSSProperties} onClick={() => !done && setDone(true)}>
        {/* 1. что случилось */}
        <section className="rw-panel rw-p1">
          <span className="rw-tab" style={{ '--tc': p.color } as CSSProperties}>Что случилось</span>
          <span className="rw-plate">
            <span className="rw-plate-icon"><Icon name={TASK_TYPE_LOOK[v.taskType].icon} small /></span>
            {taskTitle({ type: v.taskType, number: v.taskNumber })}
          </span>
          <div className="rw-bubble">{v.speech}</div>
          <span className="rw-face">
            <span className="rw-face-in">{renderPortrait?.(p) ?? <Avatar picker={p} />}</span>
            <span className="rw-name">{p.name}</span>
          </span>
        </section>

        <div className="rw-join"><span><Arrow /></span></div>

        {/* 2. что решили: барабан по шансу варианта или сценка итога игры на ТСД */}
        <section className={`rw-panel rw-p2${done && complication ? ' shake' : ''}`}>
          <span className="rw-tab" style={{ '--tc': 'var(--text)' } as CSSProperties}>{v.auto ? `${p.name} решил сам` : 'Вы решили'}</span>
          <div className="rw-sticker">
            <span className="rw-check"><Icon name="check" small /></span>
            <b>{chosen?.label ?? v.optionLabel}</b>
          </div>
          {reel ? <>
            <span className="rw-odds"><i>!</i>{v.riskLabel} {Math.round(reel.chance * 100)}%</span>
            <ReelTsd
              segs={segs}
              hit={complication ? 'bad' : 'ok'}
              marker={1 - reel.roll /* правила: бросок < шанса — осложнение; «сработало» на полосе слева, поэтому зеркально */}
              seed={card.id}
              done={done}
              onDone={() => setDone(true)}
            />
            <div className={`rw-shout${done ? ` go ${complication ? 'bad' : 'ok'}` : ' wait'}`}>
              {done ? (complication ? 'Осложнение!' : 'Сработало!') : '…'}
            </div>
          </> : <>
            {v.tsdGame && <span className="rw-odds plain">Игра «{TSD_GAME_NAME[v.tsdGame]}»</span>}
            <div className="rw-art">{art ?? <span className="rw-art-stub">{p.name[0]}</span>}</div>
          </>}
        </section>

        <div className={`rw-join${done ? ' pop' : ' dim'}`}><span><Arrow /></span></div>

        {/* 3. итог задания — сразу после остановки барабана */}
        <section className="rw-panel rw-p3">
          <span className="rw-tab" style={{ '--tc': done ? look.color : '#C9BFA8' } as CSSProperties}>Итог</span>
          {done ? <>
            <div className="rw-ribbon"><Icon name={look.icon} /><span>{look.name}</span></div>
            <div className="rw-title">{v.title}</div>
            <div className="rw-text">{v.text}</div>
            {v.capped && <span className="rw-oops">У этого варианта исход не выше «{OUTCOME_LOOK[v.capped].name}»</span>}
            {problems.map((l, i) => <span key={i} className="rw-oops">{l.name}: {l.note ?? `${l.picked} из ${l.qty}`}</span>)}
            <div className="rw-loot">
              <span className="rw-tok coin"><i>₽</i>{v.money.got > 0 ? '+' : ''}{money(v.money.got)}</span>
              <span className="rw-tok star"><i><Icon name="perfect" small /></i>{ratingText(v.rating.got)}</span>
              <span className="rw-tok paw"><i><Icon name="paw" small /></i>+{v.xp}</span>
            </div>
            <button className="rw-go" onClick={(e) => { e.stopPropagation(); dismiss(card.id); }}>Дальше</button>
            {v.outcome === 'perfect' && <div className="rw-burst">{confetti.map((st, i) => <i key={i} style={st} />)}</div>}
          </> : <div className="rw-q"><span>?</span>Сейчас узнаем…</div>}
        </section>
      </div>
    </div>
  );
}

/** Стрелка между кадрами. */
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
