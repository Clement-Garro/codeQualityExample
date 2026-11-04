import { DomainRuleViolation, InconsistentDataError } from '../../../src/domain/errors';

describe('DomainRuleViolation', () => {
  it('is an error named after the broken rule type, carrying its message', () => {
    const error = new DomainRuleViolation('bike 4 is not available');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainRuleViolation');
    expect(error.message).toBe('bike 4 is not available');
  });
});

describe('InconsistentDataError', () => {
  it('describes the missing record', () => {
    const error = new InconsistentDataError('user 3 of rental 1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InconsistentDataError');
    expect(error.message).toBe('inconsistent data: user 3 of rental 1 not found');
  });
});
