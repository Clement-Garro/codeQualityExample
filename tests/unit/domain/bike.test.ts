import { Bike, BikeStatus } from '../../../src/domain/bike';
import { DomainRuleViolation } from '../../../src/domain/errors';

const REPUBLIQUE = 1;
const BASTILLE = 2;

const AVAILABLE_AT_REPUBLIQUE = {
  id: 4,
  stationId: REPUBLIQUE,
  status: BikeStatus.Available,
  kilometers: 12,
  isElectric: true
};
const RENTED = { ...AVAILABLE_AT_REPUBLIQUE, stationId: null, status: BikeStatus.Rented };
const IN_MAINTENANCE_NOWHERE = { ...AVAILABLE_AT_REPUBLIQUE, status: BikeStatus.Maintenance, stationId: null };

describe('Bike.restore', () => {
  it('keeps every property of a valid bike', () => {
    const bike = Bike.restore(AVAILABLE_AT_REPUBLIQUE);

    expect(bike).toMatchObject(AVAILABLE_AT_REPUBLIQUE);
  });

  const LOCATION_RULE = 'bike 4 must be parked at a station unless it is rented';
  const MILEAGE_RULE = 'bike 4 has an invalid mileage';

  it.each([
    ['a rented bike parked at a station', { ...RENTED, stationId: REPUBLIQUE }, LOCATION_RULE],
    ['an available bike without a station', { ...AVAILABLE_AT_REPUBLIQUE, stationId: null }, LOCATION_RULE],
    ['a bike in maintenance without a station', IN_MAINTENANCE_NOWHERE, LOCATION_RULE],
    ['a negative mileage', { ...AVAILABLE_AT_REPUBLIQUE, kilometers: -1 }, MILEAGE_RULE],
    ['a mileage that is not a whole number', { ...AVAILABLE_AT_REPUBLIQUE, kilometers: 1.5 }, MILEAGE_RULE]
  ])('refuses %s', (_case, properties, expectedMessage) => {
    expect(() => Bike.restore(properties)).toThrow(new DomainRuleViolation(expectedMessage));
  });

  it('accepts a new bike that has never been ridden', () => {
    expect(Bike.restore({ ...AVAILABLE_AT_REPUBLIQUE, kilometers: 0 }).kilometers).toBe(0);
  });

  it('accepts a broken bike parked at a station', () => {
    expect(Bike.restore({ ...AVAILABLE_AT_REPUBLIQUE, status: BikeStatus.Broken }).status).toBe(BikeStatus.Broken);
  });
});

describe('bike.checkOut', () => {
  it('rents an available bike and takes it out of its station', () => {
    const bike = Bike.restore(AVAILABLE_AT_REPUBLIQUE);

    const rentedBike = bike.checkOut();

    expect(rentedBike.status).toBe(BikeStatus.Rented);
    expect(rentedBike.stationId).toBeNull();
    expect(rentedBike.kilometers).toBe(12);
  });

  it('leaves the original bike unchanged', () => {
    const bike = Bike.restore(AVAILABLE_AT_REPUBLIQUE);

    bike.checkOut();

    expect(bike.status).toBe(BikeStatus.Available);
    expect(bike.stationId).toBe(REPUBLIQUE);
  });

  it.each([
    ['rented', RENTED],
    ['in maintenance', { ...AVAILABLE_AT_REPUBLIQUE, status: BikeStatus.Maintenance }],
    ['broken', { ...AVAILABLE_AT_REPUBLIQUE, status: BikeStatus.Broken }]
  ])('refuses to rent a bike that is %s', (_case, properties) => {
    const bike = Bike.restore(properties);

    expect(() => bike.checkOut()).toThrow(new DomainRuleViolation('bike 4 is not available'));
    expect(bike.status).toBe(properties.status);
  });
});

describe('bike.dockAt', () => {
  it('parks a rented bike at the station and adds the distance ridden', () => {
    const bike = Bike.restore(RENTED);

    const dockedBike = bike.dockAt(BASTILLE, 11);

    expect(dockedBike.status).toBe(BikeStatus.Available);
    expect(dockedBike.stationId).toBe(BASTILLE);
    expect(dockedBike.kilometers).toBe(23);
  });

  it('leaves the original bike unchanged', () => {
    const bike = Bike.restore(RENTED);

    bike.dockAt(BASTILLE, 11);

    expect(bike.status).toBe(BikeStatus.Rented);
    expect(bike.stationId).toBeNull();
    expect(bike.kilometers).toBe(12);
  });

  it('accepts a ride of 0 km', () => {
    expect(Bike.restore(RENTED).dockAt(BASTILLE, 0).kilometers).toBe(12);
  });

  it('refuses to park a bike that is not rented', () => {
    const bike = Bike.restore(AVAILABLE_AT_REPUBLIQUE);

    expect(() => bike.dockAt(BASTILLE, 11)).toThrow(new DomainRuleViolation('bike 4 is not rented'));
  });

  it('refuses a negative distance', () => {
    const bike = Bike.restore(RENTED);

    expect(() => bike.dockAt(BASTILLE, -1)).toThrow(
      new DomainRuleViolation('a ride cannot have a negative distance')
    );
  });
});
