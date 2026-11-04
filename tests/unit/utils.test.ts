import {
  sleep,
  log,
  hasRequiredFields,
  simulateHttpCall,
  getLocationInfo
} from '../../src/utils';
import { useFastClock } from '../support/fastClock';

beforeEach(() => {
  useFastClock();
});

describe('sleep', () => {
  it('blocks for at least the requested duration', () => {
    const startTime = Date.now();

    sleep(500);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(500);
  });
});

describe('log', () => {
  it('prints the level, the message and the serialized context on one line', () => {
    log('WARN', 'broken bike at station', { bikeId: 6 });

    expect(console.log).toHaveBeenCalledWith('[WARN] broken bike at station {"bikeId":6}');
  });
});

describe('hasRequiredFields', () => {
  it.each([
    ['every field is filled', { userId: 1, stationId: 2 }, true],
    ['a field is zero', { userId: 0, stationId: 2 }, true],
    ['a field is a non-empty string', { userId: '1', stationId: '2' }, true],
    ['a field is a non-numeric string', { userId: 'abc', stationId: '2' }, true],
    ['a field is missing', { userId: 1 }, false],
    ['a field is null', { userId: 1, stationId: null }, false],
    ['a field is an empty string', { userId: 1, stationId: '' }, false],
    ['a field is NaN', { userId: 1, stationId: NaN }, false]
  ])('returns %s when %s', (_case, object, expected) => {
    expect(hasRequiredFields(object, ['userId', 'stationId'])).toBe(expected);
  });

  it.each([null, undefined])('rejects a %s object', (object) => {
    expect(hasRequiredFields(object, ['userId'])).toBe(false);
  });

  it('accepts any object when no field is required', () => {
    expect(hasRequiredFields({}, [])).toBe(true);
  });
});

describe('simulateHttpCall', () => {
  it('answers 200, echoes the request and returns a payment reference', () => {
    const body = { userId: 1, amount: 5 };

    const response = simulateHttpCall('https://payments.example.com/preauth', body);

    expect(response).toEqual({
      status: 200,
      url: 'https://payments.example.com/preauth',
      body,
      reference: expect.stringMatching(/^REF\d+$/)
    });
  });
});

describe('getLocationInfo', () => {
  it.each([
    [48.867, 2.363, 'north', 'clear'],
    [48.841, 2.322, 'south', 'rain'],
    [48.85, 2.36, 'south', 'rain'],
    [48.851, 2.361, 'north', 'clear']
  ])('places (%p, %p) in zone %p with %p weather', (latitude, longitude, zone, weather) => {
    expect(getLocationInfo(latitude, longitude)).toEqual({ latitude, longitude, zone, weather });
  });
});
