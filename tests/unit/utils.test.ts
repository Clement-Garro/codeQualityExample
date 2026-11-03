import {
  sleep,
  log,
  hasRequiredFields,
  roundToCents,
  simulateHttpCall,
  getLocationInfo,
  computeFraudScore,
  computeRentalPrice
} from '../../src/utils';
import { useFastClock } from '../support/fastClock';

const basicUser = { subscription: 'basic', isBlacklisted: false } as const;
const premiumUser = { subscription: 'premium', isBlacklisted: false } as const;
const blacklistedUser = { subscription: 'basic', isBlacklisted: true } as const;

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

describe('roundToCents', () => {
  it.each([
    [3.14159, 3.14],
    [4.6000000001, 4.6],
    [0.125, 0.13],
    [10, 10]
  ])('rounds %p to %p', (amount, expected) => {
    expect(roundToCents(amount)).toBe(expected);
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

describe('computeFraudScore', () => {
  it.each([
    ['a premium user with a small amount', premiumUser, 5, 0],
    ['a basic user', basicUser, 5, 10],
    ['an amount of exactly 40', premiumUser, 40, 0],
    ['an amount above 40', premiumUser, 41, 30],
    ['a basic user with an amount above 40', basicUser, 41, 40],
    ['a blacklisted user', blacklistedUser, 5, 110]
  ])('scores %s', (_case, user, amount, expectedScore) => {
    expect(computeFraudScore(user, amount)).toBe(expectedScore);
  });
});

describe('computeRentalPrice', () => {
  it('charges the flat price of 1 for the first 30 minutes', () => {
    expect(computeRentalPrice(0, false, 'basic')).toBe(1);
    expect(computeRentalPrice(30, false, 'basic')).toBe(1);
  });

  it('adds 2.50 for an electric bike', () => {
    expect(computeRentalPrice(10, true, 'basic')).toBe(3.5);
  });

  it('gives premium subscribers 20% off', () => {
    expect(computeRentalPrice(10, false, 'premium')).toBe(0.8);
    expect(computeRentalPrice(10, true, 'premium')).toBe(2.8);
  });

  it('charges a small amount for each minute after the first 30', () => {
    const firstChargedMinute = computeRentalPrice(31, false, 'basic') - computeRentalPrice(30, false, 'basic');

    expect(firstChargedMinute).toBeGreaterThan(0);
    expect(firstChargedMinute).toBeLessThan(0.2);
  });

  it('adds a 25 penalty once the rental exceeds 24 hours', () => {
    const priceDifference = computeRentalPrice(1441, false, 'basic') - computeRentalPrice(1440, false, 'basic');

    expect(priceDifference).toBeGreaterThan(25);
    expect(priceDifference).toBeLessThan(26);
  });

  it('uses the billing rate of 0.15 per minute after the first 30 minutes', () => {
    expect(computeRentalPrice(45, false, 'basic')).toBe(3.25);
  });
});
