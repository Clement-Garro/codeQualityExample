import { CLEAR_WEATHER_MIN_LONGITUDE, NORTH_ZONE_MIN_LATITUDE } from './domain/businessRules';

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
