import { describe, expect, it } from 'vitest';
import { createRng } from '../random';
import { createBarcode, markGuess, scoreBarcode } from './barcode';

describe('«Штрихкод»: отметки', () => {
  it('зелёная — на месте, жёлтая — есть в другом месте, серая — нет', () => {
    expect(markGuess([1, 2, 3, 4], [1, 3, 9, 0])).toEqual(['hit', 'near', 'miss', 'miss']);
    expect(markGuess([1, 2, 3, 4], [1, 2, 3, 4])).toEqual(['hit', 'hit', 'hit', 'hit']);
  });

  it('повторы: жёлтых для цифры не больше, чем её осталось неугаданной', () => {
    expect(markGuess([1, 2, 3, 4], [5, 1, 1, 1])).toEqual(['miss', 'near', 'miss', 'miss']);
    expect(markGuess([1, 1, 2, 3], [1, 2, 1, 1])).toEqual(['hit', 'near', 'near', 'miss']);
    expect(markGuess([7, 7, 0, 0], [7, 0, 7, 9])).toEqual(['hit', 'near', 'near', 'miss']);
  });

  it('исход по попыткам', () => {
    expect(scoreBarcode(4, 4)).toBe('perfect');
    expect(scoreBarcode(5, 4)).toBe('withErrors');
  });

  it('одно зерно — один код', () => {
    expect(createBarcode(createRng(3))).toEqual(createBarcode(createRng(3)));
  });
});
