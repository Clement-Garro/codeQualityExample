/** External fleet management service, told about new rentals and stations to rebalance. */
export interface FleetNotifier {
  rentalCreated(rentalId: number): void;
  rebalancingRequested(stationId: number): void;
}
