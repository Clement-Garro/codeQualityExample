import { ReturnRefusal } from '../../../src/application/result';
import { ReturnBike } from '../../../src/application/useCases/returnBike';
import { BikeStatus } from '../../../src/domain/bike';
import { InconsistentDataError } from '../../../src/domain/errors';
import { RentalStatus } from '../../../src/domain/rental';
import {
  ALICE,
  BASTILLE,
  CAROL,
  CLASSIC_BIKE,
  createUseCaseFixture,
  dockedBikeIdsAt,
  ELECTRIC_BIKE,
  findBike,
  findRental,
  findUser,
  makeUnfindable,
  MONTPARNASSE,
  NATION,
  REPUBLIQUE,
  seedWithCapacity,
  startRental,
  START_TIME,
  updateBike,
  UseCaseFixture
} from '../../support/portDoubles';

const ONE_MINUTE_MS = 60_000;
const UNKNOWN_ID = 99;

let fixture: UseCaseFixture;
let returnBike: ReturnBike;

function setUp(seed?: Parameters<typeof createUseCaseFixture>[0]) {
  fixture = createUseCaseFixture(seed);
  returnBike = new ReturnBike(fixture);
}

beforeEach(() => {
  setUp();
});

function rentForMinutes(userId: number, bikeId: number, minutes: number): number {
  const rental = startRental(fixture, userId, bikeId);
  fixture.clock.advanceMinutes(minutes);
  return rental.id;
}

function giveBack(rentalId: number, stationId: number) {
  return returnBike.execute({ rentalId, stationId });
}

function refusalOf(rentalId: number, stationId: number) {
  const result = giveBack(rentalId, stationId);
  return result.isSuccess ? undefined : result.refusal;
}

describe('refusals', () => {
  it('refuses an unknown rental', () => {
    expect(refusalOf(UNKNOWN_ID, BASTILLE)).toBe(ReturnRefusal.RentalNotFound);
  });

  it('refuses an unknown station', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);

    expect(refusalOf(rentalId, UNKNOWN_ID)).toBe(ReturnRefusal.StationNotFound);
    expect(findRental(fixture, rentalId).isOpen()).toBe(true);
  });

  it('refuses a rental that is already closed', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);
    giveBack(rentalId, BASTILLE);

    expect(refusalOf(rentalId, BASTILLE)).toBe(ReturnRefusal.AlreadyReturned);
  });

  it('charges the user only once when the same bike is returned twice', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);
    giveBack(rentalId, BASTILLE);

    giveBack(rentalId, BASTILLE);

    expect(fixture.paymentGateway.capture).toHaveBeenCalledTimes(1);
    expect(findUser(fixture, CAROL).credit).toBe(119);
  });

  it('refuses a full return station without charging the user', () => {
    setUp(seedWithCapacity(NATION, 1)); // Nation holds a single bike: it is full
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);

    expect(refusalOf(rentalId, NATION)).toBe(ReturnRefusal.StationFull);
    expect(fixture.paymentGateway.capture).not.toHaveBeenCalled();
    expect(findRental(fixture, rentalId).isOpen()).toBe(true);
  });

  it('reports an unknown rental before an unknown station', () => {
    expect(refusalOf(UNKNOWN_ID, UNKNOWN_ID)).toBe(ReturnRefusal.RentalNotFound);
  });

  it('reports a closed rental before an unknown station', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);
    giveBack(rentalId, BASTILLE);

    expect(refusalOf(rentalId, UNKNOWN_ID)).toBe(ReturnRefusal.AlreadyReturned);
  });
});

describe('pricing', () => {
  it.each([
    ['10 min, classic bike, basic user', CAROL, CLASSIC_BIKE, 10, 1],
    ['30 min (last minute of the flat price)', CAROL, CLASSIC_BIKE, 30, 1],
    ['31 min (first charged minute)', CAROL, CLASSIC_BIKE, 31, 1.15],
    ['45 min', CAROL, CLASSIC_BIKE, 45, 3.25],
    ['45 min on an electric bike', CAROL, ELECTRIC_BIKE, 45, 5.75],
    ['45 min for a premium user', ALICE, CLASSIC_BIKE, 45, 2.6],
    ['45 min on an electric bike for a premium user', ALICE, ELECTRIC_BIKE, 45, 4.6],
    ['24 h exactly (no penalty yet)', CAROL, CLASSIC_BIKE, 1440, 212.5],
    ['24 h and 1 min (late penalty)', CAROL, CLASSIC_BIKE, 1441, 237.65]
  ])('charges %s', (_case, userId, bikeId, minutes, expectedPrice) => {
    const rentalId = rentForMinutes(userId, bikeId, minutes);

    const result = giveBack(rentalId, BASTILLE);

    expect(result.isSuccess && result.value.durationMinutes).toBe(minutes);
    expect(result.isSuccess && result.value.price).toBe(expectedPrice);
  });
});

describe('successful return', () => {
  it('answers with the return summary', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const result = giveBack(rentalId, BASTILLE);

    expect(result).toEqual({
      isSuccess: true,
      value: { rentalId, durationMinutes: 45, price: 3.25, stationName: 'Bastille', isCaptured: true }
    });
  });

  it('closes the requested rental and leaves the other ones open', () => {
    const carolRentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 0);
    const aliceRentalId = rentForMinutes(ALICE, 9, 0);

    giveBack(carolRentalId, BASTILLE);

    expect(findRental(fixture, aliceRentalId).isOpen()).toBe(true);
  });

  it('closes a rental that is not the first one in the list', () => {
    const carolRentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 0);
    const aliceRentalId = rentForMinutes(ALICE, 9, 0);

    const result = giveBack(aliceRentalId, BASTILLE);

    expect(result.isSuccess && result.value.rentalId).toBe(aliceRentalId);
    expect(findRental(fixture, carolRentalId).isOpen()).toBe(true);
  });

  it('captures the price on the pre-authorized payment', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    const carolBeforeReturn = findUser(fixture, CAROL);

    giveBack(rentalId, BASTILLE);

    expect(fixture.paymentGateway.capture).toHaveBeenCalledWith(carolBeforeReturn, 'REF-PREAUTH', 3.25);
  });

  it('debits the price from the user once the payment is captured', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    giveBack(rentalId, BASTILLE);

    expect(findUser(fixture, CAROL).credit).toBeCloseTo(120 - 3.25);
  });

  it('closes the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    giveBack(rentalId, BASTILLE);

    expect(findRental(fixture, rentalId)).toMatchObject({
      endTime: START_TIME + 45 * ONE_MINUTE_MS,
      endStationId: BASTILLE,
      status: RentalStatus.Completed,
      price: 3.25
    });
  });

  it('parks the bike at the return station and adds the distance ridden', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    giveBack(rentalId, BASTILLE);

    expect(findBike(fixture, CLASSIC_BIKE)).toMatchObject({
      status: BikeStatus.Available,
      stationId: BASTILLE,
      kilometers: 120 + 11
    });
    expect(dockedBikeIdsAt(fixture, BASTILLE)).toEqual([CLASSIC_BIKE, 5, 6]);
  });
});

describe('when the capture fails', () => {
  beforeEach(() => {
    fixture.paymentGateway.failCaptures();
  });

  it('still closes the rental but reports that the payment is not captured', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const result = giveBack(rentalId, BASTILLE);

    expect(result.isSuccess && result.value.isCaptured).toBe(false);
    expect(findRental(fixture, rentalId).status).toBe(RentalStatus.Completed);
  });

  it('does not debit the user', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    giveBack(rentalId, BASTILLE);

    expect(findUser(fixture, CAROL).credit).toBe(120);
  });
});

describe('rebalancing', () => {
  it('asks for rebalancing when the return station holds 1.5 times the average number of bikes', () => {
    const rentalId = rentForMinutes(CAROL, 9, 0);

    giveBack(rentalId, REPUBLIQUE);

    expect(fixture.fleetNotifier.rebalancingRequested).toHaveBeenCalledWith(REPUBLIQUE);
  });

  it('does not ask for rebalancing below that threshold', () => {
    const rentalId = rentForMinutes(CAROL, ELECTRIC_BIKE, 0);

    giveBack(rentalId, BASTILLE);

    expect(fixture.fleetNotifier.rebalancingRequested).not.toHaveBeenCalled();
  });

  it('does not ask for rebalancing when the station is exactly at the threshold', () => {
    const rentalId = rentForMinutes(CAROL, 9, 0);
    // Bikes 3 and 4 leave Republique. After the return: 2 + 3 + 2 + 1 = 8 docked bikes, average 2,
    // threshold 3, Bastille holds 3.
    updateBike(fixture, 3, { status: BikeStatus.Rented, stationId: null });
    updateBike(fixture, 4, { status: BikeStatus.Rented, stationId: null });

    giveBack(rentalId, BASTILLE);

    expect(fixture.fleetNotifier.rebalancingRequested).not.toHaveBeenCalled();
  });

  it('counts the returned bike at its new station', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 0);

    // Montparnasse holds 3 bikes, then 4 with the returned one: above the threshold of 10 / 4 * 1.5 = 3.75.
    giveBack(rentalId, MONTPARNASSE);

    expect(fixture.fleetNotifier.rebalancingRequested).toHaveBeenCalledWith(MONTPARNASSE);
  });
});

// The seed data guarantees that a rental refers to an existing user and bike. If that is no longer
// true, the data is corrupted: the use case fails fast instead of charging the wrong price or
// silently skipping the bike.
describe('inconsistent data', () => {
  it('refuses to return a bike whose rental refers to an unknown user, without closing the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    makeUnfindable(fixture.users, CAROL);

    expect(() => giveBack(rentalId, BASTILLE)).toThrow(new InconsistentDataError('user 3 of rental 1'));
    expect(findRental(fixture, rentalId).endTime).toBeNull();
    expect(fixture.paymentGateway.capture).not.toHaveBeenCalled();
  });

  it('refuses to return a bike whose rental refers to an unknown bike, without closing the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    makeUnfindable(fixture.bikes, CLASSIC_BIKE);

    expect(() => giveBack(rentalId, BASTILLE)).toThrow(new InconsistentDataError('bike 1 of rental 1'));
    expect(findRental(fixture, rentalId).endTime).toBeNull();
    expect(fixture.paymentGateway.capture).not.toHaveBeenCalled();
  });
});
