import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../../src/index';

// End-to-end: a real HTTP server on a free port, called with fetch like a real client.
// Nothing is mocked or accelerated (real clock, real simulated delays), so these tests are slow
// and kept few: they check one complete user journey and one error path.

jest.setTimeout(30_000);

let server: Server;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

async function callApi(method: 'GET' | 'POST', path: string, body?: object) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function findStation(stations: any[], name: string) {
  return stations.find((station) => station.name === name);
}

it('a rider finds a bike, rides it and returns it at another station', async () => {
  const stationsBefore = (await callApi('GET', '/stations')).body;
  expect(findStation(stationsBefore, 'Montparnasse').free).toBe(3);
  expect(findStation(stationsBefore, 'Nation').free).toBe(1);

  const rental = await callApi('POST', '/rent', { userId: 3, stationId: 3 });
  expect(rental.status).toBe(200);
  expect(rental.body).toMatchObject({ msg: 'ok', bikeId: 9, station: 'Montparnasse', preAuth: 5 });

  const openRental = await callApi('GET', `/rentals/${rental.body.rentalId}`);
  expect(openRental.body).toMatchObject({ bikeId: 9, open: true, minutes: 0, price: 1 });

  const returned = await callApi('POST', '/return', { rentalId: rental.body.rentalId, stationId: 4 });
  expect(returned.status).toBe(200);
  expect(returned.body).toMatchObject({ station: 'Nation', minutes: 0, price: 1, captured: true });

  const closedRental = await callApi('GET', `/rentals/${rental.body.rentalId}`);
  expect(closedRental.body.open).toBe(false);

  const stationsAfter = (await callApi('GET', '/stations')).body;
  expect(findStation(stationsAfter, 'Montparnasse').free).toBe(2);
  expect(findStation(stationsAfter, 'Nation').free).toBe(2);
  expect(findStation(stationsAfter, 'Nation').bikes.map((bike: { id: number }) => bike.id)).toContain(9);
});

it('a rider sending an incomplete request gets a clear error', async () => {
  const response = await callApi('POST', '/rent', { userId: 3 });

  expect(response).toEqual({ status: 400, body: { msg: 'bad request' } });
});
