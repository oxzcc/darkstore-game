// Цвета мира из docs/08-art-style.md, раздел 3.1. Все цвета сцены берутся отсюда.
import type { ZoneType } from '../model/warehouse';

export const PALETTE = {
  primary: '#428C00',
  grass: '#93DE44',
  floor: '#FFFFFA',
  floorGrid: '#E9E8DF', // швы плитки
  // стены и ворота по art/reference/world_wall.png и world_gates.png (M9b3)
  wallPanel: '#EEEEEC',      // белые панели
  wallPilaster: '#FAFAF8',   // пилястры и карниз
  wallPlinth: '#A9AAAE',     // серый цоколь
  wallSeam: '#D8D8D6',       // шов панели
  wallAccent: '#6DB52F',     // зелёные вставки, кромки, столбики-отбойники
  wallAccentSeam: '#5A9A25', // шов на зелёной вставке, колпаки столбиков
  concrete: '#CFCFCB',       // бетонная площадка у ворот
  wood: '#C8A97B',
  box: '#E9CB98',       // картонная коробка с товаром (светлее дерева полок)
  metal: '#554B4E',
  metalDark: '#3B3437',  // прорези и «башмаки» стоек стеллажа (M9b1)
  rackBoard: '#E8D2A6',  // светлый настил полок (art/reference/world_shelving_unit.png)
  road: '#656971',
  closeupFog: '#F3EFE4', // дымка вдали в виде стеллажа вблизи (светлая и тёплая) и фон за ней
  // грузовик по art/reference/world_transport_truck.png (M7b)
  truckCab: '#76BE34',   // зелёная кабина
  truckBody: '#F3F3F1',  // белый фургон
  truckTrim: '#C9C9CC',  // серые уголки фургона, бампер, диски
  truckDark: '#34373C',  // шины, стёкла, рама
  truckLight: '#FFFFFF', // фары
  boxTape: '#F4E6C8',    // скотч на коробках паллеты (art/reference/world_palete.png)
  // M9b2: паллета и стол фасовки (art/reference/world_palete.png, world_packaging_table.png)
  palletWood: '#DDBB85',  // доски поддона и рулон скотча (светлее брусков)
  tableTop: '#ECE6DA',    // столешница
  bin: '#7E838B',         // серые лотки под столом
  accentGreen: '#76BE34', // зелёные детали предметов (боковина диспенсера)
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
