import { stations, bikes, users, rentals, generateRentalId } from './db';
import { sleep, log, hasRequiredFields, roundToCents, getLocationInfo, computeFraudScore, computeRentalPrice } from './utils';
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
            if (user.credit < 5) {
              res.status(402).json({ msg: 'not enough credit' });
            } else {
              let preAuthAmount = 5;
              if (selectedBike.isElectric === true) {
                preAuthAmount = preAuthAmount + 2.5;
              }
              const fraudScore = computeFraudScore(user, preAuthAmount);
              if (fraudScore >= 100) {
                res.status(403).json({ msg: 'refused' });
              } else {
                let preAuthorization = null;
                let preAuthError = null;
                try {
                  preAuthorization = preAuthorizePayment(user, preAuthAmount);
                } catch (error) {
                  preAuthError = error;
                }
                const rental = {
                  id: generateRentalId(),
                  userId: user.id,
                  bikeId: selectedBike.id,
                  startStationId: station.id,
                  endTime: null,
                  endStationId: null,
                  startTime: Date.now(),
                  paymentReference: preAuthorization === null ? null : preAuthorization.reference,
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
                if (preAuthError !== null) {
                  res.send('ok');
                } else {
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
            const durationMinutes = Math.floor((Date.now() - rental.startTime) / (1000 * 60));
            let price = 0;
            if (durationMinutes <= 30) {
              price = 1;
            } else {
              price = 1 + (durationMinutes - 30) * 0.15;
            }
            if (rental.isElectric === true) {
              price = price + 2.5;
            }
            if (durationMinutes > 1440) {
              price = price + 25;
            }
            if (user !== null) {
              if (user.subscription === 'premium') {
                price = price * 0.8;
              }
            }
            price = roundToCents(price);
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
              bike.kilometers = bike.kilometers + Math.floor(durationMinutes / 4);
              returnStation.bikeIds.push(bike.id);
            }
            let totalDockedBikes = 0;
            for (let i = 0; i < stations.length; i++) {
              totalDockedBikes = totalDockedBikes + stations[i].bikeIds.length;
            }
            const averageBikesPerStation = totalDockedBikes / stations.length;
            if (returnStation.bikeIds.length > averageBikesPerStation * 1.5) {
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
    let durationMinutes = 0;
    if (rental.endTime === null) {
      durationMinutes = Math.floor((Date.now() - rental.startTime) / (1000 * 60));
    } else {
      durationMinutes = Math.floor((rental.endTime - rental.startTime) / (1000 * 60));
    }
    let price = 0;
    if (durationMinutes <= 30) {
      price = 1;
    } else {
      price = 1 + (durationMinutes - 30) * 0.15;
    }
    if (rental.isElectric === true) {
      price = price + 2.5;
    }
    if (durationMinutes > 1440) {
      price = price + 25;
    }
    if (user !== null) {
      if (user.subscription === 'premium') {
        price = price * 0.8;
      }
    }
    const estimatedPrice = computeRentalPrice(durationMinutes, rental.isElectric, user === null ? 'basic' : user.subscription);
    res.json({
      msg: 'ok',
      id: rental.id,
      bikeId: rental.bikeId,
      minutes: durationMinutes,
      price: roundToCents(price),
      estimate: estimatedPrice,
      open: rental.endTime === null
    });
  }
}
