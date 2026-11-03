let db: typeof import('../../src/db');

beforeEach(() => {
  jest.resetModules();
  db = require('../../src/db');
});

describe('rental ids', () => {
  it('starts at 1 and increments on every call', () => {
    expect(db.generateRentalId()).toBe(1);
    expect(db.generateRentalId()).toBe(2);
    expect(db.generateRentalId()).toBe(3);
  });

  it('starts again from 1 after a reset', () => {
    db.generateRentalId();
    db.generateRentalId();

    db.resetRentalIds();

    expect(db.generateRentalId()).toBe(1);
  });
});

describe('seed data integrity', () => {
  it('starts without any rental', () => {
    expect(db.rentals).toEqual([]);
  });

  it('lists in each station exactly the bikes located there', () => {
    for (const station of db.stations) {
      const bikesAtStation = db.bikes.filter((bike) => bike.stationId === station.id).map((bike) => bike.id);
      expect([...station.bikeIds].sort()).toEqual(bikesAtStation.sort());
    }
  });

  it('never puts more bikes in a station than its capacity', () => {
    for (const station of db.stations) {
      expect(station.bikeIds.length).toBeLessThanOrEqual(station.capacity);
    }
  });

  it('uses unique ids for stations, bikes and users', () => {
    for (const collection of [db.stations, db.bikes, db.users]) {
      const ids = collection.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('only uses known bike statuses', () => {
    for (const bike of db.bikes) {
      expect([0, 1, 2, 3]).toContain(bike.status);
    }
  });
});
