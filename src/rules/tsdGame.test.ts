import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { CallAnswer } from '../model/call';
import type { BarcodeGame, DepthGame, ExpiryGame } from '../model/tsdGame';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { TSD } from '../config/balance';
import { BARCODE, DEPTH, EXPIRY, SITUATION_BY_ID, TSD_OPTION_ID } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openOrders } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity } from './jobs';
import type { Rng } from './random';
import { answerCall, raiseCall, revealCalls } from './calls';
import { sendPicker } from './tsd';
import { submitBarcodeGuess, closeExpiryUnit, closeTsdGame, depthMovesFrom, moveDepthBox, openExpiryUnit, takeExpiryUnit, tapDepthBox, tsdStatsOf } from './tsdGame';
import { expiryDate } from './minigames/expiry';
import { CALLS } from '../config/calls';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

function runUntil(s: GameState, done: (s: GameState) => boolean, step = 0.1, max = 5000): GameState {
  for (let i = 0; i < max && !done(s); i++) s = advanceWorld(s, map, step).state;
  return s;
}

/** Лаки на заказе, развилка «товар в глубине» на первой позиции; дошёл и зовёт. tsd — есть ли вариант «Взять ТСД». */
function calling(tsd: 'depth' | 'expiry' | 'barcode' | null = 'depth', situationId = tsd === 'expiry' ? 'expiring' : tsd === 'barcode' ? 'barcode' : 'deep') {
  const g = createInitialGame(map, 1);
  const task = openOrders(g)[0];
  const s = dispatchTask(g, map, task.id, 'lucky');
  const job = s.pickers.lucky.job!;
  const stepIndex = job.steps.findIndex((st) => st.kind === 'pick');
  const withCall: GameState = {
    ...s,
    pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...job, call: { stepIndex, lineIndex: 0, situationId, raised: false } } } },
  };
  const at = runUntil(withCall, (x) => x.calls.length > 0);
  return { s: { ...at, calls: at.calls.map((c) => ({ ...c, tsd })) }, taskId: task.id };
}

/** Игра с простой полкой: нужная коробка во втором ряду, перед ней пустой выход — лучший путь 1 ход. */
const dg = (s: GameState) => s.tsdGame as DepthGame;

function easyGame(s: GameState, exit = 0): GameState {
  const g = dg(s);
  return { ...s, tsdGame: { ...g, best: 1, board: { ...g.board, cells: [-1, 1, 2, 0, 3, 4, 5, 6, -1], exit } } };
}

describe('«Взять ТСД» в развилке', () => {
  it('вариант есть только у ситуаций с готовой игрой и выпадает не всегда', () => {
    const { s } = calling(null);
    const call = s.calls[0];
    // заново поднять тот же вызов с разными зёрнами: у «глубины» вариант то есть, то нет
    const raisedFor = (situationId: string) => Array.from({ length: 40 }, (_, seed) => {
      const base: GameState = {
        ...s, rngSeed: seed + 1, calls: [],
        pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: { ...s.pickers.lucky.job!.call!, situationId } } } },
      };
      return raiseCall(base, 'lucky').calls[0].tsd;
    });
    const deep = raisedFor('deep');
    expect(deep).toContain('depth');
    if (!CALLS.forceTsd) expect(deep).toContain(null); // с флагом проверки вариант есть всегда
    expect(raisedFor('jam').every((x) => x === null)).toBe(true);     // у пробки игры нет
    expect(raisedFor('expiring')).toContain('expiry');                // «Срок» сделан (N3)
    expect(raisedFor('barcode')).toContain('barcode');                // «Штрихкод» сделан (N4)
    expect(call.optionIds).not.toContain(TSD_OPTION_ID);              // сборщик сам ТСД не выбирает
  });

  it('нет варианта — ответ «Взять ТСД» не принимается', () => {
    const { s } = calling(null);
    expect(answerCall(s, s.calls[0].id, TSD_OPTION_ID)).toBe(s);
  });

  it('взял ТСД: вызов уходит, игра у стеллажа позиции, сборщик стоит, мир на паузе, время игры идёт', () => {
    const { s, taskId } = calling();
    const line = s.tasks[taskId].type === 'order' ? (s.tasks[taskId] as Extract<GameState['tasks'][string], { type: 'order' }>).payload.lines[0] : null;
    const g = answerCall(s, s.calls[0].id, TSD_OPTION_ID);
    expect(g.calls).toHaveLength(0);
    expect(g.tsdGame).toMatchObject({ kind: 'depth', pickerId: 'lucky', lineIndex: 0, moves: 0, result: null });
    expect(g.tsdGame!.rack).toEqual({ aisle: line!.address.aisle, rack: line!.address.rack });
    expect(dg(g).board.boxes[0]).toBe(line!.productId);
    expect(pickerActivity(g, 'lucky').kind).toBe('tsdGame');
    const later = advanceWorld(g, map, 2).state;
    expect(later.pickers.lucky.position).toEqual(g.pickers.lucky.position);
    expect(later.clock.time - g.clock.time).toBeCloseTo(2 * TSD.worldSpeedDuringTsdGame, 5); // мир на паузе
    expect(later.tsdGame!.elapsed).toBeCloseTo(2, 5);
  });

  it('ход: нужная коробка встала на выход — игра закончена сама, исход по ходам; «К складу» — ответ в задании, сборщик работает дальше', () => {
    const { s, taskId } = calling();
    let g = easyGame(answerCall(s, s.calls[0].id, TSD_OPTION_ID));
    expect(tapDepthBox(g, 4).tsdGame!.note).toBe('stuck'); // вокруг нет места
    expect(tapDepthBox(g, 3)).toBe(g);                     // выбор коробки — только в интерфейсе
    expect(depthMovesFrom(g, 3)).toEqual([0]);             // куда можно: пустая клетка впереди
    expect(moveDepthBox(g, 3, 4)).toBe(g);                 // в занятую — нельзя
    g = moveDepthBox(g, 3, 0); // на выход
    expect(g.tsdGame).toMatchObject({ moves: 1, result: 'perfect', note: 'taken' });
    expect(tapDepthBox(g, 1)).toBe(g); // игра закончена — клики не действуют
    expect(moveDepthBox(g, 1, 3)).toBe(g);
    const back = closeTsdGame(g);
    expect(back.tsdGame).toBe(null);
    expect(back.tasks[taskId].callLog).toEqual([{ situationId: 'deep', lineIndex: 0, optionId: TSD_OPTION_ID, risk: 'low', auto: false, tsd: 'perfect',
      // цифры игры — для кадра «Вы решили» в окне итога (вариант А, 20.10)
      tsdStats: { kind: 'depth', seconds: dg(g).elapsed, moves: 1, best: dg(g).best, timeout: false, tooMany: false } }]);
    expect(back.pickers.lucky.state).toBe('working');
    const done = runUntil(back, (x) => x.tasks[taskId].status === 'done');
    expect(done.tasks[taskId].status).toBe('done');
  });

  it('коробка, которую некуда сдвинуть, — «не сдвинется»; до конца игры закрыть нельзя', () => {
    const { s } = calling();
    const g0 = answerCall(s, s.calls[0].id, TSD_OPTION_ID);
    // нужная у задней стенки (клетка 7), вокруг неё коробки, пустые клетки — впереди слева
    const g = { ...g0, tsdGame: { ...dg(g0), board: { ...dg(g0).board, cells: [-1, -1, 1, 2, 3, 4, 5, 0, 6] } } };
    expect(tapDepthBox(g, 7).tsdGame!.note).toBe('stuck');
    expect(closeTsdGame(g)).toBe(g);
  });

  it('ходов больше, чем допускает «с ошибками», — провал сразу', () => {
    const { s } = calling();
    let g = easyGame(answerCall(s, s.calls[0].id, TSD_OPTION_ID), 2); // выход справа — туда-обратно по левой клетке не попадём
    // гоняем коробку туда-обратно: лучший путь 1 ход, «с ошибками» — до 1 + DEPTH.withErrorsExtra
    for (let i = 0; i <= DEPTH.withErrorsExtra; i++) {
      g = i % 2 === 0 ? moveDepthBox(g, 3, 0) : moveDepthBox(g, 0, 3);
      expect(g.tsdGame!.result).toBe(null);
    }
    g = moveDepthBox(g, 0, 3);
    expect(g.tsdGame).toMatchObject({ result: 'failed', note: 'tooMany', moves: DEPTH.withErrorsExtra + 2 });
  });

  it('время вышло — провал', () => {
    const { s } = calling();
    const g = answerCall(s, s.calls[0].id, TSD_OPTION_ID);
    const late = runUntil(g, (x) => x.tsdGame?.result !== null, 0.5);
    expect(late.tsdGame).toMatchObject({ result: 'failed', note: 'timeout' });
    expect(late.tsdGame!.elapsed).toBe(DEPTH.timeLimit);
  });
});

describe('исход с игрой на ТСД', () => {
  const fixed = (...xs: number[]): Rng => {
    let i = 0;
    return { next: () => xs[i++ % xs.length], seed: () => 0 } as unknown as Rng;
  };
  const tsd = (result: CallAnswer['tsd']): CallAnswer => ({ situationId: 'deep', lineIndex: 0, optionId: TSD_OPTION_ID, risk: 'low', auto: false, tsd: result });

  it('броска нет: идеально — без изменений, с ошибками — ступень, провал — две', () => {
    expect(revealCalls('perfect', [tsd('perfect')], fixed(0)).final).toBe('perfect'); // даже при «невезучем» броске
    expect(revealCalls('perfect', [tsd('withErrors')], fixed(0.99)).final).toBe('withErrors');
    expect(revealCalls('perfect', [tsd('failed')], fixed(0.99)).final).toBe('failed');
    expect(revealCalls('withErrors', [tsd('perfect')], fixed(0)).final).toBe('withErrors'); // игра не исправляет исход по характеристикам
    expect(revealCalls('perfect', [tsd('withErrors')], fixed(0)).calls[0]).toMatchObject({ complication: true, tsd: 'withErrors' });
  });

  it('у ситуации «глубина» есть игра, у «пробки» нет', () => {
    expect(SITUATION_BY_ID.deep.tsdGame).toBe('depth');
    expect(SITUATION_BY_ID.jam.tsdGame).toBeUndefined();
  });
});

describe('предложение «Взять ТСД?» при отправке', () => {
  it('выключено флагом: при «Отправить» сборщик всегда идёт сам', () => {
    expect(TSD.offerOnDispatch).toBe(false);
    for (let seed = 1; seed <= 20; seed++) {
      const g = createInitialGame(map, seed);
      const task = openOrders(g)[0];
      const s = sendPicker(g, map, task.id, 'lucky');
      expect(s.tsdOffer).toBe(null);
      expect(s.pickers.lucky.state).toBe('walking');
    }
  });
});

describe('«Срок»', () => {
  const eg = (s: GameState) => s.tsdGame as ExpiryGame;
  const start = () => {
    const { s, taskId } = calling('expiry');
    return { g: answerCall(s, s.calls[0].id, TSD_OPTION_ID), taskId };
  };
  const goodIndex = (g: GameState) => eg(g).units.findIndex((u) => u.days >= eg(g).need);
  const badIndex = (g: GameState) => eg(g).units.findIndex((u) => u.days < eg(g).need);

  it('взял ТСД: в лотке 4 ряда по 3 штуки, подходит ровно одна, этикетки на всех сторонах по кругу, кроме верха', () => {
    const { g } = start();
    expect(eg(g)).toMatchObject({ kind: 'expiry', need: EXPIRY.need, open: null, result: null });
    const units = eg(g).units;
    expect(units).toHaveLength(EXPIRY.rows * EXPIRY.cols);
    expect(units.filter((u) => u.days >= EXPIRY.need)).toHaveLength(1);
    expect(units.every((u) => u.side >= 0 && u.side <= 5 && u.side !== 4)).toBe(true); // сверху — никогда
    expect(new Set(units.slice(0, 5).map((u) => u.side)).size).toBe(5); // первые пять — все разрешённые стороны
    expect(g.pickers.lucky.state).toBe('playing');
  });

  it('поднять и положить обратно; взять подходящую быстро — идеально', () => {
    let { g } = start();
    g = openExpiryUnit(g, badIndex(g));
    expect(eg(g).open).toBe(badIndex(g));
    expect(eg(g).units[badIndex(g)].seen).toBe(true);
    g = closeExpiryUnit(g);
    expect(eg(g).open).toBe(null);
    expect(takeExpiryUnit(g)).toBe(g); // ничего не поднято — брать нечего
    g = takeExpiryUnit(openExpiryUnit(g, goodIndex(g)));
    expect(eg(g)).toMatchObject({ result: 'perfect', note: 'taken', taken: goodIndex(g) });
  });

  it('не та штука — провал; подходящая, но долго — с ошибками; время вышло — провал', () => {
    const { g } = start();
    expect(eg(takeExpiryUnit(openExpiryUnit(g, badIndex(g)))).result).toBe('failed');
    const slow = { ...g, tsdGame: { ...eg(g), elapsed: EXPIRY.perfectSeconds + 1 } };
    expect(eg(takeExpiryUnit(openExpiryUnit(slow, goodIndex(slow)))).result).toBe('withErrors');
    const late = runUntil(g, (x) => x.tsdGame?.result !== null, 0.5);
    expect(eg(late)).toMatchObject({ result: 'failed', note: 'timeout', open: null });
  });

  it('«К складу» — итог в задании как ответ на развилку', () => {
    const { g, taskId } = start();
    const done = closeTsdGame(takeExpiryUnit(openExpiryUnit(g, goodIndex(g))));
    expect(done.tsdGame).toBe(null);
    expect(done.tasks[taskId].callLog).toEqual([{ situationId: 'expiring', lineIndex: 0, optionId: TSD_OPTION_ID, risk: 'low', auto: false, tsd: 'perfect',
      tsdStats: { kind: 'expiry', seconds: 0, timeout: false, takenDays: expect.any(Number), mode: 'fresh' } }]);
  });

  it('дата на этикетке: первая смена из config, каждая следующая смена — на день позже', () => {
    const f = EXPIRY.firstShiftDate;
    expect(expiryDate(0)).toBe(`${String(f.day).padStart(2, '0')}.${String(f.month).padStart(2, '0')}`);
    expect(expiryDate(0, 1, { ...EXPIRY, firstShiftDate: { day: 14, month: 10, year: 2026 } })).toBe('14.10');
    expect(expiryDate(0, 2, { ...EXPIRY, firstShiftDate: { day: 14, month: 10, year: 2026 } })).toBe('15.10');
    expect(expiryDate(2, 3, { ...EXPIRY, firstShiftDate: { day: 14, month: 10, year: 2026 } })).toBe('18.10');
    // через конец месяца
    expect(expiryDate(2, 1, { ...EXPIRY, firstShiftDate: { day: 30, month: 10, year: 2026 } })).toBe('01.11');
    expect(expiryDate(0, 3, { ...EXPIRY, firstShiftDate: { day: 30, month: 10, year: 2026 } })).toBe('01.11');
  });
});

describe('«Штрихкод»', () => {
  const bg = (s: GameState) => s.tsdGame as BarcodeGame;
  const start = () => {
    const { s, taskId } = calling('barcode');
    return { g: answerCall(s, s.calls[0].id, TSD_OPTION_ID), taskId };
  };
  /** Вступление прошло — можно вводить. */
  const ready = (g: GameState): GameState => ({ ...g, tsdGame: { ...bg(g), elapsed: bg(g).startDelay } });
  const secret = (g: GameState) => bg(g).code.slice(bg(g).hiddenFrom, bg(g).hiddenFrom + bg(g).hiddenCount);
  /** Неверная попытка: все цифры сдвинуты на 1. */
  const wrong = (g: GameState) => secret(g).map((d) => (d + 1) % 10);

  it('код из 13 цифр, начало 46, середина затёрта, наклейка не сверху', () => {
    const { g } = start();
    const b = bg(g);
    expect(b.code).toHaveLength(BARCODE.length);
    expect(b.code.slice(0, 2)).toEqual([4, 6]);
    expect(b).toMatchObject({ hiddenFrom: BARCODE.hiddenFrom, hiddenCount: BARCODE.hiddenCount, attempts: BARCODE.attempts, guesses: [], result: null });
    expect(b.side).not.toBe(4);
  });

  it('пока идёт вступление (подлёт, подъём, поворот), ввод не принимается; неполная попытка — тоже', () => {
    const { g } = start();
    expect(submitBarcodeGuess(g, secret(g))).toBe(g);
    const r = ready(g);
    expect(submitBarcodeGuess(r, secret(r).slice(0, 3))).toBe(r);
  });

  it('угадал за perfectWithin — идеально, позже — неплохо', () => {
    let g = ready(start().g);
    g = submitBarcodeGuess(g, secret(g));
    expect(bg(g)).toMatchObject({ result: 'perfect', note: 'solved' });
    let h = ready(start().g);
    for (let i = 0; i < BARCODE.perfectWithin; i++) h = submitBarcodeGuess(h, wrong(h));
    expect(bg(h).result).toBe(null);
    h = submitBarcodeGuess(h, secret(h));
    expect(bg(h).result).toBe('withErrors');
  });

  it('попытки кончились — провал; время кончилось (не считая вступления) — провал', () => {
    let g = ready(start().g);
    for (let i = 0; i < BARCODE.attempts; i++) g = submitBarcodeGuess(g, wrong(g));
    expect(bg(g)).toMatchObject({ result: 'failed', note: 'outOfTries' });
    expect(bg(g).guesses).toHaveLength(BARCODE.attempts);
    const late = runUntil(start().g, (x) => x.tsdGame?.result !== null, 0.5);
    expect(bg(late)).toMatchObject({ result: 'failed', note: 'timeout' });
    expect(bg(late).elapsed).toBe(BARCODE.timeLimit + BARCODE.introSeconds);
  });
});

describe('цифры игры на ТСД для окна итога (tsdStatsOf)', () => {
  const base = { callId: 'c', taskId: 't', pickerId: 'lucky', situationId: 's', lineIndex: 0, address: { aisle: 1, rack: 1, shelf: 1 },
    rack: { aisle: 1, rack: 1 }, noteAt: 0, result: 'perfect' as const };

  it('«Штрихкод»: время без вступления, сколько попыток, угадан ли код', () => {
    const g: BarcodeGame = { ...base, kind: 'barcode', elapsed: 20, timeLimit: 90, startDelay: 2, productId: 'coffee', code: [], hiddenFrom: 5,
      hiddenCount: 4, side: 0, attempts: 6, perfectWithin: 4, guesses: [{ digits: [], marks: [] }, { digits: [], marks: [] }], note: 'solved' };
    expect(tsdStatsOf(g)).toEqual({ kind: 'barcode', seconds: 18, timeout: false, tries: 2, attempts: 6, solved: true });
  });

  it('«Срок»: какой срок у взятой штуки', () => {
    const g: ExpiryGame = { ...base, kind: 'expiry', elapsed: 21, timeLimit: 45, productId: 'coffee', need: 2, mode: 'fresh', perfectSeconds: 28,
      units: [{ days: 0, side: 0, seen: false }, { days: 3, side: 1, seen: false }], open: null, taken: 1, note: 'taken' };
    expect(tsdStatsOf(g)).toEqual({ kind: 'expiry', seconds: 21, timeout: false, takenDays: 3, mode: 'fresh' });
    expect(tsdStatsOf({ ...g, taken: null, note: 'timeout' })).toMatchObject({ takenDays: null, timeout: true });
  });
});
