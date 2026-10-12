// «Взять ТСД» и сессия мини-игры (docs/06-minigames.md, раздел 10; docs/09-architecture.md, раздел 6).
import type { Address } from './address';

/** Висит предложение «Взять ТСД?»: сборщик стоит и ждёт ответа игрока. */
export type TsdOffer = {
  taskId: string;
  pickerId: string;
  expiresAt: number; // игровое время, когда предложение сгорит и сборщик пойдёт работать сам
};

/** Стеллаж по номеру аллеи и номеру в аллее (адрес без полки). */
export type RackRef = { aisle: number; rack: number };

/** Что фактически сделано в «Сборке»: взята одна штука товара с полки в позицию заказа (06, раздел 5). */
export type PickingAction = { kind: 'take'; lineIndex: number; productId: string; address: Address };

/** Ошибка по ходу мини-игры (06, раздел 4). M5e1 — только «товар не из заказа». */
export type MinigameError = {
  kind: 'wrong_product' | 'wrong_shelf' | 'wrong_qty' | 'wrong_expiry' | 'phantom_accept';
  severity: 'minor' | 'normal' | 'major';
  address?: Address;
};

/** Ответ ТСД на последний скан — для строки сообщения на экране. */
export type ScanFeedback = {
  result: 'taken' | 'notInOrder' | 'shelfEmpty';
  productId: string;
  address: Address;
  lineIndex: number | null; // в какую позицию взято (для 'taken')
  at: number;               // session.elapsed в момент скана: по нему экран понимает, что скан новый
};

/**
 * Идёт личная мини-игра «Сборка» (06, разделы 2 и 5). Игрок выбирает стеллаж — сборщик идёт к нему;
 * дошёл — камера у стеллажа (atFocus), клик по товару — скан одной штуки.
 * Остатки склада во время сессии не меняются: всё копится в actions (09, раздел 6.2).
 */
export type MinigameSession = {
  taskId: string;
  pickerId: string;
  startedAt: number;       // игровое время
  elapsed: number;         // сколько секунд идёт сборка — в темпе своего сборщика, а не замедленного мира
  focus: RackRef | null;   // выбранный стеллаж (подсвечен на сцене, сборщик идёт к нему)
  atFocus: boolean;        // сборщик дошёл, камера у стеллажа; false — общий вид склада
  actions: PickingAction[];
  errors: MinigameError[];
  lastScan: ScanFeedback | null;
};
