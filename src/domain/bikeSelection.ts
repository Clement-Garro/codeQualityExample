export interface SelectableBike {
  readonly id: number;
  readonly kilometers: number;
}

/**
 * Chooses the bike to rent among the available ones, listed in the order of the data:
 * the requested bike when one is asked for, otherwise the least used one (the first listed on a tie).
 */
export function selectBike<T extends SelectableBike>(
  availableBikes: readonly T[],
  requestedBikeId: number | null
): T | undefined {
  if (requestedBikeId !== null) {
    return availableBikes.find((bike) => bike.id === requestedBikeId);
  }
  let leastUsedBike: T | undefined = undefined;
  for (const bike of availableBikes) {
    if (leastUsedBike === undefined || bike.kilometers < leastUsedBike.kilometers) {
      leastUsedBike = bike;
    }
  }
  return leastUsedBike;
}
