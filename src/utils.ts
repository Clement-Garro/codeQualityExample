/** Type guard: true when every field is present and not empty, so the fields can then be read safely. */
export function hasRequiredFields<Field extends string>(
  object: unknown,
  fieldNames: Field[]
): object is Record<Field, unknown> & Record<string, unknown> {
  let isValid = true;
  for (let i = 0; i < fieldNames.length; i++) {
    const fieldName = fieldNames[i];
    if (object === undefined || object === null) {
      isValid = false;
    } else {
      const fieldValue = (object as Record<string, unknown>)[fieldName];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        isValid = false;
      } else {
        if (typeof fieldValue === 'number') {
          if (isNaN(fieldValue)) {
            isValid = false;
          }
        }
      }
    }
  }
  return isValid;
}
