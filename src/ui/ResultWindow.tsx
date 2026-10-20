// Окно итога задания с развилкой — три кадра комикса (правка автора 18.10, P4; вид — прототип «Окно итога задания», одобрен автором):
// 1. «Что случилось» — задание, реплика сборщика пузырём, его портрет; 2. «Вы решили» — выбранный вариант и ТСД с барабаном
// «Сработало / Осложнение» по шансу варианта (а если брали ТСД — сценка итога игры); 3. «Итог» — сразу после остановки барабана:
// лента исхода, что произошло, награды жетонами, «Дальше». Мир на паузе. Клик по окну, Enter или Esc во время барабана — сразу итог, потом — закрыть.
// Задания без развилки показывает RollWindow — те же кадры (ResultFrames).
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore, type ResultCard } from '../store/gameStore';
import { resultView } from '../store/selectors';
import { OUTCOME_LOOK, TSD_GAME_NAME } from './labels';
import type { ReelSeg } from './ReelTsd';
import ChanceBar from './ChanceBar';
import { play } from '../audio/engine';
import { FinalFrame, Join, StoryFrame } from './ResultFrames';

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
  const rollShown = useGameStore((s) => s.ui.rolls.length > 0);    // сначала итог другого задания без развилки (P3)
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

  // итог виден — звук (M9e): у барабана «Сработало / Осложнение», у игры на ТСД — исход задания
  useEffect(() => {
    if (!done) return;
    if (reel) play(reel.complication ? 'complication' : 'worked', { delay: 0.12 });
    else play(card.reveal.final);
  }, [done]);

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
  const p = v.picker;
  const look = OUTCOME_LOOK[v.outcome];
  const art = !reel && v.art && renderArt ? renderArt({ ...v.art, picker: p }) : null;
  const notes = [
    ...(v.capped ? [`У этого варианта исход не выше «${OUTCOME_LOOK[v.capped].name}»`] : []),
    ...v.lines.filter((l) => l.note || l.picked < l.qty).map((l) => `${l.name}: ${l.note ?? `${l.picked} из ${l.qty}`}`),
  ];
  const chosen = v.options.find((o) => o.chosen);
  const complication = reel?.complication ?? false;

  return (
    <div className="ac-veil">
      <div className="rw" style={{ '--pc': p.color, '--oc': look.color } as CSSProperties} onClick={() => !done && setDone(true)}>
        <StoryFrame tab="Что случилось" taskType={v.taskType} taskNumber={v.taskNumber} speech={v.speech} picker={p} portrait={renderPortrait?.(p)} />
        <Join />

        {/* 2. что решили (упрощение по макету «Итог · В», 20.10): вариант жирной строкой; ответ вариантом — тонкая полоса шанса
            с маркером и «Сработало! / Осложнение!»; играли на ТСД — одна строка цифр игры (сценка — только на компьютере) */}
        <section className={`rw-panel rw-p2${done && complication ? ' shake' : ''}`}>
          <span className="rw-tab" style={{ '--tc': 'var(--text)' } as CSSProperties}>{v.auto ? `${p.name} решил сам` : 'Вы решили'}</span>
          <b className="rw-choice">{chosen?.label ?? v.optionLabel}</b>
          {reel ? <>
            <div className="rw-chance">
              <ChanceBar
                segs={segs}
                marker={1 - reel.roll /* правила: бросок < шанса — осложнение; «сработало» на полосе слева, поэтому зеркально */}
                done={done}
                onDone={() => setDone(true)}
              />
              <div className={`rw-shout${done ? ` go ${complication ? 'bad' : 'ok'}` : ' wait'}`}>
                {done ? (complication ? 'Осложнение!' : 'Сработало!') : '…'}
              </div>
            </div>
            <span className="rw-sub">{v.riskLabel}: {Math.round(reel.chance * 100)}%</span>
          </> : <>
            {v.tsdResult?.facts.length
              ? <span className="rw-sub">{v.tsdResult.facts.join(' · ')}</span>
              : v.tsdGame && <span className="rw-sub">Игра «{TSD_GAME_NAME[v.tsdGame]}»</span>}
            <div className={`rw-art${v.tsdResult ? ' rw-art-extra' : ''}`}>{art ?? <span className="rw-art-stub">{p.name[0]}</span>}</div>
          </>}
        </section>

        <Join lit={done} />
        <FinalFrame
          done={done}
          outcome={v.outcome}
          title={v.title}
          text={v.text}
          notes={notes}
          gain={{ money: v.money.got, rating: v.rating.got, xp: v.xp }}
          seed={card.id}
          onClose={() => dismiss(card.id)}
        />
      </div>
    </div>
  );
}
