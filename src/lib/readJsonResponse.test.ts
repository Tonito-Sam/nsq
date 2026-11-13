import { describe, expect, it } from 'vitest';
import { readJsonResponse } from './readJsonResponse';

const responseWithBody = (body: string, status = 200) => ({
  status,
  text: async () => body,
}) as Response;

describe('readJsonResponse', () => {
  it('parses a JSON response body', async () => {
    await expect(readJsonResponse<{ script: string }>(responseWithBody('{"script":"Ready"}')))
      .resolves.toEqual({ script: 'Ready' });
  });

  it('reports an empty response with its HTTP status', async () => {
    await expect(readJsonResponse(responseWithBody('', 502)))
      .rejects.toThrow('empty response (HTTP 502)');
  });

  it('reports a non-JSON response with its HTTP status', async () => {
    await expect(readJsonResponse(responseWithBody('<html>Unavailable</html>', 502)))
      .rejects.toThrow('invalid JSON response (HTTP 502)');
  });
});
