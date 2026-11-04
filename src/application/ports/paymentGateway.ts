/** What the payment gateway needs to know about the user. */
export interface PaymentAccount {
  readonly id: number;
  readonly credit: number;
  readonly isBlacklisted: boolean;
}

export type PreAuthorizationResult =
  | { readonly isApproved: true; readonly reference: string }
  | { readonly isApproved: false; readonly reason: string };

export type CaptureResult = { readonly isCaptured: true; readonly reference: string } | { readonly isCaptured: false };

/** External payment service. A refusal is a result, never an exception. It does not change the user's credit. */
export interface PaymentGateway {
  preAuthorize(account: PaymentAccount, amount: number): PreAuthorizationResult;
  capture(account: Pick<PaymentAccount, 'id'>, paymentReference: string, amount: number): CaptureResult;
}
