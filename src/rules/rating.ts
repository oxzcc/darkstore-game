// Рейтинг склада (X4, решение автора 07.11, вариант А): среднее последних оценок, как у настоящего магазина.
// Оценки и размер окна — RATING в config/balance.ts. В состоянии — история оценок и уже посчитанное среднее (`GameState.rating`).
import type { GameState } from '../model/game';
import { RATING } from '../config/balance';

/** Среднее оценок (пусто — старт). */
export function ratingOf(scores: number[]): number {
  const list = scores.length ? scores : RATING.start;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

/** Добавить оценку: в истории остаются последние RATING.window, рейтинг — их среднее. */
export function addRatingScore(state: GameState, score: number): GameState {
  const scores = [...(state.ratingScores ?? RATING.start), score].slice(-RATING.window);
  return { ...state, ratingScores: scores, rating: ratingOf(scores) };
}
