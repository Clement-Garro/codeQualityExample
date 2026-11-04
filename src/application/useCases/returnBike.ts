import { Bike } from '../../domain/bike';
import { computeRiddenKilometers, isRebalancingNeeded } from '../../domain/fleet';
import { computeDurationMinutes, computeRentalPrice } from '../../domain/pricing';
import { Rental } from '../../domain/rental';
import { Station } from '../../domain/station';
import { User } from '../../domain/user';
import { Clock } from '../ports/clock';
import { FleetNotifier } from '../ports/fleetNotifier';
import { PaymentGateway } from '../ports/paymentGateway';
import { BikeRepository, RentalRepository, StationRepository, UserRepository } from '../ports/repositories';
import { requireExisting } from '../requireExisting';
import { refuse, Result, ReturnRefusal, succeed } from '../result';

export interface ReturnBikeDependencies {
  readonly stations: StationRepository;
  readonly bikes: BikeRepository;
  readonly users: UserRepository;
  readonly rentals: RentalRepository;
  readonly paymentGateway: PaymentGateway;
  readonly fleetNotifier: FleetNotifier;
  readonly clock: Clock;
}

export interface ReturnBikeInput {
  readonly rentalId: number;
  readonly stationId: number;
}

export interface RentalReturned {
  readonly rentalId: number;
  readonly durationMinutes: number;
  readonly price: number;
  readonly stationName: string;
  /** False when the payment could not be captured: the rental is closed anyway. */
  readonly isCaptured: boolean;
}

interface AcceptedReturn {
  readonly rental: Rental;
  readonly station: Station;
  readonly user: User;
  readonly bike: Bike;
}

/** Closes a rental at a station with a free slot, charges the price and parks the bike there. */
export class ReturnBike {
  constructor(private readonly deps: ReturnBikeDependencies) {}

  execute(input: ReturnBikeInput): Result<RentalReturned, ReturnRefusal> {
    const rental = this.deps.rentals.findById(input.rentalId);
    if (rental === undefined) {
      return refuse(ReturnRefusal.RentalNotFound);
    }
    if (!rental.isOpen()) {
      return refuse(ReturnRefusal.AlreadyReturned);
    }
    const station = this.deps.stations.findById(input.stationId);
    if (station === undefined) {
      return refuse(ReturnRefusal.StationNotFound);
    }
    if (!station.hasFreeSlot(this.deps.bikes.findDockedAt(station.id).length)) {
      return refuse(ReturnRefusal.StationFull);
    }
    const user = requireExisting(
      this.deps.users.findById(rental.userId),
      'user ' + rental.userId + ' of rental ' + rental.id
    );
    const bike = requireExisting(
      this.deps.bikes.findById(rental.bikeId),
      'bike ' + rental.bikeId + ' of rental ' + rental.id
    );
    return succeed(this.closeRental({ rental, station, user, bike }));
  }

  private closeRental(accepted: AcceptedReturn): RentalReturned {
    const { rental, station, user, bike } = accepted;
    const durationMinutes = computeDurationMinutes(rental.startTime, this.deps.clock.now());
    const price = computeRentalPrice(durationMinutes, rental.isElectric, user.subscription);
    const capture = this.deps.paymentGateway.capture(user, rental.paymentReference, price);
    if (capture.isCaptured) {
      this.deps.users.save(user.debit(price));
    }
    this.deps.rentals.save(rental.complete({ endTime: this.deps.clock.now(), endStationId: station.id, price: price }));
    this.deps.bikes.save(bike.dockAt(station.id, computeRiddenKilometers(durationMinutes)));
    this.requestRebalancingIfNeeded(station);
    return {
      rentalId: rental.id,
      durationMinutes: durationMinutes,
      price: price,
      stationName: station.name,
      isCaptured: capture.isCaptured
    };
  }

  private requestRebalancingIfNeeded(station: Station): void {
    const occupancy = {
      dockedBikeCount: this.deps.bikes.findDockedAt(station.id).length,
      totalDockedBikeCount: this.deps.bikes.countDocked(),
      stationCount: this.deps.stations.findAll().length
    };
    if (isRebalancingNeeded(occupancy)) {
      this.deps.fleetNotifier.rebalancingRequested(station.id);
    }
  }
}
