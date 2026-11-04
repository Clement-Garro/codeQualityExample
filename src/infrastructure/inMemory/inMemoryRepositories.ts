import {
  BikeRepository,
  RentalRepository,
  Repositories,
  StationRepository,
  UserRepository
} from '../../application/ports/repositories';
import { Bike } from '../../domain/bike';
import { Rental } from '../../domain/rental';
import { Station } from '../../domain/station';
import { User } from '../../domain/user';
import { SeedData } from './seedData';

interface Identified {
  readonly id: number;
}

/** Entities kept in memory in the order of the data; saving replaces an entity in place or adds it at the end. */
class InMemoryCollection<T extends Identified> {
  private readonly entities: T[];

  constructor(initialEntities: readonly T[]) {
    this.entities = [...initialEntities];
  }

  findById(id: number): T | undefined {
    return this.entities.find((entity) => entity.id === id);
  }

  findAll(): readonly T[] {
    return [...this.entities];
  }

  save(entity: T): void {
    const index = this.entities.findIndex((candidate) => candidate.id === entity.id);
    if (index === -1) {
      this.entities.push(entity);
    } else {
      this.entities[index] = entity;
    }
  }
}

class InMemoryStationRepository implements StationRepository {
  constructor(private readonly stations: InMemoryCollection<Station>) {}

  findById(id: number): Station | undefined {
    return this.stations.findById(id);
  }

  findAll(): readonly Station[] {
    return this.stations.findAll();
  }
}

class InMemoryBikeRepository implements BikeRepository {
  constructor(private readonly bikes: InMemoryCollection<Bike>) {}

  findById(id: number): Bike | undefined {
    return this.bikes.findById(id);
  }

  findDockedAt(stationId: number): readonly Bike[] {
    return this.bikes.findAll().filter((bike) => bike.stationId === stationId);
  }

  countDocked(): number {
    return this.bikes.findAll().filter((bike) => bike.stationId !== null).length;
  }

  save(bike: Bike): void {
    this.bikes.save(bike);
  }
}

class InMemoryUserRepository implements UserRepository {
  constructor(private readonly users: InMemoryCollection<User>) {}

  findById(id: number): User | undefined {
    return this.users.findById(id);
  }

  save(user: User): void {
    this.users.save(user);
  }
}

class InMemoryRentalRepository implements RentalRepository {
  private readonly rentals = new InMemoryCollection<Rental>([]);
  private nextAvailableId = 1;

  findById(id: number): Rental | undefined {
    return this.rentals.findById(id);
  }

  findAll(): readonly Rental[] {
    return this.rentals.findAll();
  }

  hasOpenRentalFor(userId: number): boolean {
    return this.rentals.findAll().some((rental) => rental.userId === userId && rental.isOpen());
  }

  nextId(): number {
    return this.nextAvailableId++;
  }

  save(rental: Rental): void {
    this.rentals.save(rental);
  }
}

/** Storage of one application: its own copy of the data and its own rental numbering. */
export function createInMemoryRepositories(seed: SeedData): Repositories {
  return {
    stations: new InMemoryStationRepository(new InMemoryCollection(seed.stations)),
    bikes: new InMemoryBikeRepository(new InMemoryCollection(seed.bikes)),
    users: new InMemoryUserRepository(new InMemoryCollection(seed.users)),
    rentals: new InMemoryRentalRepository()
  };
}
