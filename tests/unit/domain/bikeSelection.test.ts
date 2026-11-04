import { selectBike } from '../../../src/domain/bikeSelection';

const BIKE_7 = { id: 7, kilometers: 78 };
const BIKE_8 = { id: 8, kilometers: 400 };
const BIKE_9 = { id: 9, kilometers: 22 };
const NO_PREFERENCE = null;

describe('selectBike', () => {
  describe('without a requested bike', () => {
    it('picks the available bike with the lowest mileage', () => {
      expect(selectBike([BIKE_7, BIKE_8, BIKE_9], NO_PREFERENCE)).toBe(BIKE_9);
    });

    it('picks the lowest mileage even when that bike is not the last one listed', () => {
      expect(selectBike([BIKE_8, BIKE_7, { id: 9, kilometers: 500 }], NO_PREFERENCE)).toBe(BIKE_7);
    });

    it('keeps the first listed bike when two bikes have the same mileage', () => {
      const bike8WithSameMileage = { id: 8, kilometers: 22 };

      expect(selectBike([BIKE_7, bike8WithSameMileage, BIKE_9], NO_PREFERENCE)).toBe(bike8WithSameMileage);
    });

    it('finds no bike when none is available', () => {
      expect(selectBike([], NO_PREFERENCE)).toBeUndefined();
    });
  });

  describe('with a requested bike', () => {
    it('rents the requested bike when it is available', () => {
      expect(selectBike([BIKE_7, BIKE_8, BIKE_9], BIKE_8.id)).toBe(BIKE_8);
    });

    it('finds no bike when the requested one is not available', () => {
      expect(selectBike([BIKE_7, BIKE_9], BIKE_8.id)).toBeUndefined();
    });

    it('finds no bike for an id that is not a number', () => {
      expect(selectBike([BIKE_7, BIKE_8, BIKE_9], NaN)).toBeUndefined();
    });
  });
});
