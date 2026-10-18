// Рецепты звуков (M9e): каждый звук собирается кодом из простых волн и шума — без файлов.
// Стиль — короткие мягкие «игрушечные» звуки. Громкость каждого — config/audio.ts (AUDIO.volume).
// Звук из файла вместо рецепта — SOUND_FILES в том же config.
import type { SoundName } from '../config/audio';

/** Рецепт: куда играть (out), когда (at — время звуковой карты), вариация (номер звезды и т. п.). */
type Recipe = (ctx: AudioContext, out: AudioNode, at: number, variant: number) => void;

type ToneOpts = {
  freq: number;
  to?: number;          // к какой частоте скользит
  dur: number;          // длительность, с
  type?: OscillatorType;
  vol?: number;         // 0…1
  attack?: number;      // нарастание, с
  start?: number;       // сдвиг от at, с
  lowpass?: number;     // приглушить верха (Гц)
};

/** Одна нота: волна с нарастанием и затуханием. */
function tone(ctx: AudioContext, out: AudioNode, at: number, o: ToneOpts): void {
  const t0 = at + (o.start ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const g = ctx.createGain();
  const vol = o.vol ?? 1;
  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

/** Короткий шум (щелчок, шорох, «пшик»). */
function noise(ctx: AudioContext, out: AudioNode, at: number, o: { dur: number; vol?: number; start?: number; band?: number; q?: number }): void {
  const t0 = at + (o.start ?? 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = o.band ?? 2000;
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.value = o.vol ?? 1;
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t0);
}

/** Ноты по порядку (арпеджио): частоты, шаг между нотами, длительность каждой. */
function arp(ctx: AudioContext, out: AudioNode, at: number, freqs: number[], step: number, dur: number, type: OscillatorType = 'triangle', vol = 1): void {
  freqs.forEach((freq, i) => tone(ctx, out, at, { freq, dur, type, vol, start: i * step }));
}

// ноты (Гц), чтобы рецепты читались
const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };

/** «Гав»: пила со спадом высоты через фильтр — как короткий лай. */
function woof(ctx: AudioContext, out: AudioNode, at: number, start: number, pitch: number): void {
  tone(ctx, out, at, { freq: pitch, to: pitch * 0.55, dur: 0.16, type: 'sawtooth', vol: 0.9, attack: 0.01, start, lowpass: 900 });
  tone(ctx, out, at, { freq: pitch * 2, to: pitch * 1.1, dur: 0.1, type: 'square', vol: 0.15, attack: 0.01, start, lowpass: 1600 });
  noise(ctx, out, at, { dur: 0.06, vol: 0.25, start, band: 700, q: 2 });
}

export const SOUNDS: Record<SoundName, Recipe> = {
  // интерфейс
  click: (c, o, t) => tone(c, o, t, { freq: 720, to: 560, dur: 0.05, type: 'square', vol: 0.5, lowpass: 2500 }),
  open: (c, o, t) => { tone(c, o, t, { freq: N.C5, dur: 0.09, vol: 0.8 }); tone(c, o, t, { freq: N.G5, dur: 0.12, vol: 0.8, start: 0.06 }); },
  close: (c, o, t) => { tone(c, o, t, { freq: N.G5, dur: 0.08, vol: 0.7 }); tone(c, o, t, { freq: N.C5, dur: 0.1, vol: 0.7, start: 0.05 }); },

  // задания
  taskNew: (c, o, t) => { tone(c, o, t, { freq: N.E6, dur: 0.35, type: 'sine', vol: 0.8 }); tone(c, o, t, { freq: N.B5, dur: 0.3, type: 'sine', vol: 0.5, start: 0.08 }); },
  hurryTick: (c, o, t) => { tone(c, o, t, { freq: 1800, dur: 0.03, type: 'square', vol: 0.4, lowpass: 3000 }); noise(c, o, t, { dur: 0.02, vol: 0.4, band: 3000 }); },
  expired: (c, o, t) => {
    tone(c, o, t, { freq: N.E4, to: 196, dur: 0.35, type: 'sawtooth', vol: 0.5, lowpass: 1200 });
    tone(c, o, t, { freq: 247, to: 131, dur: 0.45, type: 'sawtooth', vol: 0.5, start: 0.2, lowpass: 1000 });
  },

  // сборщик зовёт: «гав-гав»; грузовик: короткий двойной гудок
  call: (c, o, t) => { woof(c, o, t, 0, 340); woof(c, o, t, 0.2, 380); },
  truck: (c, o, t) => {
    for (const s of [0, 0.3]) {
      tone(c, o, t, { freq: 220, dur: 0.22, type: 'square', vol: 0.4, start: s, attack: 0.02, lowpass: 900 });
      tone(c, o, t, { freq: 277, dur: 0.22, type: 'square', vol: 0.4, start: s, attack: 0.02, lowpass: 900 });
    }
  },

  // ТСД
  scan: (c, o, t) => tone(c, o, t, { freq: 2100, dur: 0.09, type: 'square', vol: 0.45, lowpass: 4000 }),
  key: (c, o, t, v) => tone(c, o, t, { freq: v < 0 ? 900 : 1250, dur: 0.045, type: 'square', vol: 0.4, lowpass: 3500 }),
  error: (c, o, t) => {
    tone(c, o, t, { freq: 150, dur: 0.13, type: 'square', vol: 0.5, lowpass: 800 });
    tone(c, o, t, { freq: 140, dur: 0.16, type: 'square', vol: 0.5, start: 0.16, lowpass: 800 });
  },
  slide: (c, o, t) => { noise(c, o, t, { dur: 0.12, vol: 0.7, band: 900, q: 0.8 }); tone(c, o, t, { freq: 300, to: 220, dur: 0.08, vol: 0.4, start: 0.06 }); },
  tsdWin: (c, o, t) => arp(c, o, t, [N.C5, N.E5, N.G5, N.C6], 0.08, 0.22, 'square', 0.35),

  // барабан
  reelTick: (c, o, t) => { noise(c, o, t, { dur: 0.018, vol: 0.9, band: 2600, q: 3 }); tone(c, o, t, { freq: 1400, dur: 0.02, type: 'square', vol: 0.15 }); },
  reelStop: (c, o, t) => { tone(c, o, t, { freq: 180, to: 90, dur: 0.15, type: 'sine', vol: 1 }); noise(c, o, t, { dur: 0.06, vol: 0.5, band: 1200 }); },

  // исход задания без развилки
  perfect: (c, o, t) => { arp(c, o, t, [N.C5, N.E5, N.G5, N.C6, N.E6], 0.07, 0.3, 'triangle', 0.8); tone(c, o, t, { freq: N.G6, dur: 0.5, type: 'sine', vol: 0.3, start: 0.35 }); },
  withErrors: (c, o, t) => arp(c, o, t, [N.G4, N.C5, N.D5], 0.11, 0.25, 'triangle', 0.8),
  failed: (c, o, t) => {
    arp(c, o, t, [N.G4, N.E4], 0.16, 0.25, 'triangle', 0.8);
    tone(c, o, t, { freq: N.C4, to: 196, dur: 0.6, type: 'triangle', vol: 0.8, start: 0.32 });
  },

  // исход ответа в развилке
  worked: (c, o, t) => arp(c, o, t, [N.E5, N.A5, N.C6], 0.08, 0.25, 'triangle', 0.8),
  complication: (c, o, t) => {
    tone(c, o, t, { freq: N.A4, to: 330, dur: 0.22, type: 'sawtooth', vol: 0.4, lowpass: 1400 });
    tone(c, o, t, { freq: 311, to: 196, dur: 0.4, type: 'sawtooth', vol: 0.4, start: 0.18, lowpass: 1200 });
  },

  // деньги
  coin: (c, o, t) => { tone(c, o, t, { freq: N.B5, dur: 0.08, type: 'square', vol: 0.35 }); tone(c, o, t, { freq: N.E6, dur: 0.3, type: 'square', vol: 0.35, start: 0.07 }); },
  moneyDown: (c, o, t) => { tone(c, o, t, { freq: N.E5, dur: 0.1, type: 'square', vol: 0.3 }); tone(c, o, t, { freq: N.A4, dur: 0.25, type: 'square', vol: 0.3, start: 0.09 }); },

  // смена
  shiftStart: (c, o, t) => arp(c, o, t, [N.G4, N.C5, N.E5, N.G5], 0.1, 0.25, 'triangle', 0.8),
  shiftEnd: (c, o, t) => {
    arp(c, o, t, [N.C5, N.G4, N.C5], 0.14, 0.2, 'triangle', 0.8);
    for (const f of [N.C5, N.E5, N.G5]) tone(c, o, t, { freq: f, dur: 0.9, type: 'triangle', vol: 0.45, start: 0.42 });
  },
  star: (c, o, t, v) => {
    const f = [N.C6, N.E6, N.G6][Math.min(2, Math.max(0, v))];
    tone(c, o, t, { freq: f, dur: 0.4, type: 'sine', vol: 0.8 });
    tone(c, o, t, { freq: f * 1.5, dur: 0.25, type: 'triangle', vol: 0.25, start: 0.03 });
  },
};
