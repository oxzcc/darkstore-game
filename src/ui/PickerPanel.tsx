// Карточки сборщиков снизу (ui_01): имя, состояние, усталость.
import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { pickerList } from '../store/selectors';
import { PICKER_STATE_NAME } from './labels';
import { Avatar, FatigueBar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

export default function PickerPanel() {
  const pickers = useGameStore((s) => s.game.pickers);
  const list = useMemo(() => pickerList(pickers), [pickers]);

  return (
    <div className="picker-bar">
      {list.map((p) => (
        <Vx key={p.id} className="picker-card">
          <Avatar picker={p} />
          <div>
            <div className="picker-name">{p.name}</div>
            <div className="picker-state">
              <Icon name={p.state === 'idle' ? 'check' : 'work'} small />
              {PICKER_STATE_NAME[p.state]}
            </div>
            <FatigueBar value={p.stats.fatigue} />
          </div>
        </Vx>
      ))}
    </div>
  );
}
