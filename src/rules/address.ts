// Адреса: единственное место, где адрес разбирается и превращается в строку (CLAUDE.md, «Система адресов»).
import type { Address } from '../model/address';
import type { WarehouseMap } from '../model/warehouse';

const ADDRESS_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** '3.2.1' → { aisle: 3, rack: 2, shelf: 1 }. Неверная строка — ошибка. */
export function parseAddress(text: string): Address {
  const m = ADDRESS_PATTERN.exec(text.trim());
  if (!m) throw new Error(`Неверный адрес: «${text}». Ожидается аллея.стеллаж.полка, например 3.2.1`);
  const [aisle, rack, shelf] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (aisle < 1 || rack < 1 || shelf < 1) throw new Error(`Неверный адрес: «${text}». Номера начинаются с 1`);
  return { aisle, rack, shelf };
}

/** { aisle: 3, rack: 2, shelf: 1 } → '3.2.1'. Так адрес показывается везде: на ТСД, в заданиях, на сцене. */
export function formatAddress(a: Address): string {
  return `${a.aisle}.${a.rack}.${a.shelf}`;
}

/** Строка-ключ для словарей. Совпадает с видом адреса на экране. */
export const addressKey = formatAddress;

export function sameAddress(a: Address, b: Address): boolean {
  return a.aisle === b.aisle && a.rack === b.rack && a.shelf === b.shelf;
}

/** Есть ли такая полка на складе. */
export function isValidAddress(map: WarehouseMap, a: Address): boolean {
  const rack = map.racks.find((r) => r.aisle === a.aisle && r.rack === a.rack);
  return !!rack && Number.isInteger(a.shelf) && a.shelf >= 1 && a.shelf <= rack.shelves;
}

/** Все адреса склада по порядку: 1.1.1, 1.1.2, … */
export function allAddresses(map: WarehouseMap): Address[] {
  return map.racks.flatMap((r) =>
    Array.from({ length: r.shelves }, (_, i) => ({ aisle: r.aisle, rack: r.rack, shelf: i + 1 })),
  );
}
