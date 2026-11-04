import {
  BLACKLISTED_RISK_SCORE,
  FRAUD_REFUSAL_SCORE,
  HIGH_AMOUNT_RISK_SCORE,
  HIGH_AMOUNT_THRESHOLD,
  NON_PREMIUM_RISK_SCORE
} from './businessRules';
import { Subscription, UserProperties } from './user';

export type FraudProfile = Pick<UserProperties, 'subscription' | 'isBlacklisted'>;

/** Risk scores add up: a high amount, a non-premium subscription and the blacklist each raise the score. */
export function computeFraudScore(user: FraudProfile, amount: number): number {
  let fraudScore = 0;
  if (amount > HIGH_AMOUNT_THRESHOLD) {
    fraudScore = fraudScore + HIGH_AMOUNT_RISK_SCORE;
  }
  if (user.subscription !== Subscription.Premium) {
    fraudScore = fraudScore + NON_PREMIUM_RISK_SCORE;
  }
  if (user.isBlacklisted) {
    fraudScore = fraudScore + BLACKLISTED_RISK_SCORE;
  }
  return fraudScore;
}

export function isFraudSuspected(fraudScore: number): boolean {
  return fraudScore >= FRAUD_REFUSAL_SCORE;
}
