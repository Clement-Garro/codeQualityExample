import { DomainRuleViolation } from '../../../src/domain/errors';
import { Subscription, User } from '../../../src/domain/user';

const CAROL = { id: 3, name: 'carol', credit: 120, subscription: Subscription.Basic, isBlacklisted: false };

describe('user.hasMinimumCreditToRent', () => {
  it('refuses a user with less than 5 of credit', () => {
    expect(User.restore({ ...CAROL, credit: 4.99 }).hasMinimumCreditToRent()).toBe(false);
  });

  it('accepts a user with exactly 5 of credit', () => {
    expect(User.restore({ ...CAROL, credit: 5 }).hasMinimumCreditToRent()).toBe(true);
  });
});

describe('user.debit', () => {
  it('returns a user whose credit is reduced by the amount', () => {
    const user = User.restore(CAROL);

    expect(user.debit(4.6).credit).toBeCloseTo(115.4);
  });

  it('leaves the original user unchanged', () => {
    const user = User.restore(CAROL);

    user.debit(4.6);

    expect(user.credit).toBe(120);
  });

  it('accepts a debit of 0', () => {
    expect(User.restore(CAROL).debit(0).credit).toBe(120);
  });

  it('lets the credit become negative, as the service does today', () => {
    expect(User.restore({ ...CAROL, credit: 5 }).debit(237.65).credit).toBeCloseTo(-232.65);
  });

  it('refuses a negative amount', () => {
    expect(() => User.restore(CAROL).debit(-1)).toThrow(new DomainRuleViolation('cannot debit a negative amount'));
  });
});
