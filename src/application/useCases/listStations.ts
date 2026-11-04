import { Bike, BikeStatus } from '../../domain/bike';
import { Station } from '../../domain/station';
import { LocationService } from '../ports/locationService';
import { BikeRepository, StationRepository } from '../ports/repositories';

export interface ListStationsDependencies {
  readonly stations: StationRepository;
  readonly bikes: BikeRepository;
  readonly locationService: LocationService;
}

export interface StationOverview {
  readonly station: Station;
  readonly zone: 'north' | 'south';
  readonly weather: 'clear' | 'rain';
  /** Available and broken bikes, sorted by mileage (bikes with the same mileage keep the data order). */
  readonly listedBikes: readonly Bike[];
  readonly freeBikeCount: number;
  readonly freeElectricBikeCount: number;
  /** Capacity minus every parked bike, broken and in maintenance included. */
  readonly freeSlotCount: number;
}

export class ListStations {
  constructor(private readonly deps: ListStationsDependencies) {}

  execute(): StationOverview[] {
    return this.deps.stations.findAll().map((station) => this.describe(station));
  }

  private describe(station: Station): StationOverview {
    const location = this.deps.locationService.describe(station.latitude, station.longitude);
    const dockedBikes = this.deps.bikes.findDockedAt(station.id);
    const freeBikes = dockedBikes.filter((bike) => bike.status === BikeStatus.Available);
    const listedBikes = dockedBikes
      .filter((bike) => bike.status === BikeStatus.Available || bike.status === BikeStatus.Broken)
      .sort((firstBike, secondBike) => firstBike.kilometers - secondBike.kilometers);
    return {
      station: station,
      zone: location.zone,
      weather: location.weather,
      listedBikes: listedBikes,
      freeBikeCount: freeBikes.length,
      freeElectricBikeCount: freeBikes.filter((bike) => bike.isElectric).length,
      freeSlotCount: station.capacity - dockedBikes.length
    };
  }
}
