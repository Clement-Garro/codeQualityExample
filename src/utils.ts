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

export function sleep(durationMs) {
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {}
}

export function log(level, message, context) {
  console.log('[' + level + '] ' + message + ' ' + JSON.stringify(context));
}

export function hasRequiredFields(object, fieldNames) {
  let isValid = true;
  for (let i = 0; i < fieldNames.length; i++) {
    const fieldName = fieldNames[i];
    if (object === undefined || object === null) {
      isValid = false;
    } else {
      if (object[fieldName] === undefined || object[fieldName] === null || object[fieldName] === '') {
        isValid = false;
      } else {
        if (typeof object[fieldName] === 'number') {
          if (isNaN(object[fieldName])) {
            isValid = false;
          }
        }
      }
    }
  }
  return isValid;
}

export function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

export function simulateHttpCall(url, body) {
  sleep(200);
  return { status: 200, url: url, body: body, reference: 'REF' + Math.floor(Math.random() * 100000) };
}

export function getLocationInfo(latitude, longitude) {
  sleep(300);
  const locationInfo = { latitude: latitude, longitude: longitude, zone: '', weather: '' };
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

export function computeFraudScore(user, amount) {
  sleep(200);
  let fraudScore = 0;
  if (amount > HIGH_AMOUNT_THRESHOLD) {
    fraudScore = fraudScore + HIGH_AMOUNT_RISK_SCORE;
  }
  if (user.subscription !== 'premium') {
    fraudScore = fraudScore + NON_PREMIUM_RISK_SCORE;
  }
  if (user.isBlacklisted === true) {
    fraudScore = fraudScore + BLACKLISTED_RISK_SCORE;
  }
  return fraudScore;
}

export function computeDurationMinutes(startTime, endTime) {
  return Math.floor((endTime - startTime) / MS_PER_MINUTE);
}

export function computeRentalPrice(durationMinutes, isElectric, subscription) {
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
  if (subscription === 'premium') {
    price = price * PREMIUM_PRICE_FACTOR;
  }
  return roundToCents(price);
}
