export interface Logger {
  info(message: string, context: unknown): void;
  warn(message: string, context: unknown): void;
}
