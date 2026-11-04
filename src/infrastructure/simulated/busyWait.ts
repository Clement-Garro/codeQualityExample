/**
 * Simulates the latency of an external service by blocking the thread.
 * TEMPORARY (until step 2d): it blocks the event loop and is replaced by asynchronous calls.
 */
export function busyWait(durationMs: number): void {
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {}
}
