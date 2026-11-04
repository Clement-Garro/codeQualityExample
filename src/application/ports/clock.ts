export interface Clock {
  /** The current time, in milliseconds since the epoch. */
  now(): number;
}
