const ONE_MINUTE_MS = 60_000;

export interface FastClock {
  advanceMinutes(minutes: number): void;
}

/**
 * Replaces Date.now with a deterministic clock that moves forward by 1 ms on every read.
 * The application waits with a busy loop on Date.now, so every simulated delay
 * (payment, geolocation...) completes instantly, and rental durations become exact.
 */
export function useFastClock(startTime = Date.UTC(2026, 0, 1, 8, 0, 0)): FastClock {
  let currentTime = startTime;
  jest.spyOn(Date, 'now').mockImplementation(() => {
    currentTime += 1;
    return currentTime;
  });
  return {
    advanceMinutes(minutes: number) {
      currentTime += minutes * ONE_MINUTE_MS;
    }
  };
}
