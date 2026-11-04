import { Bike, BikeStatus } from '../../../src/domain/bike';
import { Rental } from '../../../src/domain/rental';
import { Station } from '../../../src/domain/station';
import {
  formatRentalDetails,
  formatRentalReturned,
  formatRentalStarted,
  formatStationOverview
} from '../../../src/presentation/http/responses';

const START_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);
const REPUBLIQUE = Station.restore({ id: 1, name: 'Republique', capacity: 20, latitude: 48.867, longitude: 2.363 });
const ALICE_RENTAL = Rental.open({
  id: 1,
  userId: 1,
  bikeId: 4,
  startStationId: 1,
  startTime: START_TIME,
  paymentReference: 'REF-PREAUTH',
  preAuthAmount: 7.5,
  isElectric: true
});

function bike(id: number, status: BikeStatus, kilometers: number, isElectric: boolean) {
  return Bike.restore({ id, stationId: 1, status, kilometers, isElectric });
}

describe('formatRentalStarted', () => {
  it('answers with the rental summary of the current contract', () => {
    const body = formatRentalStarted({ rental: ALICE_RENTAL, stationName: 'Republique' });

    expect(body).toEqual({
      msg: 'ok',
      rentalId: 1,
      bikeId: 4,
      station: 'Republique',
      preAuth: 7.5,
      ref: 'REF-PREAUTH'
    });
    expect(Object.keys(body)).toEqual(['msg', 'rentalId', 'bikeId', 'station', 'preAuth', 'ref']);
  });

  it('rounds the pre-authorized amount to the cent', () => {
    const rental = Rental.restore({ ...ALICE_RENTAL, preAuthAmount: 5.004 });

    expect(formatRentalStarted({ rental, stationName: 'Republique' }).preAuth).toBe(5);
  });
});

describe('formatRentalReturned', () => {
  it('answers with the return summary of the current contract', () => {
    const body = formatRentalReturned({
      rentalId: 1,
      durationMinutes: 45,
      price: 3.25,
      stationName: 'Bastille',
      isCaptured: true
    });

    expect(body).toEqual({ msg: 'ok', rentalId: 1, minutes: 45, price: 3.25, station: 'Bastille', captured: true });
    expect(Object.keys(body)).toEqual(['msg', 'rentalId', 'minutes', 'price', 'station', 'captured']);
  });

  it('reports captured: false when the payment could not be captured', () => {
    const body = formatRentalReturned({
      rentalId: 1,
      durationMinutes: 45,
      price: 3.25,
      stationName: 'Bastille',
      isCaptured: false
    });

    expect(body.captured).toBe(false);
  });
});

describe('formatStationOverview', () => {
  const overview = {
    station: REPUBLIQUE,
    zone: 'north' as const,
    weather: 'clear' as const,
    listedBikes: [bike(4, BikeStatus.Available, 12, true), bike(6, BikeStatus.Broken, 1200, false)],
    freeBikeCount: 1,
    freeElectricBikeCount: 1,
    freeSlotCount: 16
  };

  it('describes the station with the keys of the current contract', () => {
    const body = formatStationOverview(overview);

    expect(body).toEqual({
      id: 1,
      name: 'Republique',
      zone: 'north',
      weather: 'clear',
      free: 1,
      electric: 1,
      slots: 16,
      bikes: [
        { id: 4, el: true, km: 12 },
        { id: 6, el: false, km: 1200, broken: true }
      ]
    });
    expect(Object.keys(body)).toEqual(['id', 'name', 'zone', 'weather', 'free', 'electric', 'slots', 'bikes']);
  });

  it('marks only the broken bikes, after the other bike fields', () => {
    const [availableBike, brokenBike] = formatStationOverview(overview).bikes;

    expect(Object.keys(availableBike)).toEqual(['id', 'el', 'km']);
    expect(Object.keys(brokenBike)).toEqual(['id', 'el', 'km', 'broken']);
  });
});

describe('formatRentalDetails', () => {
  it('shows the running duration and price of an open rental', () => {
    const body = formatRentalDetails({ rental: ALICE_RENTAL, durationMinutes: 45, price: 4.6, isOpen: true });

    expect(body).toEqual({ msg: 'ok', id: 1, bikeId: 4, minutes: 45, price: 4.6, estimate: 4.6, open: true });
    expect(Object.keys(body)).toEqual(['msg', 'id', 'bikeId', 'minutes', 'price', 'estimate', 'open']);
  });

  it('gives an estimate equal to the price of the rental', () => {
    const body = formatRentalDetails({ rental: ALICE_RENTAL, durationMinutes: 10, price: 2.8, isOpen: false });

    expect(body.estimate).toBe(body.price);
    expect(body.open).toBe(false);
  });
});
