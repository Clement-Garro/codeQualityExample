import {
  CaptureResult,
  PaymentAccount,
  PaymentGateway,
  PreAuthorizationResult
} from '../../src/application/ports/paymentGateway';

/**
 * Stand-in for the external payment service: it approves and captures by default, records every call,
 * and can be told to decline the pre-authorizations or to fail the captures.
 */
export class FakePaymentGateway implements PaymentGateway {
  private preAuthorizationResult: PreAuthorizationResult = { isApproved: true, reference: 'REF-PREAUTH' };
  private captureResult: CaptureResult = { isCaptured: true, reference: 'REF-CAPTURE' };

  readonly preAuthorize = jest.fn(
    (_account: PaymentAccount, _amount: number): PreAuthorizationResult => this.preAuthorizationResult
  );

  readonly capture = jest.fn(
    (_account: Pick<PaymentAccount, 'id'>, _paymentReference: string, _amount: number): CaptureResult =>
      this.captureResult
  );

  declinePreAuthorizations(reason: string): void {
    this.preAuthorizationResult = { isApproved: false, reason: reason };
  }

  approvePreAuthorizations(): void {
    this.preAuthorizationResult = { isApproved: true, reference: 'REF-PREAUTH' };
  }

  failCaptures(): void {
    this.captureResult = { isCaptured: false };
  }
}
