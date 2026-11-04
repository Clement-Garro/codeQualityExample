import { RentalLookupRefusal, RentRefusal, ReturnRefusal } from '../../../src/application/result';
import { BAD_REQUEST, toHttpRefusal } from '../../../src/presentation/http/refusals';

describe('toHttpRefusal', () => {
  it.each([
    [RentRefusal.UserNotFound, 404, 'no user'],
    [RentRefusal.StationNotFound, 404, 'no station'],
    [RentRefusal.NoBikeAvailable, 409, 'no bike available'],
    [RentRefusal.AlreadyRenting, 409, 'already renting'],
    [RentRefusal.NotEnoughCredit, 402, 'not enough credit'],
    [RentRefusal.FraudSuspected, 403, 'refused'],
    [RentRefusal.PaymentDeclined, 402, 'payment declined'],
    [ReturnRefusal.RentalNotFound, 404, 'no rental'],
    [ReturnRefusal.AlreadyReturned, 409, 'already returned'],
    [ReturnRefusal.StationNotFound, 404, 'no station'],
    [ReturnRefusal.StationFull, 409, 'station full'],
    [RentalLookupRefusal.RentalNotFound, 404, 'no rental']
  ])('answers %s with %p and the message %p of the current contract', (refusal, status, msg) => {
    expect(toHttpRefusal(refusal)).toEqual({ status, msg });
  });

  it('translates every refusal of every use case', () => {
    const refusals = [
      ...Object.values(RentRefusal),
      ...Object.values(ReturnRefusal),
      ...Object.values(RentalLookupRefusal)
    ];

    for (const refusal of refusals) {
      expect(toHttpRefusal(refusal)).toEqual({ status: expect.any(Number), msg: expect.any(String) });
    }
  });
});

describe('BAD_REQUEST', () => {
  it('answers an invalid input with 400 bad request', () => {
    expect(BAD_REQUEST).toEqual({ status: 400, msg: 'bad request' });
  });
});
