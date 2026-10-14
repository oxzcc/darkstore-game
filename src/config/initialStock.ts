// Начальный запас склада на старте кампании (02, раздел 4: «на складе есть начальный запас»).
// 32 полки из 96 заняты, остальные свободны под выкладку новых поставок.
// Срок годности считается от первой смены: смена старта + срок товара.

export type InitialStockEntry = { productId: string; address: string; qty: number };

export const CAMPAIGN_START_SHIFT = 1;

export const INITIAL_STOCK: InitialStockEntry[] = [
  { productId: 'milk',    address: '1.1.1', qty: 8 },
  { productId: 'milk',    address: '2.3.2', qty: 6 },
  { productId: 'milk',    address: '4.5.1', qty: 10 },
  { productId: 'bread',   address: '1.2.3', qty: 7 },
  { productId: 'bread',   address: '3.1.1', qty: 9 },
  { productId: 'bread',   address: '4.4.2', qty: 6 },
  { productId: 'yogurt',  address: '1.3.2', qty: 10 },
  { productId: 'yogurt',  address: '2.5.4', qty: 8 },
  { productId: 'yogurt',  address: '3.6.1', qty: 6 },
  { productId: 'bananas', address: '1.4.1', qty: 9 },
  { productId: 'bananas', address: '3.2.3', qty: 7 },
  { productId: 'bananas', address: '4.1.1', qty: 8 },
  { productId: 'eggs',    address: '1.5.2', qty: 6 },
  { productId: 'eggs',    address: '2.2.1', qty: 10 },
  { productId: 'eggs',    address: '4.6.3', qty: 7 },
  { productId: 'cheese',  address: '1.6.4', qty: 8 },
  { productId: 'cheese',  address: '3.4.2', qty: 6 },
  { productId: 'cheese',  address: '2.6.1', qty: 9 },
  { productId: 'juice',   address: '2.1.3', qty: 10 },
  { productId: 'juice',   address: '4.3.4', qty: 8 },
  { productId: 'cookies', address: '1.1.4', qty: 7 },
  { productId: 'cookies', address: '3.3.1', qty: 9 },
  { productId: 'cookies', address: '4.2.2', qty: 6 },
  { productId: 'chips',   address: '2.4.2', qty: 8 },
  { productId: 'chips',   address: '3.5.3', qty: 10 },
  { productId: 'chips',   address: '1.3.4', qty: 7 },
  { productId: 'pasta',   address: '2.2.4', qty: 9 },
  { productId: 'pasta',   address: '4.5.3', qty: 6 },
  { productId: 'coffee',  address: '3.1.4', qty: 7 },
  { productId: 'coffee',  address: '1.5.1', qty: 8 },
  { productId: 'water',   address: '2.6.3', qty: 10 },
  { productId: 'water',   address: '4.1.4', qty: 9 },
];
