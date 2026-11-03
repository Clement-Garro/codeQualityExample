import {
  BASE_PRICE,
  BLACKLISTED_RISK_SCORE,
  CLEAR_WEATHER_MIN_LONGITUDE,
  ELECTRIC_BIKE_SURCHARGE,
  HIGH_AMOUNT_RISK_SCORE,
  HIGH_AMOUNT_THRESHOLD,
  INCLUDED_MINUTES,
  LONG_RENTAL_PENALTY,
  LONG_RENTAL_THRESHOLD_MINUTES,
  MS_PER_MINUTE,
  NON_PREMIUM_RISK_SCORE,
  NORTH_ZONE_MIN_LATITUDE,
  PREMIUM_PRICE_FACTOR,
  PRICE_PER_EXTRA_MINUTE
} from './businessRules';
import { Subscription, User } from './types';

export type LogLevel = 'INFO' | 'WARN';

export interface LocationInfo {
  latitude: number;
  longitude: number;
  zone: 'north' | 'south' | '';
  weather: 'clear' | 'rain' | '';
}

export interface SimulatedHttpResponse {
  status: number;
  url: string;
  body: unknown;
  reference: string;
}

export function sleep(durationMs: number): void {
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {}
}

export function log(level: LogLevel, message: string, context: unknown): void {
  console.log('[' + level + '] ' + message + ' ' + JSON.stringify(context));
}

/** Type guard: true when every field is present and not empty, so the fields can then be read safely. */
export function hasRequiredFields<Field extends string>(
  object: unknown,
  fieldNames: Field[]
): object is Record<Field, unknown> & Record<string, unknown> {
  let isValid = true;
  for (let i = 0; i < fieldNames.length; i++) {
    const fieldName = fieldNames[i];
    if (object === undefined || object === null) {
      isValid = false;
    } else {
      const fieldValue = (object as Record<string, unknown>)[fieldName];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        isValid = false;
      } else {
        if (typeof fieldValue === 'number') {
          if (isNaN(fieldValue)) {
            isValid = false;
          }
        }
      }
    }
  }
  return isValid;
}

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function simulateHttpCall(url: string, body: unknown): SimulatedHttpResponse {
  sleep(200);
  return { status: 200, url: url, body: body, reference: 'REF' + Math.floor(Math.random() * 100000) };
}

export function getLocationInfo(latitude: number, longitude: number): LocationInfo {
  sleep(300);
  const locationInfo: LocationInfo = { latitude: latitude, longitude: longitude, zone: '', weather: '' };
  if (latitude > NORTH_ZONE_MIN_LATITUDE) {
    locationInfo.zone = 'north';
  } else {
    locationInfo.zone = 'south';
  }
  if (longitude > CLEAR_WEATHER_MIN_LONGITUDE) {
    locationInfo.weather = 'clear';
  } else {
    locationInfo.weather = 'rain';
  }
  return locationInfo;
}

export function computeFraudScore(user: Pick<User, 'subscription' | 'isBlacklisted'>, amount: number): number {
  sleep(200);
  let fraudScore = 0;
  if (amount > HIGH_AMOUNT_THRESHOLD) {
    fraudScore = fraudScore + HIGH_AMOUNT_RISK_SCORE;
  }
  if (user.subscription !== Subscription.Premium) {
    fraudScore = fraudScore + NON_PREMIUM_RISK_SCORE;
  }
  if (user.isBlacklisted === true) {
    fraudScore = fraudScore + BLACKLISTED_RISK_SCORE;
  }
  return fraudScore;
}

export function computeDurationMinutes(startTime: number, endTime: number): number {
  return Math.floor((endTime - startTime) / MS_PER_MINUTE);
}

export function computeRentalPrice(durationMinutes: number, isElectric: boolean, subscription: Subscription): number {
  let price = BASE_PRICE;
  if (durationMinutes > INCLUDED_MINUTES) {
    price = price + (durationMinutes - INCLUDED_MINUTES) * PRICE_PER_EXTRA_MINUTE;
  }
  if (isElectric === true) {
    price = price + ELECTRIC_BIKE_SURCHARGE;
  }
  if (durationMinutes > LONG_RENTAL_THRESHOLD_MINUTES) {
    price = price + LONG_RENTAL_PENALTY;
  }
  if (subscription === Subscription.Premium) {
    price = price * PREMIUM_PRICE_FACTOR;
  }
  return roundToCents(price);
}
