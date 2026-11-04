import { FraudProfile } from '../../domain/fraud';

/** External anti-fraud service: gives the risk score of a rental for this user and amount. */
export interface FraudScreening {
  scoreOf(user: FraudProfile, amount: number): number;
}
