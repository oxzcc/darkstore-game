// Начальный запас склада на старте кампании (02, раздел 4: «на складе есть начальный запас»).
// 15 полок из 36 заняты, остальные свободны под выкладку новых поставок (компактный склад, 16.10).
// Срок годности считается от первой смены: смена старта + срок товара.

export type InitialStockEntry = { productId: string; address: string; qty: number };

export const CAMPAIGN_START_SHIFT = 1;

export const INITIAL_STOCK: InitialStockEntry[] = [
  { productId: 'milk',    address: '1.1.1', qty: 8 },
  { productId: 'milk',    address: '2.3.2', qty: 6 },
  { productId: 'coffee',  address: '1.2.1', qty: 7 },
  { productId: 'bread',   address: '1.2.3', qty: 7 },
  { productId: 'bread',   address: '3.1.1', qty: 9 },
  { productId: 'yogurt',  address: '1.3.2', qty: 7 },
  { productId: 'bananas', address: '1.4.1', qty: 9 },
  { productId: 'bananas', address: '3.2.3', qty: 7 },
  { productId: 'eggs',    address: '2.2.1', qty: 10 },
  { productId: 'pasta',   address: '2.2.3', qty: 9 },
  { productId: 'juice',   address: '2.1.3', qty: 10 },
  { productId: 'chips',   address: '2.4.2', qty: 8 },
  { productId: 'cookies', address: '3.3.1', qty: 9 },
  { productId: 'water',   address: '3.3.3', qty: 10 },
  { productId: 'cheese',  address: '3.4.2', qty: 6 },
];

/**
 * Партии «истекает сегодня» на старте (M7e1; решение автора 14.10, вариант «а»: пока в игре нет календаря смен).
 * Докладываются к тем же товарам на полки, где есть место; по ним приходят задания «Списание».
 * Такие партии не продаются: заказы их не обещают и не берут. С M8 просрочка будет считаться по настоящему сроку.
 */
export const EXPIRING_STOCK: InitialStockEntry[] = [
  { productId: 'cheese',  address: '3.4.2', qty: 3 },
  { productId: 'bread',   address: '1.2.3', qty: 2 },
  { productId: 'yogurt',  address: '1.3.2', qty: 3 },
  { productId: 'bananas', address: '3.2.3', qty: 2 },
];
