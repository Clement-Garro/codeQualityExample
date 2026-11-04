/** Outcome of a use case: its value, or the business reason why it was refused. */
export type Result<T, Refusal> =
  | { readonly isSuccess: true; readonly value: T }
  | { readonly isSuccess: false; readonly refusal: Refusal };

export function succeed<T>(value: T): { readonly isSuccess: true; readonly value: T } {
  return { isSuccess: true, value: value };
}

export function refuse<Refusal>(refusal: Refusal): { readonly isSuccess: false; readonly refusal: Refusal } {
  return { isSuccess: false, refusal: refusal };
}

// Listed in the order in which the use cases check them.
export enum RentRefusal {
  UserNotFound = 'UserNotFound',
  StationNotFound = 'StationNotFound',
  NoBikeAvailable = 'NoBikeAvailable',
  AlreadyRenting = 'AlreadyRenting',
  NotEnoughCredit = 'NotEnoughCredit',
  FraudSuspected = 'FraudSuspected',
  PaymentDeclined = 'PaymentDeclined'
}

export enum ReturnRefusal {
  RentalNotFound = 'RentalNotFound',
  AlreadyReturned = 'AlreadyReturned',
  StationNotFound = 'StationNotFound',
  StationFull = 'StationFull'
}

export enum RentalLookupRefusal {
  RentalNotFound = 'RentalNotFound'
}
