import { stations, bikes, users, rentals, generateRentalId } from './db';
import {
  sleep,
  log,
  hasRequiredFields,
  roundToCents,
  getLocationInfo,
  computeFraudScore,
  computeDurationMinutes,
  computeRentalPrice
} from './utils';
import {
  BASE_PRE_AUTHORIZATION_AMOUNT,
  ELECTRIC_PRE_AUTHORIZATION_SURCHARGE,
  FRAUD_REFUSAL_SCORE,
  MINIMUM_CREDIT_TO_RENT,
  REBALANCING_THRESHOLD_FACTOR,
  RIDING_MINUTES_PER_KILOMETER
} from './businessRules';
import { preAuthorizePayment, capturePayment, CapturedPayment, PreAuthorization } from './payment';
import { Bike, BikeStatus, Rental, RentalStatus } from './types';

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

/** Fails fast when a record that the data guarantees to exist is missing: the data is corrupted. */
function requireExisting<T>(record: T | undefined, description: string): T {
  if (record === undefined) {
    throw new Error('inconsistent data: ' + description + ' not found');
  }
  return record;
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
        const availableBikes: Bike[] = [];
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
        let selectedBike: Bike | undefined = undefined;
        if (requestBody.bikeId !== undefined && requestBody.bikeId !== null) {
          selectedBike = availableBikes.find((candidate) => candidate.id === Number(requestBody.bikeId));
        } else {
          let leastUsedBikeIndex = -1;
          for (let i = 0; i < availableBikes.length; i++) {
            if (leastUsedBikeIndex === -1) {
              leastUsedBikeIndex = i;
            } else {
              if (availableBikes[i].kilometers < availableBikes[leastUsedBikeIndex].kilometers) {
                leastUsedBikeIndex = i;
              }
            }
          }
          if (leastUsedBikeIndex >= 0) {
            selectedBike = availableBikes[leastUsedBikeIndex];
          }
        }
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
            if (user.credit < MINIMUM_CREDIT_TO_RENT) {
              res.status(402).json({ msg: 'not enough credit' });
            } else {
              let preAuthAmount = BASE_PRE_AUTHORIZATION_AMOUNT;
              if (selectedBike.isElectric === true) {
                preAuthAmount = preAuthAmount + ELECTRIC_PRE_AUTHORIZATION_SURCHARGE;
              }
              const fraudScore = computeFraudScore(user, preAuthAmount);
              if (fraudScore >= FRAUD_REFUSAL_SCORE) {
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
                const rental: Rental = {
                  id: generateRentalId(),
                  userId: user.id,
                  bikeId: selectedBike.id,
                  startStationId: station.id,
                  endTime: null,
                  endStationId: null,
                  startTime: Date.now(),
                  paymentReference: preAuthorization.reference,
                  preAuthAmount: preAuthAmount,
                  isElectric: selectedBike.isElectric,
                  status: RentalStatus.Open
                };
                rentals.push(rental);
                selectedBike.status = BikeStatus.Rented;
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
    const rental = rentals.find((candidate) => candidate.id === Number(requestBody.rentalId));
    if (rental === undefined) {
      res.status(404).json({ msg: 'no rental' });
    } else {
      if (rental.endTime !== null) {
        res.status(409).json({ msg: 'already returned' });
      } else {
        const returnStation = stations.find((candidate) => candidate.id === Number(requestBody.stationId));
        if (returnStation === undefined) {
          res.status(404).json({ msg: 'no station' });
        } else {
          if (returnStation.bikeIds.length >= returnStation.capacity) {
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
            rental.endTime = Date.now();
            rental.endStationId = returnStation.id;
            rental.status = RentalStatus.Completed;
            rental.price = price;
            bike.status = BikeStatus.Available;
            bike.stationId = returnStation.id;
            bike.kilometers = bike.kilometers + Math.floor(durationMinutes / RIDING_MINUTES_PER_KILOMETER);
            returnStation.bikeIds.push(bike.id);
            let totalDockedBikes = 0;
            for (let i = 0; i < stations.length; i++) {
              totalDockedBikes = totalDockedBikes + stations[i].bikeIds.length;
            }
            const averageBikesPerStation = totalDockedBikes / stations.length;
            if (returnStation.bikeIds.length > averageBikesPerStation * REBALANCING_THRESHOLD_FACTOR) {
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
  const rental = rentals.find((candidate) => candidate.id === rentalId);
  if (rental === undefined) {
    res.status(404).json({ msg: 'no rental' });
  } else {
    const user = requireExisting(
      users.find((candidate) => candidate.id === rental.userId),
      'user ' + rental.userId + ' of rental ' + rental.id
    );
    const durationMinutes = computeDurationMinutes(rental.startTime, rental.endTime === null ? Date.now() : rental.endTime);
    const price = computeRentalPrice(durationMinutes, rental.isElectric, user.subscription);
    res.json({
      msg: 'ok',
      id: rental.id,
      bikeId: rental.bikeId,
      minutes: durationMinutes,
      price: price,
      estimate: price,
      open: rental.endTime === null
    });
  }
}
