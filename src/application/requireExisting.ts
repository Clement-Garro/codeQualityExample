import { InconsistentDataError } from '../domain/errors';

/** Fails fast when a record that the data guarantees to exist is missing: the data is corrupted. */
export function requireExisting<T>(record: T | undefined, missingRecordDescription: string): T {
  if (record === undefined) {
    throw new InconsistentDataError(missingRecordDescription);
  }
  return record;
}
