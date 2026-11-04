import { Bike, BikeStatus } from '../../domain/bike';
import { selectBike } from '../../domain/bikeSelection';
import { isFraudSuspected } from '../../domain/fraud';
import { computePreAuthorizationAmount } from '../../domain/pricing';
import { Rental } from '../../domain/rental';
import { Station } from '../../domain/station';
import { User } from '../../domain/user';
import { Clock } from '../ports/clock';
import { FleetNotifier } from '../ports/fleetNotifier';
import { FraudScreening } from '../ports/fraudScreening';
import { Logger } from '../ports/logger';
import { PaymentGateway } from '../ports/paymentGateway';
import { BikeRepository, RentalRepository, StationRepository, UserRepository } from '../ports/repositories';
import { refuse, RentRefusal, Result, succeed } from '../result';

export interface RentBikeDependencies {
  readonly stations: StationRepository;
  readonly bikes: BikeRepository;
  readonly users: UserRepository;
  readonly rentals: RentalRepository;
  readonly paymentGateway: PaymentGateway;
  readonly fraudScreening: FraudScreening;
  readonly fleetNotifier: FleetNotifier;
  readonly logger: Logger;
  readonly clock: Clock;
}

export interface RentBikeInput {
  readonly userId: number;
  readonly stationId: number;
  /** The bike the user asks for, or null to get the least used available bike. */
  readonly requestedBikeId: number | null;
}

export interface RentalStarted {
  readonly rental: Rental;
  readonly stationName: string;
}

interface ApprovedRental {
  readonly user: User;
  readonly station: Station;
  readonly bike: Bike;
  readonly preAuthAmount: number;
  readonly paymentReference: string;
}

/** Rents a bike at a station, once every condition is met; a refusal leaves the data untouched. */
export class RentBike {
  constructor(private readonly deps: RentBikeDependencies) {}

  execute(input: RentBikeInput): Result<RentalStarted, RentRefusal> {
    const user = this.deps.users.findById(input.userId);
    if (user === undefined) {
      return refuse(RentRefusal.UserNotFound);
    }
    const station = this.deps.stations.findById(input.stationId);
    if (station === undefined) {
      return refuse(RentRefusal.StationNotFound);
    }
    const bike = selectBike(this.findAvailableBikesAt(station), input.requestedBikeId);
    if (bike === undefined) {
      return refuse(RentRefusal.NoBikeAvailable);
    }
    if (this.deps.rentals.hasOpenRentalFor(user.id)) {
      return refuse(RentRefusal.AlreadyRenting);
    }
    if (!user.hasMinimumCreditToRent()) {
      return refuse(RentRefusal.NotEnoughCredit);
    }
    const preAuthAmount = computePreAuthorizationAmount(bike.isElectric);
    if (isFraudSuspected(this.deps.fraudScreening.scoreOf(user, preAuthAmount))) {
      return refuse(RentRefusal.FraudSuspected);
    }
    const paymentReference = this.preAuthorize(user, preAuthAmount);
    if (paymentReference === undefined) {
      return refuse(RentRefusal.PaymentDeclined);
    }
    return succeed(this.startRental({ user, station, bike, preAuthAmount, paymentReference }));
  }

  /** Reference of the pre-authorized payment, or undefined (and a logged warning) when it is declined. */
  private preAuthorize(user: User, amount: number): string | undefined {
    const preAuthorization = this.deps.paymentGateway.preAuthorize(user, amount);
    if (!preAuthorization.isApproved) {
      this.deps.logger.warn('payment declined', { userId: user.id, amount: amount, reason: preAuthorization.reason });
      return undefined;
    }
    return preAuthorization.reference;
  }

  /** The available bikes of the station, in the order of the data; broken ones are reported on the way. */
  private findAvailableBikesAt(station: Station): Bike[] {
    const availableBikes: Bike[] = [];
    for (const bike of this.deps.bikes.findDockedAt(station.id)) {
      if (bike.status === BikeStatus.Available) {
        availableBikes.push(bike);
      } else if (bike.status === BikeStatus.Broken) {
        this.deps.logger.warn('broken bike at station', bike.id);
      }
    }
    return availableBikes;
  }

  private startRental(approved: ApprovedRental): RentalStarted {
    const rental = Rental.open({
      id: this.deps.rentals.nextId(),
      userId: approved.user.id,
      bikeId: approved.bike.id,
      startStationId: approved.station.id,
      startTime: this.deps.clock.now(),
      paymentReference: approved.paymentReference,
      preAuthAmount: approved.preAuthAmount,
      isElectric: approved.bike.isElectric
    });
    this.deps.rentals.save(rental);
    this.deps.bikes.save(approved.bike.checkOut());
    this.deps.fleetNotifier.rentalCreated(rental.id);
    return { rental, stationName: approved.station.name };
  }
}
