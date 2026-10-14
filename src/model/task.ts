// Задания (docs/04-tasks.md; окончательная модель — docs/09-architecture.md, раздел 4.4).
import type { Address } from './address';
import type { CallAnswer } from './call';

export type TaskType = 'order' | 'putaway' | 'receiving' | 'writeoff';

export type TaskStatus =
  | 'new' | 'assigned' | 'pickerEnRoute' | 'pickerArrived'
  | 'inProgress' | 'done' | 'expired';

export type Outcome = 'perfect' | 'withErrors' | 'failed';

/** Шансы трёх исходов, в сумме 1. */
export type OutcomeChances = Record<Outcome, number>;

export type TaskLocation =
  | { kind: 'address'; address: Address }
  | { kind: 'zone'; zone: 'receiving' | 'packing' | 'scrap' };

type TaskBase = {
  id: string;
  number: number;                  // номер для игрока: «Сборка №12»
  status: TaskStatus;
  createdAt: number;               // игровое время, секунды
  deadline: number;                // пока не используется: время и сроки появятся в M4
  difficulty: 1 | 2 | 3;
  reward: { money: number; rating: number };
  location: TaskLocation;
  assignedPickerId: string | null;
  mode: 'personal' | 'delegated' | null; // лично или поручено
  outcome: Outcome | null;
  callLog?: CallAnswer[];          // как разрешились развилки по этому заданию (10, раздел 3)
};

export type OrderLine = { productId: string; address: Address; qty: number };
export type OrderPayload = { lines: OrderLine[] };
export type PutawayPayload = { palletId: string };
export type ReceivingPayload = { deliveryId: string; palletCount: number };
export type WriteoffPayload = { stockRecordId: string; qty: number };

export type Task =
  | (TaskBase & { type: 'order'; payload: OrderPayload })
  | (TaskBase & { type: 'putaway'; payload: PutawayPayload })
  | (TaskBase & { type: 'receiving'; payload: ReceivingPayload })
  | (TaskBase & { type: 'writeoff'; payload: WriteoffPayload });

export type OrderTask = Extract<Task, { type: 'order' }>;
export type ReceivingTask = Extract<Task, { type: 'receiving' }>;
