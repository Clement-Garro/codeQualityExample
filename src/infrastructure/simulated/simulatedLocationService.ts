import { LocationDescription, LocationService } from '../../application/ports/locationService';
import { CLEAR_WEATHER_MIN_LONGITUDE, NORTH_ZONE_MIN_LATITUDE } from '../../domain/businessRules';
import { busyWait } from './busyWait';

const GEOLOCATION_DELAY_MS = 300;

/** Simulated geolocation service: the zone and the "weather" only depend on the coordinates. */
export class SimulatedLocationService implements LocationService {
  describe(latitude: number, longitude: number): LocationDescription {
    busyWait(GEOLOCATION_DELAY_MS);
    return {
      zone: latitude > NORTH_ZONE_MIN_LATITUDE ? 'north' : 'south',
      weather: longitude > CLEAR_WEATHER_MIN_LONGITUDE ? 'clear' : 'rain'
    };
  }
}
