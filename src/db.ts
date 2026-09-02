// in memory storage

export const stations = [
  { id: 1, name: 'Republique', cap: 20, lat: 48.867, lng: 2.363, b: [1, 2, 3, 4] },
  { id: 2, name: 'Bastille', cap: 15, lat: 48.853, lng: 2.369, b: [5, 6] },
  { id: 3, name: 'Montparnasse', cap: 25, lat: 48.841, lng: 2.322, b: [7, 8, 9] },
  { id: 4, name: 'Nation', cap: 12, lat: 48.848, lng: 2.395, b: [10] }
];

// s: 0 = available, 1 = rented, 2 = maintenance, 3 = broken
export const bikes = [
  { id: 1, st: 1, s: 0, km: 120, el: false },
  { id: 2, st: 1, s: 0, km: 340, el: true },
  { id: 3, st: 1, s: 2, km: 900, el: false },
  { id: 4, st: 1, s: 0, km: 12, el: true },
  { id: 5, st: 2, s: 0, km: 55, el: false },
  { id: 6, st: 2, s: 3, km: 1200, el: false },
  { id: 7, st: 3, s: 0, km: 78, el: true },
  { id: 8, st: 3, s: 0, km: 400, el: false },
  { id: 9, st: 3, s: 0, km: 22, el: false },
  { id: 10, st: 4, s: 0, km: 640, el: true }
];

export const users = [
  { id: 1, name: 'alice', credit: 50, sub: 'premium', bl: false },
  { id: 2, name: 'bob', credit: 4, sub: 'basic', bl: false },
  { id: 3, name: 'carol', credit: 120, sub: 'basic', bl: false },
  { id: 4, name: 'dave', credit: 30, sub: 'basic', bl: true }
];

export const rentals: any[] = [];

let currentRentalId = 1;

export function nextRentalId() {
  return currentRentalId++;
}

export function resetIds() {
  currentRentalId = 1;
}
