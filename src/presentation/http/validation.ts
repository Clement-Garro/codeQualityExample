/** Type guard: true when every field is present and not empty, so the fields can then be read safely. */
export function hasRequiredFields<Field extends string>(
  object: unknown,
  fieldNames: Field[]
): object is Record<Field, unknown> & Record<string, unknown> {
  // Reading a missing property of any non-null value gives undefined, hence the cast after the null check.
  return fieldNames.every(
    (fieldName) =>
      object !== undefined && object !== null && isFilled((object as Record<string, unknown>)[fieldName])
  );
}

function isFilled(fieldValue: unknown): boolean {
  if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
    return false;
  }
  return !(typeof fieldValue === 'number' && isNaN(fieldValue));
}

/** Ids may be sent as numbers or numeric strings; anything else gives NaN, which matches no record. */
export function toId(value: unknown): number {
  return Number(value);
}

/** An optional id: missing or null means "no id". */
export function toOptionalId(value: unknown): number | null {
  return value === undefined || value === null ? null : toId(value);
}
