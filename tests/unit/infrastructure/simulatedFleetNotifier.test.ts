import { ConsoleLogger } from '../../../src/infrastructure/consoleLogger';
import { SimulatedFleetNotifier } from '../../../src/infrastructure/simulated/simulatedFleetNotifier';
import { useFastClock } from '../../support/fastClock';

const REPUBLIQUE = 1;

let notifier: SimulatedFleetNotifier;

beforeEach(() => {
  useFastClock();
  notifier = new SimulatedFleetNotifier(new ConsoleLogger());
});

describe('rentalCreated', () => {
  it('logs the new rental', () => {
    notifier.rentalCreated(1);

    expect(console.log).toHaveBeenCalledWith('[INFO] rental created 1');
  });

  it('waits for the fleet service, at least 100 ms', () => {
    const startTime = Date.now();

    notifier.rentalCreated(1);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(100);
  });
});

describe('rebalancingRequested', () => {
  it('logs the station to rebalance', () => {
    notifier.rebalancingRequested(REPUBLIQUE);

    expect(console.log).toHaveBeenCalledWith('[INFO] rebalancing triggered 1');
  });

  it('waits for the fleet service, at least 150 ms', () => {
    const startTime = Date.now();

    notifier.rebalancingRequested(REPUBLIQUE);

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(150);
  });
});
