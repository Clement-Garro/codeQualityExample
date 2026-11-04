import { DomainRuleViolation } from './errors';

// Status values are the numbers stored since the beginning: they are kept so that the data and the API
// stay unchanged, but the code only refers to them by name.
export enum BikeStatus {
  Available = 0,
  Rented = 1,
  Maintenance = 2,
  Broken = 3
}

export interface BikeProperties {
  readonly id: number;
  /** The station where the bike is parked, or null while it is rented: the only record of its location. */
  readonly stationId: number | null;
  readonly status: BikeStatus;
  readonly kilometers: number;
  readonly isElectric: boolean;
}

export class Bike implements BikeProperties {
  readonly id: number;
  readonly stationId: number | null;
  readonly status: BikeStatus;
  readonly kilometers: number;
  readonly isElectric: boolean;

  private constructor(properties: BikeProperties) {
    this.id = properties.id;
    this.stationId = properties.stationId;
    this.status = properties.status;
    this.kilometers = properties.kilometers;
    this.isElectric = properties.isElectric;
  }

  static restore(properties: BikeProperties): Bike {
    const isRented = properties.status === BikeStatus.Rented;
    if (isRented !== (properties.stationId === null)) {
      throw new DomainRuleViolation('bike ' + properties.id + ' must be parked at a station unless it is rented');
    }
    if (!Number.isInteger(properties.kilometers) || properties.kilometers < 0) {
      throw new DomainRuleViolation('bike ' + properties.id + ' has an invalid mileage');
    }
    return new Bike(properties);
  }

  /** Takes an available bike out of its station for a rental. */
  checkOut(): Bike {
    if (this.status !== BikeStatus.Available) {
      throw new DomainRuleViolation('bike ' + this.id + ' is not available');
    }
    return new Bike({ ...this, status: BikeStatus.Rented, stationId: null });
  }

  /** Parks a rented bike at a station, adding the distance ridden to its mileage. */
  dockAt(stationId: number, distanceKilometers: number): Bike {
    if (this.status !== BikeStatus.Rented) {
      throw new DomainRuleViolation('bike ' + this.id + ' is not rented');
    }
    if (distanceKilometers < 0) {
      throw new DomainRuleViolation('a ride cannot have a negative distance');
    }
    return new Bike({
      ...this,
      status: BikeStatus.Available,
      stationId: stationId,
      kilometers: this.kilometers + distanceKilometers
    });
  }
}
