import { DomainRuleViolation } from './errors';
import { computeDurationMinutes } from './pricing';

// Status values are the numbers stored since the beginning, kept so that the data stays unchanged.
export enum RentalStatus {
  Open = 1,
  Completed = 2
}

export interface NewRental {
  readonly id: number;
  readonly userId: number;
  readonly bikeId: number;
  readonly startStationId: number;
  readonly startTime: number;
  readonly paymentReference: string;
  readonly preAuthAmount: number;
  /** Type of the bike when it was rented: it sets the price. */
  readonly isElectric: boolean;
}

export interface RentalReturn {
  readonly endTime: number;
  readonly endStationId: number;
  readonly price: number;
}

/** An open rental has no end time, end station nor price; a completed rental has all three. */
export interface RentalProperties extends NewRental {
  readonly status: RentalStatus;
  readonly endTime: number | null;
  readonly endStationId: number | null;
  readonly price: number | null;
}

export class Rental implements RentalProperties {
  readonly id: number;
  readonly userId: number;
  readonly bikeId: number;
  readonly startStationId: number;
  readonly startTime: number;
  readonly paymentReference: string;
  readonly preAuthAmount: number;
  readonly isElectric: boolean;
  readonly status: RentalStatus;
  readonly endTime: number | null;
  readonly endStationId: number | null;
  readonly price: number | null;

  private constructor(properties: RentalProperties) {
    this.id = properties.id;
    this.userId = properties.userId;
    this.bikeId = properties.bikeId;
    this.startStationId = properties.startStationId;
    this.startTime = properties.startTime;
    this.paymentReference = properties.paymentReference;
    this.preAuthAmount = properties.preAuthAmount;
    this.isElectric = properties.isElectric;
    this.status = properties.status;
    this.endTime = properties.endTime;
    this.endStationId = properties.endStationId;
    this.price = properties.price;
  }

  static open(newRental: NewRental): Rental {
    return new Rental({ ...newRental, status: RentalStatus.Open, endTime: null, endStationId: null, price: null });
  }

  static restore(properties: RentalProperties): Rental {
    const isOpen = properties.status === RentalStatus.Open;
    const returnFields = [properties.endTime, properties.endStationId, properties.price];
    const isConsistent = isOpen
      ? returnFields.every((field) => field === null)
      : returnFields.every((field) => field !== null);
    if (!isConsistent) {
      throw new DomainRuleViolation(
        'rental ' + properties.id + ' has an end time, end station and price only once returned'
      );
    }
    return new Rental(properties);
  }

  isOpen(): boolean {
    return this.status === RentalStatus.Open;
  }

  complete(rentalReturn: RentalReturn): Rental {
    if (!this.isOpen()) {
      throw new DomainRuleViolation('rental ' + this.id + ' is already returned');
    }
    return new Rental({ ...this, status: RentalStatus.Completed, ...rentalReturn });
  }

  /** Duration until now for an open rental, final duration once the bike is returned. */
  durationMinutesAt(now: number): number {
    return computeDurationMinutes(this.startTime, this.endTime === null ? now : this.endTime);
  }
}
