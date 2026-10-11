// Цвета мира из docs/08-art-style.md, раздел 3.1. Все цвета сцены берутся отсюда.
import type { ZoneType } from '../model/warehouse';

export const PALETTE = {
  primary: '#428C00',
  grass: '#93DE44',
  floor: '#FFFFFA',
  wall: '#B7B6B8',
  wallPillar: '#428C00',
  wood: '#C8A97B',
  metal: '#554B4E',
  road: '#656971',
};

/** Цвет пола зон. Заглушка: в 08 зоны размечены линиями, пока просто подкрашенный пол. */
export const ZONE_FLOOR_COLORS: Record<ZoneType, string> = {
  receiving: '#FFE7A3', // жёлтая разметка приёмки
  storage: PALETTE.floor,
  packing: '#D8F0BC',   // зелёная рамка фасовки и выдачи
  scrap: '#F8C9C7',     // красная штриховка брака
  rest: PALETTE.wood,   // деревянный пол зоны отдыха
};
