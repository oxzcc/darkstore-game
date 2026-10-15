// Сохранение игры в браузере (M8e; docs/09, раздел 12; решения автора 15.10).
// Встроенное в Zustand дополнение persist: сохраняется только `game` (не окна и не выделение), в localStorage.
// Пишем не каждый кадр, а не чаще раза в SAVE_EVERY_MS и обязательно при закрытии вкладки.
// Другая версия формата (GAME_STATE_VERSION) — старое сохранение сбрасывается, начинается новая кампания.
// После открытия игра стоит на паузе (решение автора 15.10): продолжить — ×1 или пауза.
import { createJSONStorage, type PersistOptions, type StateStorage } from 'zustand/middleware';
import type { GameState } from '../model/game';
import { GAME_STATE_VERSION } from '../config/balance';

export const SAVE_KEY = 'darkstore-game';
const SAVE_EVERY_MS = 3000;

/** localStorage может быть недоступен (приватное окно, запрет сайта) — тогда игра просто не сохраняется. */
function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Хранилище, которое копит последнюю запись и сбрасывает её не чаще раза в SAVE_EVERY_MS и при закрытии вкладки. */
function throttledStorage(): StateStorage {
  let pending: [string, string] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending) return;
    const [k, v] = pending;
    pending = null;
    try { safeStorage()?.setItem(k, v); } catch { /* место кончилось или запрещено — пропускаем */ }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }
  return {
    getItem: (k) => { try { return safeStorage()?.getItem(k) ?? null; } catch { return null; } },
    setItem: (k, v) => {
      pending = [k, v];
      if (!timer) timer = setTimeout(flush, SAVE_EVERY_MS);
    },
    removeItem: (k) => {
      pending = null;
      try { safeStorage()?.removeItem(k); } catch { /* ничего */ }
    },
  };
}

type Saved = { game: GameState };

/** Настройки persist для store: что сохранять и как поднимать сохранение. */
export function persistOptions<S extends Saved>(): PersistOptions<S, Saved> {
  return {
    name: SAVE_KEY,
    version: GAME_STATE_VERSION,
    storage: createJSONStorage(throttledStorage),
    partialize: (s) => ({ game: s.game }),
    // формат поменялся — сохранение не подходит: остаётся новая игра
    migrate: () => undefined as unknown as Saved,
    merge: (persisted, current) => {
      const saved = (persisted as Saved | undefined)?.game;
      if (!saved || saved.version !== GAME_STATE_VERSION) return current;
      // после открытия — на паузе. Кроме игры на ТСД: мир в ней и так стоит, а снять паузу во время игры нечем —
      // кнопки скорости заблокированы, и клики по головоломке не проходили (игра зависала).
      return { ...current, game: { ...saved, clock: { ...saved.clock, paused: saved.tsdGame === null } } };
    },
  };
}
