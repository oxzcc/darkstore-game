// Подсказки обучающей смены (M8d). Какая подсказка сейчас нужна, решается по состоянию игры;
// показанные запоминаются в campaign.hintsSeen (сохраняются вместе с игрой).
import type { GameState } from '../model/game';
import { HINTS, type HintId } from '../config/tutorial';
import { isTutorial } from './shiftPlan';

/** Есть ли сейчас то, о чём подсказка. openCallId — открыто ли окно развилки (это состояние интерфейса). */
function triggered(state: GameState, id: HintId, openCallId: string | null): boolean {
  const open = Object.values(state.tasks).filter((t) => t.status === 'new');
  switch (id) {
    case 'start': return true;
    case 'order': case 'receiving': case 'putaway': case 'writeoff': return open.some((t) => t.type === id);
    case 'call': return state.calls.some((c) => c.expiresAt !== null);
    case 'tsd': return !!openCallId && state.calls.some((c) => c.id === openCallId && c.tsd !== null);
  }
}

/** Подсказка, которую надо показать сейчас; null — никакой (не обучающая смена, всё уже показано, или нечему). */
export function currentHint(state: GameState, openCallId: string | null = null): HintId | null {
  if (!isTutorial(state) || state.campaign.phase !== 'running' || state.tsdGame) return null;
  const seen = state.campaign.hintsSeen ?? [];
  return HINTS.find((h) => !seen.includes(h.id) && triggered(state, h.id, openCallId))?.id ?? null;
}

/** «Понятно» — подсказка больше не покажется. */
export function markHintSeen(state: GameState, id: HintId): GameState {
  const seen = state.campaign.hintsSeen ?? [];
  if (seen.includes(id)) return state;
  return { ...state, campaign: { ...state.campaign, hintsSeen: [...seen, id] } };
}
