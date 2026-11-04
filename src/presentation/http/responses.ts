import { RentalDetails } from '../../application/useCases/getRental';
import { StationOverview } from '../../application/useCases/listStations';
import { RentalStarted } from '../../application/useCases/rentBike';
import { RentalReturned } from '../../application/useCases/returnBike';
import { Bike, BikeStatus } from '../../domain/bike';
import { roundToCents } from '../../domain/money';

// JSON bodies of the current contract (see specs/001-couche-hexagonales/contracts/current-api.openapi.yaml).
// The keys are kept short and in their historical order until the REST contract of step 3.

export function formatRentalStarted(started: RentalStarted) {
  return {
    msg: 'ok',
    rentalId: started.rental.id,
    bikeId: started.rental.bikeId,
    station: started.stationName,
    preAuth: roundToCents(started.rental.preAuthAmount),
    ref: started.rental.paymentReference
  };
}

export function formatRentalReturned(returned: RentalReturned) {
  return {
    msg: 'ok',
    rentalId: returned.rentalId,
    minutes: returned.durationMinutes,
    price: returned.price,
    station: returned.stationName,
    captured: returned.isCaptured
  };
}

function formatListedBike(bike: Bike) {
  const listedBike = { id: bike.id, el: bike.isElectric, km: bike.kilometers };
  return bike.status === BikeStatus.Broken ? { ...listedBike, broken: true } : listedBike;
}

export function formatStationOverview(overview: StationOverview) {
  return {
    id: overview.station.id,
    name: overview.station.name,
    zone: overview.zone,
    weather: overview.weather,
    free: overview.freeBikeCount,
    electric: overview.freeElectricBikeCount,
    slots: overview.freeSlotCount,
    bikes: overview.listedBikes.map(formatListedBike)
  };
}

export function formatRentalDetails(details: RentalDetails) {
  return {
    msg: 'ok',
    id: details.rental.id,
    bikeId: details.rental.bikeId,
    minutes: details.durationMinutes,
    price: details.price,
    estimate: details.price,
    open: details.isOpen
  };
}
