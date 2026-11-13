export async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`The server returned an invalid JSON response (HTTP ${response.status}).`);
    }
    throw error;
  }
}
