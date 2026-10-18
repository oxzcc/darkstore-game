// Окно итога задания с развилкой — три колонки (правка автора 18.10, P4):
// слева сюжет — реплика сборщика и варианты (выбранный подсвечен); по центру ТСД с барабаном «Сработало / Осложнение»
// по шансу выбранного варианта, а если брали ТСД — сценка-иллюстрация итога игры; справа итог задания — сразу после остановки барабана.
// Только минимум: что выбрано, что произошло, какой итог. Мир на паузе. Закрыть — кнопка, Enter или Esc (во время барабана — сразу к итогу).
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore, type ResultCard } from '../store/gameStore';
import { money, resultView } from '../store/selectors';
import { nameForm, OUTCOME_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import ReelTsd, { type ReelSeg } from './ReelTsd';
import Vx from './Vx';
import Icon from './icons';

const ratingText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')}`;

/** Что нужно сценке итога: развилка, вариант, сработал ли, итог ТСД, сборщик и товар позиции. */
export type ResultArt = NonNullable<NonNullable<ReturnType<typeof resultView>>['art']> & { picker: Picker };

/** `renderArt` — сценка-иллюстрация итога (её передаёт App: интерфейс сам 3D не импортирует); null — заглушка. */
export default function ResultWindow({ renderArt }: { renderArt?: (art: ResultArt) => ReactNode | null }) {
  const card = useGameStore((s) => s.ui.results[0]);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null); // итог прошлого заказа — только после игры на ТСД
  const rollShown = useGameStore((s) => s.ui.rolls.length > 0);    // сначала барабан другого задания (P3)
  if (!card || tsdPlaying || rollShown) return null;
  return <Result key={card.id} card={card} renderArt={renderArt} />;
}

function Result({ card, renderArt }: { card: ResultCard; renderArt?: (art: ResultArt) => ReactNode | null }) {
  const game = useGameStore((s) => s.game);
  const dismiss = useGameStore((s) => s.dismissResult);
  // данные — на момент открытия окна: пока оно открыто, мир на паузе
  const v = useMemo(() => resultView(game, card), [card]);
  const reel = v?.reel ?? null;
  // ответ вариантом — сначала барабан; играли на ТСД — итог сразу
  const [done, setDone] = useState(reel === null);

  const segs = useMemo<ReelSeg[]>(() => (reel ? [
    { key: 'ok', share: 1 - reel.chance, color: OUTCOME_LOOK.perfect.color, icon: 'check' },
    { key: 'bad', share: reel.chance, color: OUTCOME_LOOK.failed.color, icon: 'fail' },
  ] : []), [reel]);

  const next = () => (done ? dismiss(card.id) : setDone(true));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!v) return null;
  const look = OUTCOME_LOOK[v.outcome];
  const art = !reel && v.art && renderArt ? renderArt({ ...v.art, picker: v.picker }) : null;
  const problems = v.lines.filter((l) => l.note || l.picked < l.qty);

  return (
    <div className="ac-veil">
      <Vx className="res3" bodyClass="window" style={{ '--pc': v.picker.color, '--oc': look.color } as CSSProperties}>
        <div className="res3-grid">
          {/* 1. сюжет: что случилось и что выбрали */}
          <section className="res3-col">
            <div className="res3-who">
              <Avatar picker={v.picker} small />
              <div className="grow">
                <b>{taskTitle({ type: v.taskType, number: v.taskNumber })}</b>
                <span>{v.picker.name}</span>
              </div>
            </div>
            <div className="res3-speech">«{v.speech}»</div>
            <div className="res3-label">{v.auto ? `${v.picker.name} решил сам` : 'Вы решили'}</div>
            <div className="res3-options">
              {v.options.map((o) => (
                <div key={o.id} className={`res3-opt${o.chosen ? ' chosen' : ''}`}>
                  {o.chosen && <Icon name="check" small />}
                  <span className="grow">{o.label}</span>
                  {o.chosen && reel && <span className="res3-risk">{v.riskLabel}: {Math.round(reel.chance * 100)}%</span>}
                </div>
              ))}
            </div>
          </section>

          {/* 2. центр: барабан по шансу варианта или сценка итога игры на ТСД */}
          <section className="res3-col res3-center" onClick={() => !done && setDone(true)}>
            {reel ? (
              <ReelTsd
                segs={segs}
                hit={reel.complication ? 'bad' : 'ok'}
                marker={1 - reel.roll /* правила: бросок < шанса — осложнение; «сработало» на полосе слева, поэтому зеркально */}
                seed={card.id}
                done={done}
                onDone={() => setDone(true)}
              />
            ) : (
              <div className="res3-art">{art ?? <span className="res3-art-stub">{v.picker.name[0]}</span>}</div>
            )}
            <div className="res3-step">
              {done ? <b style={{ color: reel ? (reel.complication ? 'var(--failed)' : 'var(--primary)') : look.color }}>{reel ? (reel.complication ? 'Осложнение' : 'Сработало') : OUTCOME_LOOK[v.outcome].name}</b> : '…'}
            </div>
          </section>

          {/* 3. итог задания — сразу после остановки барабана */}
          <section className="res3-col res3-result">
            {done ? <>
              <div className="res3-stamp"><Icon name={look.icon} /><b>{look.name}</b></div>
              <div className="res3-title">{v.title}</div>
              <div className="res3-text">{v.text}</div>
              {v.capped && <div className="res3-note">У этого варианта исход не выше «{OUTCOME_LOOK[v.capped].name}»</div>}
              {problems.map((l, i) => <div key={i} className="res3-note bad">{l.name}: {l.note ?? `${l.picked} из ${l.qty}`}</div>)}
              <div className="res3-sum">
                <span>Деньги</span><b>{v.money.got > 0 ? '+' : ''}{money(v.money.got)}</b>
                <span>Рейтинг</span><b>{ratingText(v.rating.got)}</b>
                <span>Опыт {nameForm(v.picker.name)}</span><b>+{v.xp}</b>
              </div>
              <button className="btn res3-close" onClick={() => dismiss(card.id)}><Vx>Закрыть</Vx></button>
            </> : <div className="res3-wait">…</div>}
          </section>
        </div>
      </Vx>
    </div>
  );
}
