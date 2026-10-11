// Подсказка во время мини-игры, пока нет настоящей панели ТСД (она — в M5e).
// В общем виде: «нажмите на стеллаж». У стеллажа: «Назад к складу» (кнопка и Esc, 06, раздел 2.3).
import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import Vx from './Vx';

export default function TsdHint() {
  const session = useGameStore((s) => s.game.minigame);
  const picker = useGameStore((s) => (s.game.minigame ? s.game.pickers[s.game.minigame.pickerId] : null));
  const leaveRack = useGameStore((s) => s.leaveRack);
  const atFocus = session?.atFocus ?? false;

  useEffect(() => {
    if (!atFocus) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') leaveRack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [atFocus, leaveRack]);

  if (!session || !picker) return null;

  return (
    <div className="tsd-hint" style={{ '--pc': picker.color } as CSSProperties}>
      {atFocus ? (
        <button className="btn" onClick={leaveRack}><Vx>← Назад к складу · Esc</Vx></button>
      ) : (
        <Vx className="tsd-hint-card">
          <b>ТСД у вас.</b> Нажмите на стеллаж — камера подлетит к нему.
          <div className="note">Сама мини-игра ещё в разработке: пока {picker.name} собирает заказ сам.</div>
        </Vx>
      )}
    </div>
  );
}
