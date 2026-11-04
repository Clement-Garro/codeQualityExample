import { RentRefusal } from '../../../src/application/result';
import { RentBike } from '../../../src/application/useCases/rentBike';
import { BikeStatus } from '../../../src/domain/bike';
import { Rental, RentalStatus } from '../../../src/domain/rental';
import {
  ALICE,
  BASTILLE,
  BOB,
  CAROL,
  CLASSIC_BIKE,
  createUseCaseFixture,
  DAVE,
  dockedBikeIdsAt,
  ELECTRIC_BIKE,
  findBike,
  findUser,
  MONTPARNASSE,
  NATION,
  REPUBLIQUE,
  START_TIME,
  updateBike,
  updateUser,
  UseCaseFixture
} from '../../support/portDoubles';

const NO_PREFERENCE = null;
const UNKNOWN_ID = 99;

let fixture: UseCaseFixture;
let rentBike: RentBike;

beforeEach(() => {
  fixture = createUseCaseFixture();
  rentBike = new RentBike(fixture);
});

function rent(userId: number, stationId: number, requestedBikeId: number | null = NO_PREFERENCE) {
  return rentBike.execute({ userId, stationId, requestedBikeId });
}

function rentedBikeId(userId: number, stationId: number, requestedBikeId: number | null = NO_PREFERENCE) {
  const result = rent(userId, stationId, requestedBikeId);
  return result.isSuccess ? result.value.rental.bikeId : undefined;
}

/** The rental started by a successful result; fails the test setup when the rental was refused. */
function startedRental(result: ReturnType<typeof rent>) {
  if (!result.isSuccess) {
    throw new Error(`test setup: the rental was refused (${result.refusal})`);
  }
  return result.value.rental;
}

function refusalOf(userId: number, stationId: number, requestedBikeId: number | null = NO_PREFERENCE) {
  const result = rent(userId, stationId, requestedBikeId);
  return result.isSuccess ? undefined : result.refusal;
}

describe('successful rental', () => {
  it('answers with the rental summary', () => {
    const result = rent(ALICE, REPUBLIQUE);

    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess && result.value.stationName).toBe('Republique');
    expect(result.isSuccess && result.value.rental).toMatchObject({
      id: 1,
      bikeId: ELECTRIC_BIKE,
      preAuthAmount: 7.5,
      paymentReference: 'REF-PREAUTH'
    });
  });

  it('records an open rental', () => {
    rent(ALICE, REPUBLIQUE);

    expect(fixture.rentals.findAll()).toEqual([
      Rental.open({
        id: 1,
        userId: ALICE,
        bikeId: ELECTRIC_BIKE,
        startStationId: REPUBLIQUE,
        startTime: START_TIME,
        paymentReference: 'REF-PREAUTH',
        preAuthAmount: 7.5,
        isElectric: true
      })
    ]);
    expect(fixture.rentals.findAll()[0].status).toBe(RentalStatus.Open);
  });

  it('marks the bike as rented and removes it from the station', () => {
    rent(ALICE, REPUBLIQUE);

    expect(findBike(fixture, ELECTRIC_BIKE).status).toBe(BikeStatus.Rented);
    expect(dockedBikeIdsAt(fixture, REPUBLIQUE)).toEqual([1, 2, 3]);
  });

  it('gives each rental its own increasing id', () => {
    const firstResult = rent(ALICE, REPUBLIQUE);
    const secondResult = rent(CAROL, MONTPARNASSE);

    expect(firstResult.isSuccess && firstResult.value.rental.id).toBe(1);
    expect(secondResult.isSuccess && secondResult.value.rental.id).toBe(2);
  });

  it('logs the rental creation through the fleet service', () => {
    rent(ALICE, REPUBLIQUE);

    expect(fixture.fleetNotifier.rentalCreated).toHaveBeenCalledWith(1);
  });
});

describe('bike selection', () => {
  it('picks the available bike with the lowest mileage when no bike is requested', () => {
    expect(rentedBikeId(CAROL, REPUBLIQUE)).toBe(4);
    expect(rentedBikeId(ALICE, MONTPARNASSE)).toBe(9);
  });

  it('picks the lowest mileage even when that bike is not the last one listed', () => {
    updateBike(fixture, 9, { kilometers: 500 });

    expect(rentedBikeId(CAROL, MONTPARNASSE)).toBe(7);
  });

  it('keeps the first listed bike when two bikes have the same mileage', () => {
    updateBike(fixture, 8, { kilometers: 22 });

    expect(rentedBikeId(CAROL, MONTPARNASSE)).toBe(8);
  });

  it('treats a missing bike id as "no preference"', () => {
    expect(rentedBikeId(CAROL, REPUBLIQUE, NO_PREFERENCE)).toBe(4);
  });

  it('rents the requested bike when it is available', () => {
    expect(rentedBikeId(CAROL, REPUBLIQUE, CLASSIC_BIKE)).toBe(CLASSIC_BIKE);
  });

  it.each([
    ['in maintenance', REPUBLIQUE, 3],
    ['broken', BASTILLE, 6],
    ['parked at another station', REPUBLIQUE, 5],
    ['unknown', REPUBLIQUE, UNKNOWN_ID],
    ['not a number', REPUBLIQUE, NaN]
  ])('refuses when the requested bike is %s', (_case, stationId, bikeId) => {
    expect(refusalOf(CAROL, stationId, bikeId)).toBe(RentRefusal.NoBikeAvailable);
  });

  it('refuses when the station has no available bike', () => {
    rent(CAROL, NATION);

    expect(refusalOf(ALICE, NATION)).toBe(RentRefusal.NoBikeAvailable);
  });

  it('warns about broken bikes found at the station', () => {
    rent(CAROL, BASTILLE);

    expect(fixture.logger.warn).toHaveBeenCalledWith('broken bike at station', 6);
  });

  it('does not report bikes in maintenance as broken', () => {
    rent(CAROL, REPUBLIQUE);

    expect(fixture.logger.warn).not.toHaveBeenCalledWith('broken bike at station', expect.anything());
  });

  it('only looks for broken bikes once the user and the station are known', () => {
    rent(UNKNOWN_ID, BASTILLE);

    expect(fixture.logger.warn).not.toHaveBeenCalled();
  });
});

describe('business rules', () => {
  it('refuses an unknown user', () => {
    expect(refusalOf(UNKNOWN_ID, REPUBLIQUE)).toBe(RentRefusal.UserNotFound);
  });

  it('refuses an unknown station', () => {
    expect(refusalOf(CAROL, UNKNOWN_ID)).toBe(RentRefusal.StationNotFound);
  });

  it('refuses a second rental while the first one is still open', () => {
    rent(CAROL, REPUBLIQUE);

    expect(refusalOf(CAROL, MONTPARNASSE)).toBe(RentRefusal.AlreadyRenting);
  });

  it('lets the user rent again once the previous bike is returned', () => {
    const firstRental = startedRental(rent(CAROL, REPUBLIQUE));
    fixture.rentals.save(firstRental.complete({ endTime: START_TIME, endStationId: BASTILLE, price: 1 }));

    expect(rent(CAROL, MONTPARNASSE).isSuccess).toBe(true);
  });

  it('refuses a user with less than 5 of credit', () => {
    expect(refusalOf(BOB, REPUBLIQUE)).toBe(RentRefusal.NotEnoughCredit);
  });

  it('accepts a user with exactly 5 of credit', () => {
    updateUser(fixture, CAROL, { credit: 5 });

    expect(rent(CAROL, REPUBLIQUE, CLASSIC_BIKE).isSuccess).toBe(true);
  });

  it('refuses a fraud score of 100 without contacting the payment gateway', () => {
    fixture.fraudScreening.answerScore(100);

    expect(refusalOf(DAVE, REPUBLIQUE)).toBe(RentRefusal.FraudSuspected);
    expect(fixture.paymentGateway.preAuthorize).not.toHaveBeenCalled();
    expect(fixture.rentals.findAll()).toHaveLength(0);
  });

  it('accepts a fraud score just below 100', () => {
    fixture.fraudScreening.answerScore(99);

    expect(rent(CAROL, REPUBLIQUE).isSuccess).toBe(true);
  });

  it('scores the fraud risk of the user for the pre-authorized amount', () => {
    rent(CAROL, REPUBLIQUE, ELECTRIC_BIKE);

    expect(fixture.fraudScreening.scoreOf).toHaveBeenCalledWith(findUser(fixture, CAROL), 7.5);
  });

  it('pre-authorizes 5 for a classic bike', () => {
    const result = rent(CAROL, REPUBLIQUE, CLASSIC_BIKE);

    expect(fixture.paymentGateway.preAuthorize).toHaveBeenCalledWith(findUser(fixture, CAROL), 5);
    expect(result.isSuccess && result.value.rental.preAuthAmount).toBe(5);
  });

  it('pre-authorizes 7.50 for an electric bike', () => {
    const result = rent(CAROL, REPUBLIQUE, ELECTRIC_BIKE);

    expect(fixture.paymentGateway.preAuthorize).toHaveBeenCalledWith(findUser(fixture, CAROL), 7.5);
    expect(result.isSuccess && result.value.rental.preAuthAmount).toBe(7.5);
  });
});

describe('order of the checks', () => {
  it('reports the unknown user before the unknown station', () => {
    expect(refusalOf(UNKNOWN_ID, UNKNOWN_ID)).toBe(RentRefusal.UserNotFound);
  });

  it('reports a missing bike before the lack of credit', () => {
    rent(CAROL, NATION);

    expect(refusalOf(BOB, NATION)).toBe(RentRefusal.NoBikeAvailable);
  });

  it('reports an open rental before the lack of credit', () => {
    updateUser(fixture, CAROL, { credit: 6 });
    rent(CAROL, REPUBLIQUE, CLASSIC_BIKE);
    updateUser(fixture, CAROL, { credit: 1 });

    expect(refusalOf(CAROL, MONTPARNASSE)).toBe(RentRefusal.AlreadyRenting);
  });

  it('reports the lack of credit before the fraud risk', () => {
    fixture.fraudScreening.answerScore(110);

    expect(refusalOf(BOB, REPUBLIQUE)).toBe(RentRefusal.NotEnoughCredit);
    expect(fixture.fraudScreening.scoreOf).not.toHaveBeenCalled();
  });
});

describe('when the payment pre-authorization is declined', () => {
  beforeEach(() => {
    fixture.paymentGateway.declinePreAuthorizations('insufficient funds');
  });

  it('refuses the rental because the payment is declined', () => {
    expect(refusalOf(CAROL, REPUBLIQUE)).toBe(RentRefusal.PaymentDeclined);
  });

  it('does not record any rental', () => {
    rent(CAROL, REPUBLIQUE);

    expect(fixture.rentals.findAll()).toHaveLength(0);
  });

  it('leaves the bike available at its station', () => {
    rent(CAROL, REPUBLIQUE, ELECTRIC_BIKE);

    expect(findBike(fixture, ELECTRIC_BIKE).status).toBe(BikeStatus.Available);
    expect(dockedBikeIdsAt(fixture, REPUBLIQUE)).toEqual([1, 2, 3, 4]);
  });

  it('does not consume a rental id', () => {
    rent(CAROL, REPUBLIQUE);
    fixture.paymentGateway.approvePreAuthorizations();

    const result = rent(CAROL, REPUBLIQUE);

    expect(result.isSuccess && result.value.rental.id).toBe(1);
  });

  it('logs the refusal with its reason', () => {
    rent(CAROL, REPUBLIQUE, ELECTRIC_BIKE);

    expect(fixture.logger.warn).toHaveBeenCalledWith('payment declined', {
      userId: CAROL,
      amount: 7.5,
      reason: 'insufficient funds'
    });
    expect(fixture.fleetNotifier.rentalCreated).not.toHaveBeenCalled();
  });
});
