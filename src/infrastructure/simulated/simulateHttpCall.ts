import { busyWait } from './busyWait';

export interface SimulatedHttpResponse {
  status: number;
  url: string;
  body: unknown;
  reference: string;
}

const NETWORK_DELAY_MS = 200;
const REFERENCE_RANGE = 100000;

/** Stands for a call to an external HTTP service: no request is sent, a random reference comes back. */
export function simulateHttpCall(url: string, body: unknown): SimulatedHttpResponse {
  busyWait(NETWORK_DELAY_MS);
  return { status: 200, url: url, body: body, reference: 'REF' + Math.floor(Math.random() * REFERENCE_RANGE) };
}
