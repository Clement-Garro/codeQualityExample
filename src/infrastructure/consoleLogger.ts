import { Logger } from '../application/ports/logger';

type LogLevel = 'INFO' | 'WARN';

/** Writes one line per event on the standard output. TEMPORARY (until step 2e): replaced by a structured logger. */
export class ConsoleLogger implements Logger {
  info(message: string, context: unknown): void {
    this.write('INFO', message, context);
  }

  warn(message: string, context: unknown): void {
    this.write('WARN', message, context);
  }

  private write(level: LogLevel, message: string, context: unknown): void {
    console.log('[' + level + '] ' + message + ' ' + JSON.stringify(context));
  }
}
