// in memory storage

export const stations = [
  { id: 1, name: 'Republique', capacity: 20, latitude: 48.867, longitude: 2.363, bikeIds: [1, 2, 3, 4] },
  { id: 2, name: 'Bastille', capacity: 15, latitude: 48.853, longitude: 2.369, bikeIds: [5, 6] },
  { id: 3, name: 'Montparnasse', capacity: 25, latitude: 48.841, longitude: 2.322, bikeIds: [7, 8, 9] },
  { id: 4, name: 'Nation', capacity: 12, latitude: 48.848, longitude: 2.395, bikeIds: [10] }
];

// status: 0 = available, 1 = rented, 2 = maintenance, 3 = broken
export const bikes = [
  { id: 1, stationId: 1, status: 0, kilometers: 120, isElectric: false },
  { id: 2, stationId: 1, status: 0, kilometers: 340, isElectric: true },
  { id: 3, stationId: 1, status: 2, kilometers: 900, isElectric: false },
  { id: 4, stationId: 1, status: 0, kilometers: 12, isElectric: true },
  { id: 5, stationId: 2, status: 0, kilometers: 55, isElectric: false },
  { id: 6, stationId: 2, status: 3, kilometers: 1200, isElectric: false },
  { id: 7, stationId: 3, status: 0, kilometers: 78, isElectric: true },
  { id: 8, stationId: 3, status: 0, kilometers: 400, isElectric: false },
  { id: 9, stationId: 3, status: 0, kilometers: 22, isElectric: false },
  { id: 10, stationId: 4, status: 0, kilometers: 640, isElectric: true }
];

export const users = [
  { id: 1, name: 'alice', credit: 50, subscription: 'premium', isBlacklisted: false },
  { id: 2, name: 'bob', credit: 4, subscription: 'basic', isBlacklisted: false },
  { id: 3, name: 'carol', credit: 120, subscription: 'basic', isBlacklisted: false },
  { id: 4, name: 'dave', credit: 30, subscription: 'basic', isBlacklisted: true }
];

export const rentals: any[] = [];

let nextAvailableRentalId = 1;

export function generateRentalId() {
  return nextAvailableRentalId++;
}

export function resetRentalIds() {
  nextAvailableRentalId = 1;
}
