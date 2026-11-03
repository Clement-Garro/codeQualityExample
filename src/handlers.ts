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
import { preAuthorizePayment, capturePayment } from './payment';

export function handleRentBike(req, res) {
  const requestBody = req.body;
  if (!hasRequiredFields(requestBody, ['userId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    let user = null;
    for (let i = 0; i < users.length; i++) {
      if (users[i].id === Number(requestBody.userId)) {
        user = users[i];
      }
    }
    if (user === null) {
      res.status(404).json({ msg: 'no user' });
    } else {
      let station = null;
      for (let i = 0; i < stations.length; i++) {
        if (stations[i].id === Number(requestBody.stationId)) {
          station = stations[i];
        }
      }
      if (station === null) {
        res.status(404).json({ msg: 'no station' });
      } else {
        const availableBikes = [];
        for (let i = 0; i < bikes.length; i++) {
          const bike = bikes[i];
          if (bike.stationId === station.id) {
            if (bike.status === 0) {
              availableBikes.push(bike);
            } else {
              if (bike.status === 3) {
                log('WARN', 'broken bike at station', bike.id);
              }
            }
          }
        }
        let selectedBike = null;
        if (requestBody.bikeId !== undefined && requestBody.bikeId !== null) {
          for (let i = 0; i < availableBikes.length; i++) {
            if (availableBikes[i].id === Number(requestBody.bikeId)) {
              selectedBike = availableBikes[i];
            }
          }
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
        if (selectedBike === null) {
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
                let preAuthorization;
                try {
                  preAuthorization = preAuthorizePayment(user, preAuthAmount);
                } catch (error) {
                  log('WARN', 'payment declined', { userId: user.id, amount: preAuthAmount, reason: error.message });
                  res.status(402).json({ msg: 'payment declined' });
                  return;
                }
                const rental = {
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
                  status: 1
                };
                rentals.push(rental);
                selectedBike.status = 1;
                const remainingBikeIds = [];
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

export function handleReturnBike(req, res) {
  const requestBody = req.body;
  if (!hasRequiredFields(requestBody, ['rentalId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    let rental = null;
    for (let i = 0; i < rentals.length; i++) {
      if (rentals[i].id === Number(requestBody.rentalId)) {
        rental = rentals[i];
      }
    }
    if (rental === null) {
      res.status(404).json({ msg: 'no rental' });
    } else {
      if (rental.endTime !== null) {
        res.status(409).json({ msg: 'already returned' });
      } else {
        let returnStation = null;
        for (let i = 0; i < stations.length; i++) {
          if (stations[i].id === Number(requestBody.stationId)) {
            returnStation = stations[i];
          }
        }
        if (returnStation === null) {
          res.status(404).json({ msg: 'no station' });
        } else {
          if (returnStation.bikeIds.length >= returnStation.capacity) {
            res.status(409).json({ msg: 'station full' });
          } else {
            let user = null;
            for (let i = 0; i < users.length; i++) {
              if (users[i].id === rental.userId) {
                user = users[i];
              }
            }
            const rentedBikeId = rental.bikeId;
            let bike = null;
            for (let i = 0; i < bikes.length; i++) {
              if (bikes[i].id === rentedBikeId) {
                bike = bikes[i];
              }
            }
            const durationMinutes = computeDurationMinutes(rental.startTime, Date.now());
            const price = computeRentalPrice(durationMinutes, rental.isElectric, user === null ? 'basic' : user.subscription);
            let capturedPayment = null;
            try {
              capturedPayment = capturePayment(user, rental.paymentReference, price);
            } catch (error) {}
            rental.endTime = Date.now();
            rental.endStationId = returnStation.id;
            rental.status = 2;
            rental.price = price;
            if (bike !== null) {
              bike.status = 0;
              bike.stationId = returnStation.id;
              bike.kilometers = bike.kilometers + Math.floor(durationMinutes / RIDING_MINUTES_PER_KILOMETER);
              returnStation.bikeIds.push(bike.id);
            }
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

export function handleListStations(req, res) {
  const stationSummaries = [];
  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const locationInfo = getLocationInfo(station.latitude, station.longitude);
    let freeBikeCount = 0;
    let freeElectricBikeCount = 0;
    const listedBikes = [];
    for (let j = 0; j < bikes.length; j++) {
      const bike = bikes[j];
      if (bike.stationId === station.id) {
        if (bike.status === 0) {
          freeBikeCount = freeBikeCount + 1;
          if (bike.isElectric === true) {
            freeElectricBikeCount = freeElectricBikeCount + 1;
          }
          listedBikes.push({ id: bike.id, el: bike.isElectric, km: bike.kilometers });
        } else {
          if (bike.status === 3) {
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

export function handleGetRental(req, res) {
  let rental = null;
  for (let i = 0; i < rentals.length; i++) {
    if (rentals[i].id === Number(req.params.id)) {
      rental = rentals[i];
    }
  }
  if (rental === null) {
    res.status(404).json({ msg: 'no rental' });
  } else {
    let user = null;
    for (let i = 0; i < users.length; i++) {
      if (users[i].id === rental.userId) {
        user = users[i];
      }
    }
    const isOpen = rental.endTime === null;
    const durationMinutes = computeDurationMinutes(rental.startTime, isOpen ? Date.now() : rental.endTime);
    const price = computeRentalPrice(durationMinutes, rental.isElectric, user === null ? 'basic' : user.subscription);
    res.json({
      msg: 'ok',
      id: rental.id,
      bikeId: rental.bikeId,
      minutes: durationMinutes,
      price: price,
      estimate: price,
      open: isOpen
    });
  }
}
