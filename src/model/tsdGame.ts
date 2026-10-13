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
};

/** Что ТСД сказал на последний клик — строка на экране. */
export type DepthNote = 'moved' | 'stuck' | 'notFront' | 'taken' | 'timeout';

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

/** Игра, которая идёт сейчас (одна за раз). Другие виды добавятся сюда же. */
export type TsdGame = DepthGame;
