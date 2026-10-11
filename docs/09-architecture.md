# 09. Архитектура

Этот документ описывает, как игра устроена в коде: какие есть слои, где что лежит, как выглядят данные и как они текут от клика игрока до 3D-сцены. Правила игры — в `02`–`07`, здесь только то, как их реализовать. Черновики моделей данных из `03`, `05`, `06` и `07` сведены здесь в окончательную версию.

**Правило для разработки:** если код противоречит этому документу, сначала обсуди, а потом меняй либо код, либо документ. Где решение не принято, стоит пометка «ОТКРЫТО»; «Допущение» — предложено для первой версии, автор ещё не подтвердил.

## 1. Главная идея в одной картинке

```
         клик игрока                       таймер (каждый кадр)
              │                                    │
              ▼                                    ▼
   ┌──────────────────┐   вызывает    ┌──────────────────────┐
   │   ui / minigames │ ────────────► │   store (Zustand)    │  ← единственный источник правды
   └──────────────────┘   действия    │   действия = обёртки │
              ▲                       └──────────┬───────────┘
              │ читают состояние                 │ вызывает чистые функции
   ┌──────────┴───────┐                          ▼
   │      scene       │               ┌──────────────────────┐
   │ (только рисует)  │               │   rules (чистый TS)  │  ← вся логика игры, покрыта тестами
   └──────────────────┘               └──────────────────────┘
                                                 │ читает числа
                                                 ▼
                                      ┌──────────────────────┐
                                      │   config (данные)    │  ← баланс, типы заданий, товары
                                      └──────────────────────┘
```

Простыми словами:

- **rules** — «мозг»: знает правила, но ничего не помнит и ничего не рисует. Получает состояние, возвращает новое состояние.
- **store** — «память»: хранит текущее состояние игры и вызывает rules, когда что-то происходит.
- **scene** и **ui** — «глаза и руки»: показывают состояние и передают клики игрока в store.
- **minigames** — отдельные экраны ТСД: получают задание, возвращают результат.
- **config** — все числа, которые хочется крутить без переписывания кода.

## 2. Структура папок

```
src/
  main.tsx              — точка входа
  App.tsx               — собирает экран: сцена + интерфейс + окно ТСД
  app/
    GameLoop.tsx        — невидимый компонент, двигает время (раздел 7)

  model/                — только типы TypeScript, без логики
    address.ts
    warehouse.ts        — клетки, стеллажи, зоны, карта
    product.ts
    stock.ts
    task.ts
    picker.ts
    game.ts             — GameState целиком
    results.ts          — результаты мини-игр и заданий

  config/               — данные и числа баланса
    balance.ts          — длительность смены, скорость мира, награды, штрафы
    taskTypes.ts        — описание типов заданий (пример в 04-tasks.md, раздел 9)
    products.ts         — каталог товаров
    pickers.ts          — стартовые сборщики
    warehouse.ts        — планировка склада (см. 07-warehouse-map.md)

  rules/                — чистый TypeScript, без React и без 3D
    address.ts          — разбор, форматирование и проверка адреса
    random.ts           — генератор случайных чисел с зерном
    warehouse.ts        — карта, клетки, поиск пути, время дороги (см. 07-warehouse-map.md)
    stock.ts            — учётные и фактические остатки
    tasks/
      generator.ts      — появление новых заданий
      lifecycle.ts      — смена статусов задания
      deadline.ts       — расчёт сроков
    outcome.ts          — шансы исходов, бросок исхода, применение результата
    pickers.ts          — опыт, усталость, перерыв
    shift.ts            — начало и конец смены, итоги
    advance.ts          — продвижение мира на dt (раздел 7)
    *.test.ts           — тесты лежат рядом с файлами

  store/
    gameStore.ts        — Zustand-хранилище и действия
    selectors.ts        — готовые выборки для ui и scene
    persist.ts          — сохранение в браузере (раздел 12)

  minigames/
    types.ts            — общий контракт мини-игры (раздел 6)
    registry.ts         — какой компонент для какого типа задания
    TsdFrame.tsx        — рамка «экрана ТСД», общая для всех мини-игр
    picking/            — мини-игра «Сборка» (M5)
    putaway/            — «Выкладка» (M7)
    receiving/          — «Приёмка» (M7)
    writeoff/           — «Списание» (M7)

  scene/                — React Three Fiber, только отображение
    Scene.tsx           — камера, свет, корень сцены
    Warehouse.tsx       — пол, стены, зоны, стеллажи
    Pickers.tsx         — сборщики и их движение
    Trucks.tsx, Pallets.tsx, TaskMarkers.tsx
    models/             — воксельные модели из кубов, один файл на модель (CLAUDE.md, «Графика»)

  ui/                   — обычный React-интерфейс поверх сцены
    TaskPanel.tsx       — панель заданий
    PickerPanel.tsx     — панель сборщиков
    AssignDialog.tsx    — окно назначения (с автопаузой)
    TopBar.tsx          — время смены, деньги, рейтинг, пауза, скорость
    ShiftSummary.tsx    — итоги смены
    theme.css           — цвета, шрифт, аутлайны

public/
  fonts/                — X5 Sans (.woff и .ttf)
  assets/               — картинки и модели, которые грузит игра

art/reference/          — исходные ассеты и макеты (в игру напрямую не грузятся)
docs/                   — эти документы
```

## 3. Правила импортов между слоями

Кто кого может импортировать. Если хочется нарушить правило, это сигнал, что логика оказалась не в том слое.

| Слой | Может импортировать | Нельзя импортировать |
|---|---|---|
| `model` | ничего | всё |
| `config` | `model` | `rules`, `store`, React |
| `rules` | `model`, `config` | `store`, `scene`, `ui`, `minigames`, React, three.js |
| `store` | `model`, `config`, `rules` | `scene`, `ui`, `minigames` |
| `minigames` | `model`, `config`, `rules/address.ts` (только форматирование) | `store`, `scene` |
| `scene` | `model`, `config`, `store` (только чтение), `rules/warehouse.ts` (только `cellToWorld`) | остальные `rules`, `ui` |
| `ui` | `model`, `config`, `store`, `minigames` | `scene` |

Главные запреты:

- **Сцена никогда не меняет состояние.** Клик по объекту в сцене вызывает действие store (например, «выбрать сборщика»), а не меняет данные сам.
- **Мини-игра не трогает store.** Она возвращает результат через `onFinish`, дальше разбирается store.
- **rules не знает про React.** Поэтому его можно тестировать без браузера.

## 4. Модель данных

Все типы лежат в `src/model/`. Общие правила:

- **Состояние игры — обычный JSON.** Только объекты, массивы, строки, числа и `boolean`. Никаких классов, `Map`, `Set`, `Date` и функций внутри состояния. Так его легко сохранить, сравнить в тесте и вывести в консоль.
- **Ссылки по `id`, а не вложением.** Задание хранит `assignedPickerId`, а не самого сборщика.
- **Коллекции — словари по `id`:** `Record<string, Task>`. Так любое задание находится одной строкой.
- **Время — игровые секунды** (число). Срок годности — в сменах.

### 4.1 Адрес

```ts
// model/address.ts
export type Address = {
  aisle: number;   // аллея
  rack: number;    // стеллаж
  shelf: number;   // полка
};
```

Функции в `rules/address.ts`: `parseAddress('1.2.3')`, `formatAddress(addr)`, `addressKey(addr)` (строка для ключей словарей), `sameAddress(a, b)`, `isValidAddress(map, addr)` (есть ли такая полка на карте, `07-warehouse-map.md`, раздел 5.4). Больше нигде адрес строкой не собирается (см. CLAUDE.md).

### 4.1а Карта склада

Типы из `07-warehouse-map.md`, раздел 9:

```ts
// model/warehouse.ts
export type Cell = { x: number; z: number };   // клетка сетки, целые числа

export type ZoneType = 'receiving' | 'storage' | 'packing' | 'scrap' | 'rest';

export type Zone = { type: ZoneType; from: Cell; to: Cell; access: Cell };

export type Rack = {
  aisle: number;
  rack: number;
  shelves: number;
  cell: Cell;      // где стоит стеллаж
  access: Cell;    // клетка прохода перед ним
};

export type WarehouseMap = {
  width: number;
  depth: number;
  racks: Rack[];   // генерируются функцией из чисел в config/warehouse.ts
  zones: Zone[];
};
```

Карта не меняется во время игры, поэтому лежит в `config`, а не в `GameState`. Если склад начнёт расти (улучшения), её перенесут в состояние.

### 4.2 Товары и остатки

```ts
// model/product.ts
export type Product = {
  id: string;
  name: string;
  shelfLifeShifts: number;  // срок годности в сменах
  icon?: string;            // путь к картинке в public/assets
};

// model/stock.ts
export type StockRecord = {
  id: string;
  productId: string;
  address: Address;
  bookQty: number;          // учётное количество (что думает система)
  actualQty: number;        // фактическое количество (что реально на полке)
  expiresAtShift: number;   // номер смены, после которой товар просрочен
};
```

Ключевое из `03-warehouse-flow.md`: **два количества**. Пример ошибки выкладки «не та полка»: по адресу A запись `bookQty: 5, actualQty: 0`, по адресу B запись `bookQty: 0, actualQty: 5`. Сборщик пойдёт на A по учёту и ничего не найдёт.

Допущение (из `03`): на одной полке один вид товара, но может быть несколько записей с разным сроком годности (партии). Поэтому записи — отдельные строки, а не одна на адрес.

### 4.3 Поставки и паллеты

```ts
export type PalletState = 'inTruck' | 'inReceiving' | 'accepted' | 'unpacked' | 'empty';

export type Pallet = {
  id: string;
  deliveryId: string;
  state: PalletState;
  invoiceItems: { productId: string; qty: number }[];  // по накладной
  actualItems:  { productId: string; qty: number }[];  // что реально приехало
};

export type Delivery = {
  id: string;
  palletIds: string[];
  arrivedAt: number;
};
```

`actualItems` игрок заранее не видит: это нужно, чтобы rules могли проверить ошибки приёмки.

### 4.4 Задания

Общая часть одинакова для всех типов, `payload` разный. В TypeScript это «размеченное объединение»: по полю `type` компилятор сам понимает, какой `payload` внутри.

```ts
// model/task.ts
export type TaskType = 'order' | 'putaway' | 'receiving' | 'writeoff';

export type TaskStatus =
  | 'new' | 'assigned' | 'pickerEnRoute' | 'pickerArrived'
  | 'inProgress' | 'done' | 'expired';

export type Outcome = 'perfect' | 'withErrors' | 'failed';

type TaskBase = {
  id: string;
  status: TaskStatus;
  createdAt: number;
  deadline: number;
  difficulty: 1 | 2 | 3;
  reward: { money: number; rating: number };
  location: TaskLocation;          // адрес или зона
  assignedPickerId: string | null;
  mode: 'personal' | 'delegated' | null;  // лично или поручено
  outcome: Outcome | null;
};

export type TaskLocation =
  | { kind: 'address'; address: Address }
  | { kind: 'zone'; zone: 'receiving' | 'packing' | 'scrap' };

export type Task =
  | (TaskBase & { type: 'order';     payload: OrderPayload })
  | (TaskBase & { type: 'putaway';   payload: PutawayPayload })
  | (TaskBase & { type: 'receiving'; payload: ReceivingPayload })
  | (TaskBase & { type: 'writeoff';  payload: WriteoffPayload });

export type OrderPayload = {
  lines: { productId: string; address: Address; qty: number }[];
};
export type PutawayPayload   = { palletId: string };
export type ReceivingPayload = { deliveryId: string };
export type WriteoffPayload  = { stockRecordId: string; qty: number };
```

### 4.5 Сборщики

```ts
// model/picker.ts
export type PickerState = 'idle' | 'walking' | 'waiting' | 'working' | 'playing' | 'resting';

export type Picker = {
  id: string;
  name: string;
  color: string;                 // цвет на сцене и в UI (не пересекается с цветами исходов)
  state: PickerState;
  taskId: string | null;
  stats: { speed: number; accuracy: number; fatigue: number };
  specialization: Record<TaskType, { level: number; xp: number }>;
  position: Cell;                // клетка склада, где стоит (свободный стоит там, где закончил, 07, раздел 2)
  path: Cell[];                  // маршрут, если идёт
  pathProgress: number;          // сколько клеток пути пройдено (может быть дробным)
  workEndsAt: number | null;     // когда закончит перерыв (M8)
  job: PickerJob | null;         // текущая работа: шаги «идти → собрать → … → фасовать» и где он сейчас (M4)
  // на будущее (05-pickers.md, раздел 2): пока не используются
  description?: string;
  traits?: string[];
};
```

Шансы исходов (`PickerOutcomeChances`) **не хранятся**: их каждый раз считает функция в `rules/outcome.ts` (раздел 5).

### 4.6 Состояние игры целиком

```ts
// model/game.ts
export type GameState = {
  version: number;               // версия формата, для будущих сохранений
  rngSeed: number;               // текущее состояние генератора случайностей
  nextId: number;                // счётчик для новых id

  campaign: { shiftIndex: number; totalShifts: number; isTutorial: boolean };
  clock: {
    time: number;                // игровое время внутри смены, секунды
    paused: boolean;
    playerSpeed: 1 | 2;          // кнопка скорости ×2
  };
  money: number;
  rating: number;

  products: Record<string, Product>;
  stock: Record<string, StockRecord>;
  deliveries: Record<string, Delivery>;
  pallets: Record<string, Pallet>;
  tasks: Record<string, Task>;
  pickers: Record<string, Picker>;

  activeMinigameTaskId: string | null;  // какое задание сейчас играется лично
  shiftLog: ShiftEvent[];               // что случилось за смену (для итогов)
};
```

Выбор в интерфейсе (какое задание выделено, открыто ли окно назначения) — это **не** игровое состояние. Он лежит в отдельной маленькой части store (`ui`), не сохраняется и не попадает в rules.

## 5. Слой rules

Все функции чистые: одинаковый вход → одинаковый выход, ничего не меняют снаружи. Основные:

| Функция | Что делает |
|---|---|
| `parseAddress`, `formatAddress` | адреса |
| `getRackCell(address)`, `getAccessPoint(location)` | клетка стеллажа и клетка, куда идёт сборщик (`07`, раздел 6) |
| `cellToWorld(cell)` | клетка → координаты 3D-сцены; единственное место, где известен размер клетки |
| `findPath(map, from, to)` | путь по проходам без диагоналей (поиск в ширину, без библиотек) |
| `travelTime(picker, path)` | время дороги с учётом скорости и усталости; то же число показывается на карточке |
| `taskDeadline(task, now)` | срок по формуле из `04-tasks.md`, раздел 4.1 |
| `generateTasks(state, dt, rng)` | новые задания по весам и загрузке |
| `canAssign(state, taskId, pickerId)` | можно ли назначить (свободен ли, не просрочено ли) |
| `assignPicker(state, taskId, pickerId)` | назначение и построение маршрута |
| `outcomeChances(picker, task)` | вероятности трёх исходов и время выполнения |
| `simulateTask(state, task, picker, rng)` | результат поручённого задания |
| `resultFromMinigame(task, minigameResult)` | результат личного задания |
| `applyTaskResult(state, taskId, result)` | применяет исход: деньги, рейтинг, остатки, опыт, усталость |
| `advanceWorld(state, dt, rng)` | продвигает мир на `dt` (раздел 7) |
| `endShift(state)` / `startShift(state)` | итоги смены, сброс усталости, просрочка товаров |

### 5.1 Один путь к исходу

Исход может прийти двумя дорогами (лично или поручено), но **применяется одной функцией**:

```
лично:     мини-игра → MinigameResult → resultFromMinigame ─┐
                                                            ├→ TaskResult → applyTaskResult
поручено:  outcomeChances → simulateTask (бросок) ──────────┘
```

`TaskResult` содержит не только исход, но и **что физически сделано**: сколько и чего принято, на какую полку что выложено, сколько собрано. Именно из этого `applyTaskResult` меняет `bookQty` и `actualQty`. Так последствия ошибок (`02-gameplay-loop.md`, раздел 8) работают одинаково при личной игре и при поручении.

```ts
// model/results.ts (сокращённо)
export type TaskResult = {
  outcome: Outcome;
  durationSec: number;
  effects: TaskEffects;   // что изменить на складе; свой вид у каждого типа задания
  notes: string[];        // причины для игрока: «товара нет по адресу 1.2.3»
};
```

`outcomeChances` — **единственное место**, где считаются шансы. Его же вызывает карточка сборщика в UI (через selector), поэтому игрок видит ровно те шансы, по которым потом бросается исход. Формулы — ОТКРЫТО (`05-pickers.md`, раздел 4).

### 5.2 Случайность

- В rules **нельзя** вызывать `Math.random()`. Случайность приходит параметром `rng` из `rules/random.ts` (маленький генератор с зерном, около 10 строк, без библиотек).
- Зерно хранится в `GameState.rngSeed`. Плюс: в тесте можно задать зерно и получить один и тот же результат каждый раз, а баг можно воспроизвести.
- id новых объектов тоже берутся из счётчика `nextId`, а не случайно.

## 6. Мини-игры

### 6.1 Контракт

Каждая мини-игра — React-компонент с одинаковым входом и выходом. Это окончательная версия черновика из `06-minigames.md`, раздел 10:

```ts
// minigames/types.ts
export type MinigameProps<T extends Task = Task> = {
  task: T;
  products: Record<string, Product>;
  view: MinigameView;            // что показывает ТСД: данные системы (учётные адреса и количества)
  actual: MinigameActual;        // что сборщик реально увидит на месте: фактические полки и паллеты
  modifiers: PickerModifiers;    // влияние сборщика (06, раздел 9), считает rules
  difficulty: MinigameDifficulty; // числа сложности из config (06, раздел 11)
  onFinish: (result: MinigameResult) => void;
};

export type MinigameError = {
  kind: 'wrong_shelf' | 'wrong_product' | 'wrong_qty' | 'wrong_expiry' | 'phantom_accept';
  severity: 'minor' | 'normal' | 'major';
  address?: Address;
};

export type MinigameResult = {
  durationSec: number;
  inTime: boolean;
  errors: MinigameError[];
  actions: MinigameAction[];     // что сделано: какой товар куда положен, сколько принято, что «не найдено»
};
```

Правила:

- Мини-игра получает **всё нужное через props** и ничего не читает из store сама.
- **Прервать мини-игру нельзя** (решение автора). В окне ТСД нет кнопки «закрыть»: начатую мини-игру нужно довести до конца. Передумать и поручить сборщику тоже нельзя, выбор окончательный. Ручная пауза при этом работает: останавливает и мир, и мини-игру (`06`, раздел 3).
- Мини-игра **не решает исход.** Она лишь записывает действия игрока, исход считает `resultFromMinigame` в rules. Так баланс правится в одном месте.
- Время внутри мини-игры идёт по реальным часам, а мир за её пределами — замедленно (раздел 7).
- `registry.ts` связывает тип задания с компонентом: `{ order: PickingGame, putaway: PutawayGame, ... }`. Окно ТСД в `ui` открывает нужную игру по `task.type`.

### 6.2 Почему `view` и `actual` разделены

ТСД показывает данные системы (учёт), а реальность может отличаться. Например, в мини-игре «Сборка» игрок идёт на адрес из учёта, а там пусто, потому что раньше была ошибка выкладки. Мини-игре нужны оба набора, чтобы честно показать «полка пустая». Готовит их store из `GameState` перед открытием окна.

Что из сборщика влияет на личную мини-игру — ОТКРЫТО (`05-pickers.md`, раздел 9). Поэтому мини-игра получает не самого сборщика, а только `modifiers`: когда решение примут, поменяется только расчёт `modifiers` в rules, а не сами мини-игры.

## 7. Время и игровой цикл

### 7.1 Кто двигает время

Время двигает **только** `app/GameLoop.tsx`: невидимый компонент, который каждый кадр браузера вызывает `store.tick(realDeltaSec)`.

- Не используем `useFrame` из R3F для логики: сцена может не отрисовываться (например, вкладка свёрнута), а логика от сцены зависеть не должна.
- Если кадр был слишком долгим (вкладку свернули), шаг обрезается до 0,1 секунды, чтобы мир не «прыгал».

### 7.2 Скорость мира

```
игровой dt = реальный dt × скорость игрока (1 или 2) × множитель режима
```

| Режим | Множитель (из `config/balance.ts`) |
|---|---|
| обычный | 1 |
| пауза (ручная или автопауза окна назначения) | 0 |
| идёт личная мини-игра | 0,2 (стартово, `02-gameplay-loop.md`, раздел 2) |

Время на паузе в 10 минут смены не засчитывается само собой: при множителе 0 игровое время не растёт.

### 7.3 Что происходит за один шаг

`advanceWorld(state, dt, rng)` по порядку:

1. Прибавить `dt` к `clock.time`.
2. Сдвинуть идущих сборщиков по маршруту; кто дошёл, переходит в `waiting`, задание — в `pickerArrived`.
3. Завершить поручённые работы, у которых наступил `workEndsAt` (через `simulateTask` → `applyTaskResult`).
4. Обновить перерывы (снижение усталости).
5. Пометить просроченные задания (`expired`), освободить их сборщиков (допущение из `04-tasks.md`, раздел 3).
6. Создать новые задания (`generateTasks`).
7. Если время смены вышло — перейти к итогам.

Функция возвращает новое состояние и список событий (`ShiftEvent`: «задание выполнено», «задание просрочено»), чтобы UI мог показать всплывающие сообщения.

### 7.4 Движение на сцене

Логика хранит маршрут сборщика и дробный прогресс по нему (`pathProgress`). Сцена каждый кадр берёт эти числа и плавно ставит фигурку между клетками. Сцена **ничего не решает**: если на паузе прогресс не меняется, фигурка стоит.

## 8. Store (Zustand)

Одно хранилище `useGameStore` с двумя частями:

- `game: GameState` — игровое состояние (раздел 4.6);
- `ui` — выделение, открытые окна, всплывающие сообщения.

Действия — тонкие обёртки над rules: взять состояние, вызвать чистую функцию, положить результат.

```ts
assign: (taskId, pickerId) =>
  set((s) => ({ game: assignPicker(s.game, taskId, pickerId) })),
```

Список действий (стартовый): `tick`, `togglePause`, `setPlayerSpeed`, `selectTask`, `openAssignDialog`, `closeAssignDialog`, `assign`, `choosePersonal`, `chooseDelegate`, `finishMinigame`, `sendToBreak`, `startNextShift`.

Правила:

- Логика (условия, расчёты) в действиях не пишется — только вызов rules.
- Компоненты подписываются на маленькие кусочки через `selectors.ts` (например, `selectPickerById`), чтобы не перерисовывать всё при каждом шаге времени. Это важно для скорости: `tick` меняет состояние каждый кадр.

## 9. Сцена (React Three Fiber)

- Ортографическая изометрическая камера, управление кликами (CLAUDE.md).
- Координаты: клетка склада `Cell {x, z}` = 1 воксельный блок = 1 метр (`07-warehouse-map.md`, раздел 1). Перевод клетки в 3D делает только `cellToWorld`, сцена сама размер клетки не знает.
- Компоненты получают данные через selectors и рисуют их. Клик по объекту вызывает действие store («выбрать сборщика», «выбрать задание»).
- Пока ассетов нет — заглушки из кубов с плоским цветом. Ассеты из `art/reference` подключаются на этапе M9 (или раньше, по решению автора); способ — в `08-art-style.md`.

## 10. Интерфейс

- Обычный React поверх `<Canvas>` (HTML-слой, не внутри 3D).
- Все числа на экране (шансы, время до места, награды) берутся из selectors, которые вызывают rules. UI сам ничего не считает.
- Шрифт X5 Sans подключается в `ui/theme.css` через `@font-face` из `public/fonts/`.
- Цвета, аутлайны, тени — переменные CSS в одном месте (`theme.css`), чтобы стиль правился без поиска по всем файлам.

## 11. Config

- Всё, что помечено в документах как «настраивается», живёт в `src/config/`.
- Config — обычные TypeScript-объекты с типами, например `TASK_TYPES` (`04-tasks.md`, раздел 9). Типы не дают ошибиться в названии поля.
- rules получает числа из config, а не пишет их прямо в коде. Если в rules появилось «магическое число», его место в config.

## 12. Сохранение

- Склад и кампания сохраняются между сменами (`02-gameplay-loop.md`, раздел 3).
- **Игра сохраняется в браузере** (решение автора): закрыл вкладку, открыл снова — кампания продолжается. Сохранение лежит в `localStorage` и делается через встроенное в Zustand дополнение `persist` (новая библиотека не нужна). Настройка — в `store/persist.ts`.
- Сохраняется только `game: GameState`. Часть `ui` (выделение, открытые окна) не сохраняется.
- Поле `version` в `GameState`: если формат состояния поменялся после обновления игры, старое сохранение не ломает игру. В первой версии допущение: при несовпадении версии старое сохранение просто сбрасывается и начинается новая кампания.
- Сохранение живёт в одном браузере на одном устройстве. Переноса между устройствами нет.
- ОТКРЫТО: когда именно сохранять (после каждого задания, раз в несколько секунд или только между сменами). Допущение: раз в несколько секунд и при закрытии вкладки; если игрок закрыл вкладку во время мини-игры, при возвращении она начинается заново.

## 13. Тесты

- Тестируется слой `rules` (CLAUDE.md). Тест лежит рядом с файлом: `outcome.ts` → `outcome.test.ts`.
- Тесты запускаются через **Vitest** (согласовано). Он сделан для проектов на Vite и понимает TypeScript без доп. настроек. Команда: `npm test`.
- Что проверять в первую очередь:
  - адреса: `parseAddress(formatAddress(a))` возвращает тот же адрес; неверные строки дают ошибку;
  - остатки: ошибка выкладки создаёт расхождение `bookQty`/`actualQty` ровно как в таблице `02`, раздел 8;
  - шансы исходов: три вероятности в сумме дают 1;
  - генератор заданий: не создаёт сборку на товар, которого нет в учёте;
  - время: на паузе ничего не меняется.

## 14. Что появляется на каком этапе

| Этап | Что добавляется в архитектуре |
|---|---|
| M0 | `main.tsx`, `App.tsx`, `scene/Scene.tsx` с кубом |
| M1 | камера, `scene/Warehouse.tsx`, `config/warehouse.ts` (зоны) |
| M2 | папка `model/`, `rules/address.ts`, `rules/stock.ts`, `config/products.ts`, `config/pickers.ts`, подключение Vitest и первые тесты |
| M3 | `store/gameStore.ts`, `rules/tasks/*`, `ui/TaskPanel.tsx`, `ui/AssignDialog.tsx`, `simulateTask` со случайным исходом |
| M4 | `app/GameLoop.tsx`, `rules/warehouse.ts` (путь), `rules/advance.ts`, движение в `scene/Pickers.tsx` |
| M5 | `minigames/types.ts`, `TsdFrame.tsx`, `minigames/picking/` |
| M6 | `resultFromMinigame`, `applyTaskResult`, рейтинг и деньги в `TopBar` |
| M7 | остальные мини-игры, полные `effects` для всех типов |
| M8 | `rules/shift.ts`, `rules/pickers.ts` (опыт, усталость), `ui/ShiftSummary.tsx`, генератор по весам, `store/persist.ts` (сохранение) |
| M9 | ассеты, звук, полировка, публикация |

На ранних этапах можно делать упрощённые версии файлов, но **границы слоёв соблюдаются с самого начала**: переносить логику из сцены в rules потом дороже, чем сразу положить её на место.

## 15. Открытые вопросы

1. Когда именно сохранять игру (раздел 12).
2. Формулы `outcomeChances` и влияние сборщика на личную мини-игру (из `05-pickers.md`).
3. Публикация: куда выкладывать готовую сборку (GitHub Pages, Vercel, другое).

Решено:

- Тесты — Vitest.
- Игра сохраняется в браузере (`localStorage` через `persist` из Zustand).
- Личную мини-игру прервать нельзя, передумать в пользу поручения тоже нельзя.
