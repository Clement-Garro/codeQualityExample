import { Bike, BikeStatus } from '../../domain/bike';
import { Station } from '../../domain/station';
import { Subscription, User } from '../../domain/user';

export interface SeedData {
  readonly stations: readonly Station[];
  readonly bikes: readonly Bike[];
  readonly users: readonly User[];
}

/** Demonstration data of the service, built anew on every call. The location of each bike is its stationId. */
export function createSeedData(): SeedData {
  return {
    stations: [
      Station.restore({ id: 1, name: 'Republique', capacity: 20, latitude: 48.867, longitude: 2.363 }),
      Station.restore({ id: 2, name: 'Bastille', capacity: 15, latitude: 48.853, longitude: 2.369 }),
      Station.restore({ id: 3, name: 'Montparnasse', capacity: 25, latitude: 48.841, longitude: 2.322 }),
      Station.restore({ id: 4, name: 'Nation', capacity: 12, latitude: 48.848, longitude: 2.395 })
    ],
    bikes: [
      Bike.restore({ id: 1, stationId: 1, status: BikeStatus.Available, kilometers: 120, isElectric: false }),
      Bike.restore({ id: 2, stationId: 1, status: BikeStatus.Available, kilometers: 340, isElectric: true }),
      Bike.restore({ id: 3, stationId: 1, status: BikeStatus.Maintenance, kilometers: 900, isElectric: false }),
      Bike.restore({ id: 4, stationId: 1, status: BikeStatus.Available, kilometers: 12, isElectric: true }),
      Bike.restore({ id: 5, stationId: 2, status: BikeStatus.Available, kilometers: 55, isElectric: false }),
      Bike.restore({ id: 6, stationId: 2, status: BikeStatus.Broken, kilometers: 1200, isElectric: false }),
      Bike.restore({ id: 7, stationId: 3, status: BikeStatus.Available, kilometers: 78, isElectric: true }),
      Bike.restore({ id: 8, stationId: 3, status: BikeStatus.Available, kilometers: 400, isElectric: false }),
      Bike.restore({ id: 9, stationId: 3, status: BikeStatus.Available, kilometers: 22, isElectric: false }),
      Bike.restore({ id: 10, stationId: 4, status: BikeStatus.Available, kilometers: 640, isElectric: true })
    ],
    users: [
      User.restore({ id: 1, name: 'alice', credit: 50, subscription: Subscription.Premium, isBlacklisted: false }),
      User.restore({ id: 2, name: 'bob', credit: 4, subscription: Subscription.Basic, isBlacklisted: false }),
      User.restore({ id: 3, name: 'carol', credit: 120, subscription: Subscription.Basic, isBlacklisted: false }),
      User.restore({ id: 4, name: 'dave', credit: 30, subscription: Subscription.Basic, isBlacklisted: true })
    ]
  };
}
