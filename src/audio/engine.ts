// Звуковой движок (M9e): один AudioContext браузера, общая громкость, «без звука».
// Браузер разрешает звук только после первого нажатия игрока — unlockAudio вызывается на первый клик или клавишу.
// Игровой логики здесь нет: кто и когда играет звук — SoundDirector и окна интерфейса.
import { AUDIO, SOUND_FILES, type SoundName } from '../config/audio';
import { SOUNDS } from './sounds';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();
const lastPlayed: Partial<Record<SoundName, number>> = {};
const fileBuffers: Partial<Record<SoundName, AudioBuffer | 'loading' | 'failed'>> = {};

function readMuted(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(AUDIO.muteKey) === '1'; } catch { return false; }
}

/** Создать и «разбудить» звук. Вызывать из обработчика нажатия: иначе браузер его не включит. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : AUDIO.master;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean { return muted; }

export function setMuted(value: boolean): void {
  muted = value;
  try { window.localStorage.setItem(AUDIO.muteKey, value ? '1' : '0'); } catch { /* не сохранилось — не страшно */ }
  if (ctx && master) master.gain.setTargetAtTime(value ? 0 : AUDIO.master, ctx.currentTime, 0.02);
  listeners.forEach((l) => l());
}

/** Для кнопки «без звука» (useSyncExternalStore). */
export function subscribeMuted(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export type PlayOptions = {
  /** Через сколько секунд сыграть (звук ставится в очередь самого браузера, поэтому ровно). */
  delay?: number;
  /** Номер вариации: у звёзд — какая по счёту (выше нота). */
  variant?: number;
};

/** Что вернул play: можно оборвать звук (например, барабан остановили кликом). */
export type SoundHandle = { stop: () => void };

const NOOP: SoundHandle = { stop: () => {} };

/** Сыграть звук. Без звука, до первого клика или слишком часто подряд — тихо ничего не делает. */
export function play(name: SoundName, opts: PlayOptions = {}): SoundHandle {
  if (muted || !ctx || !master || ctx.state !== 'running') return NOOP;
  const gap = AUDIO.minGapMs[name];
  const nowMs = performance.now() + (opts.delay ?? 0) * 1000;
  if (gap !== undefined && lastPlayed[name] !== undefined && nowMs - lastPlayed[name]! < gap) return NOOP;
  lastPlayed[name] = nowMs;

  // у каждого звука свой регулятор громкости: оборвать — значит отключить его
  const out = ctx.createGain();
  out.gain.value = AUDIO.volume[name];
  out.connect(master);
  const at = ctx.currentTime + (opts.delay ?? 0);

  const file = SOUND_FILES[name];
  if (file) playFile(name, file, out, at);
  else SOUNDS[name](ctx, out, at, opts.variant ?? 0);

  let stopped = false;
  return {
    stop: () => {
      if (stopped || !ctx) return;
      stopped = true;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      setTimeout(() => out.disconnect(), 100);
    },
  };
}

/** Звук из файла (SOUND_FILES): первый раз грузится, потом берётся готовый. */
function playFile(name: SoundName, path: string, out: GainNode, at: number): void {
  if (!ctx) return;
  const buf = fileBuffers[name];
  if (buf instanceof AudioBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start(at);
    return;
  }
  if (buf) return; // грузится или не загрузился — молчим
  fileBuffers[name] = 'loading';
  const c = ctx;
  fetch(import.meta.env.BASE_URL + path)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((decoded) => { fileBuffers[name] = decoded; })
    .catch(() => { fileBuffers[name] = 'failed'; });
}
