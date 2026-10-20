// Профиль сборщика (P2, решение автора 18.10): окно по центру, мир на паузе.
// Открывается кликом по нижней карточке сборщика или по собаке на складе. Перерыв — только на нижней карточке.
// Слева портрет и что делает сейчас; справа пятиугольник характеристик с числами (X3, макет StatsProfile), бодрость, уровень и итоги за смену / кампанию.
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker, PickerTally } from '../model/picker';
import { useGameStore } from '../store/gameStore';
import { pickerProfileView, restAllowed } from '../store/selectors';
import { activityLine } from './activityText';
import { OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK } from './labels';
import { Avatar } from './PickerBits';
import StatPentagon from './StatPentagon';
import Vx from './Vx';
import Icon from './icons';
import { usePhone } from '../app/usePhone';

const pct = (v: number) => Math.round(v * 100);

/** `renderPortrait` — 3D-портрет сборщика (его передаёт App: интерфейс сам 3D не импортирует). */
export default function PickerProfile({ renderPortrait }: { renderPortrait?: (picker: Picker) => ReactNode }) {
  const game = useGameStore((s) => s.game);
  const pickerId = useGameStore((s) => s.ui.profilePickerId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const [tab, setTab] = useState<'shift' | 'campaign'>('shift');
  const phone = usePhone();
  const { sendToRest, endRest } = useGameStore.getState();

  useEffect(() => {
    if (!pickerId) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') closeProfile(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerId, closeProfile]);

  const v = pickerId ? pickerProfileView(game, pickerId) : null;
  if (!v) return null;
  const { picker: p } = v;
  const line = activityLine(v.activity);
  const tally = tab === 'shift' ? v.shift : v.campaign;

  return (
    <div className="ac-veil" onClick={closeProfile}>
      <div className="pf-wrap" onClick={(e) => e.stopPropagation()}>
        <Vx className="ac-window" bodyClass="window" style={{ '--pc': p.color } as CSSProperties}>
          <div className="pf-inner">
            {/* слева: портрет и что делает сейчас */}
            <div className="pf-left">
              <Vx className="ac-card">
                <div className="ac-portrait pf-portrait">
                  {renderPortrait?.(p) ?? <Avatar picker={p} />}
                  <span className="ac-flag">{p.name}</span>
                  <span className="pf-breed">{p.breed}</span>
                </div>
                <div className="pf-now"><Icon name={line.icon} small /> {line.text}</div>
                {/* телефон (R1): перерыв здесь — на узкой нижней карточке для кнопки нет места (макет R0) */}
                {phone && (p.state === 'resting'
                  ? <button className="mini-btn pf-rest" onClick={() => endRest(p.id)}>Вернуть</button>
                  : restAllowed(game, p.id) && <button className="mini-btn pf-rest" onClick={() => { sendToRest(p.id); closeProfile(); }}>На перерыв</button>)}
              </Vx>
            </div>

            {/* справа: характеристики, опыт, итоги */}
            <div className="pf-right">
              <div className="pf-head">
                <span className="pf-title">Профиль</span>
                <button className="call-close" onClick={closeProfile} aria-label="Закрыть">×</button>
              </div>

              <section className="pf-sect">
                <h3>Характеристики</h3>
                {/* пять характеристик (docs/10, разделы 14.3, 14.9): большой пятиугольник с числами, серый контур — без усталости */}
                <div className="pf-pent">
                  <StatPentagon stats={v.block} base={v.baseBlock} color={p.color} size={phone ? 180 : 210} numbers />
                  <div className="pf-glossary">
                    {v.stats.map((st) => (
                      <span key={st.key}>
                        <Icon name={STAT_LOOK[st.key].icon} small /><b>{STAT_LOOK[st.key].name}</b> — {STAT_LOOK[st.key].hint}
                      </span>
                    ))}
                  </div>
                </div>
                {v.fatigueMinus > 0 && (
                  <div className="pf-tired">Устал {100 - v.energy}% — все характеристики −{fmtMinus(v.fatigueMinus)} (серый контур — без усталости)</div>
                )}
                <Stat icon={STAT_LOOK.energy.icon} name={STAT_LOOK.energy.name} hint="Падает после каждого задания и снижает скорость и шансы. Восстанавливается на перерыве.">
                  <span className="pf-bar"><b className={v.energy < 40 ? 'low' : v.energy < 65 ? 'mid' : ''} style={{ width: `${v.energy}%` }} /></span>
                  <b>{v.energy}%</b>
                </Stat>
              </section>

              <section className="pf-sect">
                <h3>Уровень {v.level}</h3>
                <div className="pf-exp-row small">
                  <span className="pf-bar"><b style={{ width: `${(v.xp / v.xpNeed) * 100}%` }} /></span>
                  <span>{v.xp} из {v.xpNeed} опыта до уровня {v.level + 1}</span>
                </div>
                {v.points > 0 && <div className="pf-bonus">Очков: {v.points} — вложить можно на экране итогов смены</div>}
                <div className="ac-mute">
                  Опыт за задание: {OUTCOME_LOOK.perfect.name.toLowerCase()} +{v.xpPerOutcome.perfect},
                  {' '}{OUTCOME_LOOK.withErrors.name.toLowerCase()} +{v.xpPerOutcome.withErrors},
                  {' '}{OUTCOME_LOOK.failed.name.toLowerCase()} +{v.xpPerOutcome.failed}. Новый уровень — очко в любую характеристику.
                </div>
              </section>

              <section className="pf-sect">
                <div className="pf-tabs">
                  <h3>Итоги</h3>
                  <button className={tab === 'shift' ? 'on' : ''} onClick={() => setTab('shift')}>За смену</button>
                  <button className={tab === 'campaign' ? 'on' : ''} onClick={() => setTab('campaign')}>За кампанию</button>
                </div>
                <Tally t={tally} />
              </section>
            </div>
          </div>
        </Vx>
      </div>
    </div>
  );
}

/** −1 или −1,5. */
function fmtMinus(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

function Stat({ icon, name, hint, children }: { icon: Parameters<typeof Icon>[0]['name']; name: string; hint: string; children: ReactNode }) {
  return (
    <div className="pf-stat">
      <Icon name={icon} small />
      <span className="pf-stat-name">{name}</span>
      <span className="pf-stat-val">{children}</span>
      <span className="pf-hint">{hint}</span>
    </div>
  );
}

/** Сколько заданий и с каким исходом: плитки и полоса долей. */
function Tally({ t }: { t: PickerTally }) {
  if (t.done === 0) return <div className="ac-mute">Пока ни одного закрытого задания.</div>;
  return (
    <>
      <div className="pf-tiles">
        <span className="pf-tile"><b>{t.done}</b>заданий</span>
        {OUTCOMES_ORDER.map((o) => (
          <span key={o} className="pf-tile"><b style={{ color: OUTCOME_LOOK[o].color }}>{t[o]}</b>{OUTCOME_LOOK[o].name.toLowerCase()}</span>
        ))}
      </div>
      <span className="ac-bar pf-tally-bar">
        {OUTCOMES_ORDER.map((o) => t[o] > 0 && (
          <b key={o} style={{ width: `${(t[o] / t.done) * 100}%`, background: OUTCOME_LOOK[o].color }}>
            {t[o] / t.done >= 0.14 ? `${pct(t[o] / t.done)}%` : ''}
          </b>
        ))}
      </span>
    </>
  );
}
