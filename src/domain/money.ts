const CENTS_PER_UNIT = 100;

export function roundToCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}
