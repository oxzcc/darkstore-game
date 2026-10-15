// Деньги и рейтинг сверху по центру (макет ui_01; 09, раздел 14: M6).
// Числа берутся из состояния игры; под плашкой на миг всплывает, сколько прибавилось за задание.
// Слева — смена: «Смена 2 из 5» и сколько осталось (M8a).
import { useEffect, type CSSProperties } from 'react';
import { useGameStore, type Gain } from '../store/gameStore';
import { clockText, money, ratingText, shiftClock, signedRating, tutorialShift } from '../store/selectors';
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
  const game = useGameStore((s) => s.game);
  const sc = shiftClock(game);
  return (
    <div className="topbar">
      <div className="topbar-slot">
        <Vx className={`stat-tile${sc.secondsLeft <= 60 ? ' hurry' : ''}`}>
          <Icon name="clock" />
          <div><small>Смена {sc.shift} из {sc.total}{tutorialShift(game) ? ' · обучение' : ''}</small><b>{clockText(sc.secondsLeft)}</b></div>
        </Vx>
      </div>
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
