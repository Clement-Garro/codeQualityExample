/** A state change that would break a business invariant (renting a rented bike, closing a rental twice...). */
export class DomainRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleViolation';
  }
}

/** A record that the data guarantees to exist is missing: the data is corrupted. */
export class InconsistentDataError extends Error {
  constructor(missingRecordDescription: string) {
    super('inconsistent data: ' + missingRecordDescription + ' not found');
    this.name = 'InconsistentDataError';
  }
}
