// Телефон или нет (R1): узкий вертикальный экран. Слушает поворот и смену размера окна.
// Один источник правды и для сцены, и для интерфейса; App ещё вешает на <html> класс «phone» — по нему переключается CSS.
import { useSyncExternalStore } from 'react';
import { PHONE } from '../config/phone';

const QUERY = `(max-width: ${PHONE.maxWidth}px) and (orientation: portrait)`;

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null);

export function isPhone(): boolean {
  return media()?.matches ?? false;
}

function subscribe(cb: () => void): () => void {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false);
}
