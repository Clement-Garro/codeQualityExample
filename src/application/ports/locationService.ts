export interface LocationDescription {
  readonly zone: 'north' | 'south';
  readonly weather: 'clear' | 'rain';
}

/** External geolocation service. */
export interface LocationService {
  describe(latitude: number, longitude: number): LocationDescription;
}
