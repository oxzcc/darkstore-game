// Итоги смены и итоги кампании (M8a; 02, раздел 11; решения автора 14.10).
// Время смены вышло — мир стоит, по центру экран итогов: звёзды, сколько заданий закрыто и с каким исходом,
// деньги и рейтинг за смену, кто сколько сделал. Кнопка — следующая смена или, после последней, итоги кампании.
// X3 (макет StatsSummary): у каждого сборщика пятиугольник; есть очки — «+» у характеристик, форма меняется на глазах.
import { useState, type CSSProperties } from 'react';
import { STAT_KEYS, type Picker, type StatKey } from '../model/picker';
import { STAT_SCALE } from '../config/pickers';
import { effectiveStats } from '../rules/pickerStats';
import StatPentagon from './StatPentagon';
import { useGameStore } from '../store/gameStore';
import { campaignSummaryView, LOSE_RATING, money, plural, ratingText, shiftSummaryView, signedRating } from '../store/selectors';
import { OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

/** Три звезды: закрашено столько, сколько заработано. */
function Stars({ n, small }: { n: number; small?: boolean }) {
  return (
    <div className={`stars${small ? ' small' : ''}`}>
      {[1, 2, 3].map((i) => (
        <Icon key={i} name="perfect" style={{ '--f': i <= n ? '#FFC629' : '#E2DCCD' } as CSSProperties} />
      ))}
    </div>
  );
}

/** Пятиугольник сборщика и «+» у характеристик, пока есть очки (docs/10, раздел 14.8). */
function Points({ picker, canSpend }: { picker: Picker; canSpend: boolean }) {
  const spend = useGameStore((s) => s.spendPoint);
  const [flash, setFlash] = useState<StatKey | null>(null);
  const add = (k: StatKey) => { spend(picker.id, k); setFlash(k); };
  return (
    <div className="summary-points">
      <StatPentagon stats={effectiveStats(picker)} color={picker.color} size={110} numbers flash={flash} />
      {canSpend && picker.points > 0 && (
        <div className="summary-plus">
          <b>Очков: {picker.points}</b>
          {STAT_KEYS.map((k) => (
            <button key={k} className="mini-btn" disabled={picker.stats[k] >= STAT_SCALE.max} onClick={() => add(k)}>
              + {STAT_LOOK[k].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const signedMoney = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;

export default function ShiftSummary() {
  const game = useGameStore((s) => s.game);
  const { nextShift, finishCampaign, restartCampaign } = useGameStore.getState();
  const shift = shiftSummaryView(game);
  const campaign = campaignSummaryView(game);
  if (!shift && !campaign) return null;
  // вкладывать очки есть смысл, только если будет следующая смена
  const canSpend = !!shift && !shift.last && !shift.lost;

  return (
    <div className="summary-back">
      <div className="call-center">
        {shift && (
          <Vx className="summary" bodyClass="window">
            <div className="panel-title">Смена {shift.shift} из {shift.total} закончена</div>
            <div className="summary-body">
              <Stars n={shift.stars} />
              <div className="summary-big">
                Закрыто {shift.closed} из {shift.appeared} {plural(shift.appeared, 'задания', 'заданий', 'заданий')}
              </div>
              <div className="summary-outcomes">
                {OUTCOMES_ORDER.map((o) => (
                  <span key={o}><Icon name={OUTCOME_LOOK[o].icon} small />{OUTCOME_LOOK[o].name}: <b>{shift.byOutcome[o]}</b></span>
                ))}
                <span><Icon name="clock" small />Просрочено: <b>{shift.expired}</b></span>
              </div>
              {shift.lost && (
                <div className="summary-lost">Рейтинг упал ниже {ratingText(LOSE_RATING)} — склад закрывают</div>
              )}
              <div className="summary-sum">
                <div><span>Деньги за смену</span><b className={shift.money < 0 ? 'bad' : ''}>{signedMoney(shift.money)}</b></div>
                <div><span>Рейтинг</span><b className={shift.rating < 0 ? 'bad' : ''}>{signedRating(shift.rating)}</b></div>
              </div>
              {canSpend && shift.pickers.some(({ picker }) => picker.points > 0) && (
                <div className="summary-hint">Вложите очки: каждое +1 к характеристике, потолок {STAT_SCALE.max}. Невложенные останутся до следующей смены.</div>
              )}
              <div className="summary-pickers">
                {shift.pickers.map(({ picker, tasks }) => {
                  const g = shift.growth?.[picker.id];
                  return (
                    <div key={picker.id} className="summary-picker" style={{ '--pc': picker.color } as CSSProperties}>
                      <Avatar picker={picker} small />
                      <div className="grow">
                        <div>{picker.name} · {tasks} {plural(tasks, 'задание', 'задания', 'заданий')}</div>
                        {/* рост за смену (M8c) */}
                        {g && (
                          <div className="summary-growth">
                            +{g.xp} опыта
                            {g.level > g.fromLevel && <b> · уровень {g.level} ↑ · +{g.level - g.fromLevel} {plural(g.level - g.fromLevel, 'очко', 'очка', 'очков')}</b>}
                            {' '}· усталость {g.fatigue}%
                          </div>
                        )}
                      </div>
                      <Points picker={picker} canSpend={canSpend} />
                    </div>
                  );
                })}
              </div>
              <div className="note">Незакрытые задания не переходят в следующую смену</div>
            </div>
            <div className="buttons">
              {shift.last || shift.lost
                ? <button className="btn primary" onClick={finishCampaign}><Vx>Итоги кампании</Vx></button>
                : <button className="btn primary" onClick={nextShift}><Vx>Следующая смена</Vx></button>}
            </div>
          </Vx>
        )}

        {campaign && (
          <Vx className="summary" bodyClass="window">
            <div className="panel-title">{campaign.lost ? 'Склад закрыли' : 'Кампания пройдена'}</div>
            <div className="summary-body">
              {campaign.lost && <div className="summary-lost">Рейтинг упал ниже {ratingText(LOSE_RATING)}. Попробуйте ещё раз!</div>}
              <div className="summary-big">Звёзд: {campaign.stars} из {campaign.maxStars}</div>
              <div className="summary-shifts">
                {campaign.shifts.map((r) => (
                  <div key={r.shift} className="summary-shift">
                    <span className="grow">Смена {r.shift}</span>
                    <Stars n={r.stars} small />
                    <span>{r.closed} / {r.appeared}</span>
                    <b className={r.money < 0 ? 'bad' : ''}>{signedMoney(r.money)}</b>
                  </div>
                ))}
              </div>
              <div className="summary-sum">
                <div><span>Закрыто заданий</span><b>{campaign.closed} из {campaign.appeared}</b></div>
                <div><span>Деньги</span><b>{money(campaign.money)}</b></div>
                <div><span>Рейтинг</span><b>{ratingText(campaign.rating)}</b></div>
              </div>
            </div>
            <div className="buttons">
              <button className="btn primary" onClick={restartCampaign}><Vx>Начать заново</Vx></button>
            </div>
          </Vx>
        )}
      </div>
    </div>
  );
}
