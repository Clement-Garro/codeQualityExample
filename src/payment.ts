import { sleep, simulateHttpCall, log } from './utils';
import { User } from './types';

type PaymentAccount = Pick<User, 'id' | 'credit'>;

export interface PreAuthorization {
  success: true;
  reference: string;
  amount: number;
}

export interface CapturedPayment {
  success: true;
  reference: string;
}

export function preAuthorizePayment(user: PaymentAccount & Pick<User, 'isBlacklisted'>, amount: number): PreAuthorization {
  sleep(800);
  const paymentResponse = simulateHttpCall('https://payments.example.com/preauth', { userId: user.id, amount: amount });
  log('INFO', 'preauth done', paymentResponse.reference);
  if (user.credit < amount) {
    throw new Error('insufficient funds');
  }
  if (user.isBlacklisted === true) {
    throw new Error('blacklisted');
  }
  return { success: true, reference: paymentResponse.reference, amount: amount };
}

export function capturePayment(user: PaymentAccount, paymentReference: string, amount: number): CapturedPayment {
  sleep(800);
  const paymentResponse = simulateHttpCall('https://payments.example.com/capture', {
    userId: user.id,
    paymentReference: paymentReference,
    amount: amount
  });
  if (amount < 0) {
    throw new Error('bad amount');
  }
  user.credit = user.credit - amount;
  log('INFO', 'capture done', paymentResponse.reference);
  return { success: true, reference: paymentResponse.reference };
}

export function refundPayment(user: PaymentAccount, paymentReference: string, amount: number): { success: true } {
  sleep(800);
  simulateHttpCall('https://payments.example.com/refund', {
    userId: user.id,
    paymentReference: paymentReference,
    amount: amount
  });
  user.credit = user.credit + amount;
  return { success: true };
}
