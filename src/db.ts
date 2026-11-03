import { Bike, BikeStatus, Rental, Station, Subscription, User } from './types';

// In-memory storage, reset on every restart.

export const stations: Station[] = [
  { id: 1, name: 'Republique', capacity: 20, latitude: 48.867, longitude: 2.363, bikeIds: [1, 2, 3, 4] },
  { id: 2, name: 'Bastille', capacity: 15, latitude: 48.853, longitude: 2.369, bikeIds: [5, 6] },
  { id: 3, name: 'Montparnasse', capacity: 25, latitude: 48.841, longitude: 2.322, bikeIds: [7, 8, 9] },
  { id: 4, name: 'Nation', capacity: 12, latitude: 48.848, longitude: 2.395, bikeIds: [10] }
];

export const bikes: Bike[] = [
  { id: 1, stationId: 1, status: BikeStatus.Available, kilometers: 120, isElectric: false },
  { id: 2, stationId: 1, status: BikeStatus.Available, kilometers: 340, isElectric: true },
  { id: 3, stationId: 1, status: BikeStatus.Maintenance, kilometers: 900, isElectric: false },
  { id: 4, stationId: 1, status: BikeStatus.Available, kilometers: 12, isElectric: true },
  { id: 5, stationId: 2, status: BikeStatus.Available, kilometers: 55, isElectric: false },
  { id: 6, stationId: 2, status: BikeStatus.Broken, kilometers: 1200, isElectric: false },
  { id: 7, stationId: 3, status: BikeStatus.Available, kilometers: 78, isElectric: true },
  { id: 8, stationId: 3, status: BikeStatus.Available, kilometers: 400, isElectric: false },
  { id: 9, stationId: 3, status: BikeStatus.Available, kilometers: 22, isElectric: false },
  { id: 10, stationId: 4, status: BikeStatus.Available, kilometers: 640, isElectric: true }
];

export const users: User[] = [
  { id: 1, name: 'alice', credit: 50, subscription: Subscription.Premium, isBlacklisted: false },
  { id: 2, name: 'bob', credit: 4, subscription: Subscription.Basic, isBlacklisted: false },
  { id: 3, name: 'carol', credit: 120, subscription: Subscription.Basic, isBlacklisted: false },
  { id: 4, name: 'dave', credit: 30, subscription: Subscription.Basic, isBlacklisted: true }
];

export const rentals: Rental[] = [];

let nextAvailableRentalId = 1;

export function generateRentalId(): number {
  return nextAvailableRentalId++;
}

export function resetRentalIds(): void {
  nextAvailableRentalId = 1;
}
