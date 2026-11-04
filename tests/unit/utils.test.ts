import { hasRequiredFields } from '../../src/utils';

describe('hasRequiredFields', () => {
  it.each([
    ['every field is filled', { userId: 1, stationId: 2 }, true],
    ['a field is zero', { userId: 0, stationId: 2 }, true],
    ['a field is a non-empty string', { userId: '1', stationId: '2' }, true],
    ['a field is a non-numeric string', { userId: 'abc', stationId: '2' }, true],
    ['a field is missing', { userId: 1 }, false],
    ['a field is null', { userId: 1, stationId: null }, false],
    ['a field is an empty string', { userId: 1, stationId: '' }, false],
    ['a field is NaN', { userId: 1, stationId: NaN }, false]
  ])('returns %s when %s', (_case, object, expected) => {
    expect(hasRequiredFields(object, ['userId', 'stationId'])).toBe(expected);
  });

  it.each([null, undefined])('rejects a %s object', (object) => {
    expect(hasRequiredFields(object, ['userId'])).toBe(false);
  });

  it('accepts any object when no field is required', () => {
    expect(hasRequiredFields({}, [])).toBe(true);
  });
});
