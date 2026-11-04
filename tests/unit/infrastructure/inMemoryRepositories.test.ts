import { Bike, BikeStatus } from '../../../src/domain/bike';
import { Rental } from '../../../src/domain/rental';
import { User } from '../../../src/domain/user';
import { createInMemoryRepositories } from '../../../src/infrastructure/inMemory/inMemoryRepositories';
import { createSeedData } from '../../../src/infrastructure/inMemory/seedData';

const ALICE = 1;
const CAROL = 3;
const REPUBLIQUE = 1;
const BASTILLE = 2;
const UNKNOWN_ID = 99;
const CLASSIC_BIKE = 1;
const ELECTRIC_BIKE = 4;

function openRentalFor(userId: number, id: number) {
  return Rental.open({
    id,
    userId,
    bikeId: ELECTRIC_BIKE,
    startStationId: REPUBLIQUE,
    startTime: 0,
    paymentReference: 'REF-PREAUTH',
    preAuthAmount: 7.5,
    isElectric: true
  });
}

let repositories: ReturnType<typeof createInMemoryRepositories>;

beforeEach(() => {
  repositories = createInMemoryRepositories(createSeedData());
});

describe('station repository', () => {
  it('finds a station by id', () => {
    expect(repositories.stations.findById(BASTILLE)?.name).toBe('Bastille');
  });

  it('finds nothing for an unknown id', () => {
    expect(repositories.stations.findById(UNKNOWN_ID)).toBeUndefined();
  });

  it('lists the stations in the order of the data', () => {
    expect(repositories.stations.findAll().map((station) => station.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('bike repository', () => {
  it('finds a bike by id', () => {
    expect(repositories.bikes.findById(ELECTRIC_BIKE)?.kilometers).toBe(12);
  });

  it('finds nothing for an unknown id', () => {
    expect(repositories.bikes.findById(UNKNOWN_ID)).toBeUndefined();
  });

  it('lists the bikes parked at a station in the order of the data, whatever their status', () => {
    expect(repositories.bikes.findDockedAt(REPUBLIQUE).map((bike) => bike.id)).toEqual([1, 2, 3, 4]);
  });

  it('counts every parked bike', () => {
    expect(repositories.bikes.countDocked()).toBe(10);
  });

  it('replaces a bike when it is saved, at the same place in the data', () => {
    const classicBike = repositories.bikes.findById(CLASSIC_BIKE)!;
    const rentedBike = Bike.restore({ ...classicBike, status: BikeStatus.Rented, stationId: null });

    repositories.bikes.save(rentedBike);

    expect(repositories.bikes.findById(CLASSIC_BIKE)).toBe(rentedBike);
    expect(repositories.bikes.findDockedAt(REPUBLIQUE).map((bike) => bike.id)).toEqual([2, 3, 4]);
    expect(repositories.bikes.countDocked()).toBe(9);
  });

  it('keeps the data order when a bike is parked at another station', () => {
    const rentedBike = repositories.bikes.findById(CLASSIC_BIKE)!.checkOut();
    repositories.bikes.save(rentedBike);

    repositories.bikes.save(rentedBike.dockAt(BASTILLE, 0));

    expect(repositories.bikes.findDockedAt(BASTILLE).map((bike) => bike.id)).toEqual([CLASSIC_BIKE, 5, 6]);
  });
});

describe('user repository', () => {
  it('finds a user by id', () => {
    expect(repositories.users.findById(CAROL)?.credit).toBe(120);
  });

  it('finds nothing for an unknown id', () => {
    expect(repositories.users.findById(UNKNOWN_ID)).toBeUndefined();
  });

  it('replaces a user when it is saved', () => {
    const debitedCarol = User.restore({ ...repositories.users.findById(CAROL)!, credit: 6 });

    repositories.users.save(debitedCarol);

    expect(repositories.users.findById(CAROL)).toBe(debitedCarol);
  });
});

describe('rental repository', () => {
  it('starts without any rental', () => {
    expect(repositories.rentals.findAll()).toEqual([]);
  });

  it('gives rental ids starting at 1 and increasing on every call', () => {
    expect(repositories.rentals.nextId()).toBe(1);
    expect(repositories.rentals.nextId()).toBe(2);
    expect(repositories.rentals.nextId()).toBe(3);
  });

  it('numbers the rentals of each storage independently', () => {
    repositories.rentals.nextId();
    repositories.rentals.nextId();

    const otherRepositories = createInMemoryRepositories(createSeedData());

    expect(otherRepositories.rentals.nextId()).toBe(1);
  });

  it('adds a new rental and finds it by id', () => {
    const rental = openRentalFor(CAROL, 1);

    repositories.rentals.save(rental);

    expect(repositories.rentals.findById(1)).toBe(rental);
    expect(repositories.rentals.findAll()).toEqual([rental]);
  });

  it('replaces a rental when it is saved again', () => {
    repositories.rentals.save(openRentalFor(ALICE, 1));
    const completedRental = openRentalFor(ALICE, 1).complete({ endTime: 1, endStationId: BASTILLE, price: 1 });

    repositories.rentals.save(completedRental);

    expect(repositories.rentals.findAll()).toEqual([completedRental]);
  });

  it('finds nothing for an unknown id', () => {
    expect(repositories.rentals.findById(UNKNOWN_ID)).toBeUndefined();
  });

  it('knows whether a user has an open rental', () => {
    repositories.rentals.save(openRentalFor(CAROL, 1));

    expect(repositories.rentals.hasOpenRentalFor(CAROL)).toBe(true);
    expect(repositories.rentals.hasOpenRentalFor(ALICE)).toBe(false);
  });

  it('does not count a returned rental as open', () => {
    repositories.rentals.save(openRentalFor(CAROL, 1).complete({ endTime: 1, endStationId: BASTILLE, price: 1 }));

    expect(repositories.rentals.hasOpenRentalFor(CAROL)).toBe(false);
  });
});
