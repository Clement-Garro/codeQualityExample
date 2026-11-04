import { Bike } from '../../domain/bike';
import { Rental } from '../../domain/rental';
import { Station } from '../../domain/station';
import { User } from '../../domain/user';

export interface StationRepository {
  findById(id: number): Station | undefined;
  /** Every station, in the order of the data. */
  findAll(): readonly Station[];
}

export interface BikeRepository {
  findById(id: number): Bike | undefined;
  /** The bikes parked at the station, whatever their status, in the order of the data. */
  findDockedAt(stationId: number): readonly Bike[];
  /** The number of bikes parked at any station. */
  countDocked(): number;
  save(bike: Bike): void;
}

export interface UserRepository {
  findById(id: number): User | undefined;
  save(user: User): void;
}

export interface RentalRepository {
  findById(id: number): Rental | undefined;
  findAll(): readonly Rental[];
  hasOpenRentalFor(userId: number): boolean;
  /** The id of the next rental: consumed only when a rental is actually created. */
  nextId(): number;
  save(rental: Rental): void;
}

export interface Repositories {
  readonly stations: StationRepository;
  readonly bikes: BikeRepository;
  readonly users: UserRepository;
  readonly rentals: RentalRepository;
}
