// Окно итога задания с развилкой — по макету автора ui_12 (13.10). С M7d1 — для сборки, приёмки и выкладки.
// Сверху иллюстрация (пока заглушка), что решили и что вышло; ниже «чек» заказа: позиции, деньги, рейтинг, опыт и штамп исхода.
// Деньги и рейтинг пока только показываются (начисление — M6), опыт — M8. Закрывается кнопкой или кликом по «Закрыть».
import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { money, resultView } from '../store/selectors';
import { nameForm, OUTCOME_LOOK, TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

const ratingText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')}`;

export default function ResultWindow() {
  const card = useGameStore((s) => s.ui.results[0]);
  const game = useGameStore((s) => s.game);
  const dismiss = useGameStore((s) => s.dismissResult);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null); // итог прошлого заказа — только после игры на ТСД

  useEffect(() => {
    if (!card || tsdPlaying) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') dismiss(card.id); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, dismiss, tsdPlaying]);

  if (!card || tsdPlaying) return null;
  const v = resultView(game, card);
  if (!v) return null;
  const look = OUTCOME_LOOK[v.outcome];

  return (
    <div className="call-center wide">
      <Vx key={card.id} className="outcome" style={{ '--pc': v.picker.color, '--oc': look.color } as CSSProperties}>
        <div className="call-head">
          <Avatar picker={v.picker} small />
          <div className="grow">
            <div className="call-who">{taskTitle({ type: v.taskType, number: v.taskNumber })} · {v.picker.name}</div>
            <div className="call-sub">Как всё прошло</div>
          </div>
        </div>

        {/* заглушка иллюстрации итога 770 × 300 (решение автора 13.10 — картинка позже) */}
        <div className="outcome-art">
          <span className="outcome-art-pic">{v.picker.name[0]}</span>
          <Icon name={v.worked ? 'check' : 'errors'} />
        </div>

        <div className="outcome-chips">
          <span className="call-sub">{v.auto ? `${v.picker.name} решил сам:` : 'Вы решили:'}</span>
          <span className="chip pick">{v.optionLabel}</span>
          <span className={`chip ${v.worked ? 'ok' : 'bad'}`}>{v.verdict in OUTCOME_LOOK ? OUTCOME_LOOK[v.verdict as keyof typeof OUTCOME_LOOK].name : v.verdict}</span>
        </div>
        <div className="outcome-title">{v.title}</div>
        <div className="outcome-text">{v.text}</div>

        <div className="receipt">
          <div className="receipt-head">
            <b>{TASK_TYPE_LOOK[v.taskType].receipt} №{v.taskNumber}</b>
            <span>{TASK_TYPE_LOOK[v.taskType].doneBy} {v.picker.name}</span>
          </div>
          <div className="receipt-body">
            <div className="receipt-lines">
              {v.lines.map((l, i) => {
                const ok = l.picked >= l.qty;
                return (
                  <div key={i} className="receipt-line">
                    <span className={`mark ${ok ? 'ok' : 'bad'}`}>{ok ? '✓' : '✕'}</span>
                    <span className="grow">{l.name}</span>
                    <span className={ok ? '' : 'bad'}>{l.picked} / {l.qty}</span>
                    {l.note && <div className="receipt-note">{l.note}</div>}
                  </div>
                );
              })}
            </div>
            <div className="receipt-sum">
              <div><span>Деньги</span><span><b>{v.money.got > 0 ? '+' : ''}{money(v.money.got)}</b> из {v.money.of}</span></div>
              <div><span>Рейтинг</span><span><b>{ratingText(v.rating.got)}</b> из {ratingText(v.rating.of)}</span></div>
              <div><span>Опыт {nameForm(v.picker.name)}</span><b>{TASK_TYPE_LOOK[v.taskType].name} +{v.xp}</b></div>
            </div>
          </div>
          <div className="receipt-stamp">{look.name}</div>
        </div>

        <div className="outcome-foot">
          <button className="btn" onClick={() => dismiss(card.id)}><Vx>Закрыть</Vx></button>
        </div>
      </Vx>
    </div>
  );
}
