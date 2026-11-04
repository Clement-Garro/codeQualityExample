import { REBALANCING_THRESHOLD_FACTOR, RIDING_MINUTES_PER_KILOMETER } from './businessRules';

export interface StationOccupancy {
  readonly dockedBikeCount: number;
  readonly totalDockedBikeCount: number;
  readonly stationCount: number;
}

/** Wear of a bike: one kilometer is counted for every full 4 minutes of riding. */
export function computeRiddenKilometers(durationMinutes: number): number {
  return Math.floor(durationMinutes / RIDING_MINUTES_PER_KILOMETER);
}

/** A station needs rebalancing when it holds strictly more than 1.5 times the average number of bikes. */
export function isRebalancingNeeded(occupancy: StationOccupancy): boolean {
  const averageBikesPerStation = occupancy.totalDockedBikeCount / occupancy.stationCount;
  return occupancy.dockedBikeCount > averageBikesPerStation * REBALANCING_THRESHOLD_FACTOR;
}
