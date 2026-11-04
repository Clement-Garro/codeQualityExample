import { Subscription } from '../../../src/domain/user';
import { SimulatedFraudScreening } from '../../../src/infrastructure/simulated/simulatedFraudScreening';
import { useFastClock } from '../../support/fastClock';

const BLACKLISTED_USER = { subscription: Subscription.Basic, isBlacklisted: true };
const PREMIUM_USER = { subscription: Subscription.Premium, isBlacklisted: false };

beforeEach(() => {
  useFastClock();
});

describe('scoreOf', () => {
  const fraudScreening = new SimulatedFraudScreening();

  it('scores the user with the fraud policy of the domain', () => {
    expect(fraudScreening.scoreOf(BLACKLISTED_USER, 5)).toBe(110);
    expect(fraudScreening.scoreOf(PREMIUM_USER, 41)).toBe(30);
  });

  it('waits for the anti-fraud service, at least 200 ms', () => {
    const startTime = Date.now();

    fraudScreening.scoreOf(PREMIUM_USER, 5);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(200);
  });
});
