import { roundToCents } from '../../../src/domain/money';

describe('roundToCents', () => {
  it.each([
    [3.14159, 3.14],
    [4.6000000001, 4.6],
    [0.125, 0.13],
    [10, 10]
  ])('rounds %p to %p', (amount, expected) => {
    expect(roundToCents(amount)).toBe(expected);
  });
});
