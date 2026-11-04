import { BikeStatus } from '../../../src/domain/bike';
import { createSeedData } from '../../../src/infrastructure/inMemory/seedData';

describe('createSeedData', () => {
  it('describes the 4 stations, 10 bikes and 4 users of the demonstration', () => {
    const seed = createSeedData();

    expect(seed.stations.map((station) => station.name)).toEqual(['Republique', 'Bastille', 'Montparnasse', 'Nation']);
    expect(seed.bikes).toHaveLength(10);
    expect(seed.users.map((user) => user.name)).toEqual(['alice', 'bob', 'carol', 'dave']);
  });

  it('keeps the demonstration data unchanged', () => {
    const seed = createSeedData();

    expect(seed.bikes.map(({ id, status, kilometers, isElectric }) => [id, status, kilometers, isElectric])).toEqual([
      [1, BikeStatus.Available, 120, false],
      [2, BikeStatus.Available, 340, true],
      [3, BikeStatus.Maintenance, 900, false],
      [4, BikeStatus.Available, 12, true],
      [5, BikeStatus.Available, 55, false],
      [6, BikeStatus.Broken, 1200, false],
      [7, BikeStatus.Available, 78, true],
      [8, BikeStatus.Available, 400, false],
      [9, BikeStatus.Available, 22, false],
      [10, BikeStatus.Available, 640, true]
    ]);
    const userSummaries = seed.users.map(({ id, credit, subscription, isBlacklisted }) => [
      id,
      credit,
      subscription,
      isBlacklisted
    ]);
    expect(userSummaries).toEqual([
      [1, 50, 'premium', false],
      [2, 4, 'basic', false],
      [3, 120, 'basic', false],
      [4, 30, 'basic', true]
    ]);
    expect(seed.stations.map(({ id, capacity, latitude, longitude }) => [id, capacity, latitude, longitude])).toEqual([
      [1, 20, 48.867, 2.363],
      [2, 15, 48.853, 2.369],
      [3, 25, 48.841, 2.322],
      [4, 12, 48.848, 2.395]
    ]);
  });

  it('returns new entities on every call', () => {
    const firstSeed = createSeedData();
    const secondSeed = createSeedData();

    expect(secondSeed.stations).not.toBe(firstSeed.stations);
    expect(secondSeed.bikes[0]).not.toBe(firstSeed.bikes[0]);
    expect(secondSeed.users[0]).not.toBe(firstSeed.users[0]);
    expect(secondSeed).toEqual(firstSeed);
  });

  it('parks every bike at a station, as none is rented yet', () => {
    for (const bike of createSeedData().bikes) {
      expect(bike.status).not.toBe(BikeStatus.Rented);
      expect(bike.stationId).not.toBeNull();
    }
  });

  it('never puts more bikes in a station than its capacity', () => {
    const seed = createSeedData();

    for (const station of seed.stations) {
      const dockedBikeCount = seed.bikes.filter((bike) => bike.stationId === station.id).length;
      expect(dockedBikeCount).toBeLessThanOrEqual(station.capacity);
    }
  });

  it('uses unique ids for stations, bikes and users', () => {
    const seed = createSeedData();

    for (const collection of [seed.stations, seed.bikes, seed.users]) {
      const ids = collection.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('only uses known bike statuses', () => {
    for (const bike of createSeedData().bikes) {
      expect([0, 1, 2, 3]).toContain(bike.status);
    }
  });

  it('keeps the bikes of each station where they were', () => {
    const idsOfBikesParkedAt = (stationId: number) =>
      createSeedData()
        .bikes.filter((bike) => bike.stationId === stationId)
        .map((bike) => bike.id);

    expect([1, 2, 3, 4].map(idsOfBikesParkedAt)).toEqual([[1, 2, 3, 4], [5, 6], [7, 8, 9], [10]]);
  });
});
