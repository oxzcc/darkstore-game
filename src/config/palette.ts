// Цвета мира из docs/08-art-style.md, раздел 3.1. Все цвета сцены берутся отсюда.
import type { ZoneType } from '../model/warehouse';

export const PALETTE = {
  primary: '#428C00',
  grass: '#93DE44',
  floor: '#FFFFFA',
  floorGrid: '#E9E8DF', // швы плитки
  wall: '#B7B6B8',
  wallPillar: '#428C00',
  wood: '#C8A97B',
  box: '#E9CB98',       // картонная коробка с товаром (светлее дерева полок)
  metal: '#554B4E',
  road: '#656971',
};

/** Как выглядит зона на полу (08, раздел 6). */
export type ZoneLook = {
  fill: string | null;                 // заливка пола зоны или null
  outline: 'dashed' | null;            // пунктирная рамка
  hatch: boolean;                      // диагональная штриховка
  markColor: string;                   // цвет рамки/штриховки
};

export const ZONE_LOOK: Record<ZoneType, ZoneLook> = {
  receiving: { fill: null,       outline: 'dashed', hatch: false, markColor: '#F2BE22' }, // жёлтая пунктирная разметка
  storage:   { fill: null,       outline: null,     hatch: false, markColor: PALETTE.floor },
  packing:   { fill: '#EEF8E2',  outline: 'dashed', hatch: false, markColor: '#7FC743' }, // зелёная пунктирная рамка
  scrap:     { fill: '#FCE6E5',  outline: null,     hatch: true,  markColor: '#F0373B' }, // красная штриховка
  rest:      { fill: PALETTE.wood, outline: null,   hatch: false, markColor: PALETTE.wood }, // деревянный пол
};

/** Жёлтые сплошные линии главных проходов. */
export const PASSAGE_LINE_COLOR = '#F2BE22';
