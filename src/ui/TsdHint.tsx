// Подсказка во время мини-игры (список заказа — на панели ТСД справа, ui/TsdPanel).
// В общем виде: «выберите стеллаж» / «Лаки идёт к 2.3». У стеллажа (вид во весь экран): слева сверху «← Склад» (и Esc)
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
          {session.focus ? (
            <><b>{picker.name} идёт к стеллажу {session.focus.aisle}.{session.focus.rack}</b>
              <div className="note">Дойдёт — камера подлетит. Можно выбрать другой стеллаж.</div></>
          ) : (
            <><b>ТСД у вас.</b> Выберите стеллаж — {picker.name} пойдёт к нему.
              <div className="note">Адреса товаров — на ТСД справа. Порядок обхода — любой.</div></>
          )}
        </Vx>
      )}
    </div>
  );
}
