// Карточки сборщиков снизу (ui_01): имя, что делает сейчас, прогресс, усталость. Клик по карточке — профиль (P2); перерыв — только здесь.
import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { activityOf, pickerList, restAllowed } from '../store/selectors';
import { activityLine } from './activityText';
import { Avatar, FatigueBar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';
import { usePhone } from '../app/usePhone';

export default function PickerPanel() {
  const game = useGameStore((s) => s.game);
  const { sendToRest, endRest, openProfile } = useGameStore.getState();
  const phone = usePhone();

  return (
    <div className="picker-bar">
      {pickerList(game.pickers).map((p) => {
        const line = activityLine(activityOf(game, p.id));
        return (
          <Vx key={p.id} className="picker-card" style={{ '--pc': p.color } as CSSProperties} onClick={() => openProfile(p.id)}
            tut={game.calls.some((c) => c.pickerId === p.id) ? 'call' : undefined}>
            <Avatar picker={p} />
            <div className="grow">
              <div className="picker-name">
                {p.name}
                {p.state === 'playing' && <span className="tsd-tag">ТСД у вас</span>}
              </div>
              <div className="picker-state">
                <Icon name={line.icon} small />
                {line.text}
              </div>
              {line.progress !== null
                ? <div className="progress"><b style={{ width: `${line.progress * 100}%` }} /></div>
                : <FatigueBar value={p.stats.fatigue} />}
            </div>
            {/* перерыв (M8c): свободного и уставшего — отдыхать, отдыхающего — вернуть. На телефоне — в профиле (макет R0) */}
            {phone ? null : p.state === 'resting'
              ? <button className="mini-btn" onClick={(e) => { e.stopPropagation(); endRest(p.id); }}>Вернуть</button>
              : restAllowed(game, p.id) && <button className="mini-btn" onClick={(e) => { e.stopPropagation(); sendToRest(p.id); }}>На перерыв</button>}
          </Vx>
        );
      })}
    </div>
  );
}
