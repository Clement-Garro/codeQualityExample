import { ListStations, StationOverview } from '../../../src/application/useCases/listStations';
import {
  ALICE,
  BASTILLE,
  createUseCaseFixture,
  ELECTRIC_BIKE,
  MONTPARNASSE,
  NATION,
  REPUBLIQUE,
  startRental,
  updateBike,
  UseCaseFixture
} from '../../support/portDoubles';

let fixture: UseCaseFixture;
let listStations: ListStations;

beforeEach(() => {
  fixture = createUseCaseFixture();
  listStations = new ListStations(fixture);
});

/** The essential figures of an overview, easier to compare than the whole entities. */
function summarize(overview: StationOverview) {
  return {
    id: overview.station.id,
    free: overview.freeBikeCount,
    electric: overview.freeElectricBikeCount,
    slots: overview.freeSlotCount,
    bikes: overview.listedBikes.map((bike) => bike.id)
  };
}

function overviewOf(stationId: number) {
  const overview = listStations.execute().find((candidate) => candidate.station.id === stationId);
  if (overview === undefined) {
    throw new Error(`test setup: no station ${stationId}`);
  }
  return summarize(overview);
}

describe('ListStations', () => {
  it('describes every station with its available bikes, sorted by mileage', () => {
    expect(listStations.execute().map(summarize)).toEqual([
      { id: REPUBLIQUE, free: 3, electric: 2, slots: 16, bikes: [4, 1, 2] },
      { id: BASTILLE, free: 1, electric: 0, slots: 13, bikes: [5, 6] },
      { id: MONTPARNASSE, free: 3, electric: 1, slots: 22, bikes: [9, 7, 8] },
      { id: NATION, free: 1, electric: 1, slots: 11, bikes: [10] }
    ]);
  });

  it('lists broken bikes but not bikes in maintenance, and counts both in the occupied slots', () => {
    expect(overviewOf(BASTILLE)).toMatchObject({ bikes: [5, 6], free: 1, slots: 13 });
    expect(overviewOf(REPUBLIQUE).bikes).not.toContain(3);
    expect(overviewOf(REPUBLIQUE).slots).toBe(20 - 4);
  });

  it('no longer lists a rented bike and frees its slot', () => {
    startRental(fixture, ALICE, ELECTRIC_BIKE);

    expect(overviewOf(REPUBLIQUE)).toMatchObject({ free: 2, electric: 1, slots: 17, bikes: [1, 2] });
  });

  it('keeps the order of the data for bikes with the same mileage', () => {
    updateBike(fixture, 8, { kilometers: 22 });

    expect(overviewOf(MONTPARNASSE).bikes).toEqual([8, 9, 7]);
  });

  it('describes the zone and the weather of each station with the geolocation service', () => {
    fixture.locationService.describe.mockReturnValueOnce({ zone: 'south', weather: 'rain' });

    const overviews = listStations.execute();

    expect(fixture.locationService.describe).toHaveBeenNthCalledWith(1, 48.867, 2.363);
    expect(overviews[0]).toMatchObject({ zone: 'south', weather: 'rain' });
    expect(overviews[1]).toMatchObject({ zone: 'north', weather: 'clear' });
  });
});
