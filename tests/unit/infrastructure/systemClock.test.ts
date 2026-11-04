import { SystemClock } from '../../../src/infrastructure/systemClock';

describe('SystemClock', () => {
  it('reads the current time of the system', () => {
    const CURRENT_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);
    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME);

    expect(new SystemClock().now()).toBe(CURRENT_TIME);
  });
});
