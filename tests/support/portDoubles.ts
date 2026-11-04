import { Clock } from '../../src/application/ports/clock';
import { FleetNotifier } from '../../src/application/ports/fleetNotifier';
import { FraudScreening } from '../../src/application/ports/fraudScreening';
import { LocationDescription, LocationService } from '../../src/application/ports/locationService';
import { Logger } from '../../src/application/ports/logger';
import { Repositories } from '../../src/application/ports/repositories';
import { Bike, BikeProperties } from '../../src/domain/bike';
import { Rental } from '../../src/domain/rental';
import { Station } from '../../src/domain/station';
import { User, UserProperties } from '../../src/domain/user';
import { createInMemoryRepositories } from '../../src/infrastructure/inMemory/inMemoryRepositories';
import { createSeedData, SeedData } from '../../src/infrastructure/inMemory/seedData';
import { FakePaymentGateway } from './fakePaymentGateway';

// Named seed data (see src/infrastructure/inMemory/seedData.ts).
export const ALICE = 1; // premium, credit 50
export const BOB = 2; // basic, credit 4
export const CAROL = 3; // basic, credit 120
export const DAVE = 4; // basic, blacklisted

export const REPUBLIQUE = 1; // bikes 1 (120 km), 2 (electric, 340 km), 3 (maintenance), 4 (electric, 12 km)
export const BASTILLE = 2; // bikes 5 (55 km), 6 (broken)
export const MONTPARNASSE = 3; // bikes 7 (electric, 78 km), 8 (400 km), 9 (22 km)
export const NATION = 4; // bike 10 (electric, 640 km)

export const CLASSIC_BIKE = 1;
export const ELECTRIC_BIKE = 4;

const ONE_MINUTE_MS = 60_000;
export const START_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);

/** Clock that only moves when the test says so. */
export class ControlledClock implements Clock {
  private currentTime = START_TIME;

  now(): number {
    return this.currentTime;
  }

  advanceMinutes(minutes: number): void {
    this.currentTime += minutes * ONE_MINUTE_MS;
  }
}

/** Geolocation service answering the same zone and weather for every place. */
export class FixedLocationService implements LocationService {
  readonly describe = jest.fn((_latitude: number, _longitude: number): LocationDescription => this.location);

  constructor(private readonly location: LocationDescription = { zone: 'north', weather: 'clear' }) {}
}

/** Anti-fraud service answering a score chosen by the test (0 by default: no risk). */
export class FixedFraudScreening implements FraudScreening {
  private score = 0;

  readonly scoreOf = jest.fn((_user: unknown, _amount: number): number => this.score);

  answerScore(score: number): void {
    this.score = score;
  }
}

export class RecordingFleetNotifier implements FleetNotifier {
  readonly rentalCreated = jest.fn((_rentalId: number): void => undefined);
  readonly rebalancingRequested = jest.fn((_stationId: number): void => undefined);
}

export class RecordingLogger implements Logger {
  readonly info = jest.fn((_message: string, _context: unknown): void => undefined);
  readonly warn = jest.fn((_message: string, _context: unknown): void => undefined);
}

/**
 * Everything a use case may depend on: the real in-memory storage, filled with the seed data,
 * and doubles for the external systems (payment, geolocation, anti-fraud, fleet, logs, clock).
 */
export function createUseCaseFixture(seed: SeedData = createSeedData()) {
  const repositories: Repositories = createInMemoryRepositories(seed);
  return {
    ...repositories,
    paymentGateway: new FakePaymentGateway(),
    locationService: new FixedLocationService(),
    fraudScreening: new FixedFraudScreening(),
    fleetNotifier: new RecordingFleetNotifier(),
    logger: new RecordingLogger(),
    clock: new ControlledClock()
  };
}

export type UseCaseFixture = ReturnType<typeof createUseCaseFixture>;

function requireFound<T>(record: T | undefined, description: string): T {
  if (record === undefined) {
    throw new Error(`test setup: no ${description}`);
  }
  return record;
}

export function findUser(fixture: UseCaseFixture, id: number): User {
  return requireFound(fixture.users.findById(id), 'user ' + id);
}

export function findBike(fixture: UseCaseFixture, id: number): Bike {
  return requireFound(fixture.bikes.findById(id), 'bike ' + id);
}

export function findRental(fixture: UseCaseFixture, id: number): Rental {
  return requireFound(fixture.rentals.findById(id), 'rental ' + id);
}

export function dockedBikeIdsAt(fixture: UseCaseFixture, stationId: number): number[] {
  return fixture.bikes.findDockedAt(stationId).map((bike) => bike.id);
}

export function updateUser(fixture: UseCaseFixture, id: number, changes: Partial<UserProperties>): void {
  fixture.users.save(User.restore({ ...findUser(fixture, id), ...changes }));
}

export function updateBike(fixture: UseCaseFixture, id: number, changes: Partial<BikeProperties>): void {
  fixture.bikes.save(Bike.restore({ ...findBike(fixture, id), ...changes }));
}

export function seedWithCapacity(stationId: number, capacity: number): SeedData {
  const seed = createSeedData();
  const stations = seed.stations.map((station) =>
    station.id === stationId ? Station.restore({ ...station, capacity }) : station
  );
  return { ...seed, stations };
}

/** Simulates corrupted data: the record still exists, but can no longer be found. */
export function makeUnfindable(repository: { findById(id: number): unknown }, missingId: number): void {
  const findRecord = repository.findById.bind(repository);
  jest
    .spyOn(repository, 'findById')
    .mockImplementation((id: number) => (id === missingId ? undefined : findRecord(id)));
}

/**
 * Arranges an open rental straight in the storage, as the rent use case would leave it:
 * the bike is taken out of its station and the payment pre-authorized under 'REF-PREAUTH'.
 */
export function startRental(fixture: UseCaseFixture, userId: number, bikeId: number): Rental {
  const bike = findBike(fixture, bikeId);
  const startStationId = requireFound(bike.stationId ?? undefined, 'station for bike ' + bikeId);
  fixture.bikes.save(bike.checkOut());
  const rental = Rental.open({
    id: fixture.rentals.nextId(),
    userId,
    bikeId,
    startStationId,
    startTime: fixture.clock.now(),
    paymentReference: 'REF-PREAUTH',
    preAuthAmount: bike.isElectric ? 7.5 : 5,
    isElectric: bike.isElectric
  });
  fixture.rentals.save(rental);
  return rental;
}
