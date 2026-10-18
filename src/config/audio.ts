// Звук (M9e; решение автора 15.10: Web Audio, без файлов и библиотек).
// Здесь все числа звука: общая громкость, громкость каждого звука, как часто он может повторяться.
// Чтобы заменить звук файлом — положите файл в public/assets/sounds/ и впишите путь в SOUND_FILES.

/** Все звуки игры. Рецепт каждого (как его собрать кодом) — src/audio/sounds.ts. */
export const SOUND_NAMES = [
  'click', 'open', 'close',                        // интерфейс
  'taskNew', 'hurryTick', 'expired',               // задания
  'call', 'truck',                                 // сборщик зовёт, грузовик приехал
  'scan', 'key', 'error', 'slide', 'tsdWin',       // ТСД
  'reelTick', 'reelStop',                          // барабан
  'perfect', 'withErrors', 'failed',               // «Чисто! / Почти! / Мимо!»
  'worked', 'complication',                        // «Сработало! / Осложнение!»
  'coin', 'moneyDown',                             // деньги
  'shiftStart', 'shiftEnd', 'star',                // смена
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

export const AUDIO = {
  /** Общая громкость, 0…1. */
  master: 0.55,
  /** Громкость каждого звука относительно общей, 0…1. */
  volume: {
    click: 0.35, open: 0.45, close: 0.35,
    taskNew: 0.6, hurryTick: 0.35, expired: 0.7,
    call: 0.7, truck: 0.45,
    scan: 0.45, key: 0.35, error: 0.55, slide: 0.4, tsdWin: 0.7,
    reelTick: 0.3, reelStop: 0.6,
    perfect: 0.75, withErrors: 0.65, failed: 0.65,
    worked: 0.7, complication: 0.65,
    coin: 0.55, moneyDown: 0.5,
    shiftStart: 0.7, shiftEnd: 0.75, star: 0.65,
  } satisfies Record<SoundName, number>,
  /** Тот же звук не чаще, чем раз в столько мс (чтобы пять заданий подряд не слились в шум). */
  minGapMs: { taskNew: 250, call: 400, coin: 120, click: 40, hurryTick: 600, key: 30, error: 150 } as Partial<Record<SoundName, number>>,
  /** Барабан: не больше стольких щелчков за прокрутку. */
  reelMaxTicks: 34,
  /** Звёзды на экране итогов: пауза между звёздами, с. */
  starGap: 0.35,
  /** Где помнится «без звука» (браузер, как сохранение игры). */
  muteKey: 'darkstore-muted',
} as const;

/** Звуки из файлов вместо собранных кодом: путь от корня сайта, например 'assets/sounds/coin.mp3'. Пока пусто. */
export const SOUND_FILES: Partial<Record<SoundName, string>> = {};
