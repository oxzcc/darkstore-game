// Сборщики: создание стартовой команды. Опыт, усталость и перерывы появятся в M8.
import type { Picker } from '../model/picker';
import type { TaskType } from '../model/task';
import type { Cell, WarehouseMap } from '../model/warehouse';
import type { PickerTemplate } from '../config/pickers';
import { START_SPECIALIZATION_LEVEL } from '../config/pickers';
import { blockedCells, isRestSeat } from './warehouse';

const TASK_TYPES: TaskType[] = ['order', 'putaway', 'receiving', 'writeoff'];

/** Клетки зоны отдыха по порядку, кроме дивана, кулера и растения: здесь сборщики стоят на старте смены (07, раздел 2). */
function restCells(map: WarehouseMap): Cell[] {
  const blocked = blockedCells(map);
  return allRestCells(map).filter((c) => !blocked.has(`${c.x},${c.z}`) && !isRestSeat(map, c));
}

function allRestCells(map: WarehouseMap): Cell[] {
  const rest = map.zones.find((z) => z.type === 'rest');
  if (!rest) throw new Error('На карте нет зоны отдыха');
  const cells: Cell[] = [];
  for (let z = rest.from.z; z <= rest.to.z; z++) {
    for (let x = rest.from.x; x <= rest.to.x; x++) cells.push({ x, z });
  }
  return cells;
}

/** Места, как можно дальше друг от друга: соседние клетки — 1 м, а собака с тележкой шире, фигурки налезали (прогон 18.10).
 *  Первое — первая свободная клетка, каждое следующее — самое далёкое от уже выбранных (при равенстве — раньше по порядку). */
function spreadCells(cells: Cell[], count: number): Cell[] {
  const chosen: Cell[] = cells.slice(0, Math.min(1, count));
  const d2 = (a: Cell, b: Cell) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  while (chosen.length < count && chosen.length < cells.length) {
    let best: Cell | null = null;
    let bestDist = -1;
    for (const c of cells) {
      if (chosen.includes(c)) continue;
      const dist = Math.min(...chosen.map((x) => d2(x, c)));
      if (dist > bestDist) { best = c; bestDist = dist; }
    }
    chosen.push(best!);
  }
  return chosen;
}

/** Стартовая команда: все свободны, без усталости, специализации на стартовом уровне. */
export function createPickers(templates: PickerTemplate[], map: WarehouseMap): Record<string, Picker> {
  const spots = spreadCells(restCells(map), templates.length);
  if (templates.length > spots.length) throw new Error('Сборщиков больше, чем мест в зоне отдыха');
  const result: Record<string, Picker> = {};
  templates.forEach((t, i) => {
    result[t.id] = {
      id: t.id,
      name: t.name,
      breed: t.breed,
      color: t.color,
      state: 'idle',
      taskId: null,
      stats: { speed: t.speed, accuracy: t.accuracy, fatigue: 0 },
      specialization: Object.fromEntries(
        TASK_TYPES.map((type) => [type, { level: START_SPECIALIZATION_LEVEL, xp: 0 }]),
      ) as Picker['specialization'],
      position: spots[i],
      path: [],
      pathProgress: 0,
      workEndsAt: null,
      job: null,
    };
  });
  return result;
}
