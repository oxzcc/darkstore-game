// Рейтинг — среднее последних оценок (X4, решение автора 07.11, вариант А).
import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { RATING, START_RATING } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { addRatingScore, ratingOf } from './rating';
import { applyTaskResult } from './rewards';
import { openOrders } from './tasks/generator';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

describe('рейтинг склада', () => {
  it('на старте — среднее «прошлых» оценок = START_RATING', () => {
    const g = createInitialGame(map, 1);
    expect(g.rating).toBeCloseTo(START_RATING);
    expect(ratingOf(RATING.start)).toBeCloseTo(START_RATING);
  });

  it('в истории только последние window оценок; 5,00 — только если все идеальны', () => {
    let s = createInitialGame(map, 1);
    for (let i = 0; i < RATING.window - 1; i++) s = addRatingScore(s, 5);
    expect(s.rating).toBeLessThan(5);
    s = addRatingScore(s, 5);
    expect(s.rating).toBe(5);
    expect(s.ratingScores).toHaveLength(RATING.window);
    s = addRatingScore(s, RATING.scores.failed);
    expect(s.rating).toBeCloseTo((5 * (RATING.window - 1) + 2) / RATING.window);
  });

  it('обучающая смена: провал оценку не ставит, успех ставит', () => {
    const g = createInitialGame(map, 1); // первая смена — обучающая
    const t = openOrders(g)[0];
    expect(applyTaskResult(g, t.id, 'failed').ratingScores).toEqual(g.ratingScores);
    expect(applyTaskResult(g, t.id, 'withErrors').ratingScores!.at(-1)).toBe(RATING.scores.withErrors);
  });
});
