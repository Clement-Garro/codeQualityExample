import express, { Express } from 'express';
import { Repositories } from './application/ports/repositories';
import { createHandlers } from './handlers';
import { ConsoleLogger } from './infrastructure/consoleLogger';
import { createInMemoryRepositories } from './infrastructure/inMemory/inMemoryRepositories';
import { createSeedData, SeedData } from './infrastructure/inMemory/seedData';
import { SimulatedFleetNotifier } from './infrastructure/simulated/simulatedFleetNotifier';
import { SimulatedFraudScreening } from './infrastructure/simulated/simulatedFraudScreening';
import { SimulatedLocationService } from './infrastructure/simulated/simulatedLocationService';
import { SimulatedPaymentGateway } from './infrastructure/simulated/simulatedPaymentGateway';
import { SystemClock } from './infrastructure/systemClock';

export interface Application {
  readonly app: Express;
  /** The storage of this application, exposed so that tests can prepare and check the data. */
  readonly repositories: Repositories;
}

/** The only place where adapters are created and wired: each call gives an application with its own data. */
export function createApplication(seed: SeedData = createSeedData()): Application {
  const repositories = createInMemoryRepositories(seed);
  const logger = new ConsoleLogger();
  const handlers = createHandlers({
    ...repositories,
    paymentGateway: new SimulatedPaymentGateway(logger),
    locationService: new SimulatedLocationService(),
    fraudScreening: new SimulatedFraudScreening(),
    fleetNotifier: new SimulatedFleetNotifier(logger),
    logger: logger,
    clock: new SystemClock()
  });

  const app = express();
  app.use(express.json());
  app.post('/rent', handlers.handleRentBike);
  app.post('/return', handlers.handleReturnBike);
  app.get('/stations', handlers.handleListStations);
  app.get('/rentals/:id', handlers.handleGetRental);

  return { app, repositories };
}
