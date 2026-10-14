// Игра на ТСД внутри развилки (docs/10-minigames-concept.md, раздел 11; решение автора 14.10).
// Сборщик стоит у стеллажа и зовёт диспетчера; если игрок выбрал «Взять ТСД», камера подлетает к стеллажу
// и игрок сам решает ситуацию в короткой игре. Итог игры — исход этой позиции заказа.
import type { Address } from './address';
import type { RackRef } from './minigame';
import type { Outcome } from './task';

/** Какие игры бывают. Готова пока только «Глубина» (N2); «Срок» — N3, «Штрихкод» — N4. */
export type TsdGameKind = 'depth' | 'expiry' | 'barcode';

/**
 * «Глубина»: полка сверху как сетка cols × rows, коробки двигаются в пустые клетки, как в пятнашках.
 * Клетка i — ряд Math.floor(i / cols) (0 — передний, у прохода), место в ряду i % cols.
 * В клетке — номер коробки или -1 (пусто). Коробка 0 — нужный товар.
 */
export type DepthBoard = {
  cols: number;
  rows: number;
  cells: number[];
  boxes: string[]; // id товара каждой коробки (для вида); boxes[0] — нужный
  exit: number;    // клетка выхода в переднем ряду: нужная коробка на ней — игра закончена (решение автора 14.10)
};

/** Что ТСД сказал на последний клик — строка на экране. */
export type DepthNote = 'moved' | 'stuck' | 'taken' | 'timeout' | 'tooMany';

export type DepthGame = {
  kind: 'depth';
  callId: string;
  taskId: string;
  pickerId: string;
  situationId: string;
  lineIndex: number;
  address: Address;     // полка позиции заказа
  rack: RackRef;        // к какому стеллажу подлетает камера
  elapsed: number;      // секунды игры (в обычном темпе, а не замедленного мира)
  timeLimit: number;
  board: DepthBoard;
  best: number;         // наименьшее число ходов, чтобы вывести нужную коробку в передний ряд
  moves: number;
  note: DepthNote | null;
  noteAt: number;       // elapsed в момент note — экран понимает, что сообщение новое
  result: Outcome | null; // игра закончена: что вышло (окно ещё открыто, пока игрок не нажмёт «К складу»)
};

/**
 * «Срок» (N3; прототип одобрен автором 14.10): в лотке несколько штук товара, у каждой свой срок годности.
 * Этикетка со сроком — на одной стороне штуки: 0 — перед, 1 — право, 2 — зад, 3 — лево, 5 — низ; сверху — никогда (решения автора 14.10).
 * Сроки — в днях от сегодня (0 — сегодня). Подходит ровно одна штука: срок не раньше need.
 */
export type ExpiryUnit = { days: number; side: number; seen: boolean };

/** Что ТСД сказал на последнее действие. */
export type ExpiryNote = 'taken' | 'timeout';

/** Что ищем в «Сроке»: подходящую свежую или именно просроченную (M7e2). */
export type ExpiryMode = 'fresh' | 'expired';

export type ExpiryGame = {
  kind: 'expiry';
  callId: string;
  taskId: string;
  pickerId: string;
  situationId: string;
  lineIndex: number;
  address: Address;
  rack: RackRef;
  elapsed: number;
  timeLimit: number;
  productId: string;
  need: number;          // годен не ранее: столько дней от сегодня
  /** fresh — найти штуку с хорошим сроком (сборка); expired — найти просроченную (списание, M7e2). */
  mode: ExpiryMode;
  units: ExpiryUnit[];
  open: number | null;   // какая штука поднята крупно (её крутят и читают этикетку)
  taken: number | null;  // какую взяли — для итога
  note: ExpiryNote | null;
  noteAt: number;
  result: Outcome | null;
};

/** Отметка цифры в попытке, как в играх с угадыванием слов: на месте / есть, но в другом месте / нет. */
export type BarcodeMark = 'hit' | 'near' | 'miss';

export type BarcodeGuess = { digits: number[]; marks: BarcodeMark[] };

/** Что ТСД сказал про конец игры. */
export type BarcodeNote = 'solved' | 'outOfTries' | 'timeout';

/**
 * «Штрихкод» (N4; прототип одобрен автором 14.10): у штуки на наклейке код из 13 цифр, середина затёрта.
 * Камера подлетает, штуку достают с полки, она сама поворачивается наклейкой (startDelay секунд — время в это время не идёт).
 * Игрок подбирает стёртые цифры за несколько попыток; после каждой — отметки по цифрам.
 */
export type BarcodeGame = {
  kind: 'barcode';
  callId: string;
  taskId: string;
  pickerId: string;
  situationId: string;
  lineIndex: number;
  address: Address;
  rack: RackRef;
  elapsed: number;
  timeLimit: number;     // секунды на подбор (после вступления)
  startDelay: number;    // вступление: подлёт, подъём, поворот
  productId: string;
  code: number[];        // весь код
  hiddenFrom: number;    // с какой цифры затёрто
  hiddenCount: number;
  side: number;          // на какой стороне наклейка (как в «Сроке»; сверху — никогда)
  attempts: number;
  perfectWithin: number; // угадал за столько попыток — идеально
  guesses: BarcodeGuess[];
  note: BarcodeNote | null;
  noteAt: number;
  result: Outcome | null;
};

/** Игра, которая идёт сейчас (одна за раз). */
export type TsdGame = DepthGame | ExpiryGame | BarcodeGame;
