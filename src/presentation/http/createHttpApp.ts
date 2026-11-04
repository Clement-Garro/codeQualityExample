import express, { Express, Request, Response } from 'express';
import { GetRental } from '../../application/useCases/getRental';
import { ListStations } from '../../application/useCases/listStations';
import { RentBike } from '../../application/useCases/rentBike';
import { ReturnBike } from '../../application/useCases/returnBike';
import { BAD_REQUEST, HttpRefusal, Refusal, toHttpRefusal } from './refusals';
import { formatRentalDetails, formatRentalReturned, formatRentalStarted, formatStationOverview } from './responses';
import { hasRequiredFields, toId, toOptionalId } from './validation';

/** The use cases called by the HTTP layer (driving ports). */
export interface UseCases {
  readonly rentBike: Pick<RentBike, 'execute'>;
  readonly returnBike: Pick<ReturnBike, 'execute'>;
  readonly getRental: Pick<GetRental, 'execute'>;
  readonly listStations: Pick<ListStations, 'execute'>;
}

type Outcome<T> =
  | { readonly isSuccess: true; readonly value: T }
  | { readonly isSuccess: false; readonly refusal: Refusal };

function sendRefusal(res: Response, refusal: HttpRefusal): void {
  res.status(refusal.status).json({ msg: refusal.msg });
}

function sendOutcome<T>(res: Response, outcome: Outcome<T>, format: (value: T) => object): void {
  if (outcome.isSuccess) {
    res.json(format(outcome.value));
  } else {
    sendRefusal(res, toHttpRefusal(outcome.refusal));
  }
}

function handleRent(rentBike: UseCases['rentBike'], req: Request, res: Response): void {
  const body: unknown = req.body;
  if (!hasRequiredFields(body, ['userId', 'stationId'])) {
    sendRefusal(res, BAD_REQUEST);
    return;
  }
  const input = {
    userId: toId(body.userId),
    stationId: toId(body.stationId),
    requestedBikeId: toOptionalId(body.bikeId)
  };
  sendOutcome(res, rentBike.execute(input), formatRentalStarted);
}

function handleReturn(returnBike: UseCases['returnBike'], req: Request, res: Response): void {
  const body: unknown = req.body;
  if (!hasRequiredFields(body, ['rentalId', 'stationId'])) {
    sendRefusal(res, BAD_REQUEST);
    return;
  }
  const input = { rentalId: toId(body.rentalId), stationId: toId(body.stationId) };
  sendOutcome(res, returnBike.execute(input), formatRentalReturned);
}

/**
 * The current HTTP contract: input validation, call of the use case, JSON body and translation of the
 * refusals. Malformed JSON, unknown routes and corrupted data keep the default answers of Express.
 */
export function createHttpApp(useCases: UseCases): Express {
  const app = express();
  app.use(express.json());
  app.post('/rent', (req, res) => handleRent(useCases.rentBike, req, res));
  app.post('/return', (req, res) => handleReturn(useCases.returnBike, req, res));
  app.get('/stations', (_req, res) => {
    res.json(useCases.listStations.execute().map(formatStationOverview));
  });
  app.get('/rentals/:id', (req, res) => {
    sendOutcome(res, useCases.getRental.execute(toId(req.params.id)), formatRentalDetails);
  });
  return app;
}
