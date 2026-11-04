import { FleetNotifier } from '../../application/ports/fleetNotifier';
import { Logger } from '../../application/ports/logger';
import { busyWait } from './busyWait';

const RENTAL_NOTIFICATION_DELAY_MS = 100;
const REBALANCING_REQUEST_DELAY_MS = 150;

/** Simulated fleet management service: it only waits and logs, no real action is taken. */
export class SimulatedFleetNotifier implements FleetNotifier {
  constructor(private readonly logger: Logger) {}

  rentalCreated(rentalId: number): void {
    busyWait(RENTAL_NOTIFICATION_DELAY_MS);
    this.logger.info('rental created', rentalId);
  }

  rebalancingRequested(stationId: number): void {
    busyWait(REBALANCING_REQUEST_DELAY_MS);
    this.logger.info('rebalancing triggered', stationId);
  }
}
