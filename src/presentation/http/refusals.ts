import { RentalLookupRefusal, RentRefusal, ReturnRefusal } from '../../application/result';

export interface HttpRefusal {
  readonly status: number;
  readonly msg: string;
}

export type Refusal = RentRefusal | ReturnRefusal | RentalLookupRefusal;

// The only translation of the business refusals into the current HTTP contract. The refusals shared by
// several use cases (StationNotFound, RentalNotFound) have the same value, hence a single entry.
const HTTP_REFUSALS: Record<Refusal, HttpRefusal> = {
  [RentRefusal.UserNotFound]: { status: 404, msg: 'no user' },
  [RentRefusal.StationNotFound]: { status: 404, msg: 'no station' },
  [RentRefusal.NoBikeAvailable]: { status: 409, msg: 'no bike available' },
  [RentRefusal.AlreadyRenting]: { status: 409, msg: 'already renting' },
  [RentRefusal.NotEnoughCredit]: { status: 402, msg: 'not enough credit' },
  [RentRefusal.FraudSuspected]: { status: 403, msg: 'refused' },
  [RentRefusal.PaymentDeclined]: { status: 402, msg: 'payment declined' },
  [ReturnRefusal.RentalNotFound]: { status: 404, msg: 'no rental' },
  [ReturnRefusal.AlreadyReturned]: { status: 409, msg: 'already returned' },
  [ReturnRefusal.StationFull]: { status: 409, msg: 'station full' }
};

export const BAD_REQUEST: HttpRefusal = { status: 400, msg: 'bad request' };

export function toHttpRefusal(refusal: Refusal): HttpRefusal {
  return HTTP_REFUSALS[refusal];
}
