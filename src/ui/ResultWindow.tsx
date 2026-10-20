// Окно итога задания с развилкой — три кадра комикса (правка автора 18.10, P4; вид — прототип «Окно итога задания», одобрен автором):
// 1. «Что случилось» — задание, реплика сборщика пузырём, его портрет; 2. «Вы решили» — выбранный вариант и полоса трёх исходов
// по шансам варианта, маркер встаёт на выпавшем (X2: один бросок; а если брали ТСД — цифры и сценка итога игры); 3. «Итог» — сразу после остановки барабана:
// лента исхода, что произошло, награды жетонами, «Дальше». Мир на паузе. Клик по окну, Enter или Esc во время барабана — сразу итог, потом — закрыть.
// Задания без развилки показывает RollWindow — те же кадры (ResultFrames).
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore, type ResultCard } from '../store/gameStore';
import { resultView } from '../store/selectors';
import { LEVEL_NAME, OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, TSD_GAME_NAME } from './labels';
import { ROLL_SHOUT } from '../config/taskReport';
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

  // итог виден — звук (M9e): исход задания
  useEffect(() => {
    if (done) play(card.reveal.final, { delay: reel ? 0.12 : 0 });
  }, [done]);

  const segs = useMemo<ReelSeg[]>(() => (reel
    ? OUTCOMES_ORDER.map((o) => ({ key: o, share: reel.chances[o], color: OUTCOME_LOOK[o].color, icon: OUTCOME_LOOK[o].icon }))
    : []), [reel]);

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
  const shoutClass = v.outcome === 'perfect' ? 'ok' : v.outcome === 'withErrors' ? 'mid' : 'bad';
  const checkLine = reel
    ? [reel.check ? `${STAT_LOOK[reel.check.stat].name} ${reel.check.value}` : null, LEVEL_NAME[reel.level],
       `${v.riskLabel.toLowerCase()}: ${Math.round(reel.chances.failed * 100)}%`].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="ac-veil">
      <div className="rw" style={{ '--pc': p.color, '--oc': look.color } as CSSProperties} onClick={() => !done && setDone(true)}>
        <StoryFrame tab="Что случилось" taskType={v.taskType} taskNumber={v.taskNumber} speech={v.speech} picker={p} portrait={renderPortrait?.(p)} />
        <Join />

        {/* 2. что решили (упрощение по макету «Итог · В», 20.10): вариант жирной строкой; ответ вариантом — тонкая полоса трёх исходов
            с маркером и «Чисто! / Почти! / Мимо!» (X2); играли на ТСД — одна строка цифр игры (сценка — только на компьютере) */}
        <section className={`rw-panel rw-p2${done && v.outcome === 'failed' ? ' shake' : ''}`}>
          <span className="rw-tab" style={{ '--tc': 'var(--text)' } as CSSProperties}>{v.auto ? `${p.name} решил сам` : 'Вы решили'}</span>
          <b className="rw-choice">{chosen?.label ?? v.optionLabel}</b>
          {reel ? <>
            <div className="rw-chance">
              <ChanceBar segs={segs} marker={reel.roll} done={done} onDone={() => setDone(true)} />
              <div className={`rw-shout${done ? ` go ${shoutClass}` : ' wait'}`}>{done ? ROLL_SHOUT[v.outcome] : '…'}</div>
            </div>
            <span className="rw-sub">{checkLine}</span>
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
