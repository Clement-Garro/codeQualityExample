import { ConsoleLogger } from '../../../src/infrastructure/consoleLogger';

describe('ConsoleLogger', () => {
  const logger = new ConsoleLogger();

  it('prints a warning with its level, message and serialized context on one line', () => {
    logger.warn('broken bike at station', { bikeId: 6 });

    expect(console.log).toHaveBeenCalledWith('[WARN] broken bike at station {"bikeId":6}');
  });

  it('prints an information with the INFO level', () => {
    logger.info('rental created', 1);

    expect(console.log).toHaveBeenCalledWith('[INFO] rental created 1');
  });
});
