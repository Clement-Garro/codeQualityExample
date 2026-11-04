import { MINIMUM_CREDIT_TO_RENT } from './businessRules';
import { DomainRuleViolation } from './errors';

// A const object rather than a string enum: callers can still pass 'basic' or 'premium' literals.
export const Subscription = {
  Basic: 'basic',
  Premium: 'premium'
} as const;
export type Subscription = (typeof Subscription)[keyof typeof Subscription];

export interface UserProperties {
  readonly id: number;
  readonly name: string;
  readonly credit: number;
  readonly subscription: Subscription;
  readonly isBlacklisted: boolean;
}

export class User implements UserProperties {
  readonly id: number;
  readonly name: string;
  readonly credit: number;
  readonly subscription: Subscription;
  readonly isBlacklisted: boolean;

  private constructor(properties: UserProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.credit = properties.credit;
    this.subscription = properties.subscription;
    this.isBlacklisted = properties.isBlacklisted;
  }

  static restore(properties: UserProperties): User {
    return new User(properties);
  }

  hasMinimumCreditToRent(): boolean {
    return this.credit >= MINIMUM_CREDIT_TO_RENT;
  }

  /** Charges the user. The credit may become negative: capping it is an open business decision. */
  debit(amount: number): User {
    if (amount < 0) {
      throw new DomainRuleViolation('cannot debit a negative amount');
    }
    return new User({ ...this, credit: this.credit - amount });
  }
}
