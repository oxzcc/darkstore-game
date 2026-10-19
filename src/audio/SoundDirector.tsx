// Звуки игры (M9e): невидимый компонент, как GameLoop. Ничего не меняет в игре — только слушает.
// 1) Первое нажатие игрока «будит» звук (так требует браузер); нажатие любой кнопки — щелчок.
// 2) Сравнивает состояние store до и после изменения и озвучивает, что случилось:
//    новое задание, срок горит, просрочка, сборщик зовёт, грузовик, ТСД, деньги, окна, смена.
// Барабан и «Чисто! / Сработало!» озвучивают сами окна (ui/ReelTsd, RollWindow, ResultWindow) — они знают, когда лента встала.
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { hintView, taskPins } from '../store/selectors';
import { WAREHOUSE_MAP } from '../store/gameStore';
import { AUDIO } from '../config/audio';
import { play, unlockAudio } from './engine';
import type { GameState } from '../model/game';
import type { UiState } from '../store/gameStore';

type Snap = { game: GameState; ui: UiState };

/** Какое окно сейчас открыто — для звуков «открыть / закрыть». */
function openWindow(s: Snap): string | null {
  if (s.ui.assignTaskId) return `assign:${s.ui.assignTaskId}`;
  if (s.ui.profilePickerId) return `profile:${s.ui.profilePickerId}`;
  if (s.ui.openCallId) return `call:${s.ui.openCallId}`;
  if (s.game.tsdGame === null && s.ui.results[0]) return `result:${s.ui.results[0].id}`;
  if (s.game.tsdGame === null && s.ui.rolls[0]) return `roll:${s.ui.rolls[0].id}`;
  const hint = hintView(s.game, s.ui);
  if (hint) return `hint:${hint.id}`;
  return null;
}

/** Есть ли новое задание, у которого вот-вот выйдет срок (тот же признак, что красный пин). */
function anyHurry(game: GameState): boolean {
  return taskPins(game, WAREHOUSE_MAP).some((p) => p.warn && !p.overdue);
}

function onChange(s: Snap, prev: Snap): void {
  const g = s.game;
  const pg = prev.game;

  // смена: кончилась — фанфары и звёзды; началась — короткий подъём
  if (g.campaign.phase !== pg.campaign.phase || g.campaign.shift !== pg.campaign.shift) {
    if (g.campaign.phase === 'running') play('shiftStart');
    else if (g.campaign.phase === 'summary' && pg.campaign.phase === 'running') {
      play('shiftEnd');
      const stars = g.campaign.history[g.campaign.history.length - 1]?.stars ?? 0;
      for (let i = 0; i < stars; i++) play('star', { delay: 1 + i * AUDIO.starGap, variant: i });
    }
    return; // при смене смены задания появляются пачкой — их не озвучиваем
  }

  // новое задание
  if (Object.values(g.tasks).some((t) => t.status === 'new' && !pg.tasks[t.id])) play('taskNew');

  // срок горит: щелчок раз в игровую секунду, пока есть красный пин
  if (Math.floor(g.clock.time) !== Math.floor(pg.clock.time) && anyHurry(g)) play('hurryTick');

  // грузовик поехал к воротам
  if (g.truckComing != null && pg.truckComing == null) play('truck');

  // сборщик зовёт («!» над головой)
  const prevCalls = new Set(pg.calls.map((c) => c.id));
  if (g.calls.some((c) => !prevCalls.has(c.id))) play('call');

  // ТСД
  const tg = g.tsdGame;
  const ptg = pg.tsdGame;
  if (tg && !ptg) play('scan');
  if (tg && ptg && tg.kind === ptg.kind) {
    if (tg.result && !ptg.result) play(tg.result === 'perfect' ? 'tsdWin' : tg.result === 'withErrors' ? 'withErrors' : 'error');
    else if (tg.kind === 'depth' && ptg.kind === 'depth') {
      if (tg.moves > ptg.moves) play('slide');
      else if (tg.noteAt !== ptg.noteAt && tg.note === 'stuck') play('error');
    } else if (tg.kind === 'expiry' && ptg.kind === 'expiry') {
      if (tg.open !== null && ptg.open === null) play('scan');
      else if (tg.open === null && ptg.open !== null) play('slide');
    } else if (tg.kind === 'barcode' && ptg.kind === 'barcode') {
      if (tg.guesses.length > ptg.guesses.length) play('error'); // не угадал (угадал — это result выше)
    }
  }
  if (s.ui.barcodeInput.length > prev.ui.barcodeInput.length) play('key');
  else if (s.ui.barcodeInput.length < prev.ui.barcodeInput.length && !tg?.result) play('key', { variant: -1 });

  // просрочка, деньги
  const prevToasts = new Set(prev.ui.toasts.map((t) => t.id));
  const newToasts = s.ui.toasts.filter((t) => !prevToasts.has(t.id));
  const expired = newToasts.some((t) => t.expired);
  if (expired) play('expired');
  // исход без окна (всплывашка) — коротко
  const plain = newToasts.find((t) => !t.expired);
  if (plain) play(plain.outcome);
  const prevGains = new Set(prev.ui.gains.map((x) => x.id));
  for (const gain of s.ui.gains.filter((x) => !prevGains.has(x.id))) {
    if (gain.money > 0) play('coin');
    else if (gain.money < 0 && !expired) play('moneyDown');
  }

  // окна
  const win = openWindow(s);
  const pwin = openWindow(prev);
  if (win !== pwin) {
    if (win) play('open');
    else play('close');
  }
}

export default function SoundDirector() {
  useEffect(() => {
    // браузер даёт включить звук только по нажатию игрока
    const onPress = (e: Event) => {
      unlockAudio();
      const btn = (e.target as Element | null)?.closest?.('button');
      if (btn && !(btn as HTMLButtonElement).disabled) play('click');
    };
    const onKey = () => unlockAudio();
    window.addEventListener('pointerdown', onPress, true);
    window.addEventListener('keydown', onKey, true);
    const unsub = useGameStore.subscribe((s, prev) => onChange(s, prev));
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('keydown', onKey, true);
      unsub();
    };
  }, []);
  return null;
}
