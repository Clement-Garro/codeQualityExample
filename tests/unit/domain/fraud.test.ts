import { computeFraudScore, isFraudSuspected } from '../../../src/domain/fraud';
import { Subscription } from '../../../src/domain/user';

const BASIC_USER = { subscription: Subscription.Basic, isBlacklisted: false };
const PREMIUM_USER = { subscription: Subscription.Premium, isBlacklisted: false };
const BLACKLISTED_USER = { subscription: Subscription.Basic, isBlacklisted: true };
const BLACKLISTED_PREMIUM_USER = { subscription: Subscription.Premium, isBlacklisted: true };

describe('computeFraudScore', () => {
  it.each([
    ['a premium user with a small amount', PREMIUM_USER, 5, 0],
    ['a basic user', BASIC_USER, 5, 10],
    ['an amount of exactly 40', PREMIUM_USER, 40, 0],
    ['an amount above 40', PREMIUM_USER, 41, 30],
    ['a basic user with an amount above 40', BASIC_USER, 41, 40],
    ['a blacklisted user', BLACKLISTED_USER, 5, 110],
    ['a blacklisted premium user', BLACKLISTED_PREMIUM_USER, 5, 100]
  ])('scores %s', (_case, user, amount, expectedScore) => {
    expect(computeFraudScore(user, amount)).toBe(expectedScore);
  });
});

describe('isFraudSuspected', () => {
  it('accepts a score just below the refusal score', () => {
    expect(isFraudSuspected(99)).toBe(false);
  });

  it('refuses from the refusal score of 100', () => {
    expect(isFraudSuspected(100)).toBe(true);
    expect(isFraudSuspected(110)).toBe(true);
  });
});
