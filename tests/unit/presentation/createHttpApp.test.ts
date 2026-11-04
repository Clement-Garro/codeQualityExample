import request from 'supertest';
import {
  RentalLookupRefusal,
  refuse,
  RentRefusal,
  Result,
  ReturnRefusal,
  succeed
} from '../../../src/application/result';
import { RentalDetails } from '../../../src/application/useCases/getRental';
import { StationOverview } from '../../../src/application/useCases/listStations';
import { RentalStarted, RentBikeInput } from '../../../src/application/useCases/rentBike';
import { RentalReturned, ReturnBikeInput } from '../../../src/application/useCases/returnBike';
import { InconsistentDataError } from '../../../src/domain/errors';
import { Rental } from '../../../src/domain/rental';
import { Station } from '../../../src/domain/station';
import { createHttpApp } from '../../../src/presentation/http/createHttpApp';

// The HTTP layer is tested alone: the use cases are replaced by doubles, so that each test checks the
// conversion of the request, the call and the translation of the result into the current contract.

const RENTAL = Rental.open({
  id: 1,
  userId: 3,
  bikeId: 4,
  startStationId: 1,
  startTime: 0,
  paymentReference: 'REF-PREAUTH',
  preAuthAmount: 7.5,
  isElectric: true
});
const REPUBLIQUE = Station.restore({ id: 1, name: 'Republique', capacity: 20, latitude: 48.867, longitude: 2.363 });

function createUseCaseDoubles() {
  return {
    rentBike: {
      execute: jest.fn(
        (_input: RentBikeInput): Result<RentalStarted, RentRefusal> =>
          succeed({ rental: RENTAL, stationName: 'Republique' })
      )
    },
    returnBike: {
      execute: jest.fn(
        (_input: ReturnBikeInput): Result<RentalReturned, ReturnRefusal> =>
          succeed({ rentalId: 1, durationMinutes: 45, price: 3.25, stationName: 'Bastille', isCaptured: true })
      )
    },
    getRental: {
      execute: jest.fn(
        (_rentalId: number): Result<RentalDetails, RentalLookupRefusal> =>
          succeed({ rental: RENTAL, durationMinutes: 45, price: 5.75, isOpen: true })
      )
    },
    listStations: {
      execute: jest.fn((): StationOverview[] => [
        {
          station: REPUBLIQUE,
          zone: 'north',
          weather: 'clear',
          listedBikes: [],
          freeBikeCount: 0,
          freeElectricBikeCount: 0,
          freeSlotCount: 20
        }
      ])
    }
  };
}

let useCases: ReturnType<typeof createUseCaseDoubles>;
let app: ReturnType<typeof createHttpApp>;

beforeEach(() => {
  useCases = createUseCaseDoubles();
  app = createHttpApp(useCases);
});

describe('POST /rent', () => {
  it('rents with the converted input and answers with the rental summary', async () => {
    const response = await request(app).post('/rent').send({ userId: 3, stationId: 1 });

    expect(useCases.rentBike.execute).toHaveBeenCalledWith({ userId: 3, stationId: 1, requestedBikeId: null });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      msg: 'ok',
      rentalId: 1,
      bikeId: 4,
      station: 'Republique',
      preAuth: 7.5,
      ref: 'REF-PREAUTH'
    });
  });

  it('accepts ids sent as numeric strings', async () => {
    await request(app).post('/rent').send({ userId: '3', stationId: '1', bikeId: '2' });

    expect(useCases.rentBike.execute).toHaveBeenCalledWith({ userId: 3, stationId: 1, requestedBikeId: 2 });
  });

  it.each([
    ['an empty body', {}],
    ['a missing userId', { stationId: 1 }],
    ['a missing stationId', { userId: 3 }],
    ['an empty userId', { userId: '', stationId: 1 }],
    ['a null stationId', { userId: 3, stationId: null }]
  ])('answers 400 for %s without renting', async (_case, body) => {
    const response = await request(app).post('/rent').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ msg: 'bad request' });
    expect(useCases.rentBike.execute).not.toHaveBeenCalled();
  });

  it('translates a refusal into its status and message', async () => {
    useCases.rentBike.execute.mockReturnValueOnce(refuse(RentRefusal.NotEnoughCredit));

    const response = await request(app).post('/rent').send({ userId: 2, stationId: 1 });

    expect(response.status).toBe(402);
    expect(response.body).toEqual({ msg: 'not enough credit' });
  });
});

describe('POST /return', () => {
  it('returns with the converted input and answers with the return summary', async () => {
    const response = await request(app).post('/return').send({ rentalId: '1', stationId: 2 });

    expect(useCases.returnBike.execute).toHaveBeenCalledWith({ rentalId: 1, stationId: 2 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      msg: 'ok',
      rentalId: 1,
      minutes: 45,
      price: 3.25,
      station: 'Bastille',
      captured: true
    });
  });

  it.each([
    ['an empty body', {}],
    ['a missing rentalId', { stationId: 2 }],
    ['a missing stationId', { rentalId: 1 }]
  ])('answers 400 for %s without returning', async (_case, body) => {
    const response = await request(app).post('/return').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ msg: 'bad request' });
    expect(useCases.returnBike.execute).not.toHaveBeenCalled();
  });

  it('translates a refusal into its status and message', async () => {
    useCases.returnBike.execute.mockReturnValueOnce(refuse(ReturnRefusal.StationFull));

    const response = await request(app).post('/return').send({ rentalId: 1, stationId: 4 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ msg: 'station full' });
  });
});

describe('GET /stations', () => {
  it('describes every station in JSON', async () => {
    const response = await request(app).get('/stations');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual([
      { id: 1, name: 'Republique', zone: 'north', weather: 'clear', free: 0, electric: 0, slots: 20, bikes: [] }
    ]);
  });
});

describe('GET /rentals/:id', () => {
  it('shows the rental with the converted id', async () => {
    const response = await request(app).get('/rentals/1');

    expect(useCases.getRental.execute).toHaveBeenCalledWith(1);
    expect(response.body).toEqual({
      msg: 'ok',
      id: 1,
      bikeId: 4,
      minutes: 45,
      price: 5.75,
      estimate: 5.75,
      open: true
    });
  });

  it('answers 404 to a rental id that is not a number', async () => {
    useCases.getRental.execute.mockReturnValueOnce(refuse(RentalLookupRefusal.RentalNotFound));

    const response = await request(app).get('/rentals/not-a-number');

    expect(useCases.getRental.execute).toHaveBeenCalledWith(NaN);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ msg: 'no rental' });
  });
});

describe('errors left to Express', () => {
  it('answers 400 to a malformed JSON body', async () => {
    const response = await request(app).post('/rent').set('Content-Type', 'application/json').send('{"userId": 1,');

    expect(response.status).toBe(400);
    expect(useCases.rentBike.execute).not.toHaveBeenCalled();
  });

  it('answers 404 to an unknown route', async () => {
    expect((await request(app).get('/bikes')).status).toBe(404);
  });

  it('answers 500 when the data is corrupted', async () => {
    useCases.getRental.execute.mockImplementationOnce(() => {
      throw new InconsistentDataError('user 3 of rental 1');
    });

    expect((await request(app).get('/rentals/1')).status).toBe(500);
  });
});
