import { RentalLookupRefusal, RentRefusal, ReturnRefusal } from './application/result';
import { GetRental } from './application/useCases/getRental';
import { ListStations, StationOverview } from './application/useCases/listStations';
import { RentBike } from './application/useCases/rentBike';
import { ReturnBike } from './application/useCases/returnBike';
import { BikeStatus } from './domain/bike';
import { roundToCents } from './domain/money';
import { hasRequiredFields } from './utils';

// The handlers only depend on the part of the HTTP request and response they use,
// so Express and the test doubles can both be passed in.
export interface HttpRequest {
  body?: unknown;
  params: Record<string, string>;
}

export interface HttpResponse {
  status(code: number): HttpResponse;
  json(payload: unknown): unknown;
}

export type HttpHandler = (req: HttpRequest, res: HttpResponse) => void;

export interface Handlers {
  handleRentBike: HttpHandler;
  handleReturnBike: HttpHandler;
  handleListStations: HttpHandler;
  handleGetRental: HttpHandler;
}

export interface UseCases {
  readonly rentBike: RentBike;
  readonly returnBike: ReturnBike;
  readonly getRental: GetRental;
  readonly listStations: ListStations;
}

interface HttpRefusal {
  readonly status: number;
  readonly msg: string;
}

// The HTTP translation of every business refusal of the current contract.
const RENT_REFUSALS: Record<RentRefusal, HttpRefusal> = {
  [RentRefusal.UserNotFound]: { status: 404, msg: 'no user' },
  [RentRefusal.StationNotFound]: { status: 404, msg: 'no station' },
  [RentRefusal.NoBikeAvailable]: { status: 409, msg: 'no bike available' },
  [RentRefusal.AlreadyRenting]: { status: 409, msg: 'already renting' },
  [RentRefusal.NotEnoughCredit]: { status: 402, msg: 'not enough credit' },
  [RentRefusal.FraudSuspected]: { status: 403, msg: 'refused' },
  [RentRefusal.PaymentDeclined]: { status: 402, msg: 'payment declined' }
};

const RETURN_REFUSALS: Record<ReturnRefusal, HttpRefusal> = {
  [ReturnRefusal.RentalNotFound]: { status: 404, msg: 'no rental' },
  [ReturnRefusal.AlreadyReturned]: { status: 409, msg: 'already returned' },
  [ReturnRefusal.StationNotFound]: { status: 404, msg: 'no station' },
  [ReturnRefusal.StationFull]: { status: 409, msg: 'station full' }
};

const RENTAL_LOOKUP_REFUSALS: Record<RentalLookupRefusal, HttpRefusal> = {
  [RentalLookupRefusal.RentalNotFound]: { status: 404, msg: 'no rental' }
};

const BAD_REQUEST: HttpRefusal = { status: 400, msg: 'bad request' };

function sendRefusal(res: HttpResponse, refusal: HttpRefusal): void {
  res.status(refusal.status).json({ msg: refusal.msg });
}

function toOptionalId(value: unknown): number | null {
  return value === undefined || value === null ? null : Number(value);
}

function toStationSummary(overview: StationOverview) {
  return {
    id: overview.station.id,
    name: overview.station.name,
    zone: overview.zone,
    weather: overview.weather,
    free: overview.freeBikeCount,
    electric: overview.freeElectricBikeCount,
    slots: overview.freeSlotCount,
    bikes: overview.listedBikes.map((bike) =>
      bike.status === BikeStatus.Broken
        ? { id: bike.id, el: bike.isElectric, km: bike.kilometers, broken: true }
        : { id: bike.id, el: bike.isElectric, km: bike.kilometers }
    )
  };
}

function handleRentBike(rentBike: RentBike, req: HttpRequest, res: HttpResponse): void {
  const body = req.body;
  if (!hasRequiredFields(body, ['userId', 'stationId'])) {
    sendRefusal(res, BAD_REQUEST);
    return;
  }
  const result = rentBike.execute({
    userId: Number(body.userId),
    stationId: Number(body.stationId),
    requestedBikeId: toOptionalId(body.bikeId)
  });
  if (!result.isSuccess) {
    sendRefusal(res, RENT_REFUSALS[result.refusal]);
    return;
  }
  const { rental, stationName } = result.value;
  res.json({
    msg: 'ok',
    rentalId: rental.id,
    bikeId: rental.bikeId,
    station: stationName,
    preAuth: roundToCents(rental.preAuthAmount),
    ref: rental.paymentReference
  });
}

function handleReturnBike(returnBike: ReturnBike, req: HttpRequest, res: HttpResponse): void {
  const body = req.body;
  if (!hasRequiredFields(body, ['rentalId', 'stationId'])) {
    sendRefusal(res, BAD_REQUEST);
    return;
  }
  const result = returnBike.execute({ rentalId: Number(body.rentalId), stationId: Number(body.stationId) });
  if (!result.isSuccess) {
    sendRefusal(res, RETURN_REFUSALS[result.refusal]);
    return;
  }
  const returned = result.value;
  res.json({
    msg: 'ok',
    rentalId: returned.rentalId,
    minutes: returned.durationMinutes,
    price: returned.price,
    station: returned.stationName,
    captured: returned.isCaptured
  });
}

function handleListStations(listStations: ListStations, res: HttpResponse): void {
  res.json(listStations.execute().map(toStationSummary));
}

function handleGetRental(getRental: GetRental, req: HttpRequest, res: HttpResponse): void {
  const result = getRental.execute(Number(req.params.id));
  if (!result.isSuccess) {
    sendRefusal(res, RENTAL_LOOKUP_REFUSALS[result.refusal]);
    return;
  }
  const details = result.value;
  res.json({
    msg: 'ok',
    id: details.rental.id,
    bikeId: details.rental.bikeId,
    minutes: details.durationMinutes,
    price: details.price,
    estimate: details.price,
    open: details.isOpen
  });
}

export function createHandlers(useCases: UseCases): Handlers {
  return {
    handleRentBike: (req, res) => handleRentBike(useCases.rentBike, req, res),
    handleReturnBike: (req, res) => handleReturnBike(useCases.returnBike, req, res),
    handleListStations: (_req, res) => handleListStations(useCases.listStations, res),
    handleGetRental: (req, res) => handleGetRental(useCases.getRental, req, res)
  };
}
