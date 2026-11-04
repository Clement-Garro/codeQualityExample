import { Express } from 'express';
import { Repositories } from './application/ports/repositories';
import { GetRental } from './application/useCases/getRental';
import { ListStations } from './application/useCases/listStations';
import { RentBike } from './application/useCases/rentBike';
import { ReturnBike } from './application/useCases/returnBike';
import { ConsoleLogger } from './infrastructure/consoleLogger';
import { createInMemoryRepositories } from './infrastructure/inMemory/inMemoryRepositories';
import { createSeedData, SeedData } from './infrastructure/inMemory/seedData';
import { SimulatedFleetNotifier } from './infrastructure/simulated/simulatedFleetNotifier';
import { SimulatedFraudScreening } from './infrastructure/simulated/simulatedFraudScreening';
import { SimulatedLocationService } from './infrastructure/simulated/simulatedLocationService';
import { SimulatedPaymentGateway } from './infrastructure/simulated/simulatedPaymentGateway';
import { SystemClock } from './infrastructure/systemClock';
import { createHttpApp, UseCases } from './presentation/http/createHttpApp';

export interface Application {
  readonly app: Express;
  /** The storage of this application, exposed so that tests can prepare and check the data. */
  readonly repositories: Repositories;
}

/** Creates the simulated adapters and gives each use case only the ports it uses. */
function createUseCases(repositories: Repositories): UseCases {
  const { stations, bikes, users, rentals } = repositories;
  const logger = new ConsoleLogger();
  const clock = new SystemClock();
  const paymentGateway = new SimulatedPaymentGateway(logger);
  const fleetNotifier = new SimulatedFleetNotifier(logger);
  return {
    rentBike: new RentBike({
      stations,
      bikes,
      users,
      rentals,
      paymentGateway,
      fraudScreening: new SimulatedFraudScreening(),
      fleetNotifier,
      logger,
      clock
    }),
    returnBike: new ReturnBike({ stations, bikes, users, rentals, paymentGateway, fleetNotifier, clock }),
    getRental: new GetRental({ rentals, users, clock }),
    listStations: new ListStations({ stations, bikes, locationService: new SimulatedLocationService() })
  };
}

/** The only place where adapters are created and wired: each call gives an application with its own data. */
export function createApplication(seed: SeedData = createSeedData()): Application {
  const repositories = createInMemoryRepositories(seed);
  return { app: createHttpApp(createUseCases(repositories)), repositories };
}
