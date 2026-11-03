// Domain types. Status values are the numbers stored since the beginning: they are kept so that
// the data and the API stay unchanged, but the code only refers to them by name.

export enum BikeStatus {
  Available = 0,
  Rented = 1,
  Maintenance = 2,
  Broken = 3
}

export enum RentalStatus {
  Open = 1,
  Completed = 2
}

// A const object rather than a string enum: callers can still pass 'basic' or 'premium' literals.
export const Subscription = {
  Basic: 'basic',
  Premium: 'premium'
} as const;
export type Subscription = (typeof Subscription)[keyof typeof Subscription];

export interface Station {
  id: number;
  name: string;
  capacity: number;
  latitude: number;
  longitude: number;
  bikeIds: number[];
}

export interface Bike {
  id: number;
  stationId: number;
  status: BikeStatus;
  kilometers: number;
  isElectric: boolean;
}

export interface User {
  id: number;
  name: string;
  credit: number;
  subscription: Subscription;
  isBlacklisted: boolean;
}

export interface Rental {
  id: number;
  userId: number;
  bikeId: number;
  startStationId: number;
  startTime: number;
  endTime: number | null;
  endStationId: number | null;
  paymentReference: string;
  preAuthAmount: number;
  isElectric: boolean;
  status: RentalStatus;
  price?: number;
}
