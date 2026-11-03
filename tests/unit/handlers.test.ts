import { createRequest, createResponse } from '../support/fakeHttp';
import { FastClock, useFastClock } from '../support/fastClock';
import { findById } from '../support/findById';

// The payment gateway is an external system: it is replaced by a mock in unit tests.
jest.mock('../../src/payment');

const ALICE = 1; // premium, credit 50
const BOB = 2; // basic, credit 4
const CAROL = 3; // basic, credit 120
const DAVE = 4; // basic, blacklisted

const REPUBLIQUE = 1; // bikes 1 (120 km), 2 (electric, 340 km), 3 (maintenance), 4 (electric, 12 km)
const BASTILLE = 2; // bikes 5 (55 km), 6 (broken)
const MONTPARNASSE = 3; // bikes 7 (electric, 78 km), 8 (400 km), 9 (22 km)
const NATION = 4; // bike 10 (electric, 640 km)

const CLASSIC_BIKE = 1;
const ELECTRIC_BIKE = 4;

let handlers: typeof import('../../src/handlers');
let db: typeof import('../../src/db');
let payment: jest.Mocked<typeof import('../../src/payment')>;
let clock: FastClock;

beforeEach(() => {
  jest.resetModules();
  db = require('../../src/db');
  payment = require('../../src/payment');
  handlers = require('../../src/handlers');
  payment.preAuthorizePayment.mockImplementation((_user, amount) => ({ success: true, reference: 'REF-PREAUTH', amount }));
  payment.capturePayment.mockReturnValue({ success: true, reference: 'REF-CAPTURE' });
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

function findUser(id: number) {
  return findById(db.users, id);
}

function findBike(id: number) {
  return findById(db.bikes, id);
}

function findStation(id: number) {
  return findById(db.stations, id);
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
  });

  describe('bike selection', () => {
    it('picks the available bike with the lowest mileage when no bike is requested', () => {
      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.bikeId).toBe(4);
      expect(rentBike({ userId: ALICE, stationId: MONTPARNASSE }).body.bikeId).toBe(9);
    });

    it('picks the lowest mileage even when that bike is not the last one listed', () => {
      findBike(9).kilometers = 500;

      expect(rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.bikeId).toBe(7);
    });

    it('keeps the first listed bike when two bikes have the same mileage', () => {
      findBike(8).kilometers = 22;

      expect(rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.bikeId).toBe(8);
    });

    it('treats a null bikeId as "no preference"', () => {
      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: null }).body.bikeId).toBe(4);
    });

    it('rents the requested bike when it is available', () => {
      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: CLASSIC_BIKE }).body.bikeId).toBe(CLASSIC_BIKE);
    });

    it.each([
      ['in maintenance', REPUBLIQUE, 3],
      ['broken', BASTILLE, 6],
      ['parked at another station', REPUBLIQUE, 5],
      ['unknown', REPUBLIQUE, 99]
    ])('answers 409 when the requested bike is %s', (_case, stationId, bikeId) => {
      const response = rentBike({ userId: CAROL, stationId, bikeId });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'no bike available' });
    });

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

    it('does not report bikes in maintenance as broken', () => {
      rentBike({ userId: CAROL, stationId: REPUBLIQUE });

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('broken bike'));
    });
  });

  describe('business rules', () => {
    it('refuses a second rental while the first one is still open', () => {
      rentBike({ userId: CAROL, stationId: REPUBLIQUE });

      const response = rentBike({ userId: CAROL, stationId: MONTPARNASSE });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'already renting' });
    });

    it('lets the user rent again once the previous bike is returned', () => {
      const firstRentalId = rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.rentalId;
      returnBike({ rentalId: firstRentalId, stationId: BASTILLE });

      expect(rentBike({ userId: CAROL, stationId: MONTPARNASSE }).statusCode).toBe(200);
    });

    it('refuses a user with less than 5 of credit', () => {
      const response = rentBike({ userId: BOB, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(402);
      expect(response.body).toEqual({ msg: 'not enough credit' });
    });

    it('accepts a user with exactly 5 of credit', () => {
      findUser(CAROL).credit = 5;

      expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: CLASSIC_BIKE }).statusCode).toBe(200);
    });

    it('refuses a blacklisted user without contacting the payment gateway', () => {
      const response = rentBike({ userId: DAVE, stationId: REPUBLIQUE });

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ msg: 'refused' });
      expect(payment.preAuthorizePayment).not.toHaveBeenCalled();
      expect(db.rentals).toHaveLength(0);
    });

    it('refuses a blacklisted premium user, whose fraud score is exactly 100', () => {
      findUser(ALICE).isBlacklisted = true;

      expect(rentBike({ userId: ALICE, stationId: REPUBLIQUE }).statusCode).toBe(403);
    });

    it('pre-authorizes 5 for a classic bike', () => {
      const response = rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: CLASSIC_BIKE });

      expect(payment.preAuthorizePayment).toHaveBeenCalledWith(findUser(CAROL), 5);
      expect(response.body.preAuth).toBe(5);
    });

    it('pre-authorizes 7.50 for an electric bike', () => {
      const response = rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: ELECTRIC_BIKE });

      expect(payment.preAuthorizePayment).toHaveBeenCalledWith(findUser(CAROL), 7.5);
      expect(response.body.preAuth).toBe(7.5);
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

    it('records an open rental', () => {
      rentBike({ userId: ALICE, stationId: REPUBLIQUE });

      expect(db.rentals).toEqual([
        {
          id: 1,
          userId: ALICE,
          bikeId: ELECTRIC_BIKE,
          startStationId: REPUBLIQUE,
          endTime: null,
          endStationId: null,
          startTime: expect.any(Number),
          paymentReference: 'REF-PREAUTH',
          preAuthAmount: 7.5,
          isElectric: true,
          status: 1
        }
      ]);
    });

    it('marks the bike as rented and removes it from the station', () => {
      rentBike({ userId: ALICE, stationId: REPUBLIQUE });

      expect(findBike(ELECTRIC_BIKE).status).toBe(1);
      expect(findStation(REPUBLIQUE).bikeIds).toEqual([1, 2, 3]);
    });

    it('gives each rental its own increasing id', () => {
      expect(rentBike({ userId: ALICE, stationId: REPUBLIQUE }).body.rentalId).toBe(1);
      expect(rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.rentalId).toBe(2);
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
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 10);
      findStation(NATION).capacity = findStation(NATION).bikeIds.length;

      const response = returnBike({ rentalId, stationId: NATION });

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ msg: 'station full' });
      expect(payment.capturePayment).not.toHaveBeenCalled();
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

      const response = returnBike({ rentalId, stationId: BASTILLE });

      expect(response.body.minutes).toBe(minutes);
      expect(response.body.price).toBe(expectedPrice);
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

    it('closes the requested rental and leaves the other ones open', () => {
      const carolRentalId = rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.rentalId;
      const aliceRentalId = rentBike({ userId: ALICE, stationId: MONTPARNASSE }).body.rentalId;

      const response = returnBike({ rentalId: carolRentalId, stationId: BASTILLE });

      expect(response.body.rentalId).toBe(carolRentalId);
      expect(findById(db.rentals, aliceRentalId).endTime).toBeNull();
    });

    it('closes a rental that is not the first one in the list', () => {
      const carolRentalId = rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.rentalId;
      const aliceRentalId = rentBike({ userId: ALICE, stationId: MONTPARNASSE }).body.rentalId;

      const response = returnBike({ rentalId: aliceRentalId, stationId: BASTILLE });

      expect(response.body.rentalId).toBe(aliceRentalId);
      expect(findById(db.rentals, carolRentalId).endTime).toBeNull();
    });

    it('captures the price on the pre-authorized payment', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      returnBike({ rentalId, stationId: BASTILLE });

      expect(payment.capturePayment).toHaveBeenCalledWith(findUser(CAROL), 'REF-PREAUTH', 3.25);
    });

    it('closes the rental', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      returnBike({ rentalId, stationId: BASTILLE });

      expect(db.rentals[0]).toMatchObject({
        endTime: expect.any(Number),
        endStationId: BASTILLE,
        status: 2,
        price: 3.25
      });
    });

    it('parks the bike at the return station and adds the distance ridden', () => {
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      returnBike({ rentalId, stationId: BASTILLE });

      expect(findBike(CLASSIC_BIKE)).toMatchObject({ status: 0, stationId: BASTILLE, kilometers: 120 + 11 });
      expect(findStation(BASTILLE).bikeIds).toEqual([5, 6, CLASSIC_BIKE]);
    });

    it('still closes the rental but reports captured: false when the capture fails', () => {
      payment.capturePayment.mockImplementation(() => {
        throw new Error('gateway down');
      });
      const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

      const response = returnBike({ rentalId, stationId: BASTILLE });

      expect(response.statusCode).toBe(200);
      expect(response.body.captured).toBe(false);
      expect(db.rentals[0].status).toBe(2);
    });
  });

  describe('rebalancing', () => {
    it('asks for rebalancing when the return station holds 1.5 times the average number of bikes', () => {
      const rentalId = rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.rentalId;

      returnBike({ rentalId, stationId: REPUBLIQUE });

      expect(console.log).toHaveBeenCalledWith('[INFO] rebalancing triggered 1');
    });

    it('does not ask for rebalancing below that threshold', () => {
      const rentalId = rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.rentalId;

      returnBike({ rentalId, stationId: BASTILLE });

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('rebalancing'));
    });

    it('does not ask for rebalancing when the station is exactly at the threshold', () => {
      const rentalId = rentBike({ userId: CAROL, stationId: MONTPARNASSE }).body.rentalId;
      // After the return: 2 + 3 + 2 + 1 = 8 docked bikes, average 2, threshold 3, Bastille holds 3.
      findStation(REPUBLIQUE).bikeIds = [1, 2];

      returnBike({ rentalId, stationId: BASTILLE });

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('rebalancing'));
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

  it('no longer lists a rented bike and frees its slot', () => {
    rentBike({ userId: ALICE, stationId: REPUBLIQUE });

    const republique = listStations().body[0];

    expect(republique).toMatchObject({ free: 2, electric: 1, slots: 17 });
    expect(republique.bikes.map((bike: { id: number }) => bike.id)).toEqual([1, 2]);
  });
});

describe('handleGetRental', () => {
  it('answers 404 for an unknown rental', () => {
    const response = getRental(99);

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ msg: 'no rental' });
  });

  it('shows the requested rental when it is not the first one in the list', () => {
    rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: CLASSIC_BIKE });
    const aliceRentalId = rentBike({ userId: ALICE, stationId: MONTPARNASSE }).body.rentalId;

    const response = getRental(aliceRentalId);

    expect(response.body).toMatchObject({ id: aliceRentalId, bikeId: 9 });
  });

  it('shows the running duration and price of an open rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const response = getRental(rentalId);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ msg: 'ok', id: rentalId, bikeId: CLASSIC_BIKE, minutes: 45, price: 3.25, open: true });
  });

  it('shows the rental that was asked for when several exist', () => {
    const carolRentalId = rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: CLASSIC_BIKE }).body.rentalId;
    rentBike({ userId: ALICE, stationId: MONTPARNASSE });

    expect(getRental(carolRentalId).body).toMatchObject({ id: carolRentalId, bikeId: CLASSIC_BIKE });
  });

  it.each([
    ['a ride within the flat price', CAROL, CLASSIC_BIKE, 10, 1],
    ['an electric bike', CAROL, ELECTRIC_BIKE, 45, 5.75],
    ['a premium user', ALICE, ELECTRIC_BIKE, 45, 4.6],
    ['a rental of exactly 24 hours', CAROL, CLASSIC_BIKE, 1440, 212.5],
    ['a rental longer than 24 hours', CAROL, CLASSIC_BIKE, 1441, 237.65]
  ])('applies the tariff for %s', (_case, userId, bikeId, minutes, expectedPrice) => {
    const rentalId = rentForMinutes(userId, bikeId, minutes);

    expect(getRental(rentalId).body.price).toBe(expectedPrice);
  });

  it.each([
    ['a basic user', CAROL, 3.5],
    ['a premium user', ALICE, 2.8]
  ])('gives %s an estimate equal to the price within the first 30 minutes', (_case, userId, expectedPrice) => {
    const rentalId = rentForMinutes(userId, ELECTRIC_BIKE, 10);

    expect(getRental(rentalId).body).toMatchObject({ price: expectedPrice, estimate: expectedPrice });
  });

  it('freezes the duration and the price once the bike is returned', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    const chargedPrice = returnBike({ rentalId, stationId: BASTILLE }).body.price;
    clock.advanceMinutes(60);

    const response = getRental(rentalId);

    expect(response.body).toMatchObject({ minutes: 45, price: chargedPrice, open: false });
  });
});

describe('handleRentBike when the payment pre-authorization is declined', () => {
  beforeEach(() => {
    payment.preAuthorizePayment.mockImplementation(() => {
      throw new Error('insufficient funds');
    });
  });

  it('refuses the rental with 402 payment declined', () => {
    const response = rentBike({ userId: CAROL, stationId: REPUBLIQUE });

    expect(response.statusCode).toBe(402);
    expect(response.body).toEqual({ msg: 'payment declined' });
  });

  it('does not record any rental', () => {
    rentBike({ userId: CAROL, stationId: REPUBLIQUE });

    expect(db.rentals).toHaveLength(0);
  });

  it('leaves the bike available at its station', () => {
    rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: ELECTRIC_BIKE });

    expect(findBike(ELECTRIC_BIKE).status).toBe(0);
    expect(findStation(REPUBLIQUE).bikeIds).toEqual([1, 2, 3, 4]);
  });

  it('does not consume a rental id', () => {
    rentBike({ userId: CAROL, stationId: REPUBLIQUE });
    payment.preAuthorizePayment.mockImplementation((_user, amount) => ({ success: true, reference: 'REF-PREAUTH', amount }));

    expect(rentBike({ userId: CAROL, stationId: REPUBLIQUE }).body.rentalId).toBe(1);
  });

  it('logs the refusal with its reason', () => {
    rentBike({ userId: CAROL, stationId: REPUBLIQUE, bikeId: ELECTRIC_BIKE });

    expect(console.log).toHaveBeenCalledWith(
      '[WARN] payment declined {"userId":3,"amount":7.5,"reason":"insufficient funds"}'
    );
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('rental created'));
  });
});

describe('handleGetRental estimate', () => {
  it('gives an estimate equal to the price of the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);

    const response = getRental(rentalId);

    expect(response.body.estimate).toBe(response.body.price);
  });
});

// The seed data guarantees that a rental refers to an existing user and bike. If that is no longer
// true, the data is corrupted: the handlers fail fast instead of charging the wrong price or
// silently skipping the bike.
describe('inconsistent data', () => {
  function deleteRecord<T extends { id: number }>(records: T[], id: number) {
    records.splice(records.indexOf(findById(records, id)), 1);
  }

  it('refuses to return a bike whose rental refers to an unknown user, without closing the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    deleteRecord(db.users, CAROL);

    expect(() => returnBike({ rentalId, stationId: BASTILLE })).toThrow('inconsistent data: user 3 of rental 1 not found');
    expect(findById(db.rentals, rentalId).endTime).toBeNull();
    expect(payment.capturePayment).not.toHaveBeenCalled();
  });

  it('refuses to return a bike whose rental refers to an unknown bike, without closing the rental', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    deleteRecord(db.bikes, CLASSIC_BIKE);

    expect(() => returnBike({ rentalId, stationId: BASTILLE })).toThrow('inconsistent data: bike 1 of rental 1 not found');
    expect(findById(db.rentals, rentalId).endTime).toBeNull();
    expect(payment.capturePayment).not.toHaveBeenCalled();
  });

  it('refuses to show a rental that refers to an unknown user', () => {
    const rentalId = rentForMinutes(CAROL, CLASSIC_BIKE, 45);
    deleteRecord(db.users, CAROL);

    expect(() => getRental(rentalId)).toThrow('inconsistent data: user 3 of rental 1 not found');
  });
});
