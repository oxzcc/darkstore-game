// Профиль сборщика (P2, решение автора 18.10): окно по центру, мир на паузе.
// Открывается кликом по нижней карточке сборщика или по собаке на складе. Перерыв — только на нижней карточке.
// Слева портрет и что делает сейчас; справа Лапы / Нюх / Бодрость с пояснениями, опыт по типам заданий и итоги за смену / кампанию.
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker, PickerTally } from '../model/picker';
import { useGameStore } from '../store/gameStore';
import { pickerProfileView } from '../store/selectors';
import { SPEC_RANKS, STAT_SCALE } from '../config/pickers';
import { activityLine } from './activityText';
import { EXP_NAME, OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, TASK_TYPE_LOOK } from './labels';
import { Avatar, Pips } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

const pct = (v: number) => Math.round(v * 100);

/** `renderPortrait` — 3D-портрет сборщика (его передаёт App: интерфейс сам 3D не импортирует). */
export default function PickerProfile({ renderPortrait }: { renderPortrait?: (picker: Picker) => ReactNode }) {
  const game = useGameStore((s) => s.game);
  const pickerId = useGameStore((s) => s.ui.profilePickerId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const [tab, setTab] = useState<'shift' | 'campaign'>('shift');

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
                <Stat icon={STAT_LOOK.speed.icon} name={STAT_LOOK.speed.name} hint="Как быстро ходит и работает: меньше секунд в дороге и на задании.">
                  <Pips value={p.stats.speed * 5 / STAT_SCALE.max} /><b>{p.stats.speed} из {STAT_SCALE.max}</b>
                </Stat>
                <Stat icon={STAT_LOOK.accuracy.icon} name={STAT_LOOK.accuracy.name} hint="Как редко ошибается: чем выше, тем больше шанс «Идеально» и меньше «Провал».">
                  <Pips value={p.stats.accuracy * 5 / STAT_SCALE.max} /><b>{p.stats.accuracy} из {STAT_SCALE.max}</b>
                </Stat>
                <Stat icon={STAT_LOOK.energy.icon} name={STAT_LOOK.energy.name} hint="Падает после каждого задания и снижает скорость и шансы. Восстанавливается на перерыве.">
                  <span className="pf-bar"><b className={v.energy < 40 ? 'low' : v.energy < 65 ? 'mid' : ''} style={{ width: `${v.energy}%` }} /></span>
                  <b>{v.energy}%</b>
                </Stat>
              </section>

              <section className="pf-sect">
                <h3>Опыт по заданиям</h3>
                {v.exp.map((e) => (
                  <div key={e.type} className="pf-exp">
                    <Vx className="task-icon small" style={{ '--tint': TASK_TYPE_LOOK[e.type].tint } as CSSProperties}>
                      <Icon name={TASK_TYPE_LOOK[e.type].icon} small />
                    </Vx>
                    <div className="grow">
                      <div className="pf-exp-row">
                        <span>{TASK_TYPE_LOOK[e.type].name}: <b>{SPEC_RANKS[e.level] ?? e.level}</b></span>
                        <Pips value={e.level} max={v.maxLevel} />
                      </div>
                      <div className="pf-exp-row small">
                        {e.need === null
                          ? <span>Высший уровень</span>
                          : <>
                            <span className="pf-bar"><b style={{ width: `${(e.xp / e.need) * 100}%` }} /></span>
                            <span>{e.xp} из {e.need} до «{SPEC_RANKS[e.level + 1]}»</span>
                          </>}
                        <span className="pf-bonus" title={`${EXP_NAME[e.type]} прибавляет к шансу «Идеально» на этих заданиях`}>
                          {e.bonus > 0 ? `+${pct(e.bonus)}% к «Идеально»` : 'без бонуса'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="ac-mute">
                  Опыт за задание: {OUTCOME_LOOK.perfect.name.toLowerCase()} +{v.xpPerOutcome.perfect},
                  {' '}{OUTCOME_LOOK.withErrors.name.toLowerCase()} +{v.xpPerOutcome.withErrors},
                  {' '}{OUTCOME_LOOK.failed.name.toLowerCase()} +{v.xpPerOutcome.failed}.
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
