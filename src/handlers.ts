import { Clock } from './application/ports/clock';
import { FleetNotifier } from './application/ports/fleetNotifier';
import { FraudScreening } from './application/ports/fraudScreening';
import { LocationService } from './application/ports/locationService';
import { Logger } from './application/ports/logger';
import { PaymentGateway } from './application/ports/paymentGateway';
import { Repositories } from './application/ports/repositories';
import { Bike, BikeStatus } from './domain/bike';
import { selectBike } from './domain/bikeSelection';
import { InconsistentDataError } from './domain/errors';
import { computeRiddenKilometers, isRebalancingNeeded } from './domain/fleet';
import { isFraudSuspected } from './domain/fraud';
import { roundToCents } from './domain/money';
import { computeDurationMinutes, computePreAuthorizationAmount, computeRentalPrice } from './domain/pricing';
import { Rental } from './domain/rental';
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

export interface HandlerDependencies extends Repositories {
  readonly paymentGateway: PaymentGateway;
  readonly locationService: LocationService;
  readonly fraudScreening: FraudScreening;
  readonly fleetNotifier: FleetNotifier;
  readonly logger: Logger;
  readonly clock: Clock;
}

interface ListedBike {
  id: number;
  el: boolean;
  km: number;
  broken?: true;
}

/** Fails fast when a record that the data guarantees to exist is missing: the data is corrupted. */
function requireExisting<T>(record: T | undefined, description: string): T {
  if (record === undefined) {
    throw new InconsistentDataError(description);
  }
  return record;
}

export function createHandlers(deps: HandlerDependencies): Handlers {
  const { stations, bikes, users, rentals } = deps;
  const { paymentGateway, locationService, fraudScreening, fleetNotifier, logger, clock } = deps;

  function handleRentBike(req: HttpRequest, res: HttpResponse): void {
    const requestBody = req.body;
    if (!hasRequiredFields(requestBody, ['userId', 'stationId'])) {
      res.status(400).json({ msg: 'bad request' });
    } else {
      const user = users.findById(Number(requestBody.userId));
      if (user === undefined) {
        res.status(404).json({ msg: 'no user' });
      } else {
        const station = stations.findById(Number(requestBody.stationId));
        if (station === undefined) {
          res.status(404).json({ msg: 'no station' });
        } else {
          const availableBikes: Bike[] = [];
          for (const bike of bikes.findDockedAt(station.id)) {
            if (bike.status === BikeStatus.Available) {
              availableBikes.push(bike);
            } else {
              if (bike.status === BikeStatus.Broken) {
                logger.warn('broken bike at station', bike.id);
              }
            }
          }
          const requestedBikeId =
            requestBody.bikeId !== undefined && requestBody.bikeId !== null ? Number(requestBody.bikeId) : null;
          const selectedBike = selectBike(availableBikes, requestedBikeId);
          if (selectedBike === undefined) {
            res.status(409).json({ msg: 'no bike available' });
          } else {
            if (rentals.hasOpenRentalFor(user.id)) {
              res.status(409).json({ msg: 'already renting' });
            } else {
              if (!user.hasMinimumCreditToRent()) {
                res.status(402).json({ msg: 'not enough credit' });
              } else {
                const preAuthAmount = computePreAuthorizationAmount(selectedBike.isElectric);
                if (isFraudSuspected(fraudScreening.scoreOf(user, preAuthAmount))) {
                  res.status(403).json({ msg: 'refused' });
                } else {
                  const preAuthorization = paymentGateway.preAuthorize(user, preAuthAmount);
                  if (!preAuthorization.isApproved) {
                    logger.warn('payment declined', {
                      userId: user.id,
                      amount: preAuthAmount,
                      reason: preAuthorization.reason
                    });
                    res.status(402).json({ msg: 'payment declined' });
                    return;
                  }
                  const rental = Rental.open({
                    id: rentals.nextId(),
                    userId: user.id,
                    bikeId: selectedBike.id,
                    startStationId: station.id,
                    startTime: clock.now(),
                    paymentReference: preAuthorization.reference,
                    preAuthAmount: preAuthAmount,
                    isElectric: selectedBike.isElectric
                  });
                  rentals.save(rental);
                  bikes.save(selectedBike.checkOut());
                  fleetNotifier.rentalCreated(rental.id);
                  res.json({
                    msg: 'ok',
                    rentalId: rental.id,
                    bikeId: selectedBike.id,
                    station: station.name,
                    preAuth: roundToCents(preAuthAmount),
                    ref: rental.paymentReference
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  function handleReturnBike(req: HttpRequest, res: HttpResponse): void {
    const requestBody = req.body;
    if (!hasRequiredFields(requestBody, ['rentalId', 'stationId'])) {
      res.status(400).json({ msg: 'bad request' });
    } else {
      const rental = rentals.findById(Number(requestBody.rentalId));
      if (rental === undefined) {
        res.status(404).json({ msg: 'no rental' });
      } else {
        if (!rental.isOpen()) {
          res.status(409).json({ msg: 'already returned' });
        } else {
          const returnStation = stations.findById(Number(requestBody.stationId));
          if (returnStation === undefined) {
            res.status(404).json({ msg: 'no station' });
          } else {
            if (!returnStation.hasFreeSlot(bikes.findDockedAt(returnStation.id).length)) {
              res.status(409).json({ msg: 'station full' });
            } else {
              const user = requireExisting(
                users.findById(rental.userId),
                'user ' + rental.userId + ' of rental ' + rental.id
              );
              const bike = requireExisting(
                bikes.findById(rental.bikeId),
                'bike ' + rental.bikeId + ' of rental ' + rental.id
              );
              const durationMinutes = computeDurationMinutes(rental.startTime, clock.now());
              const price = computeRentalPrice(durationMinutes, rental.isElectric, user.subscription);
              const capture = paymentGateway.capture(user, rental.paymentReference, price);
              if (capture.isCaptured) {
                users.save(user.debit(price));
              }
              rentals.save(rental.complete({ endTime: clock.now(), endStationId: returnStation.id, price: price }));
              bikes.save(bike.dockAt(returnStation.id, computeRiddenKilometers(durationMinutes)));
              const occupancy = {
                dockedBikeCount: bikes.findDockedAt(returnStation.id).length,
                totalDockedBikeCount: bikes.countDocked(),
                stationCount: stations.findAll().length
              };
              if (isRebalancingNeeded(occupancy)) {
                fleetNotifier.rebalancingRequested(returnStation.id);
              }
              res.json({
                msg: 'ok',
                rentalId: rental.id,
                minutes: durationMinutes,
                price: price,
                station: returnStation.name,
                captured: capture.isCaptured
              });
            }
          }
        }
      }
    }
  }

  function handleListStations(_req: HttpRequest, res: HttpResponse): void {
    const stationSummaries = [];
    for (const station of stations.findAll()) {
      const location = locationService.describe(station.latitude, station.longitude);
      const dockedBikes = bikes.findDockedAt(station.id);
      let freeBikeCount = 0;
      let freeElectricBikeCount = 0;
      const listedBikes: ListedBike[] = [];
      for (const bike of dockedBikes) {
        if (bike.status === BikeStatus.Available) {
          freeBikeCount = freeBikeCount + 1;
          if (bike.isElectric) {
            freeElectricBikeCount = freeElectricBikeCount + 1;
          }
          listedBikes.push({ id: bike.id, el: bike.isElectric, km: bike.kilometers });
        } else {
          if (bike.status === BikeStatus.Broken) {
            listedBikes.push({ id: bike.id, el: bike.isElectric, km: bike.kilometers, broken: true });
          }
        }
      }
      listedBikes.sort((firstBike, secondBike) => firstBike.km - secondBike.km);
      stationSummaries.push({
        id: station.id,
        name: station.name,
        zone: location.zone,
        weather: location.weather,
        free: freeBikeCount,
        electric: freeElectricBikeCount,
        slots: station.capacity - dockedBikes.length,
        bikes: listedBikes
      });
    }
    res.json(stationSummaries);
  }

  function handleGetRental(req: HttpRequest, res: HttpResponse): void {
    const rental = rentals.findById(Number(req.params.id));
    if (rental === undefined) {
      res.status(404).json({ msg: 'no rental' });
    } else {
      const user = requireExisting(users.findById(rental.userId), 'user ' + rental.userId + ' of rental ' + rental.id);
      const durationMinutes = rental.durationMinutesAt(clock.now());
      const price = computeRentalPrice(durationMinutes, rental.isElectric, user.subscription);
      res.json({
        msg: 'ok',
        id: rental.id,
        bikeId: rental.bikeId,
        minutes: durationMinutes,
        price: price,
        estimate: price,
        open: rental.isOpen()
      });
    }
  }

  return { handleRentBike, handleReturnBike, handleListStations, handleGetRental };
}
