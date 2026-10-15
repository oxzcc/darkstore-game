// Подсказка обучающей смены по центру (M8d; решение автора 15.10): заголовок, пара строк и «Понятно» (Enter).
// Пока открыта — мир на паузе (store.tick). Показывается один раз на каждую тему.
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { hintView } from '../store/selectors';
import Vx from './Vx';

export default function TutorialHint() {
  const game = useGameStore((s) => s.game);
  const openCallId = useGameStore((s) => s.ui.openCallId);
  const dismiss = useGameStore((s) => s.dismissHint);
  const hint = hintView(game, openCallId);

  useEffect(() => {
    if (!hint) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); dismiss(hint.id); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hint, dismiss]);

  if (!hint) return null;
  return (
    <div className="hint-back">
      <div className="call-center">
        <Vx key={hint.id} className="hint" bodyClass="window">
          <div className="panel-title">{hint.title}</div>
          <div className="hint-body">{hint.text}</div>
          <div className="buttons">
            <button className="btn primary" onClick={() => dismiss(hint.id)}><Vx>Понятно</Vx></button>
          </div>
        </Vx>
      </div>
    </div>
  );
}
