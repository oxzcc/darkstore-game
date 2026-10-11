// Подсказка во время мини-игры, пока нет настоящей панели ТСД (она — в M5e).
// В общем виде: «нажмите на стеллаж». У стеллажа (вид во весь экран): слева сверху «← Склад» (и Esc)
// и плашка «Стеллаж 3.2 · глазами Лаки · аллея 3» (06, раздел 2.3; пример автора 12.10).
import { useEffect, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { Avatar } from './PickerBits';
import Vx from './Vx';

/** «глазами Лаки / Коржика / Бурана». Имена сборщиков известны заранее (config/pickers.ts). */
function nameForm(name: string): string {
  if (/[бвгджзйклмнпрстфхцчшщ]$/.test(name)) return `${name}а`; // Коржик → Коржика, Буран → Бурана
  return name; // Лаки — не склоняется
}

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
    <div className={`tsd-hint${atFocus ? ' top' : ''}`} style={{ '--pc': picker.color } as CSSProperties}>
      {atFocus && session.focus ? (
        <div className="closeup-bar">
          <button className="btn" title="Назад к складу (Esc)" onClick={leaveRack}><Vx>← Склад</Vx></button>
          <Vx className="closeup-place">
            <Avatar picker={picker} small />
            <div>
              <div className="closeup-title">Стеллаж {session.focus.aisle}.{session.focus.rack}</div>
              <div className="closeup-sub">глазами {nameForm(picker.name)} · аллея {session.focus.aisle}</div>
            </div>
          </Vx>
        </div>
      ) : (
        <Vx className="tsd-hint-card">
          <b>ТСД у вас.</b> Нажмите на стеллаж — камера подлетит к нему.
          <div className="note">Сама мини-игра ещё в разработке: пока {picker.name} собирает заказ сам.</div>
        </Vx>
      )}
    </div>
  );
}
