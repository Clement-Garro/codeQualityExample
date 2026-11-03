import { sleep, simulateHttpCall, log } from './utils';

export function preAuthorizePayment(user, amount) {
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

export function capturePayment(user, paymentReference, amount) {
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

export function refundPayment(user, paymentReference, amount) {
  sleep(800);
  simulateHttpCall('https://payments.example.com/refund', {
    userId: user.id,
    paymentReference: paymentReference,
    amount: amount
  });
  user.credit = user.credit + amount;
  return { success: true };
}
