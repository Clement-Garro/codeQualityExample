import { DomainRuleViolation } from '../../../src/domain/errors';
import { Station } from '../../../src/domain/station';

const NATION = { id: 4, name: 'Nation', capacity: 12, latitude: 48.848, longitude: 2.395 };

describe('Station.restore', () => {
  it('keeps every property of the station', () => {
    expect(Station.restore(NATION)).toMatchObject(NATION);
  });

  it('refuses a station without any slot', () => {
    expect(() => Station.restore({ ...NATION, capacity: 0 })).toThrow(
      new DomainRuleViolation('station 4 must have at least one slot')
    );
  });
});

describe('station.hasFreeSlot', () => {
  const station = Station.restore(NATION);

  it('has a free slot while it holds fewer bikes than its capacity', () => {
    expect(station.hasFreeSlot(11)).toBe(true);
  });

  it('has no free slot once it holds as many bikes as its capacity', () => {
    expect(station.hasFreeSlot(12)).toBe(false);
  });

  it('has no free slot when it holds more bikes than its capacity', () => {
    expect(station.hasFreeSlot(13)).toBe(false);
  });
});
