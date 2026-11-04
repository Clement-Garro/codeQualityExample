import {
  computeDurationMinutes,
  computePreAuthorizationAmount,
  computeRentalPrice
} from '../../../src/domain/pricing';
import { Subscription } from '../../../src/domain/user';

const ONE_MINUTE_MS = 60_000;
const START_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);
const CLASSIC = false;
const ELECTRIC = true;

describe('computeDurationMinutes', () => {
  it('counts whole minutes between the start and the end', () => {
    expect(computeDurationMinutes(START_TIME, START_TIME + 45 * ONE_MINUTE_MS)).toBe(45);
  });

  it('drops an incomplete last minute', () => {
    expect(computeDurationMinutes(START_TIME, START_TIME + 45 * ONE_MINUTE_MS + 59_999)).toBe(45);
  });

  it('gives 0 for a rental shorter than a minute', () => {
    expect(computeDurationMinutes(START_TIME, START_TIME + 59_999)).toBe(0);
  });
});

describe('computeRentalPrice', () => {
  it('charges the flat price of 1 for the first 30 minutes', () => {
    expect(computeRentalPrice(0, CLASSIC, Subscription.Basic)).toBe(1);
    expect(computeRentalPrice(30, CLASSIC, Subscription.Basic)).toBe(1);
  });

  it.each([
    ['31 min (first charged minute)', 31, CLASSIC, Subscription.Basic, 1.15],
    ['45 min', 45, CLASSIC, Subscription.Basic, 3.25],
    ['45 min on an electric bike', 45, ELECTRIC, Subscription.Basic, 5.75],
    ['45 min for a premium user', 45, CLASSIC, Subscription.Premium, 2.6],
    ['45 min on an electric bike for a premium user', 45, ELECTRIC, Subscription.Premium, 4.6],
    ['24 h exactly (no penalty yet)', 1440, CLASSIC, Subscription.Basic, 212.5],
    ['24 h and 1 min (late penalty)', 1441, CLASSIC, Subscription.Basic, 237.65]
  ])('charges %s', (_case, minutes, isElectric, subscription, expectedPrice) => {
    expect(computeRentalPrice(minutes, isElectric, subscription)).toBe(expectedPrice);
  });

  it('adds 2.50 for an electric bike', () => {
    expect(computeRentalPrice(10, ELECTRIC, Subscription.Basic)).toBe(3.5);
  });

  it('gives premium subscribers 20% off', () => {
    expect(computeRentalPrice(10, CLASSIC, Subscription.Premium)).toBe(0.8);
    expect(computeRentalPrice(10, ELECTRIC, Subscription.Premium)).toBe(2.8);
  });

  it('charges a small amount for each minute after the first 30', () => {
    const firstChargedMinute =
      computeRentalPrice(31, CLASSIC, Subscription.Basic) - computeRentalPrice(30, CLASSIC, Subscription.Basic);

    expect(firstChargedMinute).toBeGreaterThan(0);
    expect(firstChargedMinute).toBeLessThan(0.2);
  });

  it('adds a 25 penalty once the rental exceeds 24 hours', () => {
    const priceDifference =
      computeRentalPrice(1441, CLASSIC, Subscription.Basic) - computeRentalPrice(1440, CLASSIC, Subscription.Basic);

    expect(priceDifference).toBeGreaterThan(25);
    expect(priceDifference).toBeLessThan(26);
  });

  it('uses the billing rate of 0.15 per minute after the first 30 minutes', () => {
    expect(computeRentalPrice(45, CLASSIC, Subscription.Basic)).toBe(3.25);
  });

  it('rounds the price to the cent', () => {
    expect(computeRentalPrice(33, CLASSIC, Subscription.Premium)).toBe(1.16);
  });
});

describe('computePreAuthorizationAmount', () => {
  it('pre-authorizes 5 for a classic bike', () => {
    expect(computePreAuthorizationAmount(CLASSIC)).toBe(5);
  });

  it('pre-authorizes 7.50 for an electric bike', () => {
    expect(computePreAuthorizationAmount(ELECTRIC)).toBe(7.5);
  });
});
