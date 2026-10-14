// Поставки и паллеты (docs/03-warehouse-flow.md, разделы 4 и 8; docs/09-architecture.md, раздел 4.3; docs/10, раздел 13.2).
// Расхождений накладной и факта больше нет (10, раздел 11.6): что на паллете, то и принимается.
import type { Cell } from './warehouse';

/** Жизненный цикл паллеты (03, раздел 8). «В грузовике» не храним: паллеты выгружаются сразу при приезде. */
export type PalletState = 'inReceiving' | 'accepted' | 'unpacked' | 'empty';

export type PalletItem = { productId: string; qty: number };

export type Pallet = {
  id: string;
  deliveryId: string;
  state: PalletState;
  items: PalletItem[];
  cell: Cell; // где стоит в зоне приёмки (место из DELIVERY.palletSlots)
};

/** atGate — грузовик стоит у ворот, ждёт приёмки; received — принята, грузовик уехал. */
export type DeliveryStatus = 'atGate' | 'received';

export type Delivery = {
  id: string;
  number: number;     // как у задания приёмки: «Поставка №7»
  status: DeliveryStatus;
  palletIds: string[];
  arrivedAt: number;  // игровое время
};
