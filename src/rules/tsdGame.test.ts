import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { CallAnswer } from '../model/call';
import type { DepthGame, ExpiryGame } from '../model/tsdGame';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { TSD } from '../config/balance';
import { DEPTH, EXPIRY, SITUATION_BY_ID, TSD_OPTION_ID } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openTasks } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity } from './jobs';
import type { Rng } from './random';
import { answerCall, raiseCall, revealCalls } from './calls';
import { sendPicker } from './tsd';
import { closeExpiryUnit, closeTsdGame, depthMovesFrom, moveDepthBox, openExpiryUnit, takeExpiryUnit, tapDepthBox } from './tsdGame';
import { expiryDate } from './minigames/expiry';
import { CALLS } from '../config/calls';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

function runUntil(s: GameState, done: (s: GameState) => boolean, step = 0.1, max = 5000): GameState {
  for (let i = 0; i < max && !done(s); i++) s = advanceWorld(s, map, step).state;
  return s;
}

/** Лаки на заказе, развилка «товар в глубине» на первой позиции; дошёл и зовёт. tsd — есть ли вариант «Взять ТСД». */
function calling(tsd: 'depth' | 'expiry' | null = 'depth', situationId = tsd === 'expiry' ? 'expiring' : 'deep') {
  const g = createInitialGame(map, 1);
  const task = openTasks(g)[0];
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
    expect(raisedFor('barcode').every((x) => x === null)).toBe(true);  // «Штрихкод» ещё нет (N4)
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
    expect(back.tasks[taskId].callLog).toEqual([{ situationId: 'deep', lineIndex: 0, optionId: TSD_OPTION_ID, risk: 'low', auto: false, tsd: 'perfect' }]);
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
      const task = openTasks(g)[0];
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

  it('взял ТСД: в лотке штуки с разными сроками, подходит ровно одна, этикетки на разных сторонах', () => {
    const { g } = start();
    expect(eg(g)).toMatchObject({ kind: 'expiry', need: EXPIRY.need, open: null, result: null });
    const units = eg(g).units;
    expect(units).toHaveLength(EXPIRY.badDays.length + 1);
    expect(units.filter((u) => u.days >= EXPIRY.need)).toHaveLength(1);
    expect(new Set(units.map((u) => u.side)).size).toBe(units.length);
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
    expect(done.tasks[taskId].callLog).toEqual([{ situationId: 'expiring', lineIndex: 0, optionId: TSD_OPTION_ID, risk: 'low', auto: false, tsd: 'perfect' }]);
  });

  it('дата на этикетке: сегодня из config плюс дни', () => {
    expect(expiryDate(0)).toBe(`${String(EXPIRY.today.day).padStart(2, '0')}.${String(EXPIRY.today.month).padStart(2, '0')}`);
    expect(expiryDate(2, { ...EXPIRY, today: { day: 30, month: 10 } })).toBe('01.11');
  });
});
