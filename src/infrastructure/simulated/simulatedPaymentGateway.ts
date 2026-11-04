import { Logger } from '../../application/ports/logger';
import {
  CaptureResult,
  PaymentAccount,
  PaymentGateway,
  PreAuthorizationResult
} from '../../application/ports/paymentGateway';
import { busyWait } from './busyWait';
import { simulateHttpCall } from './simulateHttpCall';

const PAYMENT_DELAY_MS = 800;
const PRE_AUTHORIZATION_URL = 'https://payments.example.com/preauth';
const CAPTURE_URL = 'https://payments.example.com/capture';

/** Simulated payment service: no real call, about 1 s of latency, refusals decided from the account data. */
export class SimulatedPaymentGateway implements PaymentGateway {
  constructor(private readonly logger: Logger) {}

  preAuthorize(account: PaymentAccount, amount: number): PreAuthorizationResult {
    busyWait(PAYMENT_DELAY_MS);
    const response = simulateHttpCall(PRE_AUTHORIZATION_URL, { userId: account.id, amount: amount });
    this.logger.info('preauth done', response.reference);
    if (account.credit < amount) {
      return { isApproved: false, reason: 'insufficient funds' };
    }
    if (account.isBlacklisted) {
      return { isApproved: false, reason: 'blacklisted' };
    }
    return { isApproved: true, reference: response.reference };
  }

  capture(account: Pick<PaymentAccount, 'id'>, paymentReference: string, amount: number): CaptureResult {
    busyWait(PAYMENT_DELAY_MS);
    const response = simulateHttpCall(CAPTURE_URL, {
      userId: account.id,
      paymentReference: paymentReference,
      amount: amount
    });
    if (amount < 0) {
      return { isCaptured: false };
    }
    this.logger.info('capture done', response.reference);
    return { isCaptured: true, reference: response.reference };
  }
}
