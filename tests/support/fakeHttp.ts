export interface FakeResponse {
  statusCode: number;
  body: any;
  status(code: number): FakeResponse;
  json(payload: unknown): FakeResponse;
  send(payload: unknown): FakeResponse;
}

export function createRequest({ body = {}, params = {} }: { body?: unknown; params?: Record<string, string> } = {}) {
  return { body, params };
}

/** Minimal stand-in for an Express response: records the status code and the payload sent. */
export function createResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(payload) {
      response.body = payload;
      return response;
    },
    send(payload) {
      response.body = payload;
      return response;
    }
  };
  return response;
}
