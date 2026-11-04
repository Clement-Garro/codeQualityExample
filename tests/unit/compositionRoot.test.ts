import request from 'supertest';
import { createApplication } from '../../src/compositionRoot';
import { useFastClock } from '../support/fastClock';

const ALICE = 1;
const REPUBLIQUE = 1;

beforeEach(() => {
  useFastClock();
});

describe('createApplication', () => {
  it('gives every application its own data', async () => {
    const firstApplication = createApplication();
    const secondApplication = createApplication();

    await request(firstApplication.app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE });

    const republique = (await request(secondApplication.app).get('/stations')).body[0];
    expect(republique).toMatchObject({ free: 3, slots: 16 });
    expect(firstApplication.repositories.rentals.findAll()).toHaveLength(1);
    expect(secondApplication.repositories.rentals.findAll()).toHaveLength(0);
  });

  it('numbers the rentals of every application from 1', async () => {
    await request(createApplication().app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE });

    const rental = await request(createApplication().app).post('/rent').send({ userId: ALICE, stationId: REPUBLIQUE });

    expect(rental.body.rentalId).toBe(1);
  });

  it('answers in JSON through the routes of the current contract', async () => {
    const response = await request(createApplication().app).get('/rentals/1');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ msg: 'no rental' });
  });
});
