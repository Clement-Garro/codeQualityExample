import {
  BASE_PRE_AUTHORIZATION_AMOUNT,
  BASE_PRICE,
  ELECTRIC_BIKE_SURCHARGE,
  ELECTRIC_PRE_AUTHORIZATION_SURCHARGE,
  INCLUDED_MINUTES,
  LONG_RENTAL_PENALTY,
  LONG_RENTAL_THRESHOLD_MINUTES,
  MS_PER_MINUTE,
  PREMIUM_PRICE_FACTOR,
  PRICE_PER_EXTRA_MINUTE
} from './businessRules';
import { roundToCents } from './money';
import { Subscription } from './user';

export function computeDurationMinutes(startTime: number, endTime: number): number {
  return Math.floor((endTime - startTime) / MS_PER_MINUTE);
}

export function computeRentalPrice(durationMinutes: number, isElectric: boolean, subscription: Subscription): number {
  let price = BASE_PRICE;
  if (durationMinutes > INCLUDED_MINUTES) {
    price = price + (durationMinutes - INCLUDED_MINUTES) * PRICE_PER_EXTRA_MINUTE;
  }
  if (isElectric) {
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

export function computePreAuthorizationAmount(isElectric: boolean): number {
  if (isElectric) {
    return BASE_PRE_AUTHORIZATION_AMOUNT + ELECTRIC_PRE_AUTHORIZATION_SURCHARGE;
  }
  return BASE_PRE_AUTHORIZATION_AMOUNT;
}
