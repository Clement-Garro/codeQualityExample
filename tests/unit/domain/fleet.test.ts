import { computeRiddenKilometers, isRebalancingNeeded } from '../../../src/domain/fleet';

describe('computeRiddenKilometers', () => {
  it.each([
    [0, 0],
    [3, 0],
    [4, 1],
    [45, 11]
  ])('counts one kilometer every 4 minutes: %p min → %p km', (minutes, expectedKilometers) => {
    expect(computeRiddenKilometers(minutes)).toBe(expectedKilometers);
  });
});

describe('isRebalancingNeeded', () => {
  // 4 stations holding 10 bikes: 2.5 bikes per station on average, threshold 3.75.
  const FLEET = { totalDockedBikeCount: 10, stationCount: 4 };

  it('asks for rebalancing when the station holds more than 1.5 times the average', () => {
    expect(isRebalancingNeeded({ ...FLEET, dockedBikeCount: 4 })).toBe(true);
  });

  it('does not ask for rebalancing below that threshold', () => {
    expect(isRebalancingNeeded({ ...FLEET, dockedBikeCount: 3 })).toBe(false);
  });

  it('does not ask for rebalancing when the station is exactly at the threshold', () => {
    expect(isRebalancingNeeded({ dockedBikeCount: 3, totalDockedBikeCount: 8, stationCount: 4 })).toBe(false);
  });
});
