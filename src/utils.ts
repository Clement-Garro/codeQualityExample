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
  if (latitude > 48.85) {
    locationInfo.zone = 'north';
  } else {
    locationInfo.zone = 'south';
  }
  if (longitude > 2.36) {
    locationInfo.weather = 'clear';
  } else {
    locationInfo.weather = 'rain';
  }
  return locationInfo;
}

export function computeFraudScore(user, amount) {
  sleep(200);
  let fraudScore = 0;
  if (amount > 40) {
    fraudScore = fraudScore + 30;
  }
  if (user.subscription !== 'premium') {
    fraudScore = fraudScore + 10;
  }
  if (user.isBlacklisted === true) {
    fraudScore = fraudScore + 100;
  }
  return fraudScore;
}

export function computeRentalPrice(durationMinutes, isElectric, subscription) {
  let price = 0;
  if (durationMinutes <= 30) {
    price = 1;
  } else {
    price = 1 + (durationMinutes - 30) * 0.15;
  }
  if (isElectric === true) {
    price = price + 2.5;
  }
  if (durationMinutes > 1440) {
    price = price + 25;
  }
  if (subscription === 'premium') {
    price = price * 0.8;
  }
  return roundToCents(price);
}
