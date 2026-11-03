import * as utils from '../../src/utils';
import { preAuthorizePayment, capturePayment, refundPayment } from '../../src/payment';
import { useFastClock } from '../support/fastClock';

function createUser(overrides = {}) {
  return { id: 1, name: 'alice', credit: 50, subscription: 'basic', isBlacklisted: false, ...overrides };
}

beforeEach(() => {
  useFastClock();
});

describe('preAuthorizePayment', () => {
  it('authorizes the amount without debiting the user', () => {
    const user = createUser({ credit: 50 });

    const preAuthorization = preAuthorizePayment(user, 7.5);

    expect(preAuthorization).toEqual({ success: true, reference: expect.stringMatching(/^REF\d+$/), amount: 7.5 });
    expect(user.credit).toBe(50);
    expect(console.log).toHaveBeenCalledWith(`[INFO] preauth done "${preAuthorization.reference}"`);
  });

  it('sends the user and the amount to the payment gateway', () => {
    const httpCallSpy = jest.spyOn(utils, 'simulateHttpCall');
    const user = createUser({ id: 3 });

    preAuthorizePayment(user, 5);

    expect(httpCallSpy).toHaveBeenCalledWith('https://payments.example.com/preauth', { userId: 3, amount: 5 });
  });

  it('accepts a credit exactly equal to the amount', () => {
    expect(preAuthorizePayment(createUser({ credit: 5 }), 5).success).toBe(true);
  });

  it('refuses a user whose credit is below the amount', () => {
    expect(() => preAuthorizePayment(createUser({ credit: 4.99 }), 5)).toThrow('insufficient funds');
  });

  it('refuses a blacklisted user', () => {
    expect(() => preAuthorizePayment(createUser({ isBlacklisted: true }), 5)).toThrow('blacklisted');
  });

  it('reports insufficient funds before the blacklist', () => {
    const user = createUser({ credit: 1, isBlacklisted: true });

    expect(() => preAuthorizePayment(user, 5)).toThrow('insufficient funds');
  });
});

describe('capturePayment', () => {
  it('debits the amount from the user credit', () => {
    const user = createUser({ credit: 50 });

    const capture = capturePayment(user, 'REF123', 4.6);

    expect(capture).toEqual({ success: true, reference: expect.stringMatching(/^REF\d+$/) });
    expect(user.credit).toBeCloseTo(45.4);
    expect(console.log).toHaveBeenCalledWith(`[INFO] capture done "${capture.reference}"`);
  });

  it('sends the user, the payment reference and the amount to the payment gateway', () => {
    const httpCallSpy = jest.spyOn(utils, 'simulateHttpCall');

    capturePayment(createUser({ id: 2 }), 'REF123', 3.25);

    expect(httpCallSpy).toHaveBeenCalledWith('https://payments.example.com/capture', {
      userId: 2,
      paymentReference: 'REF123',
      amount: 3.25
    });
  });

  it('accepts a zero amount', () => {
    const user = createUser({ credit: 50 });

    capturePayment(user, 'REF123', 0);

    expect(user.credit).toBe(50);
  });

  it('refuses a negative amount and leaves the credit untouched', () => {
    const user = createUser({ credit: 50 });

    expect(() => capturePayment(user, 'REF123', -1)).toThrow('bad amount');
    expect(user.credit).toBe(50);
  });
});

describe('refundPayment', () => {
  it('credits the amount back to the user', () => {
    const user = createUser({ credit: 10 });

    expect(refundPayment(user, 'REF123', 2.5)).toEqual({ success: true });
    expect(user.credit).toBe(12.5);
  });

  it('sends the user, the payment reference and the amount to the payment gateway', () => {
    const httpCallSpy = jest.spyOn(utils, 'simulateHttpCall');

    refundPayment(createUser({ id: 4 }), 'REF123', 2.5);

    expect(httpCallSpy).toHaveBeenCalledWith('https://payments.example.com/refund', {
      userId: 4,
      paymentReference: 'REF123',
      amount: 2.5
    });
  });
});
