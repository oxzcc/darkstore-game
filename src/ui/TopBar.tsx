// Деньги и рейтинг сверху по центру (макет ui_01; 09, раздел 14: M6).
// Числа берутся из состояния игры; под плашкой на миг всплывает, сколько прибавилось за задание.
// Таймер смены («До конца смены») появится вместе со сменой (M8).
import { useEffect, type CSSProperties } from 'react';
import { useGameStore, type Gain } from '../store/gameStore';
import { money, ratingText, signedRating } from '../store/selectors';
import Vx from './Vx';
import Icon from './icons';

const GAIN_MS = 1800;

function GainPop({ gain, kind }: { gain: Gain; kind: 'money' | 'rating' }) {
  const dismiss = useGameStore((s) => s.dismissGain);
  useEffect(() => {
    // убирает одна плашка (денег), чтобы не убрать дважды
    if (kind !== 'money') return;
    const t = setTimeout(() => dismiss(gain.id), GAIN_MS);
    return () => clearTimeout(t);
  }, [gain.id, dismiss, kind]);
  const value = kind === 'money' ? gain.money : gain.rating;
  if (value === 0) return null;
  const text = kind === 'money' ? `${value > 0 ? '+' : '−'}${money(Math.abs(value))}` : signedRating(value);
  return <div className={`gain ${value > 0 ? 'up' : 'down'}`} style={{ '--ms': `${GAIN_MS}ms` } as CSSProperties}>{text}</div>;
}

export default function TopBar() {
  const cash = useGameStore((s) => s.game.money);
  const rating = useGameStore((s) => s.game.rating);
  const gains = useGameStore((s) => s.ui.gains);
  return (
    <div className="topbar">
      <div className="topbar-slot">
        <Vx className="stat-tile">
          <Icon name="coin" />
          <div><small>Деньги</small><b>{money(cash)}</b></div>
        </Vx>
        <div className="gains">{gains.map((g) => <GainPop key={g.id} gain={g} kind="money" />)}</div>
      </div>
      <div className="topbar-slot">
        <Vx className="stat-tile">
          <Icon name="perfect" style={{ '--f': '#FFC629' } as CSSProperties} />
          <div><small>Рейтинг</small><b>{ratingText(rating)}</b></div>
        </Vx>
        <div className="gains">{gains.map((g) => <GainPop key={g.id} gain={g} kind="rating" />)}</div>
      </div>
    </div>
  );
}
