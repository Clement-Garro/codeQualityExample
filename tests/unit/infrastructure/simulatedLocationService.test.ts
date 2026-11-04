import { SimulatedLocationService } from '../../../src/infrastructure/simulated/simulatedLocationService';
import { useFastClock } from '../../support/fastClock';

beforeEach(() => {
  useFastClock();
});

describe('describe', () => {
  const locationService = new SimulatedLocationService();

  it.each([
    [48.867, 2.363, 'north', 'clear'],
    [48.841, 2.322, 'south', 'rain'],
    [48.85, 2.36, 'south', 'rain'],
    [48.851, 2.361, 'north', 'clear']
  ])('places (%p, %p) in zone %p with %p weather', (latitude, longitude, zone, weather) => {
    expect(locationService.describe(latitude, longitude)).toEqual({ zone, weather });
  });

  it('waits for the geolocation service, at least 300 ms', () => {
    const startTime = Date.now();

    locationService.describe(48.867, 2.363);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(300);
  });
});
