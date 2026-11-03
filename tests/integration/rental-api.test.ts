import request from 'supertest';
import { FastClock, useFastClock } from '../support/fastClock';

// Integration tests: the real Express app with its real modules (routing, JSON parsing,
// handlers, in-memory database and payment client) wired together, without any mock.
// Only the clock is accelerated so that simulated network delays do not slow the suite down.

const ALICE = 1;
const CAROL = 3;
const DAVE = 4;
const REPUBLIQUE = 1;
const BASTILLE = 2;

let app: typeof import('../../src/index').app;
let db: typeof import('../../src/db');
let clock: FastClock;

beforeEach(() => {
  // Fresh modules for every test: each test starts from the seed data.
  jest.resetModules();
  db = require('../../src/db');
  app = require('../../src/index').app;
  clock = useFastClock();
});

describe('rental lifecycle through the HTTP API', () => {
  it('rents, follows and returns a bike, then charges the user', async () => {
    const rental = await request(app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE });
    expect(rental.status).toBe(200);
    expect(rental.body).toMatchObject({ msg: 'ok', bikeId: 4, station: 'Republique', preAuth: 7.5 });
    expect(rental.body.ref).toMatch(/^REF\d+$/);
    const rentalId = rental.body.rentalId;

    clock.advanceMinutes(45);
    const openRental = await request(app).get(`/rentals/${rentalId}`);
    expect(openRental.body).toMatchObject({ id: rentalId, bikeId: 4, minutes: 45, price: 4.6, open: true });

    const returned = await request(app).post('/return').send({ rentalId, stationId: BASTILLE });
    expect(returned.status).toBe(200);
    expect(returned.body).toEqual({ msg: 'ok', rentalId, minutes: 45, price: 4.6, station: 'Bastille', captured: true });

    const closedRental = await request(app).get(`/rentals/${rentalId}`);
    expect(closedRental.body).toMatchObject({ open: false, price: 4.6 });

    expect(creditOf(ALICE)).toBeCloseTo(50 - 4.6);
  });

  it('shows the returned bike at its new station', async () => {
    const rentalId = (await request(app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE })).body.rentalId;
    await request(app).post('/return').send({ rentalId, stationId: BASTILLE });

    const stations = (await request(app).get('/stations')).body;

    const republique = stations.find((station) => station.id === REPUBLIQUE);
    const bastille = stations.find((station) => station.id === BASTILLE);
    expect(republique.bikes.map((bike) => bike.id)).not.toContain(4);
    expect(bastille.bikes.map((bike) => bike.id)).toContain(4);
    expect(bastille).toMatchObject({ free: 2, electric: 1, slots: 12 });
  });

  it('lets a user rent again after returning the bike', async () => {
    const rentalId = (await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE })).body.rentalId;
    await request(app).post('/return').send({ rentalId, stationId: BASTILLE });

    const secondRental = await request(app).post('/rent').send({ userId: CAROL, stationId: BASTILLE });

    expect(secondRental.status).toBe(200);
    expect(secondRental.body.rentalId).toBe(rentalId + 1);
  });

  it('does not let two users rent the same bike', async () => {
    await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE, bikeId: 1 });

    const response = await request(app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE, bikeId: 1 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ msg: 'no bike available' });
  });

  it('leaves the bike available when a blacklisted user is refused', async () => {
    const response = await request(app).post('/rent').send({ userId: DAVE, stationId: REPUBLIQUE });

    expect(response.status).toBe(403);
    const republique = (await request(app).get('/stations')).body[0];
    expect(republique.free).toBe(3);
  });

  it('refuses the rental when the real payment gateway declines the pre-authorization', async () => {
    // 6 of credit: enough to pass the 5 minimum, not enough for the 7.50 electric pre-authorization.
    db.users.find((user) => user.id === CAROL).credit = 6;

    const response = await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE, bikeId: 4 });

    expect(response.status).toBe(402);
    expect(response.body).toEqual({ msg: 'payment declined' });
    expect(db.rentals).toHaveLength(0);
    const republique = (await request(app).get('/stations')).body[0];
    expect(republique.bikes.map((bike) => bike.id)).toContain(4);
  });

  it('lets a declined user rent a cheaper classic bike instead', async () => {
    db.users.find((user) => user.id === CAROL).credit = 6;
    await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE, bikeId: 4 });

    const response = await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE, bikeId: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ msg: 'ok', rentalId: 1, bikeId: 1, preAuth: 5 });
  });

  it('charges the user only once when the same bike is returned twice', async () => {
    const rentalId = (await request(app).post('/rent').send({ userId: CAROL, stationId: REPUBLIQUE })).body.rentalId;
    const firstReturn = await request(app).post('/return').send({ rentalId, stationId: BASTILLE });

    const secondReturn = await request(app).post('/return').send({ rentalId, stationId: BASTILLE });

    expect(secondReturn.status).toBe(409);
    expect(secondReturn.body).toEqual({ msg: 'already returned' });
    expect(creditOf(CAROL)).toBeCloseTo(120 - firstReturn.body.price);
  });
});

describe('HTTP layer', () => {
  it('answers in JSON', async () => {
    const response = await request(app).get('/stations');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('answers 400 to a malformed JSON body', async () => {
    const response = await request(app).post('/rent').set('Content-Type', 'application/json').send('{"userId": 1,');

    expect(response.status).toBe(400);
  });

  it('answers 400 when the body is not JSON', async () => {
    const response = await request(app).post('/rent').type('form').send('userId=1&stationId=1');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ msg: 'bad request' });
  });

  it('answers 404 to an unknown route', async () => {
    expect((await request(app).get('/bikes')).status).toBe(404);
  });

  it('answers 404 to an unknown rental id', async () => {
    const response = await request(app).get('/rentals/not-a-number');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ msg: 'no rental' });
  });
});

function creditOf(userId: number) {
  return db.users.find((user) => user.id === userId).credit;
}
