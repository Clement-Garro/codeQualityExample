import { createRequest, createResponse } from '../support/fakeHttp';
import { FakePaymentGateway } from '../support/fakePaymentGateway';
import { FastClock, useFastClock } from '../support/fastClock';
import { Repositories } from '../../src/application/ports/repositories';
import { GetRental } from '../../src/application/useCases/getRental';
import { ListStations } from '../../src/application/useCases/listStations';
import { RentBike } from '../../src/application/useCases/rentBike';
import { ReturnBike } from '../../src/application/useCases/returnBike';
import { createHandlers, Handlers } from '../../src/handlers';
import { ConsoleLogger } from '../../src/infrastructure/consoleLogger';
import { createInMemoryRepositories } from '../../src/infrastructure/inMemory/inMemoryRepositories';
import { createSeedData, SeedData } from '../../src/infrastructure/inMemory/seedData';
import { SimulatedFleetNotifier } from '../../src/infrastructure/simulated/simulatedFleetNotifier';
import { SimulatedFraudScreening } from '../../src/infrastructure/simulated/simulatedFraudScreening';
import { SimulatedLocationService } from '../../src/infrastructure/simulated/simulatedLocationService';
import { SystemClock } from '../../src/infrastructure/systemClock';
import { seedWithCapacity } from '../support/portDoubles';

// The handlers validate the input, call a use case and translate its result into the current HTTP
// contract. The business rules themselves are tested with the use cases (tests/unit/application).
// The use cases are the real ones; only the external payment gateway is replaced by a fake.

const ALICE = 1; // premium, credit 50
const BOB = 2; // basic, credit 4
const CAROL = 3; // basic, credit 120
const DAVE = 4; // basic, blacklisted

const REPUBLIQUE = 1;
const BASTILLE = 2;
const MONTPARNASSE = 3;
const NATION = 4;

const CLASSIC_BIKE = 1;
const ELECTRIC_BIKE = 4;

let handlers: Handlers;
let repositories: Repositories;
let payment: FakePaymentGateway;
let clock: FastClock;

/** Builds the handlers on a fresh copy of the data, the way the composition root does. */
function setUp(seed: SeedData = createSeedData()) {
  repositories = createInMemoryRepositories(seed);
  payment = new FakePaymentGateway();
  const logger = new ConsoleLogger();
  const systemClock = new SystemClock();
  const fleetNotifier = new SimulatedFleetNotifier(logger);
  const { stations, bikes, users, rentals } = repositories;
  handlers = createHandlers({
    rentBike: new RentBike({
      stations,
      bikes,
      users,
      rentals,
      paymentGateway: payment,
      fraudScreening: new SimulatedFraudScreening(),
      fleetNotifier,
      logger,
      clock: systemClock
    }),
    returnBike: new ReturnBike({
      stations,
      bikes,
      users,
      rentals,
      paymentGateway: payment,
      fleetNotifier,
      clock: systemClock
    }),
    getRental: new GetRental({ rentals, users, clock: systemClock }),
    listStations: new ListStations({ stations, bikes, locationService: new SimulatedLocationService() })
  });
}

beforeEach(() => {
  setUp();
  clock = useFastClock();
});

function rentBike(body: object) {
  const response = createResponse();
  handlers.handleRentBike(createRequest({ body }), response);
  return response;
}

function returnBike(body: object) {
  const response = createResponse();
  handlers.handleReturnBike(createRequest({ body }), response);
  return response;
}

function listStations() {
  const response = createResponse();
  handlers.handleListStations(createRequest(), response);
  return response;
}

function getRental(id: number | string) {
  const response = createResponse();
  handlers.handleGetRental(createRequest({ params: { id: String(id) } }), response);
  return response;
}

function rentForMinutes(userId: number, bikeId: number, minutes: number) {
  const rental = rentBike({ userId, stationId: REPUBLIQUE, bikeId });
  clock.advanceMinutes(minutes);
  return rental.body.rentalId;
}

describe('handleRentBike', () => {
  describe('input validation', () => {
    it.each([
      ['an empty body', {}],
      ['a missing userId', { stationId: REPUBLIQUE }],
      ['a missing stationId', { userId: CAROL }],
      ['an empty userId', { userId: '', stationId: REPUBLIQUE }],
      ['a null stationId', { userId: CAROL, stationId: null }]
    ])('answers 400 for %s', (_case, body) => {
      const response = rentBike(body);

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ msg: 'bad request' });
    });

    it('answers 404 for an unknown user', () => {
      const response = rentBike({ userId: 99, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ msg: 'no user' });
    });

    it('answers 404 for an unknown station', () => {
      const response = rentBike({ userId: CAROL, stationId: 99 });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ msg: 'no station' });
    });

    it('accepts ids sent as numeric strings', () => {
      const response = rentBike({ userId: String(CAROL), stationId: String(REPUBLIQUE), bikeId: '2' });

      expect(response.statusCode).toBe(200);
      expect(response.body.bikeId).toBe(2);
    });

    it('treats a null bikeId as "no preference"', () => {
      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: null }).body.bikeId).toBe(ELECTRIC_BIKE);
    });

    it('answers 409 for a bike id that is not a number', () => {
      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: 'abc' }).statusCode).toBe(409);
    });
  });

  describe('bike selection', () => {
    it('answers 409 when the station has no available bike', () => {
      rentBike({ userId: CAROL, stationId: NATION });

      const response = rentBike({ userId: ALICE, stationId: NATION });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'no bike available' });
    });

    it('warns about broken bikes found at the station', () => {
      rentBike({ userId: CAROL, stationId: BASTILLE });

      expect(console.log).toHaveBeenCalledWith('[WARN] broken bike at station 6');
    });
  });

  describe('business rules', () => {
    it('refuses a second rental while the first one is still open', () => {
      rentBike({ userId: CAROL, stationId: REPUBLIQUE });

      const response = rentBike({ userId: CAROL, stationId: MONTPARNASSE });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'already renting' });
    });

    it('refuses a user with less than 5 of credit', () => {
      const response = rentBike({ userId: BOB, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(402);
      expect(response.body).toEqual({ msg: 'not enough credit' });
    });

    it('refuses a blacklisted user without contacting the payment gateway', () => {
      const response = rentBike({ userId: DAVE, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ msg: 'refused' });
      expect(payment.preAuthorize).not.toHaveBeenCalled();
      expect(repositories.rentals.findAll()).toHaveLength(0);
    });
  });

  describe('successful rental', () => {
    it('answers with the rental summary', () => {
      const response = rentBike({ userId: ALICE, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        msg: 'ok',
        rentalId: 1,
        bikeId: ELECTRIC_BIKE,
        station: 'Republique',
        preAuth: 7.5,
        ref: 'REF-PREAUTH'
      });
    });

    it('logs the rental creation', () => {
      rentBike({ userId: ALICE, stationId: REPUBLIQUE });

      expect(console.log).toHaveBeenCalledWith('[INFO] rental created 1');
    });
  });
});

describe('handleReturnBike', () => {
  describe('input validation', () => {
    it.each([
      ['an empty body', {}],
      ['a missing rentalId', { stationId: BASTILLE }],
      ['a missing stationId', { rentalId: 1 }]
    ])('answers 400 for %s', (_case, body) => {
      const response = returnBike(body);

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ msg: 'bad request' });
    });

    it('answers 404 for an unknown rental', () => {
      const response = returnBike({ rentalId: 99, stationId: BASTILLE });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ msg: 'no rental' });
    });

    it('answers 404 for an unknown station', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);

      const response = returnBike({ rentalId, stationId: 99 });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ msg: 'no station' });
    });

    it('answers 409 when the rental is already closed', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);
      returnBike({ rentalId, stationId: BASTILLE });

      const response = returnBike({ rentalId, stationId: BASTILLE });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'already returned' });
    });

    it('answers 409 when the return station is full', () => {
      setUp(seedWithCapacity(NATION, 1)); // Nation holds a single bike: it is full
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);

      const response = returnBike({ rentalId, stationId: NATION });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'station full' });
      expect(payment.capture).not.toHaveBeenCalled();
    });
  });

  describe('successful return', () => {
    it('answers with the return summary', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      const response = returnBike({ rentalId, stationId: BASTILLE });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        msg: 'ok',
        rentalId,
        minutes: 45,
        price: 3.25,
        station: 'Bastille',
        captured: true
      });
    });

    it('still closes the rental but reports captured: false when the capture fails', () => {
      payment.failCaptures();
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      const response = returnBike({ rentalId, stationId: BASTILLE });

      expect(response.statusCode).toBe(200);
      expect(response.body.captured).toBe(false);
      expect(repositories.rentals.findAll()[0].status).toBe(2);
    });

    it('logs the rebalancing request', () => {
      const rentalId = rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.rentalId;

      returnBike({ rentalId, stationId: REPUBLIQUE });

      expect(console.log).toHaveBeenCalledWith('[INFO] rebalancing triggered 1');
    });
  });
});

describe('handleListStations', () => {
  it('describes every station with its available bikes, sorted by mileage', () => {
    const response = listStations();

    expect(response.body).toEqual([
      {
        id: REPUBLIQUE,
        name: 'Republique',
        zone: 'north',
        weather: 'clear',
        free: 3,
        electric: 2,
        slots: 16,
        bikes: [
          { id: 4, el: true, km: 12 },
          { id: 1, el: false, km: 120 },
          { id: 2, el: true, km: 340 }
        ]
      },
      {
        id: BASTILLE,
        name: 'Bastille',
        zone: 'north',
        weather: 'clear',
        free: 1,
        electric: 0,
        slots: 13,
        bikes: [
          { id: 5, el: false, km: 55 },
          { id: 6, el: false, km: 1200, broken: true }
        ]
      },
      {
        id: MONTPARNASSE,
        name: 'Montparnasse',
        zone: 'south',
        weather: 'rain',
        free: 3,
        electric: 1,
        slots: 22,
        bikes: [
          { id: 9, el: false, km: 22 },
          { id: 7, el: true, km: 78 },
          { id: 8, el: false, km: 400 }
        ]
      },
      {
        id: NATION,
        name: 'Nation',
        zone: 'south',
        weather: 'clear',
        free: 1,
        electric: 1,
        slots: 11,
        bikes: [{ id: 10, el: true, km: 640 }]
      }
    ]);
  });

  it('lists the bike fields in the order of the contract', () => {
    const bikes = listStations().body[1].bikes;

    expect(Object.keys(bikes[0])).toEqual(['id', 'el', 'km']);
    expect(Object.keys(bikes[1])).toEqual(['id', 'el', 'km', 'broken']);
  });
});

describe('handleGetRental', () => {
  it('answers 404 for an unknown rental', () => {
    const response = getRental(99);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ msg: 'no rental' });
  });

  it('answers 404 for a rental id that is not a number', () => {
    expect(getRental('not-a-number').body).toEqual({ msg: 'no rental' });
  });

  it('shows the running duration and price of an open rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const response = getRental(rentalId);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      msg: 'ok',
      id: rentalId,
      bikeId: CLASSIC_BIKE,
      minutes: 45,
      price: 3.25,
      estimate: 3.25,
      open: true
    });
  });

  it('shows a returned rental as closed', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    returnBike({ rentalId, stationId: BASTILLE });

    expect(getRental(rentalId).body).toMatchObject({ minutes: 45, price: 3.25, open: false });
  });
});

describe('handleRentBike when the payment pre-authorization is declined', () => {
  it('refuses the rental with 402 payment declined', () => {
    payment.declinePreAuthorizations('insufficient funds');

    const response = rentBike({ userId: CAROL, stationId: REPUBLIQUE });

    expect(response.statusCode).toBe(402);
    expect(response.body).toEqual({ msg: 'payment declined' });
  });

  it('logs the refusal with its reason', () => {
    payment.declinePreAuthorizations('insufficient funds');

    rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: ELECTRIC_BIKE });

    expect(console.log).toHaveBeenCalledWith(
      '[WARN] payment declined {"userId":3,"amount":7.5,"reason":"insufficient funds"}'
    );
  });
});

describe('handleGetRental estimate', () => {
  it('gives an estimate equal to the price of the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const response = getRental(rentalId);

    expect(response.body.estimate).toBe(response.body.price);
  });
});

describe('inconsistent data', () => {
  it('lets the error of corrupted data reach the caller', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    jest.spyOn(repositories.users, 'findById').mockReturnValue(undefined);

    const corruptedDataMessage = 'inconsistent data: user 3 of rental 1 not found';

    expect(() => returnBike({ rentalId, stationId: BASTILLE })).toThrow(corruptedDataMessage);
    expect(() => getRental(rentalId)).toThrow(corruptedDataMessage);
  });
});
