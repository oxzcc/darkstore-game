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
 * Этикетка со сроком у каждой штуки на своей стороне (0 — перед, 1 — право, 2 — зад, 3 — лево; решение автора 14.10).
 * Сроки — в днях от сегодня (0 — сегодня). Подходит ровно одна штука: срок не раньше need.
 */
export type ExpiryUnit = { days: number; side: number; seen: boolean };

/** Что ТСД сказал на последнее действие. */
export type ExpiryNote = 'taken' | 'timeout';

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
  units: ExpiryUnit[];
  open: number | null;   // какая штука поднята крупно (её крутят и читают этикетку)
  taken: number | null;  // какую взяли — для итога
  note: ExpiryNote | null;
  noteAt: number;
  result: Outcome | null;
};

/** Игра, которая идёт сейчас (одна за раз). */
export type TsdGame = DepthGame | ExpiryGame;
