import { busyWait } from '../../../src/infrastructure/simulated/busyWait';
import { simulateHttpCall } from '../../../src/infrastructure/simulated/simulateHttpCall';
import { useFastClock } from '../../support/fastClock';

beforeEach(() => {
  useFastClock();
});

describe('busyWait', () => {
  it('blocks for at least the requested duration', () => {
    const startTime = Date.now();

    busyWait(500);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(500);
  });
});

describe('simulateHttpCall', () => {
  it('answers 200, echoes the request and returns a payment reference', () => {
    const body = { userId: 1, amount: 5 };

    const response = simulateHttpCall('https://payments.example.com/preauth', body);

    expect(response).toEqual({
      status: 200,
      url: 'https://payments.example.com/preauth',
      body,
      reference: expect.stringMatching(/^REF\d+$/)
    });
  });

  it('waits for the network, at least 200 ms', () => {
    const startTime = Date.now();

    simulateHttpCall('https://payments.example.com/preauth', {});

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(200);
  });
});
