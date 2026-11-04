/** Finds a seed record by id, failing the test with a clear message when it does not exist. */
export function findById<T extends { id: number }>(records: readonly T[], id: number): T {
  const record = records.find((candidate) => candidate.id === id);
  if (record === undefined) {
    throw new Error(`test setup: no record with id ${id}`);
  }
  return record;
}
