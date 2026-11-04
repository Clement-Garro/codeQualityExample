import { FraudScreening } from '../../application/ports/fraudScreening';
import { computeFraudScore, FraudProfile } from '../../domain/fraud';
import { busyWait } from './busyWait';

const FRAUD_CHECK_DELAY_MS = 200;

/** Simulated anti-fraud service: it applies the fraud policy of the domain after its usual latency. */
export class SimulatedFraudScreening implements FraudScreening {
  scoreOf(user: FraudProfile, amount: number): number {
    busyWait(FRAUD_CHECK_DELAY_MS);
    return computeFraudScore(user, amount);
  }
}
