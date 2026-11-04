import { RentalLookupRefusal } from '../../../src/application/result';
import { GetRental } from '../../../src/application/useCases/getRental';
import { InconsistentDataError } from '../../../src/domain/errors';
import { Subscription } from '../../../src/domain/user';
import {
  ALICE,
  BASTILLE,
  CAROL,
  CLASSIC_BIKE,
  createUseCaseFixture,
  ELECTRIC_BIKE,
  findRental,
  makeUnfindable,
  startRental,
  updateUser,
  UseCaseFixture
} from '../../support/portDoubles';

const UNKNOWN_ID = 99;

let fixture: UseCaseFixture;
let getRental: GetRental;

beforeEach(() => {
  fixture = createUseCaseFixture();
  getRental = new GetRental(fixture);
});

function rentForMinutes(userId: number, bikeId: number, minutes: number): number {
  const rental = startRental(fixture, userId, bikeId);
  fixture.clock.advanceMinutes(minutes);
  return rental.id;
}

function detailsOf(rentalId: number) {
  const result = getRental.execute(rentalId);
  return result.isSuccess ? result.value : undefined;
}

describe('GetRental', () => {
  it('refuses an unknown rental', () => {
    expect(getRental.execute(UNKNOWN_ID)).toEqual({ isSuccess: false, refusal: RentalLookupRefusal.RentalNotFound });
  });

  it('shows the requested rental when it is not the first one in the list', () => {
    rentForMinutes(CAROL, CLASSIC_BIKE, 0);
    const aliceRentalId = rentForMinutes(ALICE, 9, 0);

    expect(detailsOf(aliceRentalId)?.rental).toMatchObject({ id: aliceRentalId, bikeId: 9 });
  });

  it('shows the rental that was asked for when several exist', () => {
    const carolRentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 0);
    rentForMinutes(ALICE, 9, 0);

    expect(detailsOf(carolRentalId)?.rental).toMatchObject({ id: carolRentalId, bikeId: CLASSIC_BIKE });
  });

  it('shows the running duration and price of an open rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    expect(detailsOf(rentalId)).toMatchObject({ durationMinutes: 45, price: 3.25, isOpen: true });
  });

  it.each([
    ['a ride within the flat price', CAROL, CLASSIC_BIKE, 10, 1],
    ['an electric bike', CAROL, ELECTRIC_BIKE, 45, 5.75],
    ['a premium user', ALICE, ELECTRIC_BIKE, 45, 4.6],
    ['a rental of exactly 24 hours', CAROL, CLASSIC_BIKE, 1440, 212.5],
    ['a rental longer than 24 hours', CAROL, CLASSIC_BIKE, 1441, 237.65]
  ])('applies the tariff for %s', (_case, userId, bikeId, minutes, expectedPrice) => {
    const rentalId = rentForMinutes(userId, bikeId, minutes);

    expect(detailsOf(rentalId)?.price).toBe(expectedPrice);
  });

  it.each([
    ['a basic user', CAROL, 3.5],
    ['a premium user', ALICE, 2.8]
  ])('gives %s the price of an electric ride within the first 30 minutes', (_case, userId, expectedPrice) => {
    const rentalId = rentForMinutes(userId, ELECTRIC_BIKE, 10);

    expect(detailsOf(rentalId)?.price).toBe(expectedPrice);
  });

  it('prices the rental with the current subscription of the user', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    updateUser(fixture, CAROL, { subscription: Subscription.Premium });

    expect(detailsOf(rentalId)?.price).toBe(2.6);
  });

  it('freezes the duration and the price once the bike is returned', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    const rental = findRental(fixture, rentalId);
    fixture.rentals.save(rental.complete({ endTime: fixture.clock.now(), endStationId: BASTILLE, price: 3.25 }));
    fixture.clock.advanceMinutes(60);

    expect(detailsOf(rentalId)).toMatchObject({ durationMinutes: 45, price: 3.25, isOpen: false });
  });

  it('refuses to show a rental that refers to an unknown user', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    makeUnfindable(fixture.users, CAROL);

    expect(() => getRental.execute(rentalId)).toThrow(new InconsistentDataError('user 3 of rental 1'));
  });
});
