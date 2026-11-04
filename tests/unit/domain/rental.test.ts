import { DomainRuleViolation } from '../../../src/domain/errors';
import { Rental, RentalStatus } from '../../../src/domain/rental';

const ONE_MINUTE_MS = 60_000;
const START_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);
const END_TIME = START_TIME + 45 * ONE_MINUTE_MS;
const ALICE = 1;
const REPUBLIQUE = 1;
const BASTILLE = 2;

const NEW_RENTAL = {
  id: 1,
  userId: ALICE,
  bikeId: 4,
  startStationId: REPUBLIQUE,
  startTime: START_TIME,
  paymentReference: 'REF-PREAUTH',
  preAuthAmount: 7.5,
  isElectric: true
};
const RETURN_AT_BASTILLE = { endTime: END_TIME, endStationId: BASTILLE, price: 4.6 };
const OPEN_STATE = { status: RentalStatus.Open, endTime: null, endStationId: null, price: null };
const COMPLETED_STATE = { status: RentalStatus.Completed, ...RETURN_AT_BASTILLE };

describe('Rental.open', () => {
  it('opens a rental that is not returned yet', () => {
    const rental = Rental.open(NEW_RENTAL);

    expect(rental).toMatchObject({ ...NEW_RENTAL, ...OPEN_STATE });
    expect(rental.isOpen()).toBe(true);
  });
});

describe('Rental.restore', () => {
  it('restores an open rental', () => {
    const rental = Rental.restore({ ...NEW_RENTAL, ...OPEN_STATE });

    expect(rental.isOpen()).toBe(true);
  });

  it('restores a completed rental', () => {
    const rental = Rental.restore({ ...NEW_RENTAL, ...COMPLETED_STATE });

    expect(rental.isOpen()).toBe(false);
    expect(rental.price).toBe(4.6);
  });

  it.each([
    ['an open rental with an end time', { ...OPEN_STATE, endTime: END_TIME }],
    ['an open rental with an end station', { ...OPEN_STATE, endStationId: BASTILLE }],
    ['an open rental with a price', { ...OPEN_STATE, price: 4.6 }],
    ['a completed rental without end time', { ...COMPLETED_STATE, endTime: null }],
    ['a completed rental without end station', { ...COMPLETED_STATE, endStationId: null }],
    ['a completed rental without price', { ...COMPLETED_STATE, price: null }]
  ])('refuses %s', (_case, state) => {
    expect(() => Rental.restore({ ...NEW_RENTAL, ...state })).toThrow(
      new DomainRuleViolation('rental 1 has an end time, end station and price only once returned')
    );
  });
});

describe('rental.complete', () => {
  it('closes the rental with its end time, end station and price', () => {
    const rental = Rental.open(NEW_RENTAL);

    const completedRental = rental.complete(RETURN_AT_BASTILLE);

    expect(completedRental).toMatchObject({ ...NEW_RENTAL, status: RentalStatus.Completed, ...RETURN_AT_BASTILLE });
    expect(completedRental.isOpen()).toBe(false);
  });

  it('leaves the original rental open', () => {
    const rental = Rental.open(NEW_RENTAL);

    rental.complete(RETURN_AT_BASTILLE);

    expect(rental.isOpen()).toBe(true);
    expect(rental.endTime).toBeNull();
  });

  it('refuses to close a rental twice and keeps the first return', () => {
    const completedRental = Rental.open(NEW_RENTAL).complete(RETURN_AT_BASTILLE);

    const secondReturn = { endTime: END_TIME + ONE_MINUTE_MS, endStationId: REPUBLIQUE, price: 9 };

    expect(() => completedRental.complete(secondReturn)).toThrow(
      new DomainRuleViolation('rental 1 is already returned')
    );
    expect(completedRental).toMatchObject(RETURN_AT_BASTILLE);
  });
});

describe('rental.durationMinutesAt', () => {
  it('measures an open rental until now', () => {
    const rental = Rental.open(NEW_RENTAL);

    expect(rental.durationMinutesAt(START_TIME + 10 * ONE_MINUTE_MS)).toBe(10);
  });

  it('measures a completed rental until its end, whatever the current time', () => {
    const completedRental = Rental.open(NEW_RENTAL).complete(RETURN_AT_BASTILLE);

    expect(completedRental.durationMinutesAt(END_TIME + 60 * ONE_MINUTE_MS)).toBe(45);
  });
});
