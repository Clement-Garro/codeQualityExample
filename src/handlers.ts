import { stations, bikes, users, rentals, generateRentalId, BikeRecord, RentalRecord } from './db';
import { sleep, log, hasRequiredFields, getLocationInfo } from './utils';
import { preAuthorizePayment, capturePayment, CapturedPayment, PreAuthorization } from './payment';
import { Bike, BikeStatus } from './domain/bike';
import { selectBike } from './domain/bikeSelection';
import { InconsistentDataError } from './domain/errors';
import { computeRiddenKilometers, isRebalancingNeeded } from './domain/fleet';
import { computeFraudScore, isFraudSuspected } from './domain/fraud';
import { roundToCents } from './domain/money';
import { computeDurationMinutes, computePreAuthorizationAmount, computeRentalPrice } from './domain/pricing';
import { Rental } from './domain/rental';
import { Station } from './domain/station';
import { User } from './domain/user';

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

interface ListedBike {
  id: number;
  el: boolean;
  km: number;
  broken?: true;
}

// Simulated delay of the external anti-fraud service, kept until the services become asynchronous (step 2d).
const FRAUD_CHECK_DELAY_MS = 200;

/** Fails fast when a record that the data guarantees to exist is missing: the data is corrupted. */
function requireExisting<T>(record: T | undefined, description: string): T {
  if (record === undefined) {
    throw new InconsistentDataError(description);
  }
  return record;
}

// TEMPORARY (2c, P1): removed in P2. The storage still holds plain records; these conversions let the
// domain entities check every state change, then copy the result back into the records.
function toBike(record: BikeRecord): Bike {
  // A rented bike keeps its last station in the records, but it is parked nowhere.
  return Bike.restore({ ...record, stationId: record.status === BikeStatus.Rented ? null : record.stationId });
}

function applyBike(record: BikeRecord, bike: Bike): void {
  record.status = bike.status;
  record.kilometers = bike.kilometers;
  if (bike.stationId !== null) {
    record.stationId = bike.stationId;
  }
}

function toRental(record: RentalRecord): Rental {
  return Rental.restore({ ...record, price: record.price === undefined ? null : record.price });
}

function toRentalRecord(rental: Rental): RentalRecord {
  return {
    id: rental.id,
    userId: rental.userId,
    bikeId: rental.bikeId,
    startStationId: rental.startStationId,
    endTime: rental.endTime,
    endStationId: rental.endStationId,
    startTime: rental.startTime,
    paymentReference: rental.paymentReference,
    preAuthAmount: rental.preAuthAmount,
    isElectric: rental.isElectric,
    status: rental.status
  };
}

export function handleRentBike(req: HttpRequest, res: HttpResponse): void {
  const requestBody = req.body;
  if (!hasRequiredFields(requestBody, ['userId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    const user = users.find((candidate) => candidate.id === Number(requestBody.userId));
    if (user === undefined) {
      res.status(404).json({ msg: 'no user' });
    } else {
      const station = stations.find((candidate) => candidate.id === Number(requestBody.stationId));
      if (station === undefined) {
        res.status(404).json({ msg: 'no station' });
      } else {
        const availableBikes: BikeRecord[] = [];
        for (let i = 0; i < bikes.length; i++) {
          const bike = bikes[i];
          if (bike.stationId === station.id) {
            if (bike.status === BikeStatus.Available) {
              availableBikes.push(bike);
            } else {
              if (bike.status === BikeStatus.Broken) {
                log('WARN', 'broken bike at station', bike.id);
              }
            }
          }
        }
        const requestedBikeId =
          requestBody.bikeId !== undefined && requestBody.bikeId !== null ? Number(requestBody.bikeId) : null;
        const selectedBike = selectBike(availableBikes, requestedBikeId);
        if (selectedBike === undefined) {
          res.status(409).json({ msg: 'no bike available' });
        } else {
          let openRentalCount = 0;
          for (let i = 0; i < rentals.length; i++) {
            if (rentals[i].userId === user.id) {
              if (rentals[i].endTime === null) {
                openRentalCount = openRentalCount + 1;
              }
            }
          }
          if (openRentalCount > 0) {
            res.status(409).json({ msg: 'already renting' });
          } else {
            if (!User.restore(user).hasMinimumCreditToRent()) {
              res.status(402).json({ msg: 'not enough credit' });
            } else {
              const preAuthAmount = computePreAuthorizationAmount(selectedBike.isElectric);
              sleep(FRAUD_CHECK_DELAY_MS);
              const fraudScore = computeFraudScore(user, preAuthAmount);
              if (isFraudSuspected(fraudScore)) {
                res.status(403).json({ msg: 'refused' });
              } else {
                let preAuthorization: PreAuthorization;
                try {
                  preAuthorization = preAuthorizePayment(user, preAuthAmount);
                } catch (error) {
                  const reason = (error as Error).message;
                  log('WARN', 'payment declined', { userId: user.id, amount: preAuthAmount, reason: reason });
                  res.status(402).json({ msg: 'payment declined' });
                  return;
                }
                const rental = Rental.open({
                  id: generateRentalId(),
                  userId: user.id,
                  bikeId: selectedBike.id,
                  startStationId: station.id,
                  startTime: Date.now(),
                  paymentReference: preAuthorization.reference,
                  preAuthAmount: preAuthAmount,
                  isElectric: selectedBike.isElectric
                });
                rentals.push(toRentalRecord(rental));
                applyBike(selectedBike, toBike(selectedBike).checkOut());
                const remainingBikeIds: number[] = [];
                for (let i = 0; i < station.bikeIds.length; i++) {
                  if (station.bikeIds[i] !== selectedBike.id) {
                    remainingBikeIds.push(station.bikeIds[i]);
                  }
                }
                station.bikeIds = remainingBikeIds;
                try {
                  sleep(100);
                  log('INFO', 'rental created', rental.id);
                } catch (error) {}
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

export function handleReturnBike(req: HttpRequest, res: HttpResponse): void {
  const requestBody = req.body;
  if (!hasRequiredFields(requestBody, ['rentalId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    const rentalRecord = rentals.find((candidate) => candidate.id === Number(requestBody.rentalId));
    if (rentalRecord === undefined) {
      res.status(404).json({ msg: 'no rental' });
    } else {
      const rental = toRental(rentalRecord);
      if (!rental.isOpen()) {
        res.status(409).json({ msg: 'already returned' });
      } else {
        const returnStation = stations.find((candidate) => candidate.id === Number(requestBody.stationId));
        if (returnStation === undefined) {
          res.status(404).json({ msg: 'no station' });
        } else {
          if (!Station.restore(returnStation).hasFreeSlot(returnStation.bikeIds.length)) {
            res.status(409).json({ msg: 'station full' });
          } else {
            const user = requireExisting(
              users.find((candidate) => candidate.id === rental.userId),
              'user ' + rental.userId + ' of rental ' + rental.id
            );
            const bike = requireExisting(
              bikes.find((candidate) => candidate.id === rental.bikeId),
              'bike ' + rental.bikeId + ' of rental ' + rental.id
            );
            const durationMinutes = computeDurationMinutes(rental.startTime, Date.now());
            const price = computeRentalPrice(durationMinutes, rental.isElectric, user.subscription);
            let capturedPayment: CapturedPayment | null = null;
            try {
              capturedPayment = capturePayment(user, rental.paymentReference, price);
            } catch (error) {}
            const completedRental = rental.complete({
              endTime: Date.now(),
              endStationId: returnStation.id,
              price: price
            });
            rentalRecord.endTime = completedRental.endTime;
            rentalRecord.endStationId = completedRental.endStationId;
            rentalRecord.status = completedRental.status;
            rentalRecord.price = price;
            applyBike(bike, toBike(bike).dockAt(returnStation.id, computeRiddenKilometers(durationMinutes)));
            returnStation.bikeIds.push(bike.id);
            let totalDockedBikes = 0;
            for (let i = 0; i < stations.length; i++) {
              totalDockedBikes = totalDockedBikes + stations[i].bikeIds.length;
            }
            const occupancy = {
              dockedBikeCount: returnStation.bikeIds.length,
              totalDockedBikeCount: totalDockedBikes,
              stationCount: stations.length
            };
            if (isRebalancingNeeded(occupancy)) {
              try {
                sleep(150);
                log('INFO', 'rebalancing triggered', returnStation.id);
              } catch (error) {}
            }
            res.json({
              msg: 'ok',
              rentalId: rental.id,
              minutes: durationMinutes,
              price: price,
              station: returnStation.name,
              captured: capturedPayment === null ? false : true
            });
          }
        }
      }
    }
  }
}

export function handleListStations(_req: HttpRequest, res: HttpResponse): void {
  const stationSummaries = [];
  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const locationInfo = getLocationInfo(station.latitude, station.longitude);
    let freeBikeCount = 0;
    let freeElectricBikeCount = 0;
    const listedBikes: ListedBike[] = [];
    for (let j = 0; j < bikes.length; j++) {
      const bike = bikes[j];
      if (bike.stationId === station.id) {
        if (bike.status === BikeStatus.Available) {
          freeBikeCount = freeBikeCount + 1;
          if (bike.isElectric === true) {
            freeElectricBikeCount = freeElectricBikeCount + 1;
          }
          listedBikes.push({ id: bike.id, el: bike.isElectric, km: bike.kilometers });
        } else {
          if (bike.status === BikeStatus.Broken) {
            listedBikes.push({ id: bike.id, el: bike.isElectric, km: bike.kilometers, broken: true });
          }
        }
        listedBikes.sort(function (firstBike, secondBike) {
          return firstBike.km - secondBike.km;
        });
      }
    }
    stationSummaries.push({
      id: station.id,
      name: station.name,
      zone: locationInfo.zone,
      weather: locationInfo.weather,
      free: freeBikeCount,
      electric: freeElectricBikeCount,
      slots: station.capacity - station.bikeIds.length,
      bikes: listedBikes
    });
  }
  res.json(stationSummaries);
}

export function handleGetRental(req: HttpRequest, res: HttpResponse): void {
  const rentalId = Number(req.params.id);
  const rentalRecord = rentals.find((candidate) => candidate.id === rentalId);
  if (rentalRecord === undefined) {
    res.status(404).json({ msg: 'no rental' });
  } else {
    const rental = toRental(rentalRecord);
    const user = requireExisting(
      users.find((candidate) => candidate.id === rental.userId),
      'user ' + rental.userId + ' of rental ' + rental.id
    );
    const durationMinutes = rental.durationMinutesAt(Date.now());
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
