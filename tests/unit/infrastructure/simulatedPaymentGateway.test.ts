import { ConsoleLogger } from '../../../src/infrastructure/consoleLogger';
import * as simulatedHttp from '../../../src/infrastructure/simulated/simulateHttpCall';
import { SimulatedPaymentGateway } from '../../../src/infrastructure/simulated/simulatedPaymentGateway';
import { useFastClock } from '../../support/fastClock';

const ALICE_ACCOUNT = { id: 1, credit: 50, isBlacklisted: false };

let gateway: SimulatedPaymentGateway;

beforeEach(() => {
  useFastClock();
  gateway = new SimulatedPaymentGateway(new ConsoleLogger());
});

describe('preAuthorize', () => {
  it('authorizes the amount and logs the reference', () => {
    const preAuthorization = gateway.preAuthorize(ALICE_ACCOUNT, 7.5);

    expect(preAuthorization).toEqual({ isApproved: true, reference: expect.stringMatching(/^REF\d+$/) });
    const reference = preAuthorization.isApproved ? preAuthorization.reference : '';
    expect(console.log).toHaveBeenCalledWith(`[INFO] preauth done "${reference}"`);
  });

  it('sends the user and the amount to the payment gateway', () => {
    const httpCallSpy = jest.spyOn(simulatedHttp, 'simulateHttpCall');

    gateway.preAuthorize({ ...ALICE_ACCOUNT, id: 3 }, 5);

    expect(httpCallSpy).toHaveBeenCalledWith('https://payments.example.com/preauth', { userId: 3, amount: 5 });
  });

  it('accepts a credit exactly equal to the amount', () => {
    expect(gateway.preAuthorize({ ...ALICE_ACCOUNT, credit: 5 }, 5).isApproved).toBe(true);
  });

  it('refuses a user whose credit is below the amount', () => {
    expect(gateway.preAuthorize({ ...ALICE_ACCOUNT, credit: 4.99 }, 5)).toEqual({
      isApproved: false,
      reason: 'insufficient funds'
    });
  });

  it('refuses a blacklisted user', () => {
    expect(gateway.preAuthorize({ ...ALICE_ACCOUNT, isBlacklisted: true }, 5)).toEqual({
      isApproved: false,
      reason: 'blacklisted'
    });
  });

  it('reports insufficient funds before the blacklist', () => {
    const account = { ...ALICE_ACCOUNT, credit: 1, isBlacklisted: true };

    expect(gateway.preAuthorize(account, 5)).toEqual({ isApproved: false, reason: 'insufficient funds' });
  });

  it('waits for the payment gateway, about 1 s', () => {
    const startTime = Date.now();

    gateway.preAuthorize(ALICE_ACCOUNT, 5);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000);
  });
});

describe('capture', () => {
  it('captures the amount and logs the reference', () => {
    const capture = gateway.capture(ALICE_ACCOUNT, 'REF123', 4.6);

    expect(capture).toEqual({ isCaptured: true, reference: expect.stringMatching(/^REF\d+$/) });
    const reference = capture.isCaptured ? capture.reference : '';
    expect(console.log).toHaveBeenCalledWith(`[INFO] capture done "${reference}"`);
  });

  it('sends the user, the payment reference and the amount to the payment gateway', () => {
    const httpCallSpy = jest.spyOn(simulatedHttp, 'simulateHttpCall');

    gateway.capture({ ...ALICE_ACCOUNT, id: 2 }, 'REF123', 3.25);

    expect(httpCallSpy).toHaveBeenCalledWith('https://payments.example.com/capture', {
      userId: 2,
      paymentReference: 'REF123',
      amount: 3.25
    });
  });

  it('accepts a zero amount', () => {
    expect(gateway.capture(ALICE_ACCOUNT, 'REF123', 0).isCaptured).toBe(true);
  });

  it('refuses a negative amount without logging a capture', () => {
    expect(gateway.capture(ALICE_ACCOUNT, 'REF123', -1)).toEqual({ isCaptured: false });
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('capture done'));
  });

  it('never changes the credit of the account: the rental debits it', () => {
    const account = { ...ALICE_ACCOUNT };

    gateway.capture(account, 'REF123', 4.6);

    expect(account.credit).toBe(50);
  });

  it('waits for the payment gateway, about 1 s', () => {
    const startTime = Date.now();

    gateway.capture(ALICE_ACCOUNT, 'REF123', 1);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000);
  });
});
