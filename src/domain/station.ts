import { DomainRuleViolation } from './errors';

export interface StationProperties {
  readonly id: number;
  readonly name: string;
  readonly capacity: number;
  readonly latitude: number;
  readonly longitude: number;
}

/** The bikes parked at a station are not stored here: they are found from the location of each bike. */
export class Station implements StationProperties {
  readonly id: number;
  readonly name: string;
  readonly capacity: number;
  readonly latitude: number;
  readonly longitude: number;

  private constructor(properties: StationProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.capacity = properties.capacity;
    this.latitude = properties.latitude;
    this.longitude = properties.longitude;
  }

  static restore(properties: StationProperties): Station {
    if (properties.capacity <= 0) {
      throw new DomainRuleViolation('station ' + properties.id + ' must have at least one slot');
    }
    return new Station(properties);
  }

  hasFreeSlot(dockedBikeCount: number): boolean {
    return dockedBikeCount < this.capacity;
  }
}
